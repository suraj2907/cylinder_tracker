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

  // Compute live stock dynamically for each item
  const itemsWithLiveStock = useMemo(() => {
    return items.map(item => {
      // 1. Purchases sum from purchase_bills items JSONB array: [{item_id, qty, ...}]
      let totalPurchases = 0;
      purchaseBills.forEach(pb => {
        if (Array.isArray(pb.items)) {
          pb.items.forEach(line => {
            if (line.item_id === item.id) {
              totalPurchases += (parseFloat(line.qty) || 0);
            }
          });
        }
      });

      // 2. Sales sum from bills JSONB items array: [{description, qty, rate, item_id}, ...]
      let totalSales = 0;
      bills.forEach(bill => {
        if (Array.isArray(bill.items)) {
          bill.items.forEach(line => {
            if (line.item_id === item.id || (line.description && item.name && line.description.toLowerCase() === item.name.toLowerCase())) {
              totalSales += (parseFloat(line.qty) || 0);
            }
          });
        }
      });

      // 3. Adjustments sum
      const totalAdjustments = stockAdjustments
        .filter(a => a.item_id === item.id)
        .reduce((sum, a) => sum + (parseFloat(a.adjustment_qty) || 0), 0);

      const liveStock = totalPurchases - totalSales + totalAdjustments;

      return {
        ...item,
        current_stock: liveStock
      };
    });
  }, [items, purchaseBills, stockAdjustments, bills]);

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
