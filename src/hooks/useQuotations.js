import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

function sortNewestFirst(rows = []) {
  return [...rows].sort((a, b) => {
    const noDiff = Number(b.quotation_no || 0) - Number(a.quotation_no || 0);
    return noDiff || String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export function useQuotations(currentUser) {
  const [quotations, setQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [quotationError, setQuotationError] = useState('');

  const fetchQuotations = useCallback(async () => {
    setLoadingQuotations(true);
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .order('quotation_no', { ascending: false });

    if (error) {
      console.error('Error fetching quotations:', error);
      setQuotationError(error.message || 'Quotations load nahi hue');
    } else {
      setQuotations(sortNewestFirst(data || []));
      setQuotationError('');
    }
    setLoadingQuotations(false);
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchQuotations, 0);
    const channel = supabase
      .channel('realtime-quotations-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, fetchQuotations)
      .subscribe();

    return () => {
      window.clearTimeout(initialFetch);
      supabase.removeChannel(channel);
    };
  }, [fetchQuotations]);

  const nextSuggestedQuotationNo = useMemo(() => {
    const maxNo = Math.max(0, ...quotations.map(q => Number(q.quotation_no) || 0));
    return maxNo + 1;
  }, [quotations]);

  const createQuotation = async (quotationData) => {
    let requestedNo = Number(quotationData.quotation_no) || nextSuggestedQuotationNo;
    const payload = {
      ...quotationData,
      quotation_no: requestedNo,
      status: 'open',
      created_by: currentUser || 'Suraj'
    };

    let result = await supabase.from('quotations').insert([payload]).select().single();
    if (result.error?.code === '23505') {
      const { data: latest } = await supabase
        .from('quotations')
        .select('quotation_no')
        .order('quotation_no', { ascending: false })
        .limit(1);
      requestedNo = (Number(latest?.[0]?.quotation_no) || requestedNo) + 1;
      result = await supabase
        .from('quotations')
        .insert([{ ...payload, quotation_no: requestedNo }])
        .select()
        .single();
    }
    if (result.error) throw result.error;
    setQuotations(prev => sortNewestFirst([result.data, ...prev.filter(q => q.id !== result.data.id)]));
    return result.data;
  };

  const updateQuotation = async (id, fields) => {
    const { data, error } = await supabase
      .from('quotations')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    setQuotations(prev => sortNewestFirst(prev.map(q => q.id === id ? data : q)));
    return data;
  };

  // Atomically claims an open quotation so two devices cannot convert it twice.
  const claimQuotationForConversion = async (id) => {
    const { data, error } = await supabase
      .from('quotations')
      .update({ status: 'converting', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'open')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Ye quotation kisi aur device par convert ho raha hai ya pehle hi convert ho chuka hai');
    setQuotations(prev => sortNewestFirst(prev.map(q => q.id === id ? data : q)));
    return data;
  };

  const deleteQuotation = async (id) => {
    const target = quotations.find(q => q.id === id);
    if (target?.status === 'converted') throw new Error('Converted quotation delete nahi kiya ja sakta');
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) throw error;
    setQuotations(prev => prev.filter(q => q.id !== id));
  };

  return {
    quotations,
    loadingQuotations,
    quotationError,
    nextSuggestedQuotationNo,
    createQuotation,
    updateQuotation,
    claimQuotationForConversion,
    deleteQuotation,
    refetchQuotations: fetchQuotations
  };
}
