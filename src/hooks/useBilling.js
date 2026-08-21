import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

const PAGE_SIZE = 1000;

export function useBilling(currentUser, onAddDeliveryEntry, onRemoveDeliveryEntry) {
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

  const saveRestaurantProfile = async (name, { mobile, gst_num, address, previous_balance }) => {
    const payload = {
      name,
      mobile: mobile ? mobile.trim() : null,
      gst_num: (gst_num && gst_num.trim()) ? gst_num.trim().toUpperCase() : null,
      address: (address && address.trim()) ? address.trim() : null
    };
    if (previous_balance !== undefined && previous_balance !== null && previous_balance !== '') {
      payload.previous_balance = parseFloat(previous_balance) || 0;
    }

    // Optimistically update React state immediately
    setRestaurantProfiles(prev => {
      const next = { ...prev };
      next[name] = { ...(next[name] || {}), ...payload };
      next[name.toLowerCase()] = { ...(next[name.toLowerCase()] || {}), ...payload };
      return next;
    });

    try {
      await fetch('/api/db?table=restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('API db fallback', e);
    }

    try {
      await supabase
        .from('restaurants')
        .upsert(payload, { onConflict: 'name' });
    } catch (err) {
      console.warn('Supabase upsert restaurant fallback', err);
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

    let savedBill = null;
    try {
      const res = await fetch('/api/db?table=bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        savedBill = Array.isArray(result) ? result[0] : result;
      }
    } catch (e) {
      console.warn('API db fallback for bill insert', e);
    }

    if (!savedBill) {
      const { data, error } = await supabase
        .from('bills')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Error creating bill', error);
        throw error;
      }
      savedBill = data;
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
          const qtyNum = parseInt(lineItem.qty, 10);
          if (typeof onAddDeliveryEntry === 'function') {
            onAddDeliveryEntry(
              targetRestName,
              qtyNum,
              deliveryType,
              billData.bill_date || new Date().toISOString().slice(0, 10),
              currentBatchNum
            );
          } else {
            await supabase.from('entries').insert([{
              name: targetRestName,
              type: deliveryType,
              qty: qtyNum,
              date: billData.bill_date || new Date().toISOString().slice(0, 10),
              batch_num: currentBatchNum,
              is_return: false,
              user_name: currentUser
            }]);
          }
        }
      }
    }

    await fetchBills();
    return savedBill;
  };

  const deleteBill = async (id, onDeliveryRemoved) => {
    // 1. Fetch bill details before deletion to restore stock & clean auto delivery entries
    let billData = (bills || []).find(b => b.id === id);
    if (!billData) {
      const { data } = await supabase.from('bills').select('*').eq('id', id).single();
      billData = data;
    }
    
    try {
      await fetch(`/api/db?table=bills&id=${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API DB delete fallback', e);
    }
    await supabase.from('bills').delete().eq('id', id);

    // Optimistically update bills state so UI updates instantly
    setBills(prev => prev.filter(b => b.id !== id));

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

      // 3. Remove auto delivery entries from `entries` table in Supabase
      if (billData.restaurant_name) {
        const dDate = billData.bill_date || '';
        try {
          const { data: matchedEntries } = await supabase
            .from('entries')
            .select('id')
            .ilike('name', billData.restaurant_name.trim())
            .eq('date', dDate)
            .eq('is_return', false);
          if (matchedEntries && matchedEntries.length > 0) {
            for (const me of matchedEntries) {
              await fetch(`/api/db?table=entries&id=${me.id}`, { method: 'DELETE' }).catch(() => null);
            }
          }
        } catch (e) {
          console.warn('Entries cleanup API fallback', e);
        }
        await supabase
          .from('entries')
          .delete()
          .ilike('name', billData.restaurant_name.trim())
          .eq('date', dDate)
          .eq('is_return', false);
      }

      // 4. Remove auto delivery entries from React memory state (Batches, Calendar, Live Holding)
      const removeCallback = onDeliveryRemoved || onRemoveDeliveryEntry;
      if (typeof removeCallback === 'function') {
        removeCallback(billData.restaurant_name, billData.bill_date);
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
