import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

export function useInventory(currentUser) {
  const [items, setItems] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [partyItemPrices, setPartyItemPrices] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resItems, resPurchases, resAdj, resPartyPrices, resBills] = await Promise.all([
        fetch('/api/db?table=items&order=name&asc=true').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/db?table=purchase_bills&order=purchase_date&asc=false').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/db?table=stock_adjustments&order=created_at&asc=false').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/db?table=party_item_prices').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/db?table=bills').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      if (resItems && resPurchases && resAdj && resPartyPrices && resBills) {
        setItems(resItems || []);
        setPurchaseBills(resPurchases || []);
        setStockAdjustments(resAdj || []);
        setPartyItemPrices(resPartyPrices || []);
        setBills(resBills || []);
        return;
      }

      const [
        { data: itemsData },
        { data: purchasesData },
        { data: adjustmentsData },
        { data: partyPricesData },
        { data: billsData }
      ] = await Promise.all([
        supabase.from('items').select('*').order('name'),
        supabase.from('purchase_bills').select('*').order('purchase_date', { ascending: false }),
        supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false }),
        supabase.from('party_item_prices').select('*'),
        supabase.from('bills').select('*')
      ]);

      setItems(itemsData || []);
      setPurchaseBills(purchasesData || []);
      setStockAdjustments(adjustmentsData || []);
      setPartyItemPrices(partyPricesData || []);
      setBills(billsData || []);
    } catch (e) {
      console.error("Error loading inventory data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute live stock dynamically for each item from current database stock
  const itemsWithLiveStock = useMemo(() => {
    return items.map(item => {
      const baseStock = parseFloat(item.current_stock) || 0;
      return {
        ...item,
        current_stock: baseStock
      };
    });
  }, [items]);

  const saveItem = async (itemData) => {
    const { id, ...fields } = itemData;
    let query;
    if (id) {
      query = supabase.from('items').update(fields).eq('id', id).select();
    } else {
      query = supabase.from('items').insert([fields]).select();
    }
    const { data, error } = await query;
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const saveStockAdjustment = async (itemId, adjustmentQty, reason) => {
    const { error } = await supabase.from('stock_adjustments').insert([{
      item_id: itemId,
      adjustment_qty: parseFloat(adjustmentQty),
      reason,
      adjusted_by: currentUser
    }]);
    if (error) throw error;
    await fetchData();
  };

  const savePurchaseBill = async (billData) => {
    const { id, ...fields } = billData;
    let query;
    if (id) {
      query = supabase.from('purchase_bills').update(fields).eq('id', id).select();
    } else {
      query = supabase.from('purchase_bills').insert([{ ...fields, created_by: currentUser }]).select();
    }
    const { data, error } = await query;
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const deletePurchaseBill = async (id) => {
    const { error } = await supabase.from('purchase_bills').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const savePartyPrice = async (restaurantName, itemId, price) => {
    const { error } = await supabase.from('party_item_prices').upsert({
      restaurant_name: restaurantName,
      item_id: itemId,
      price: parseFloat(price)
    }, { onConflict: 'restaurant_name,item_id' });
    if (error) throw error;
    await fetchData();
  };

  const deletePartyPrice = async (id) => {
    const { error } = await supabase.from('party_item_prices').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  return {
    items: itemsWithLiveStock,
    purchaseBills,
    stockAdjustments,
    partyItemPrices,
    bills,
    loadingInventory: loading,
    saveItem,
    saveStockAdjustment,
    savePurchaseBill,
    deletePurchaseBill,
    savePartyPrice,
    deletePartyPrice,
    refetchInventory: fetchData
  };
}
