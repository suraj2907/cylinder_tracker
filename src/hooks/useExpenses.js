import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

export function useExpenses(currentUser) {
  const [categories, setCategories] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resCat, resItem, resExp] = await Promise.all([
        fetch('/api/db?table=expense_categories&order=name&asc=true').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/db?table=expense_items&order=name&asc=true').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/db?table=expenses&order=expense_date&asc=false').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      if (resCat && resItem && resExp) {
        setCategories(resCat || []);
        setExpenseItems(resItem || []);
        setExpenses(resExp || []);
        return;
      }

      const [
        { data: catData },
        { data: itemData },
        { data: expData }
      ] = await Promise.all([
        supabase.from('expense_categories').select('*').order('name'),
        supabase.from('expense_items').select('*').order('name'),
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }).range(0, 4999)
      ]);

      setCategories(catData || []);
      setExpenseItems(itemData || []);
      setExpenses(expData || []);
    } catch (e) {
      console.error("Error loading expense data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveCategory = async (name) => {
    try {
      const res = await fetch('/api/db?table=expense_categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
        return data[0] || data;
      }
    } catch (e) {
      console.warn("Proxy saveCategory fallback to supabase:", e);
    }
    const { data, error } = await supabase.from('expense_categories').insert([{ name }]).select();
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const deleteCategory = async (id) => {
    try {
      const res = await fetch(`/api/db?table=expense_categories&id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchData();
        return;
      }
    } catch (e) {
      console.warn("Proxy deleteCategory fallback to supabase:", e);
    }
    const { error } = await supabase.from('expense_categories').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const saveExpenseItem = async (name, defaultRate = 0) => {
    try {
      const res = await fetch('/api/db?table=expense_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, default_rate: parseFloat(defaultRate) || 0 })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
        return data[0] || data;
      }
    } catch (e) {
      console.warn("Proxy saveExpenseItem fallback to supabase:", e);
    }
    const { data, error } = await supabase.from('expense_items').insert([{ name, default_rate: parseFloat(defaultRate) }]).select();
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const deleteExpenseItem = async (id) => {
    try {
      const res = await fetch(`/api/db?table=expense_items&id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchData();
        return;
      }
    } catch (e) {
      console.warn("Proxy deleteExpenseItem fallback to supabase:", e);
    }
    const { error } = await supabase.from('expense_items').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const saveExpense = async (expenseData) => {
    const { id, ...fields } = expenseData;
    const payload = id ? { id, ...fields } : { ...fields, created_by: currentUser };
    
    try {
      const res = await fetch('/api/db?table=expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
        return data[0] || data;
      }
    } catch (e) {
      console.warn("Proxy saveExpense fallback to supabase client:", e);
    }

    let query;
    if (id) {
      query = supabase.from('expenses').update(fields).eq('id', id).select();
    } else {
      query = supabase.from('expenses').insert([{ ...fields, created_by: currentUser }]).select();
    }
    const { data, error } = await query;
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const deleteExpense = async (id) => {
    try {
      const res = await fetch(`/api/db?table=expenses&id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchData();
        return;
      }
    } catch (e) {
      console.warn("Proxy deleteExpense fallback to supabase client:", e);
    }
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  return {
    categories,
    expenseItems,
    expenses,
    loadingExpenses: loading,
    saveCategory,
    deleteCategory,
    saveExpenseItem,
    deleteExpenseItem,
    saveExpense,
    deleteExpense,
    refetchExpenses: fetchData
  };
}
