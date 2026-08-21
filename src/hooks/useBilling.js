import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

const PAGE_SIZE = 1000;

export function useBilling(currentUser) {
  const [restaurantProfiles, setRestaurantProfiles] = useState({});
  const [bills, setBills] = useState([]);
  const [loadingBilling, setLoadingBilling] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/db?table=restaurants');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const map = {};
          data.forEach(r => { map[r.name] = r; });
          setRestaurantProfiles(map);
          return;
        }
      }
    } catch (e) {
      console.warn('API DB proxy fetch error, falling back to Supabase client', e);
    }
    const { data, error } = await supabase.from('restaurants').select('*');
    if (error) {
      console.error('Error fetching restaurant profiles', error);
      return;
    }
    const map = {};
    (data || []).forEach(r => { map[r.name] = r; });
    setRestaurantProfiles(map);
  }, []);

  const fetchBills = useCallback(async () => {
    try {
      const res = await fetch('/api/db?table=bills&order=id&asc=false');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setBills(data);
          return;
        }
      }
    } catch (e) {
      console.warn('API DB proxy fetch bills error, falling back to Supabase client', e);
    }
    try {
      let all = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('bills')
          .select('*')
          .order('id', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setBills(all);
    } catch (err) {
      console.error('Error fetching bills:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchBills()]).finally(() => setLoadingBilling(false));
  }, [fetchProfiles, fetchBills]);

  // Shown to the user as a suggestion/placeholder only — the DB sequence is the real,
  // concurrency-safe source of truth for the actual assigned number (see createBill below).
  const nextSuggestedInvoiceNo = useMemo(() => {
    let maxNo = 0;
    bills.forEach(b => {
      const num = parseInt(b.invoice_no || b.legacy_invoice_no, 10);
      if (!isNaN(num) && num > maxNo) maxNo = num;
    });
    return maxNo > 0 ? maxNo + 1 : 3499;
  }, [bills]);

  const saveRestaurantProfile = async (name, { mobile, gst_num, address }) => {
    const { error } = await supabase
      .from('restaurants')
      .upsert({ name, mobile, gst_num, address }, { onConflict: 'name' });
    if (error) {
      console.error('Error saving restaurant profile', error);
      throw error;
    }
    await fetchProfiles();
  };

  const createBill = async (billData) => {
    // Clean up payload so only existing columns are sent to 'bills' table
    const { restaurant_id, ...cleanBillData } = billData;
    const payload = { ...cleanBillData, created_by: currentUser };

    if (payload.invoice_no) {
      payload.invoice_no = parseInt(payload.invoice_no, 10);
    } else {
      delete payload.invoice_no;
    }

    const { data, error } = await supabase
      .from('bills')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating bill', error);
      throw error;
    }

    // --- AUTO-LINKED INVENTORY & ENTRY OPERATIONS ---
    const targetRestName = billData.restaurant_name;

    // 1. Stock Deduction in `items` catalog table
    if (Array.isArray(billData.items)) {
      for (const lineItem of billData.items) {
        if (lineItem.item_id && lineItem.qty) {
          const { data: itemData } = await supabase
            .from('items')
            .select('current_stock')
            .eq('id', lineItem.item_id)
            .single();
          if (itemData) {
            const newStock = Math.max(0, (itemData.current_stock || 0) - parseInt(lineItem.qty, 10));
            await supabase.from('items').update({ current_stock: newStock }).eq('id', lineItem.item_id);
          }
        }
      }
    }

    // 2. Auto Delivery Entry Creation in `entries` table for Cylinder Delivery Counts & Calendar Log
    if (Array.isArray(billData.items)) {
      // Dynamically fetch latest active batch number from batches table
      const { data: latestBatchData } = await supabase
        .from('batches')
        .select('batch_num')
        .order('batch_num', { ascending: false })
        .limit(1)
        .single();
      const currentBatchNum = latestBatchData?.batch_num || 132;

      for (const lineItem of billData.items) {
        const desc = (lineItem.description || '').toLowerCase();
        let deliveryType = null;
        if (desc.includes('19.2')) {
          deliveryType = '19.2kg-delivery';
        } else if (desc.includes('21')) {
          deliveryType = '21kg-delivery';
        }

        if (deliveryType && lineItem.qty > 0) {
          await supabase.from('entries').insert([{
            name: targetRestName,
            type: deliveryType,
            qty: parseInt(lineItem.qty, 10),
            date: billData.bill_date || new Date().toISOString().slice(0, 10),
            batch_num: currentBatchNum,
            is_return: false,
            user_name: currentUser
          }]);
        }
      }
    }

    await fetchBills();
    return data;
  };

  const deleteBill = async (id, onDeliveryRemoved) => {
    // 1. Fetch bill details before deletion to restore stock & clean auto delivery entries
    const { data: billData } = await supabase.from('bills').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) {
      console.error('Error deleting bill', error);
      throw error;
    }

    if (billData) {
      // 2. Restore stock in `items` catalog table
      if (Array.isArray(billData.items)) {
        for (const lineItem of billData.items) {
          if (lineItem.item_id && lineItem.qty) {
            const { data: itemData } = await supabase
              .from('items')
              .select('current_stock')
              .eq('id', lineItem.item_id)
              .single();
            if (itemData) {
              const restoredStock = (itemData.current_stock || 0) + parseInt(lineItem.qty, 10);
              await supabase.from('items').update({ current_stock: restoredStock }).eq('id', lineItem.item_id);
            }
          }
        }
      }

      // 3. Remove auto delivery entries from `entries` table
      if (billData.restaurant_name) {
        await supabase
          .from('entries')
          .delete()
          .ilike('name', billData.restaurant_name.trim())
          .eq('date', billData.bill_date)
          .eq('is_return', false);
      }

      if (onDeliveryRemoved) {
        onDeliveryRemoved(billData.restaurant_name, billData.bill_date);
      }
    }

    await fetchBills();
  };

  const updateBillStatus = async (id, updateFields) => {
    const { error } = await supabase.from('bills').update(updateFields).eq('id', id);
    if (error) {
      console.error('Error updating bill status', error);
      throw error;
    }
    await fetchBills();
  };

  const recordBillPayment = async ({ billId, amount, paymentMode, note, paymentDate }) => {
    const { data, error } = await supabase.rpc('record_bill_payment', {
      p_bill_id: billId,
      p_amount: Number(amount),
      p_payment_mode: paymentMode,
      p_note: note || null,
      p_payment_date: paymentDate,
      p_user_name: currentUser
    });
    if (error) {
      console.error('Error recording bill payment', error);
      throw error;
    }
    await fetchBills();
    return data;
  };

  return {
    restaurantProfiles,
    bills,
    loadingBilling,
    nextSuggestedInvoiceNo,
    saveRestaurantProfile,
    createBill,
    deleteBill,
    updateBillStatus,
    recordBillPayment,
    refetchBills: fetchBills
  };
}
