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
      const [
        { data: catData },
        { data: itemData },
        { data: expData }
      ] = await Promise.all([
        supabase.from('expense_categories').select('*').order('name'),
        supabase.from('expense_items').select('*').order('name'),
        supabase.from('expenses').select('*').order('expense_date', { ascending: false })
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
    const { data, error } = await supabase.from('expense_categories').insert([{ name }]).select();
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const deleteCategory = async (id) => {
    const { error } = await supabase.from('expense_categories').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const saveExpenseItem = async (name, defaultRate = 0) => {
    const { data, error } = await supabase.from('expense_items').insert([{ name, default_rate: parseFloat(defaultRate) }]).select();
    if (error) throw error;
    await fetchData();
    return data[0];
  };

  const deleteExpenseItem = async (id) => {
    const { error } = await supabase.from('expense_items').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const saveExpense = async (expenseData) => {
    const { id, ...fields } = expenseData;
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
