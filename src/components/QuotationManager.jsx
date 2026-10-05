import { useMemo, useState } from 'react';
import { norm } from '../utils/dataUtils';
import { exportQuotationPDF, shareQuotationPDFOnWhatsApp } from '../utils/exportUtils';
import { supabase } from '../utils/supabaseClient';

const emptyItem = () => ({ item_id: '', description: '', hsn: '', qty: 1, rate: 0, gst_rate: 18 });
const money = value => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quoteLabel = quote => `Q-${String(quote?.quotation_no || 0).padStart(4, '0')}`;

export default function QuotationManager({
  restaurants = [],
  restaurantProfiles = {},
  itemsCatalog = [],
  partyItemPrices = [],
  batches = [],
  quotations = [],
  loading = false,
  error = '',
  nextSuggestedQuotationNo = 1,
  createQuotation,
  updateQuotation,
  claimQuotationForConversion,
  deleteQuotation,
  createBill
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [search, setSearch] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validDays, setValidDays] = useState(7);
  const [gstMode, setGstMode] = useState('gst');
  const [items, setItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState('Rates are valid until the expiry date. Supply is subject to stock availability.');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);

  const latestBatch = useMemo(() => Math.max(133, ...batches.map(b => Number(b.batch || b.batch_num) || 0)), [batches]);

  const parties = useMemo(() => {
    const byName = new Map();
    Object.entries(restaurantProfiles || {}).forEach(([name, profile]) => {
      const canonical = norm(profile?.name || name);
      if (canonical && canonical !== 'Unknown') byName.set(canonical, { name: canonical, ...profile });
    });
    restaurants.forEach(value => {
      const raw = typeof value === 'string' ? value : value.name;
      const canonical = norm(raw);
      if (canonical && canonical !== 'Unknown' && !byName.has(canonical)) {
        byName.set(canonical, typeof value === 'string' ? { name: canonical } : { ...value, name: canonical });
      }
    });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [restaurantProfiles, restaurants]);

  const partyMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return parties.filter(p => p.name.toLowerCase().includes(query) || String(p.mobile || '').includes(query)).slice(0, 12);
  }, [parties, search]);

  const profileFor = name => restaurantProfiles[name]
    || restaurantProfiles[norm(name)]
    || Object.values(restaurantProfiles || {}).find(p => norm(p.name) === norm(name))
    || parties.find(p => norm(p.name) === norm(name))
    || {};

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    items.forEach(item => {
      const lineTotal = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      subtotal += lineTotal;
      if (gstMode === 'none' || Number(item.gst_rate) === 0) {
        taxable += lineTotal;
      } else {
        const rate = Number(item.gst_rate) || 18;
        const base = lineTotal / (1 + rate / 100);
        taxable += base;
        cgst += (lineTotal - base) / 2;
        sgst += (lineTotal - base) / 2;
      }
    });
    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxable: Number(taxable.toFixed(2)),
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      total: Number(subtotal.toFixed(2))
    };
  }, [items, gstMode]);

  const selectItem = (index, itemId) => {
    const catalogItem = itemsCatalog.find(item => item.id === itemId);
    if (!catalogItem) return;
    const override = partyItemPrices.find(p => p.restaurant_name === selectedRestaurant && p.item_id === itemId);
    const lowerName = String(catalogItem.name || '').toLowerCase();
    const isGstFree = catalogItem.gst_applicable === false || lowerName.includes('empty') || lowerName.includes('khali');
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      item_id: itemId,
      description: catalogItem.name,
      hsn: catalogItem.hsn_code || '27111900',
      rate: override ? Number(override.price) : Number(catalogItem.default_rate || 0),
      gst_rate: isGstFree ? 0 : Number(catalogItem.gst_rate || 18)
    } : item));
  };

  const updateItem = (index, field, value) => {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const resetForm = () => {
    setSelectedRestaurant('');
    setSearch('');
    setQuoteDate(new Date().toISOString().slice(0, 10));
    setValidDays(7);
    setGstMode('gst');
    setItems([emptyItem()]);
    setNotes('Rates are valid until the expiry date. Supply is subject to stock availability.');
  };

  const saveQuotation = async () => {
    if (!selectedRestaurant) return alert('Pehle party select karo');
    if (!items.length || items.some(item => !item.item_id || !(Number(item.qty) > 0) || !(Number(item.rate) > 0))) {
      return alert('Sabhi items, quantity aur rate sahi bharo');
    }
    const expiry = new Date(`${quoteDate}T00:00:00`);
    expiry.setDate(expiry.getDate() + Number(validDays || 0));
    setSaving(true);
    try {
      const saved = await createQuotation({
        quotation_no: nextSuggestedQuotationNo,
        restaurant_name: selectedRestaurant,
        quotation_date: quoteDate,
        expiry_date: expiry.toISOString().slice(0, 10),
        batch_num: latestBatch,
        gst_mode: gstMode,
        items,
        subtotal: totals.subtotal,
        taxable_amount: totals.taxable,
        cgst: totals.cgst,
        sgst: totals.sgst,
        total_amount: totals.total,
        notes
      });
      setSelectedQuote(saved);
      setShowForm(false);
      resetForm();
    } catch (saveError) {
      alert(`Quotation save nahi hua: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const shareQuote = async quote => {
    await shareQuotationPDFOnWhatsApp(quote, profileFor(quote.restaurant_name));
  };

  const convertToInvoice = async quote => {
    if (quote.status === 'converted' || quote.status === 'cancelled') return;
    if (!window.confirm(`${quoteLabel(quote)} ko invoice me convert karein? Isse stock aur party ledger update hoga.`)) return;
    setBusyId(quote.id);
    try {
      let claimed;
      if (quote.status === 'converting') {
        const { data: existingBill } = await supabase
          .from('bills')
          .select('id, invoice_no')
          .eq('source_quotation_id', quote.id)
          .maybeSingle();
        if (existingBill) {
          const converted = await updateQuotation(quote.id, {
            status: 'converted',
            converted_bill_id: existingBill.id,
            converted_invoice_no: existingBill.invoice_no,
            converted_at: new Date().toISOString()
          });
          setSelectedQuote(converted);
          alert(`${quoteLabel(quote)} INV-${String(existingBill.invoice_no).padStart(4, '0')} se sync ho gaya.`);
          return;
        }
        await updateQuotation(quote.id, { status: 'open' });
      }
      claimed = await claimQuotationForConversion(quote.id);
      const bill = await createBill({
        restaurant_name: claimed.restaurant_name,
        bill_date: new Date().toISOString().slice(0, 10),
        batch_num: Number(claimed.batch_num) || latestBatch,
        gst_mode: claimed.gst_mode,
        items: claimed.items,
        subtotal: Number(claimed.subtotal),
        taxable_amount: Number(claimed.taxable_amount),
        cgst: Number(claimed.cgst),
        sgst: Number(claimed.sgst),
        total_amount: Number(claimed.total_amount),
        due_date: new Date().toISOString().slice(0, 10),
        payment_status: 'unpaid',
        amount_paid: 0,
        source_quotation_id: quote.id
      });
      const converted = await updateQuotation(quote.id, {
        status: 'converted',
        converted_bill_id: bill.id,
        converted_invoice_no: bill.invoice_no,
        converted_at: new Date().toISOString()
      });
      setSelectedQuote(converted);
      alert(`${quoteLabel(quote)} successfully INV-${String(bill.invoice_no).padStart(4, '0')} me convert ho gaya.`);
    } catch (convertError) {
      // If invoice creation succeeded but the final quotation update was interrupted,
      // reconcile instead of creating/deducting the same sale again on the next click.
      const { data: existingBill } = await supabase
        .from('bills')
        .select('id, invoice_no')
        .eq('source_quotation_id', quote.id)
        .maybeSingle();
      if (existingBill) {
        const converted = await updateQuotation(quote.id, {
          status: 'converted',
          converted_bill_id: existingBill.id,
          converted_invoice_no: existingBill.invoice_no,
          converted_at: new Date().toISOString()
        });
        setSelectedQuote(converted);
        alert(`${quoteLabel(quote)} pehle hi INV-${String(existingBill.invoice_no).padStart(4, '0')} me convert ho chuka hai.`);
      } else {
        try { await updateQuotation(quote.id, { status: 'open' }); } catch (releaseError) { console.error('Quotation conversion lock release failed:', releaseError); }
        alert(`Invoice conversion nahi hua: ${convertError.message}`);
      }
    } finally {
      setBusyId(null);
    }
  };

  const removeQuote = async quote => {
    if (!window.confirm(`${quoteLabel(quote)} delete karna hai?`)) return;
    setBusyId(quote.id);
    try {
      await deleteQuotation(quote.id);
      if (selectedQuote?.id === quote.id) setSelectedQuote(null);
    } catch (deleteError) {
      alert(deleteError.message);
    } finally {
      setBusyId(null);
    }
  };

  if (showForm) {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl shadow-soft p-5 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Create Quotation / Estimate</h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">Stock aur ledger conversion tak change nahi honge.</p>
          </div>
          <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black cursor-pointer">Cancel</button>
        </div>

        <div>
          <label className="text-xs font-black text-slate-700 block mb-1">Select Saved Party</label>
          {selectedRestaurant ? (
            <div className="flex justify-between items-center p-3 rounded-2xl bg-violet-50 border border-violet-200">
              <div><div className="text-xs font-black">{selectedRestaurant}</div><div className="text-[10px] text-slate-500">{profileFor(selectedRestaurant).mobile || 'Mobile not saved'}</div></div>
              <button onClick={() => setSelectedRestaurant('')} className="text-xs font-black text-violet-700 cursor-pointer">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Party name ya mobile search karein..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-violet-500" />
              {search && <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-auto">
                {partyMatches.map(p => <button key={p.name} onClick={() => { setSelectedRestaurant(p.name); setSearch(''); }} className="block w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-violet-50 border-b border-slate-100 cursor-pointer">{p.name}{p.mobile ? ` • ${p.mobile}` : ''}</button>)}
                {!partyMatches.length && <div className="px-4 py-3 text-xs text-slate-400">Saved party nahi mili</div>}
              </div>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className="text-xs font-black text-slate-700">Quotation No.</label><div className="mt-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black">Q-{String(nextSuggestedQuotationNo).padStart(4, '0')}</div></div>
          <div><label className="text-xs font-black text-slate-700">Date</label><input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" /></div>
          <div><label className="text-xs font-black text-slate-700">Valid For</label><select value={validDays} onChange={e => setValidDays(e.target.value)} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"><option value="3">3 days</option><option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option></select></div>
          <div><label className="text-xs font-black text-slate-700">Type</label><div className="mt-1 flex bg-slate-100 rounded-xl p-1"><button onClick={() => setGstMode('none')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg cursor-pointer ${gstMode === 'none' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>PLAIN</button><button onClick={() => setGstMode('gst')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg cursor-pointer ${gstMode === 'gst' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>GST</button></div></div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center"><h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Items</h3><button onClick={() => setItems(current => [...current, emptyItem()])} className="text-xs font-black text-violet-700 cursor-pointer">+ Add Item</button></div>
          {items.map((item, index) => <div key={index} className="grid grid-cols-12 gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50">
            <select value={item.item_id} onChange={e => selectItem(index, e.target.value)} className="col-span-12 sm:col-span-5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"><option value="">Select item...</option>{itemsCatalog.map(catalogItem => <option key={catalogItem.id} value={catalogItem.id}>{catalogItem.name}</option>)}</select>
            <input type="number" min="1" value={item.qty} onChange={e => updateItem(index, 'qty', e.target.value)} className="col-span-4 sm:col-span-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" placeholder="Qty" />
            <input type="number" min="0" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} className="col-span-5 sm:col-span-3 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" placeholder="Rate" />
            <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2 text-xs font-black">₹{money(Number(item.qty) * Number(item.rate))}{items.length > 1 && <button onClick={() => setItems(current => current.filter((_, i) => i !== index))} className="text-rose-600 cursor-pointer">✕</button>}</div>
          </div>)}
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold" placeholder="Terms / notes" />

        <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4 space-y-2 text-xs font-bold">
          {gstMode === 'gst' && <><div className="flex justify-between"><span>Taxable Amount</span><span>₹{money(totals.taxable)}</span></div><div className="flex justify-between text-slate-500"><span>CGST + SGST</span><span>₹{money(totals.cgst + totals.sgst)}</span></div></>}
          <div className="flex justify-between text-base font-black border-t border-violet-200 pt-2"><span>Quotation Total</span><span>₹{money(totals.total)}</span></div>
        </div>

        <button disabled={saving} onClick={saveQuotation} className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-black shadow-soft cursor-pointer">{saving ? 'Saving...' : 'Save Quotation'}</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-3xl p-5 shadow-soft">
        <div><h2 className="text-lg font-black text-slate-900">Quotations / Estimates</h2><p className="text-xs text-slate-500 font-semibold mt-1">Party ko quote bhejein, approval ke baad ek click me invoice banayein.</p></div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black shadow-sm cursor-pointer">＋ New Quotation</button>
      </div>

      {error && <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">Quotation database setup pending: {error}. Pehle supplied migration run karein.</div>}

      {selectedQuote && <div className="bg-white border-2 border-violet-200 rounded-3xl p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div><div className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Quotation Ready</div><div className="text-xl font-black mt-1">{quoteLabel(selectedQuote)}</div><div className="text-xs text-slate-500 font-semibold mt-1">{selectedQuote.restaurant_name} • ₹{money(selectedQuote.total_amount)} • Valid till {selectedQuote.expiry_date}</div></div>
          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => shareQuote(selectedQuote)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer">📤 WhatsApp PDF</button>
            <button onClick={() => exportQuotationPDF(selectedQuote, profileFor(selectedQuote.restaurant_name))} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black cursor-pointer">📄 Download PDF</button>
            {(selectedQuote.status === 'open' || selectedQuote.status === 'converting') && <button disabled={busyId === selectedQuote.id} onClick={() => convertToInvoice(selectedQuote)} className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-black cursor-pointer disabled:opacity-60">{selectedQuote.status === 'converting' ? 'Resume Conversion →' : 'Convert to Invoice →'}</button>}
          </div>
        </div>
      </div>}

      <div className="bg-white border border-slate-200 rounded-3xl shadow-soft overflow-hidden">
        {loading ? <div className="p-10 text-center text-xs font-bold text-slate-400">Quotations loading...</div> : quotations.length === 0 ? <div className="p-12 text-center"><div className="text-3xl mb-2">📄</div><div className="text-sm font-black text-slate-800">Abhi koi quotation nahi hai</div><div className="text-xs text-slate-400 mt-1">New Quotation se pehla estimate banayein.</div></div> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Quotation</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Date / Validity</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{quotations.map(quote => <tr key={quote.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-black text-violet-700">{quoteLabel(quote)}</td><td className="px-4 py-3 font-bold text-slate-900">{quote.restaurant_name}</td><td className="px-4 py-3 text-slate-500 font-semibold"><div>{quote.quotation_date}</div><div className="text-[10px]">Valid till {quote.expiry_date}</div></td><td className="px-4 py-3 text-right font-black">₹{money(quote.total_amount)}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${quote.status === 'converted' ? 'bg-emerald-100 text-emerald-700' : quote.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : quote.status === 'converting' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{quote.status === 'converted' ? `INV-${String(quote.converted_invoice_no || '').padStart(4, '0')}` : quote.status}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1.5"><button onClick={() => setSelectedQuote(quote)} className="px-2 py-1.5 rounded-lg bg-violet-50 text-violet-700 font-black cursor-pointer">View</button><button onClick={() => shareQuote(quote)} className="px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-black cursor-pointer">Share</button>{(quote.status === 'open' || quote.status === 'converting') && <button disabled={busyId === quote.id} onClick={() => convertToInvoice(quote)} className="px-2 py-1.5 rounded-lg bg-sky-50 text-sky-700 font-black cursor-pointer disabled:opacity-50">{quote.status === 'converting' ? 'Resume' : 'Convert'}</button>}{quote.status === 'open' && <button disabled={busyId === quote.id} onClick={() => removeQuote(quote)} className="px-2 py-1.5 rounded-lg bg-rose-50 text-rose-600 font-black cursor-pointer disabled:opacity-50">Delete</button>}</div></td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
