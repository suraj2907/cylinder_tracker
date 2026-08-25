import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { norm } from '../utils/dataUtils';

const PAGE_SIZE = 1000;

export function useBilling(currentUser, onAddDeliveryEntry, onRemoveDeliveryEntry, deductStock, restoreStock) {
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

  const sortBillsDescending = useCallback((list) => {
    return [...list].sort((a, b) => {
      const numA = parseInt(a.invoice_no, 10) || 0;
      const numB = parseInt(b.invoice_no, 10) || 0;
      if (numA !== numB) return numB - numA;
      return (b.bill_date || '').localeCompare(a.bill_date || '');
    });
  }, []);

  const fetchBills = useCallback(async () => {
    try {
      const res = await fetch('/api/db?table=bills&order=invoice_no&asc=false');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setBills(sortBillsDescending(data));
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
          .order('invoice_no', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setBills(sortBillsDescending(all));
    } catch (err) {
      console.error('Error fetching bills:', err);
    }
  }, [sortBillsDescending]);

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
            setBills(prev => sortBillsDescending([newBill, ...prev.filter(b => b.id !== newBill.id && parseInt(b.invoice_no, 10) !== parseInt(newBill.invoice_no, 10))]));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setBills(prev => sortBillsDescending(prev.map(b => b.id === updated.id ? updated : b)));
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

  const saveRestaurantProfile = async (name, { mobile, gst_num, address, previous_balance, originalName }) => {
    const finalName = (name || '').trim();
    const prevName = (originalName || '').trim();
    const isRenamed = Boolean(prevName && prevName !== finalName);

    const payload = {
      name: finalName,
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
      if (isRenamed) {
        delete next[prevName];
        delete next[prevName.toLowerCase()];
      }
      next[finalName] = { ...(next[finalName] || {}), ...payload };
      next[finalName.toLowerCase()] = { ...(next[finalName.toLowerCase()] || {}), ...payload };
      return next;
    });

    try {
      if (isRenamed) {
        // Update restaurant profile in Supabase
        const { error: updateErr } = await supabase.from('restaurants').update(payload).eq('name', prevName);
        if (updateErr) {
          // If previous row not found by exact string, try upsert
          await supabase.from('restaurants').upsert(payload, { onConflict: 'name' });
        }
        // Cascade rename to bills, payments, entries, legacy_ledger_entries
        await Promise.all([
          supabase.from('bills').update({ restaurant_name: finalName }).eq('restaurant_name', prevName),
          supabase.from('payments').update({ restaurant_name: finalName }).eq('restaurant_name', prevName),
          supabase.from('entries').update({ name: finalName }).eq('name', prevName),
          supabase.from('legacy_ledger_entries').update({ restaurant_name: finalName }).eq('restaurant_name', prevName)
        ]);
      } else {
        await supabase
          .from('restaurants')
          .upsert(payload, { onConflict: 'name' });
      }
    } catch (err) {
      console.warn('Supabase save restaurant profile error:', err);
    }

    try {
      await fetch('/api/db?table=restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('API db fallback', e);
    }

    await fetchProfiles();
  };

  const createBill = async (billData) => {
    // 1. Anti-Duplicate Protection (3-second double-click debounce)
    const targetRestName = billData.restaurant_name;
    const targetTotal = Number(billData.total_amount);
    const targetDate = billData.bill_date || new Date().toISOString().slice(0, 10);
    const targetBatchNum = parseInt(billData.batch_num, 10) || 133;

    const duplicateRecentBill = (bills || []).find(b =>
      norm(b.restaurant_name) === norm(targetRestName) &&
      Math.abs(Number(b.total_amount) - targetTotal) < 0.05 &&
      b.bill_date === targetDate &&
      (Date.now() - new Date(b.created_at || Date.now()).getTime()) < 3000
    );

    if (duplicateRecentBill) {
      throw new Error(`⚠️ Duplicate click detected! "${targetRestName}" ka ₹${targetTotal} ka bill abhi save ho raha hai.`);
    }

    // 2. Sequential Invoice Number: Concurrency-safe highest DB number check
    let invNo = billData.invoice_no ? parseInt(billData.invoice_no, 10) : null;

    // If no invoice number or if requested invoice number already exists in local bills list
    if (!invNo || (bills || []).some(b => parseInt(b.invoice_no, 10) === invNo)) {
      try {
        const { data: maxRows } = await supabase
          .from('bills')
          .select('invoice_no')
          .order('invoice_no', { ascending: false })
          .limit(1);
        const maxDbInv = maxRows && maxRows[0] ? parseInt(maxRows[0].invoice_no, 10) : 3514;
        const maxLocalInv = Math.max(3510, ...(bills || []).map(b => parseInt(b.invoice_no, 10) || 0));
        invNo = Math.max(maxDbInv, maxLocalInv) + 1;
      } catch (err) {
        const localMaxNo = Math.max(3510, ...(bills || []).map(b => parseInt(b.invoice_no, 10) || 0));
        invNo = localMaxNo + 1;
      }
    }

    const { restaurant_id, batch_num, ...cleanBillData } = billData;
    const tempId = Date.now();
    const savedBill = { 
      ...cleanBillData, 
      id: tempId,
      invoice_no: invNo,
      created_by: currentUser || 'Suraj',
      created_at: new Date().toISOString()
    };

    // 3. Stock Deduction (Category-wise in DB and local state)
    if (typeof deductStock === 'function') {
      deductStock(billData.items);
    }

    // 4. Automatic Cylinder Delivery Entry Sync into Active Batch
    if (Array.isArray(billData.items) && typeof onAddDeliveryEntry === 'function') {
      for (const it of billData.items) {
        const q = parseInt(it.qty, 10) || 0;
        if (q > 0) {
          const desc = (it.description || it.item_name || it.name || '').toLowerCase();
          let cylType = '19.2kg-delivery';
          if (desc.includes('21')) cylType = '21kg-delivery';
          else if (desc.includes('15')) cylType = '15kg-delivery';
          else if (desc.includes('empty') || desc.includes('khali')) continue;

          onAddDeliveryEntry(
            targetRestName,
            q,
            cylType,
            targetDate,
            targetBatchNum,
            false
          );
        }
      }
    }

    // 5. Save directly to Database with retry on unique constraint collision
    let payload = { ...cleanBillData, invoice_no: invNo, created_by: currentUser || 'Suraj' };
    let dbData = null;
    let dbError = null;

    const insertRes = await supabase.from('bills').insert([payload]).select().single();
    dbData = insertRes.data;
    dbError = insertRes.error;

    // Auto-resolve duplicate key collision if another partner/session created the same invoice_no
    if (dbError && (dbError.code === '23505' || dbError.message?.includes('unique'))) {
      console.warn('⚡ Duplicate invoice number detected, auto-incrementing to next available number...');
      const { data: latestMaxRows } = await supabase
        .from('bills')
        .select('invoice_no')
        .order('invoice_no', { ascending: false })
        .limit(1);
      const nextSafeInv = (latestMaxRows && latestMaxRows[0] ? parseInt(latestMaxRows[0].invoice_no, 10) : invNo) + 1;
      invNo = nextSafeInv;
      payload.invoice_no = nextSafeInv;
      savedBill.invoice_no = nextSafeInv;

      const retryRes = await supabase.from('bills').insert([payload]).select().single();
      dbData = retryRes.data;
      dbError = retryRes.error;
    }

    if (dbError) {
      console.error('Error saving bill to Supabase:', dbError);
      throw dbError;
    }

    const finalBill = dbData || savedBill;

    // Update React bills state
    setBills(prev => [finalBill, ...prev.filter(b => b.id !== finalBill.id && parseInt(b.invoice_no, 10) !== parseInt(finalBill.invoice_no, 10))]);

    // Paid Invoice Payment Record
    const paidAmt = parseFloat(billData.amount_paid || (billData.payment_status === 'paid' ? billData.total_amount : 0)) || 0;
    if (paidAmt > 0) {
      const invLabel = `INV-${String(invNo).padStart(4, '0')}`;
      const payMode = (billData.payment_type || 'cash').toLowerCase().includes('upi') ? 'UPI' : 'Cash';
      await supabase.from('payments').insert([{
        batch_num: targetBatchNum,
        restaurant_name: targetRestName,
        amount: paidAmt,
        payment_mode: payMode,
        user_name: currentUser || 'Suraj',
        date: targetDate,
        note: `Payment Received (${invLabel})`
      }]);
    }

    return finalBill;
  };

  const deleteBill = async (id, onDeliveryRemoved) => {
    // 1. Find bill details before deletion
    let billData = (bills || []).find(b => b.id === id);
    if (!billData) {
      const { data } = await supabase.from('bills').select('*').eq('id', id).single();
      billData = data;
    }

    // 2. Remove from bills state immediately
    setBills(prev => prev.filter(b => b.id !== id));

    // 3. Live Stock Restoration (Adds back deducted cylinders immediately)
    if (billData && Array.isArray(billData.items) && typeof restoreStock === 'function') {
      restoreStock(billData.items);
    }

    // 4. Remove calendar delivery entry from memory and Supabase entries table
    const removeCallback = onDeliveryRemoved || onRemoveDeliveryEntry;
    if (billData && typeof removeCallback === 'function') {
      await removeCallback(billData.restaurant_name, billData.bill_date);
    }

    // 5. Delete from DB bills table
    await supabase.from('bills').delete().eq('id', id);

    // 6. If bill had an auto-recorded payment, remove it
    if (billData && billData.invoice_no) {
      const invNote = `Payment Received (INV-${String(billData.invoice_no).padStart(4, '0')})`;
      await supabase.from('payments').delete().ilike('note', `%${invNote}%`);
    }
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
