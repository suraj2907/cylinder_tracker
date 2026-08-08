import { useState, useEffect, useCallback } from 'react';
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

  const fetchBills = useCallback(async () => {
    const { data, error } = await supabase.from('bills').select('*').order('id', { ascending: false });
    if (error) {
      console.error('Error fetching bills', error);
      return;
    }
    setBills(data || []);
  }, []);

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchBills()]).finally(() => setLoadingBilling(false));
  }, [fetchProfiles, fetchBills]);

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
    const { data, error } = await supabase
      .from('bills')
      .insert([{ ...billData, created_by: currentUser }])
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

  return {
    restaurantProfiles,
    bills,
    loadingBilling,
    saveRestaurantProfile,
    createBill,
    deleteBill,
    refetchBills: fetchBills
  };
}
