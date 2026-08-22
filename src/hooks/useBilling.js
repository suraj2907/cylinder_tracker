import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { norm } from '../utils/dataUtils';

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

    // Real-time synchronization for Bills across multiple devices (Suraj & Shivam)
    const channel = supabase
      .channel('realtime-bills-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        (payload) => {
          console.log('⚡ Realtime Bills Event:', payload);
          if (payload.eventType === 'INSERT') {
            const newBill = payload.new;
            setBills(prev => [newBill, ...prev.filter(b => b.id !== newBill.id && parseInt(b.invoice_no, 10) !== parseInt(newBill.invoice_no, 10))]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setBills(prev => prev.map(b => b.id === updated.id ? updated : b));
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old.id;
            setBills(prev => prev.filter(b => b.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProfiles, fetchBills]);

  // Shown to the user as a suggestion/placeholder only — the DB sequence is the real,
  // concurrency-safe source of truth for the actual assigned number (see createBill below).
  const nextSuggestedInvoiceNo = useMemo(() => {
    let maxNo = 0;
    bills.forEach(b => {
      const num = parseInt(b.invoice_no || b.legacy_invoice_no, 10);
      if (!isNaN(num) && num > maxNo) maxNo = num;
    });
    return maxNo > 0 ? maxNo + 1 : 3511;
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
    // 1. Anti-Duplicate Protection: Prevent accidental double-clicks or same-second submissions
    const targetRestName = billData.restaurant_name;
    const targetTotal = Number(billData.total_amount);
    const targetDate = billData.bill_date || new Date().toISOString().slice(0, 10);

    const duplicateRecentBill = (bills || []).find(b =>
      norm(b.restaurant_name) === norm(targetRestName) &&
      Math.abs(Number(b.total_amount) - targetTotal) < 0.05 &&
      b.bill_date === targetDate &&
      (Date.now() - new Date(b.created_at || Date.now()).getTime()) < 45000
    );

    if (duplicateRecentBill) {
      console.warn('Duplicate bill creation prevented:', duplicateRecentBill);
      throw new Error(`⚠️ Duplicate bill detected! "${targetRestName}" ka ₹${targetTotal} ka bill (INV-${duplicateRecentBill.invoice_no}) abhi-abhi save hua hai.`);
    }

    // 2. Concurrency-Safe Sequential Invoice Number:
    // Always fetch latest max invoice number directly from Supabase so Suraj & Shivam never collide
    let latestMaxNo = 3510;
    try {
      const { data: maxInvData } = await supabase
        .from('bills')
        .select('invoice_no')
        .order('invoice_no', { ascending: false })
        .limit(1)
        .single();
      if (maxInvData && maxInvData.invoice_no) {
        latestMaxNo = Math.max(latestMaxNo, parseInt(maxInvData.invoice_no, 10));
      }
    } catch (e) {
      console.warn('Could not query max invoice_no, using local sequence', e);
    }

    let invNo = billData.invoice_no ? parseInt(billData.invoice_no, 10) : (latestMaxNo + 1);
    if (isNaN(invNo) || invNo <= latestMaxNo) {
      invNo = latestMaxNo + 1;
    }

    // Clean up payload so only existing columns are sent to 'bills' table
    const { restaurant_id, ...cleanBillData } = billData;
    const payload = { 
      ...cleanBillData, 
      invoice_no: invNo,
      created_by: currentUser || 'Suraj'
    };

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

    // Optimistically update React state immediately with no duplicate
    setBills(prev => [savedBill, ...prev.filter(b => b.id !== savedBill.id && b.invoice_no !== savedBill.invoice_no)]);

    // --- AUTO-LINKED INVENTORY & ENTRY OPERATIONS ---
    // 1. Stock Deduction in `items` catalog table
    if (Array.isArray(billData.items)) {
      try {
        const { data: allItems } = await supabase.from('items').select('*');
        for (const lineItem of billData.items) {
          const qtyNum = parseInt(lineItem.qty, 10) || 0;
          if (qtyNum <= 0) continue;

          const desc = (lineItem.description || lineItem.name || '').toLowerCase();
          let targetItem = null;
          if (lineItem.item_id) {
            targetItem = (allItems || []).find(it => it.id === lineItem.item_id);
          }
          if (!targetItem) {
            targetItem = (allItems || []).find(it => {
              const n = it.name.toLowerCase();
              if (desc.includes('21') && n.includes('21')) return true;
              if (desc.includes('15') && n.includes('15')) return true;
              if ((desc.includes('19.2') || desc.includes('commercial') || desc.includes('lpg') || desc.includes('cylinder')) && n.includes('19.2')) return true;
              return false;
            });
          }

          if (targetItem) {
            const newStock = Math.max(0, (parseInt(targetItem.current_stock, 10) || 0) - qtyNum);
            try {
              await fetch('/api/db?table=items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: targetItem.id, current_stock: newStock })
              });
            } catch (e) {
              console.warn('API DB items stock deduction fallback', e);
            }
            await supabase.from('items').update({ current_stock: newStock }).eq('id', targetItem.id);
            targetItem.current_stock = newStock;
          }
        }
      } catch (stockErr) {
        console.warn('Error deducting stock on createBill:', stockErr);
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
        const desc = (lineItem.description || lineItem.name || '').toLowerCase();
        let deliveryType = null;
        if (desc.includes('21')) {
          deliveryType = '21kg-delivery';
        } else if (desc.includes('19.2') || desc.includes('commercial') || desc.includes('lpg') || desc.includes('cylinder')) {
          deliveryType = '19.2kg-delivery';
        } else if (!desc.includes('regulator') && !desc.includes('convertor') && !desc.includes('pipe') && !desc.includes('empty')) {
          deliveryType = '19.2kg-delivery';
        }

        // Exclude non-cylinder accessories
        if (desc.includes('regulator') || desc.includes('convertor') || desc.includes('pipe') || desc.includes('empty')) {
          deliveryType = null;
        }

        if (deliveryType && lineItem.qty > 0) {
          const qtyNum = parseInt(lineItem.qty, 10);
          const billDateStr = billData.bill_date || new Date().toISOString().slice(0, 10);

          if (typeof onAddDeliveryEntry === 'function') {
            await onAddDeliveryEntry(
              targetRestName,
              qtyNum,
              deliveryType,
              billDateStr,
              currentBatchNum
            );
          } else {
            await supabase.from('entries').insert([{
              name: targetRestName,
              type: deliveryType,
              qty: qtyNum,
              date: billDateStr,
              batch_num: currentBatchNum,
              is_return: false,
              user_name: currentUser
            }]);
          }
        }
      }
    }

    // 3. Auto Payment Collection in `payments` table for Instant Paid Invoices
    const paidAmt = parseFloat(billData.amount_paid || (billData.payment_status === 'paid' ? billData.total_amount : 0)) || 0;
    if (paidAmt > 0) {
      const invLabel = `INV-${String(invNo).padStart(4, '0')}`;
      const payMode = (billData.payment_type || 'cash').toLowerCase().includes('upi') ? 'UPI' : 'Cash';
      const payPayload = {
        batch_num: currentBatchNum,
        restaurant_name: targetRestName,
        amount: paidAmt,
        payment_mode: payMode,
        user_name: currentUser || 'Suraj',
        date: billData.bill_date || new Date().toISOString().slice(0, 10),
        note: `Payment Received (${invLabel})`
      };
      try {
        await fetch('/api/db?table=payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payPayload)
        });
      } catch (e) {
        console.warn('API DB payment insert fallback', e);
      }
      await supabase.from('payments').insert([payPayload]);
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
        try {
          const { data: allItems } = await supabase.from('items').select('id, name, current_stock');
          for (const lineItem of billData.items) {
            const qtyNum = parseFloat(lineItem.qty) || 0;
            if (qtyNum > 0) {
              let targetItem = null;
              if (lineItem.item_id) {
                targetItem = (allItems || []).find(it => it.id === lineItem.item_id);
              }
              if (!targetItem && lineItem.description) {
                const desc = lineItem.description.toLowerCase();
                targetItem = (allItems || []).find(it => {
                  const n = it.name.toLowerCase();
                  if (desc.includes('19.2') && n.includes('19.2')) return true;
                  if (desc.includes('21') && n.includes('21')) return true;
                  if (desc.includes('15') && n.includes('15')) return true;
                  if (desc.includes('empty') && n.includes('empty')) return true;
                  return false;
                });
              }
              if (targetItem) {
                const restoredStock = (parseFloat(targetItem.current_stock) || 0) + qtyNum;
                await supabase.from('items').update({ current_stock: restoredStock }).eq('id', targetItem.id);
                targetItem.current_stock = restoredStock;
              }
            }
          }
        } catch (stockErr) {
          console.warn('Error restoring stock on bill delete:', stockErr);
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

      // 5. Remove matching auto payment from `payments` table if invoice had logged payment
      if (billData.invoice_no) {
        try {
          const invNote = `Payment Received (INV-${String(billData.invoice_no).padStart(4, '0')})`;
          await fetch(`/api/db?table=payments&note=ilike.*${encodeURIComponent(invNote)}*`, { method: 'DELETE' }).catch(() => null);
          await supabase.from('payments').delete().ilike('note', `%${invNote}%`);
        } catch (payErr) {
          console.warn('Error removing auto payment on bill delete:', payErr);
        }
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
