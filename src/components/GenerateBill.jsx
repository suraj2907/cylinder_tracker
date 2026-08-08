import React, { useState, useMemo } from 'react';

const GST_RATE = 0.18; // Fixed 18% (9% CGST + 9% SGST)

function emptyItem() {
  return { description: '19.2kg Cylinder', hsn: '27111900', qty: 1, rate: 2900 };
}

export default function GenerateBill({ restaurants = [], restaurantProfiles = {}, createBill }) {
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [search, setSearch] = useState('');
  const [gstMode, setGstMode] = useState('gst'); // 'gst' | 'none'
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([emptyItem()]);
  const [savedBill, setSavedBill] = useState(null);
  const [saving, setSaving] = useState(false);

  const filteredRestaurants = useMemo(() => {
    if (!search) return restaurants.slice(0, 8);
    return restaurants.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  }, [restaurants, search]);

  const profile = restaurantProfiles[selectedRestaurant] || {};

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    if (gstMode === 'none') {
      return { subtotal, taxable: subtotal, cgst: 0, sgst: 0, total: subtotal };
    }
    // Rate is GST-inclusive, so back-calculate the taxable value from the total
    const taxable = subtotal / (1 + GST_RATE);
    const totalTax = subtotal - taxable;
    return { subtotal, taxable, cgst: totalTax / 2, sgst: totalTax / 2, total: subtotal };
  }, [items, gstMode]);

  const handleGenerate = async () => {
    if (!selectedRestaurant) {
      alert('Pehle restaurant select karo');
      return;
    }
    if (items.length === 0 || items.some(it => !it.qty || !it.rate)) {
      alert('Sabhi items mein qty aur rate bharo');
      return;
    }
    setSaving(true);
    try {
      const bill = await createBill({
        restaurant_name: selectedRestaurant,
        bill_date: billDate,
        gst_mode: gstMode,
        items,
        subtotal: totals.subtotal,
        taxable_amount: Number(totals.taxable.toFixed(2)),
        cgst: Number(totals.cgst.toFixed(2)),
        sgst: Number(totals.sgst.toFixed(2)),
        total_amount: Number(totals.total.toFixed(2))
      });
      setSavedBill(bill);
    } catch (e) {
      alert('Bill save nahi hua: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  const invoiceLabel = savedBill ? `INV-${String(savedBill.id).padStart(3, '0')}` : null;

  if (savedBill) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4 no-print">
          <button
            onClick={() => {
              setSavedBill(null);
              setItems([emptyItem()]);
              setSelectedRestaurant('');
            }}
            className="text-sm font-bold text-sky-700 hover:underline"
          >
            ← Naya Bill Banao
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700"
          >
            🖨️ Print / Save PDF
          </button>
        </div>

        <div id="bill-print-area" className="bg-white border border-customBorder rounded-2xl p-8 max-w-2xl mx-auto shadow-soft">
          <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">M/S SHREE BALAJI AGENCIES</h2>
              <p className="text-xs text-slate-500 mt-1">Kamthi Line Beside SBI ATM, Rajnandgaon, Chhattisgarh, 491441</p>
              <p className="text-xs text-slate-500">📞 9407922288 | ✉️ msspagency@gmail.com</p>
              {gstMode === 'gst' && <p className="text-xs text-slate-500">GSTIN: 22SNZPS3600E1ZH</p>}
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg">
                {gstMode === 'gst' ? 'TAX INVOICE' : 'BILL'}
              </span>
              <p className="text-xs font-bold text-slate-700 mt-2">Invoice No: {invoiceLabel}</p>
              <p className="text-xs text-slate-500">Date: {billDate}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase">Bill To</p>
            <p className="text-sm font-extrabold text-slate-900">{selectedRestaurant}</p>
            {profile.address && <p className="text-xs text-slate-500">{profile.address}</p>}
            {profile.mobile && <p className="text-xs text-slate-500">Mobile: {profile.mobile}</p>}
            {gstMode === 'gst' && profile.gst_num && <p className="text-xs text-slate-500">GSTIN: {profile.gst_num}</p>}
          </div>

          <table className="w-full text-left text-xs border-collapse mb-4">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2">Item</th>
                {gstMode === 'gst' && <th className="py-2">HSN</th>}
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2">{it.description}</td>
                  {gstMode === 'gst' && <td className="py-2">{it.hsn}</td>}
                  <td className="py-2 text-right">{it.qty}</td>
                  <td className="py-2 text-right">₹{Number(it.rate).toFixed(2)}</td>
                  <td className="py-2 text-right">₹{(it.qty * it.rate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-xs">
              {gstMode === 'gst' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable Amount</span>
                    <span>₹{totals.taxable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CGST @9%</span>
                    <span>₹{totals.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">SGST @9%</span>
                    <span>₹{totals.sgst.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-slate-300 pt-1 font-black text-sm text-slate-900">
                <span>Total</span>
                <span>₹{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] text-slate-400">
            <p>Terms: Goods once sold will not be taken back. Empty cylinder returnable; loss/damage chargeable.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-customBorder rounded-2xl p-6 shadow-soft space-y-5 max-w-2xl mx-auto">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-700">🧾 Generate Bill</h2>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase">Restaurant</label>
        {!selectedRestaurant ? (
          <div className="relative mt-1">
            <input
              className="w-full border border-customBorder rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accentCyan"
              placeholder="Restaurant search karo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <div className="absolute z-10 w-full bg-white border border-customBorder rounded-xl mt-1 shadow-lg max-h-48 overflow-auto">
                {filteredRestaurants.map(r => (
                  <button
                    key={r.name}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => {
                      setSelectedRestaurant(r.name);
                      setSearch('');
                    }}
                  >
                    {r.name}
                  </button>
                ))}
                {filteredRestaurants.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400">Koi match nahi mila</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
            <span className="text-sm font-bold text-sky-900">{selectedRestaurant}</span>
            <button onClick={() => setSelectedRestaurant('')} className="text-xs text-sky-700 hover:underline">
              Change
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Bill Date</label>
          <input
            type="date"
            className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accentCyan"
            value={billDate}
            onChange={e => setBillDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Bill Type</label>
          <div className="mt-1 flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setGstMode('gst')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                gstMode === 'gst' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              GST Bill
            </button>
            <button
              onClick={() => setGstMode('none')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                gstMode === 'none' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              Plain Bill
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-slate-500 uppercase">
            Items {gstMode === 'gst' && '(Rate mein GST included)'}
          </label>
          <button onClick={addItem} className="text-xs font-bold text-sky-700 hover:underline">
            + Item Add Karo
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="flex-[2] border border-customBorder rounded-lg px-2 py-1.5 text-xs"
                value={it.description}
                onChange={e => updateItem(i, 'description', e.target.value)}
                placeholder="Item"
              />
              <input
                className="flex-1 border border-customBorder rounded-lg px-2 py-1.5 text-xs"
                type="number"
                value={it.qty}
                onChange={e => updateItem(i, 'qty', e.target.value)}
                placeholder="Qty"
              />
              <input
                className="flex-1 border border-customBorder rounded-lg px-2 py-1.5 text-xs"
                type="number"
                value={it.rate}
                onChange={e => updateItem(i, 'rate', e.target.value)}
                placeholder="Rate"
              />
              <span className="text-xs font-bold text-slate-600 w-16 text-right">
                ₹{((it.qty || 0) * (it.rate || 0)).toFixed(0)}
              </span>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-1 text-xs">
        {gstMode === 'gst' && (
          <>
            <div className="flex justify-between text-slate-500">
              <span>Taxable Amount</span>
              <span>₹{totals.taxable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>CGST @9%</span>
              <span>₹{totals.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>SGST @9%</span>
              <span>₹{totals.sgst.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-black text-sm text-slate-900 pt-1">
          <span>Total</span>
          <span>₹{totals.total.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 disabled:opacity-50"
      >
        {saving ? 'Generating...' : '🧾 Generate Bill'}
      </button>
    </div>
  );
}
