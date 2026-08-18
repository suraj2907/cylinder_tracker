import React, { useState, useMemo } from 'react';

function emptyItem() {
  return { item_id: '', description: '', hsn: '', qty: 1, rate: 0, gst_rate: 18 };
}

// Convert a number into Indian currency words representation
function numberToWords(amount) {
  const sglDigit = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"],
        dblDigit = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"],
        tensPlace = ["", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"],
        handle_tens = (num) => {
          if (num < 10) return sglDigit[num];
          else if (num < 20) return dblDigit[num - 10];
          else {
            const tens = Math.floor(num / 10);
            const ones = num % 10;
            if (ones > 0) return tensPlace[tens] + " " + sglDigit[ones];
            else return tensPlace[tens];
          }
        },
        handle_thousands = (num) => {
          if (num === 0) return "";
          return handle_tens(num) + " Thousand";
        },
        handle_lakhs = (num) => {
          if (num === 0) return "";
          return handle_tens(num) + " Lakh";
        };

  let num = Math.floor(amount);
  if (num === 0) return "Zero";

  let words = "";
  // Extract crores (num >= 10000000)
  if (num >= 10000000) {
    const crores = Math.floor(num / 10000000);
    words += handle_tens(crores) + " Crore ";
    num %= 10000000;
  }
  // Extract lakhs (num >= 100000)
  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    words += handle_lakhs(lakhs) + " ";
    num %= 100000;
  }
  // Extract thousands (num >= 1000)
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    words += handle_thousands(thousands) + " ";
    num %= 1000;
  }
  // Extract hundreds (num >= 100)
  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    words += sglDigit[hundreds] + " Hundred ";
    num %= 100;
  }
  // Extract remaining tens/ones
  if (num > 0) {
    if (words !== "") words += "and ";
    words += handle_tens(num);
  }

  return words.trim().replace(/\s+/g, ' ');
}

