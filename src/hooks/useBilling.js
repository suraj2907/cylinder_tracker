import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

export function useBilling(currentUser) {
  const [restaurantProfiles, setRestaurantProfiles] = useState({}); // { name: {mobile, gst_num, address} }
  const [bills, setBills] = useState([]);
  const [loadingBilling, setLoadingBilling] = useState(true);

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase.from('restaurants').select('*');
    if (error) {
      console.error('Error fetching restaurant profiles', error);
      return;
    }
    const map = {};
    (data || []).forEach(r => { map[r.name] = r; });
    setRestaurantProfiles(map);
  }, []);

  // Fetch ALL historical bills using fast parallel range pagination
  const fetchBills = useCallback(async () => {
    try {
      const ranges = [
        [0, 999],
        [1000, 1999],
        [2000, 2999],
        [3000, 3999],
        [4000, 4999]
      ];
      const results = await Promise.all(
        ranges.map(([rFrom, rTo]) =>
          supabase.from('bills').select('*').order('id', { ascending: false }).range(rFrom, rTo)
        )
      );
      const dbBills = results.flatMap(r => r.data || []);
      setBills(dbBills);
    } catch (err) {
      console.error('Error fetching bills:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchBills()]).finally(() => setLoadingBilling(false));
  }, [fetchProfiles, fetchBills]);

  // Compute next sequential invoice number based on max invoice_no in DB
  const nextSuggestedInvoiceNo = useMemo(() => {
    let maxNo = 0;
    bills.forEach(b => {
      const num = parseInt(b.invoice_no || b.legacy_invoice_no, 10);
      if (!isNaN(num) && num > maxNo) {
        maxNo = num;
      }
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
    const assignedInvoiceNo = billData.invoice_no 
      ? parseInt(billData.invoice_no, 10) 
      : nextSuggestedInvoiceNo;

    const payload = {
      ...billData,
      invoice_no: assignedInvoiceNo,
      created_by: currentUser
    };

    const { data, error } = await supabase
      .from('bills')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating bill', error);
      throw error;
    }
    await fetchBills();
    return data;
  };

  const deleteBill = async (id) => {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting bill', error);
      throw error;
    }
    await fetchBills();
  };

  const updateBillStatus = async (id, updateFields) => {
    const { error } = await supabase
      .from('bills')
      .update(updateFields)
      .eq('id', id);
    if (error) {
      console.error('Error updating bill status', error);
      throw error;
    }
    await fetchBills();
  };

  // The SQL RPC updates the invoice and inserts its payment in one transaction.
  // Keeping this server-side prevents orphan payments and concurrent overpayments.
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