export default function GenerateBill({
  restaurants = [],
  restaurantProfiles = {},
  createBill,
  itemsCatalog = [],
  partyItemPrices = []
}) {
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
  
  // Previous balance from profile
  const previousBalance = useMemo(() => {
    if (!selectedRestaurant) return 0;
    // Look up outstanding balance from profile (defaults to 0 if not calculated yet)
    return parseFloat(profile.totalOutstanding || profile.outstanding || 0);
  }, [profile, selectedRestaurant]);

  const handleItemChange = (idx, itemId) => {
    const itemObj = itemsCatalog.find(i => i.id === itemId);
    if (!itemObj) return;

    // Check custom party price override
    const partyOverride = partyItemPrices.find(
      p => p.restaurant_name === selectedRestaurant && p.item_id === itemId
    );

    const finalRate = partyOverride ? parseFloat(partyOverride.price) : parseFloat(itemObj.default_rate || 0);

    // If item name contains empty/khali, or gst_applicable is false, then GST is 0%
    const isGstFree = itemObj.gst_applicable === false ||
                      itemObj.name.toLowerCase().includes('empty') ||
                      itemObj.name.toLowerCase().includes('khali');
    const finalGstRate = isGstFree ? 0 : (parseFloat(itemObj.gst_rate) || 18);

    setItems(prev => prev.map((it, i) => {
      if (i === idx) {
        return {
          ...it,
          item_id: itemId,
          description: itemObj.name,
          hsn: itemObj.hsn_code || '27111900',
          rate: finalRate,
          gst_rate: finalGstRate
        };
      }
      return it;
    }));
  };

  const updateItemQtyOrRate = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Compute GST based on individual line items
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;

    items.forEach(it => {
      const lineTotal = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
      subtotal += lineTotal;

      if (gstMode === 'none') {
        taxable += lineTotal;
      } else {
        const itemObj = itemsCatalog.find(cat => cat.id === it.item_id);
        const isGstFree = (itemObj && (itemObj.gst_applicable === false || 
                                       itemObj.name.toLowerCase().includes('empty') || 
                                       itemObj.name.toLowerCase().includes('khali'))) ||
                           (it.description && (it.description.toLowerCase().includes('empty') || 
                                               it.description.toLowerCase().includes('khali')));
        
        const lineGstRate = isGstFree ? 0 : (parseFloat(it.gst_rate) || 18);

        if (lineGstRate === 0) {
          taxable += lineTotal;
        } else {
          const lineTaxable = lineTotal / (1 + lineGstRate / 100);
          const lineTax = lineTotal - lineTaxable;
          taxable += lineTaxable;
          cgst += lineTax / 2;
          sgst += lineTax / 2;
        }
      }
    });

    return {
      subtotal,
      taxable,
      cgst,
      sgst,
      total: subtotal
    };
  }, [items, gstMode, itemsCatalog]);

  const handleGenerate = async () => {
    if (!selectedRestaurant) {
      alert('Pehle restaurant select karo');
      return;
    }
    if (items.length === 0 || items.some(it => !it.item_id || !it.qty || !it.rate)) {
      alert('Sabhi items select karo aur unki qty aur rate bharo');
      return;
    }
    setSaving(true);
    try {
      // Due Date = Bill Date + 7 days
      const d = new Date(billDate);
      d.setDate(d.getDate() + 7);
      const dueDate = d.toISOString().slice(0, 10);

      const bill = await createBill({
        restaurant_name: selectedRestaurant,
        bill_date: billDate,
        gst_mode: gstMode,
        items,
        subtotal: totals.subtotal,
        taxable_amount: Number(totals.taxable.toFixed(2)),
        cgst: Number(totals.cgst.toFixed(2)),
        sgst: Number(totals.sgst.toFixed(2)),
        total_amount: Number(totals.total.toFixed(2)),
        due_date: dueDate,
        payment_status: 'unpaid',
        amount_paid: 0
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
  const currentBalance = previousBalance + totals.total;

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
            className="text-sm font-bold text-sky-700 hover:underline cursor-pointer"
          >
            ← Naya Bill Banao
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 cursor-pointer"
          >
            🖨️ Print / Save PDF
          </button>
        </div>

        {/* Printable Section */}
        <div id="bill-print-area" className="bg-white border border-slate-350 rounded-2xl p-8 max-w-2xl mx-auto shadow-sm">
          <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">M/S SHREE BALAJI AGENCIES</h2>
              <p className="text-[10px] text-slate-500 mt-1">Kamthi Line Beside SBI ATM, Rajnandgaon, Chhattisgarh, 491441</p>
              <p className="text-[10px] text-slate-500">📞 9407922288 | ✉️ msspagency@gmail.com</p>
              {gstMode === 'gst' && <p className="text-[10px] text-slate-500 font-semibold">GSTIN: 22SNZPS3600E1ZH</p>}
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-lg">
                {gstMode === 'gst' ? 'TAX INVOICE' : 'PLAIN BILL'}
              </span>
              <p className="text-xs font-bold text-slate-700 mt-2">Invoice No: {invoiceLabel}</p>
              <p className="text-[10px] text-slate-500 font-semibold">Date: {billDate}</p>
              <p className="text-[10px] text-slate-500 font-semibold">Due Date: {savedBill.due_date || billDate}</p>
            </div>
          </div>

          {/* Bill To & Ship To Details */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-[11px]">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Bill To</p>
              <p className="font-extrabold text-slate-900 text-xs">{selectedRestaurant}</p>
              {profile.address && <p className="text-slate-500">{profile.address}</p>}
              {profile.mobile && <p className="text-slate-500">Mobile: {profile.mobile}</p>}
              {gstMode === 'gst' && profile.gst_num && <p className="text-slate-500 font-semibold">GSTIN: {profile.gst_num}</p>}
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Ship To</p>
              <p className="font-extrabold text-slate-900 text-xs">{selectedRestaurant}</p>
              {profile.address && <p className="text-slate-500">{profile.address}</p>}
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse mb-4">
            <thead>
              <tr className="border-b border-slate-300 font-bold text-slate-700 bg-slate-50/50">
                <th className="py-2.5 px-2">No</th>
                <th className="py-2.5 px-2">Items</th>
                {gstMode === 'gst' && <th className="py-2.5 px-2">HSN No.</th>}
                <th className="py-2.5 px-2 text-right">Qty.</th>
                <th className="py-2.5 px-2 text-right">Rate</th>
                {gstMode === 'gst' && <th className="py-2.5 px-2 text-right">Tax</th>}
                <th className="py-2.5 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const itemObj = itemsCatalog.find(cat => cat.id === it.item_id);
                const isGstFree = (itemObj && (itemObj.gst_applicable === false || 
                                               itemObj.name.toLowerCase().includes('empty') || 
                                               itemObj.name.toLowerCase().includes('khali'))) ||
                                   (it.description && (it.description.toLowerCase().includes('empty') || 
                                                       it.description.toLowerCase().includes('khali')));
                const lineGstRate = isGstFree ? 0 : (parseFloat(it.gst_rate) || 18);
                const lineTotal = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);

                let lineTaxAmount = 0;
                if (gstMode === 'gst' && lineGstRate > 0) {
                  const lineTaxable = lineTotal / (1 + lineGstRate / 100);
                  lineTaxAmount = lineTotal - lineTaxable;
                }

                return (
                  <tr key={idx} className="border-b border-slate-200 text-slate-800 hover:bg-slate-50/50">
                    <td className="py-2.5 px-2 font-medium text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-2 font-extrabold text-slate-900">{it.description}</td>
                    {gstMode === 'gst' && <td className="py-2.5 px-2 text-slate-500 font-semibold">{isGstFree ? '-' : it.hsn}</td>}
                    <td className="py-2.5 px-2 text-right font-black text-slate-900">{it.qty} PCS</td>
                    <td className="py-2.5 px-2 text-right">₹{Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    {gstMode === 'gst' && (
                      <td className="py-2.5 px-2 text-right font-bold text-slate-650">
                        ₹{lineTaxAmount.toFixed(2)}
                        <span className="text-[9px] text-slate-400 font-bold block">({lineGstRate}%)</span>
                      </td>
                    )}
                    <td className="py-2.5 px-2 text-right font-black text-slate-900">
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
              {/* Table Subtotal Row */}
              <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-300 border-b-2">
                <td colSpan={gstMode === 'gst' ? 3 : 2} className="py-2.5 px-2 text-xs uppercase tracking-wider">SUBTOTAL</td>
                <td className="py-2.5 px-2 text-right">
                  {items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0)}
                </td>
                <td className="py-2.5 px-2"></td>
                {gstMode === 'gst' && (
                  <td className="py-2.5 px-2 text-right">
                    ₹{(totals.cgst + totals.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                )}
                <td className="py-2.5 px-2 text-right">
                  ₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Subtotals & Bank details block */}
          <div className="grid grid-cols-2 gap-6 pt-3">
            {/* Terms & Bank details */}
            <div className="space-y-4">
              <div className="text-[10px] text-slate-500 font-semibold space-y-1">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wide block">Terms & Conditions</span>
                <p>1. Goods once sold will not be taken back or exchanged</p>
                <p>2. Empty cylinder returnable; loss/damage chargeable; subject to jurisdiction</p>
                <p>3. All disputes are subject to RAJNANDGAON jurisdiction only</p>
              </div>

              <div className="text-[10px] text-slate-500 font-semibold space-y-1">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-wide block">Bank Details</span>
                <div className="grid grid-cols-3 gap-y-0.5">
                  <span className="text-slate-400">Name</span>
                  <span className="col-span-2 text-slate-800 font-bold">MS SHREE BALAJI AGENCIES</span>
                  <span className="text-slate-400">IFSC</span>
                  <span className="col-span-2 text-slate-800 font-bold">SBIN0000464</span>
                  <span className="text-slate-400">Account No</span>
                  <span className="col-span-2 text-slate-800 font-bold">43204193003</span>
                  <span className="text-slate-400">Bank Name</span>
                  <span className="col-span-2 text-slate-800 font-bold">State Bank of India, RAJNANDGAON</span>
                </div>
              </div>

              {/* Payment QR Block */}
              <div className="flex items-start gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-w-[240px]">
                <img src="/payment-qr.png" alt="Payment QR" className="w-16 h-16 border border-slate-200 rounded-lg shrink-0 bg-white" />
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-700 block">Payment QR Code</span>
                  <span className="text-[8px] text-slate-400 block mt-0.5">UPI ID: 9407922288-3@ybl</span>
                  <span className="text-[7.5px] text-slate-400 font-semibold block">Scan with any UPI App</span>
                </div>
              </div>
            </div>

            {/* Tax calculations & Net outstanding */}
            <div className="space-y-2 text-xs text-right">
              <div className="space-y-1.5 text-slate-500 font-semibold text-[11px] pb-2 border-b">
                <div className="flex justify-between">
                  <span>Taxable Amount</span>
                  <span className="text-slate-900">₹{totals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {gstMode === 'gst' && (
                  <>
                    <div className="flex justify-between">
                      <span>CGST @9%</span>
                      <span className="text-slate-900">₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST @9%</span>
                      <span className="text-slate-900">₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between font-black text-sm text-slate-900 pb-2 border-b">
                <span>Total Amount</span>
                <span>₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-1.5 font-bold text-[11px] text-slate-500 pb-2 border-b">
                <div className="flex justify-between">
                  <span>Received Amount</span>
                  <span className="text-emerald-700 font-black">₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance</span>
                  <span className="text-slate-800">₹0.00</span>
                </div>
              </div>

              <div className="pt-1.5">
                <span className="text-[9px] text-slate-400 font-bold block uppercase">Total Amount (in words)</span>
                <span className="text-xs font-black text-slate-800 capitalize mt-0.5 block">
                  {numberToWords(Math.round(totals.total))} Rupees Only
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-customBorder rounded-2xl p-6 shadow-soft space-y-5 max-w-2xl mx-auto">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
        🧾 Generate New Tax Invoice
      </h2>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase">Selected Customer (Party)</label>
        {!selectedRestaurant ? (
          <div className="relative mt-1">
            <input
              className="w-full border border-customBorder rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-accentCyan shadow-sm"
              placeholder="Search partner hotels..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <div className="absolute z-10 w-full bg-white border border-customBorder rounded-xl mt-1 shadow-lg max-h-48 overflow-auto">
                {filteredRestaurants.map(r => (
                  <button
                    key={r.name}
                    className="block w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 border-b border-slate-100 last:border-0"
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
          <div className="mt-1 flex items-center justify-between bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2.5">
            <span className="text-xs font-black text-sky-900">{selectedRestaurant}</span>
            <button onClick={() => setSelectedRestaurant('')} className="text-xs font-black text-sky-700 hover:underline">
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
            className="mt-1 w-full border border-customBorder rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none"
            value={billDate}
            onChange={e => setBillDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-500 uppercase">GST Filing Status</label>
          <div className="mt-1 flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setGstMode('gst')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                gstMode === 'gst' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              GST Bill
            </button>
            <button
              onClick={() => setGstMode('none')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                gstMode === 'none' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              Plain Bill
            </button>
          </div>
        </div>
      </div>

      {selectedRestaurant && (
        <div className="border-t border-slate-200 pt-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-black text-slate-500 uppercase">
              Line Items {gstMode === 'gst' && '(Rate is tax inclusive)'}
            </label>
            <button onClick={addItem} className="text-xs font-black text-sky-700 hover:underline">
              + Add Item Row
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => {
              const selectedItemObj = itemsCatalog.find(cat => cat.id === it.item_id);
              const isOverStock = selectedItemObj && (it.qty > selectedItemObj.current_stock);
              return (
                <div key={i} className="space-y-1 bg-slate-50/50 p-3 rounded-xl border">
                  <div className="flex gap-2.5 items-center flex-wrap sm:flex-nowrap">
                    {/* Item dropdown selection */}
                    <select
                      required
                      className="flex-[2] border border-customBorder rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white w-full"
                      value={it.item_id}
                      onChange={e => handleItemChange(i, e.target.value)}
                    >
                      <option value="">Choose Cylinder/Service...</option>
                      {itemsCatalog.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} (Stock: {cat.current_stock} units)
                        </option>
                      ))}
                    </select>

                    <input
                      className="w-16 border border-customBorder rounded-lg px-2.5 py-1.5 text-xs font-bold text-center"
                      type="number"
                      placeholder="Qty"
                      value={it.qty}
                      onChange={e => updateItemQtyOrRate(i, 'qty', parseInt(e.target.value) || 0)}
                    />
                    <input
                      className="w-20 border border-customBorder rounded-lg px-2.5 py-1.5 text-xs font-bold text-center"
                      type="number"
                      placeholder="Rate"
                      value={it.rate}
                      onChange={e => updateItemQtyOrRate(i, 'rate', parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-xs font-black text-slate-700 w-20 text-right">
                      ₹{((it.qty || 0) * (it.rate || 0)).toLocaleString()}
                    </span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-650 font-black text-xs px-1">
                        ✕
                      </button>
                    )}
                  </div>
                  {/* Stock warning */}
                  {isOverStock && (
                    <span className="text-[10px] text-orange-600 font-bold block mt-1">
                      ⚠️ Warning: Entered qty exceeds live stock ({selectedItemObj.current_stock} available).
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bill Totals Panel */}
      {selectedRestaurant && (
        <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
          {gstMode === 'gst' && (
            <>
              <div className="flex justify-between text-slate-500 font-semibold">
                <span>Taxable Amount</span>
                <span>₹{totals.taxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-semibold">
                <span>CGST portion</span>
                <span>₹{totals.cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-semibold">
                <span>SGST portion</span>
                <span>₹{totals.sgst.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-black text-sm text-slate-900 pt-1.5 border-t">
            <span>Total Amount Due</span>
            <span>₹{totals.total.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md disabled:opacity-50 cursor-pointer"
      >
        {saving ? 'Saving invoice...' : '🧾 Save & Generate Invoice'}
      </button>
    </div>
  );
}
