import React, { useState, useMemo, useEffect } from 'react';
import { getInvoiceLabel, norm } from '../utils/dataUtils';
import { shareInvoicePDFOnWhatsApp, exportBillPDF } from '../utils/exportUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  partyItemPrices = [],
  bills = [],
  payments = [],
  nextSuggestedInvoiceNo = 3499,
  batches = []
}) {
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [search, setSearch] = useState('');
  const [gstMode, setGstMode] = useState('gst'); // 'gst' | 'none'
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customInvoiceNo, setCustomInvoiceNo] = useState('');

  // Compute active batch (e.g. Batch #133 if 132 is latest)
  const latestActiveBatch = useMemo(() => {
    let maxB = 132;
    (batches || []).forEach(b => {
      const num = parseInt(b.batch || b.batch_num, 10);
      if (!isNaN(num) && num > maxB) maxB = num;
    });
    return maxB >= 132 ? 133 : (maxB + 1);
  }, [batches]);

  const [batchNum, setBatchNum] = useState(() => String(latestActiveBatch));
  const [items, setItems] = useState([emptyItem()]);
  const [savedBill, setSavedBill] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (nextSuggestedInvoiceNo) {
      setCustomInvoiceNo(String(nextSuggestedInvoiceNo));
    }
  }, [nextSuggestedInvoiceNo]);

  useEffect(() => {
    if (latestActiveBatch) {
      setBatchNum(String(latestActiveBatch));
    }
  }, [latestActiveBatch]);

  // Comprehensive party list combining Supabase restaurant profiles, valid list, and cylinder list with canonical deduplication
  const allAvailableParties = useMemo(() => {
    const map = new Map();
    // 1. From database restaurantProfiles
    Object.keys(restaurantProfiles || {}).forEach(rawName => {
      const canonical = norm(rawName);
      if (canonical && canonical !== 'Unknown' && !map.has(canonical)) {
        const prof = restaurantProfiles[rawName] || {};
        map.set(canonical, {
          name: canonical,
          mobile: prof.mobile || '',
          gst_num: prof.gst_num || '',
          address: prof.address || ''
        });
      }
    });
    // 2. From VALID_RESTAURANTS & restaurants prop
    (restaurants || []).forEach(r => {
      const rawName = typeof r === 'string' ? r : r.name;
      const canonical = norm(rawName);
      if (canonical && canonical !== 'Unknown' && !map.has(canonical)) {
        map.set(canonical, {
          name: canonical,
          mobile: (typeof r === 'object' && r.mobile) || '',
          gst_num: (typeof r === 'object' && r.gst_num) || '',
          address: (typeof r === 'object' && r.address) || ''
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [restaurantProfiles, restaurants]);

  const filteredRestaurants = useMemo(() => {
    if (!search.trim()) return allAvailableParties.slice(0, 10);
    const q = search.toLowerCase().trim();
    return allAvailableParties.filter(r => 
      r.name.toLowerCase().includes(q) || 
      (r.mobile && r.mobile.includes(q))
    ).slice(0, 15);
  }, [allAvailableParties, search]);

  const profile = restaurantProfiles[selectedRestaurant] ||
                  restaurantProfiles[norm(selectedRestaurant)] ||
                  Object.values(restaurantProfiles || {}).find(p => norm(p.name) === norm(selectedRestaurant)) ||
                  {};
  
  // Calculate dynamic previous balance for selected party prior to bill date
  const previousBalance = useMemo(() => {
    if (!selectedRestaurant) return 0;
    const normTarget = selectedRestaurant.trim().toLowerCase();

    const profileObj = restaurantProfiles[selectedRestaurant] || {};
    const openingBal = parseFloat(profileObj.previous_balance || 0);

    let totalBilled = 0;
    (bills || []).forEach(b => {
      if ((b.restaurant_name || "").trim().toLowerCase() === normTarget) {
        if (!billDate || (b.bill_date && b.bill_date < billDate)) {
          totalBilled += (parseFloat(b.total_amount) || 0);
        }
      }
    });

    let totalPaid = 0;
    (payments || []).forEach(p => {
      const pName = (p.restaurant_name || p.restaurantName || "").trim().toLowerCase();
      if (pName === normTarget) {
        const pDate = p.date || (p.created_at ? p.created_at.slice(0, 10) : "");
        if (!billDate || (pDate && pDate < billDate)) {
          totalPaid += (parseFloat(p.amount) || 0);
        }
      }
    });

    return Math.max(0, openingBal + totalBilled - totalPaid);
  }, [selectedRestaurant, restaurantProfiles, bills, payments, billDate]);

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
      subtotal: Number(subtotal.toFixed(2)),
      taxable: Number(taxable.toFixed(2)),
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      total: Number(subtotal.toFixed(2))
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
      const d = new Date(billDate);
      d.setDate(d.getDate() + 7);
      const dueDate = d.toISOString().slice(0, 10);

      const restObj = restaurantProfiles[selectedRestaurant] || {};
      const chosenBatch = parseInt(batchNum, 10) || latestActiveBatch;
      const bill = await createBill({
        restaurant_name: selectedRestaurant,
        restaurant_id: restObj.id || undefined,
        bill_date: billDate,
        batch_num: chosenBatch,
        invoice_no: customInvoiceNo ? parseInt(customInvoiceNo, 10) : undefined,
        gst_mode: gstMode,
        items,
        subtotal: totals.subtotal,
        taxable_amount: totals.taxable,
        cgst: totals.cgst,
        sgst: totals.sgst,
        total_amount: totals.total,
        due_date: dueDate,
        payment_status: 'unpaid',
        amount_paid: 0
      });
      setSavedBill(bill);
    } catch (err) {
      alert('Bill save nahi hua: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareBillOnWhatsApp = async () => {
    if (!savedBill) return;
    const billObj = {
      ...savedBill,
      restaurant_name: selectedRestaurant,
      items: items,
      total_amount: totals.total,
      taxable_amount: totals.taxable,
      cgst: totals.cgst,
      sgst: totals.sgst,
      gst_mode: gstMode,
      bill_date: billDate,
      invoice_no: savedBill.invoice_no || customInvoiceNo,
      gst_num: customGstNum || profile.gst_num
    };
    await shareInvoicePDFOnWhatsApp(billObj, profile);
  };

  const invoiceLabel = savedBill ? getInvoiceLabel(savedBill) : null;
  const currentBalance = previousBalance + totals.total;
  const savedAmountPaid = Number(savedBill?.amount_paid || 0);
  const savedBalance = Math.max(0, Number(savedBill?.total_amount || totals.total) - savedAmountPaid);

  if (savedBill) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto animate-fadeIn pb-16">
        {/* Top Actions Bar */}
        <div className="flex justify-between items-center no-print flex-wrap gap-2.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <button
            onClick={() => {
              const nextNo = (savedBill?.invoice_no ? parseInt(savedBill.invoice_no, 10) + 1 : nextSuggestedInvoiceNo);
              setCustomInvoiceNo(String(nextNo));
              setSavedBill(null);
              setItems([emptyItem()]);
              setSelectedRestaurant('');
            }}
            className="text-xs font-black text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer bg-sky-50 px-3 py-2 rounded-xl border border-sky-200"
          >
            ← Naya Bill Banao
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareBillOnWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              📤 Send WhatsApp PDF
            </button>
            <button
              onClick={() => {
                const billObj = {
                  ...savedBill,
                  restaurant_name: selectedRestaurant,
                  items: items,
                  total_amount: totals.total,
                  taxable_amount: totals.taxable,
                  cgst: totals.cgst,
                  sgst: totals.sgst,
                  gst_mode: gstMode,
                  bill_date: billDate,
                  invoice_no: savedBill.invoice_no || customInvoiceNo,
                  gst_num: customGstNum || profile.gst_num
                };
                exportBillPDF(billObj, profile);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              📄 Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-black hover:bg-sky-700 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              🖨️ Print
            </button>
          </div>
        </div>

        {/* Printable Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-soft text-xs overflow-hidden" id="bill-print-area">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-5 mb-5 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Authorized LPG Distributor</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">M/S SHREE BALAJI AGENCIES</h2>
              <p className="text-[11px] text-slate-600 font-medium mt-1">Kamthi Line Beside SBI ATM, Rajnandgaon, Chhattisgarh, 491441</p>
              <p className="text-[11px] text-slate-600 font-semibold mt-0.5">📞 9407922288 | ✉️ msspagency@gmail.com</p>
              {gstMode === 'gst' && (
                <p className="text-[11px] font-extrabold text-slate-800 mt-1">
                  GSTIN: <span className="text-sky-800 font-black">22SNZPS3600E1ZH</span>
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <span className={`inline-block px-3.5 py-1.5 text-[11px] font-black rounded-xl uppercase tracking-wider ${
                gstMode === 'gst' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 border border-slate-300'
              }`}>
                {gstMode === 'gst' ? 'TAX INVOICE' : 'PLAIN BILL'}
              </span>
              <p className="text-sm font-black text-sky-800 mt-2">Invoice No: {invoiceLabel}</p>
              <p className="text-xs text-slate-600 font-bold mt-0.5">Date: {billDate}</p>
              <p className="text-xs text-slate-500 font-semibold">Due Date: {savedBill.due_date || billDate}</p>
            </div>
          </div>

          {/* Bill To & Ship To Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">BILL TO</span>
              <p className="font-black text-slate-900 text-sm">{selectedRestaurant}</p>
              {profile.address ? <p className="text-slate-600 text-xs font-medium leading-relaxed">{profile.address}</p> : null}
              {profile.mobile ? <p className="text-slate-700 text-xs font-bold">Phone: +91 {profile.mobile}</p> : null}
              {profile.gst_num ? <p className="text-slate-800 text-xs font-black">GSTIN: {profile.gst_num}</p> : null}
            </div>
            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">SHIP TO</span>
              <p className="font-black text-slate-900 text-sm">{selectedRestaurant}</p>
              {profile.address ? <p className="text-slate-600 text-xs font-medium leading-relaxed">{profile.address}</p> : null}
              {profile.mobile ? <p className="text-slate-700 text-xs font-bold">Phone: +91 {profile.mobile}</p> : null}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl mb-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 font-black text-slate-700 bg-slate-100/70 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Item Description</th>
                  {gstMode === 'gst' && <th className="py-3 px-3.5">HSN Code</th>}
                  <th className="py-3 px-3.5 text-right">Qty</th>
                  <th className="py-3 px-3.5 text-right">Rate (₹)</th>
                  {gstMode === 'gst' && <th className="py-3 px-3.5 text-right">GST</th>}
                  <th className="py-3 px-3.5 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                    <tr key={idx} className="text-slate-800 hover:bg-slate-50/50">
                      <td className="py-3 px-3.5 font-medium text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-black text-slate-900">{it.description}</td>
                      {gstMode === 'gst' && <td className="py-3 px-3.5 text-slate-500 font-semibold">{isGstFree ? '-' : it.hsn}</td>}
                      <td className="py-3 px-3.5 text-right font-black text-slate-900">{it.qty} PCS</td>
                      <td className="py-3 px-3.5 text-right font-semibold">₹{Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      {gstMode === 'gst' && (
                        <td className="py-3 px-3.5 text-right font-bold text-slate-600">
                          ₹{lineTaxAmount.toFixed(2)}
                          <span className="text-[9px] text-slate-400 font-bold block">({lineGstRate}%)</span>
                        </td>
                      )}
                      <td className="py-3 px-3.5 text-right font-black text-slate-900">
                        ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/70 font-black text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={gstMode === 'gst' ? 3 : 2} className="py-3 px-3.5 text-xs uppercase tracking-wider">TOTAL PCS</td>
                  <td className="py-3 px-3.5 text-right font-black">
                    {items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0)} PCS
                  </td>
                  <td className="py-3 px-3.5"></td>
                  {gstMode === 'gst' && (
                    <td className="py-3 px-3.5 text-right text-xs">
                      ₹{(totals.cgst + totals.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  <td className="py-3 px-3.5 text-right font-black text-sm text-sky-900">
                    ₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Subtotals & Bank Details Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Terms & Bank Details */}
            <div className="space-y-4">
              <div className="text-[10.5px] text-slate-500 font-semibold space-y-1 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest block mb-1">Terms & Conditions</span>
                <p>1. Goods once sold will not be taken back or exchanged.</p>
                <p>2. Empty cylinders returnable; loss/damage chargeable.</p>
                <p>3. All disputes are subject to RAJNANDGAON jurisdiction only.</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] space-y-1.5">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest block mb-1">Bank Payment Details</span>
                <div className="grid grid-cols-3 gap-y-1 text-slate-600">
                  <span className="font-semibold text-slate-400">Account:</span>
                  <span className="col-span-2 font-black text-slate-900">MS SHREE BALAJI AGENCIES</span>
                  <span className="font-semibold text-slate-400">A/C No:</span>
                  <span className="col-span-2 font-black text-slate-900">43204193003</span>
                  <span className="font-semibold text-slate-400">IFSC:</span>
                  <span className="col-span-2 font-black text-slate-900">SBIN0000464</span>
                  <span className="font-semibold text-slate-400">Branch:</span>
                  <span className="col-span-2 font-bold text-slate-800">State Bank of India, Rajnandgaon</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <img src="/payment-qr.png" alt="Payment QR" className="w-14 h-14 border border-slate-200 rounded-xl shrink-0 bg-white p-1" />
                <div className="space-y-0.5">
                  <span className="text-[11px] font-black text-slate-900 block">UPI Quick Payment</span>
                  <span className="text-[10px] font-bold text-sky-800 block">9407922288-3@ybl</span>
                  <span className="text-[9px] text-slate-400 font-semibold block">Scan with GPay, PhonePe, Paytm</span>
                </div>
              </div>
            </div>

            {/* Calculations & Net Balance Due */}
            <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div className="space-y-2 text-xs border-b border-slate-200 pb-3">
                <div className="flex justify-between items-center text-slate-600 font-bold">
                  <span>Taxable Amount</span>
                  <span className="text-slate-900 font-black">₹{totals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {gstMode === 'gst' && (
                  <>
                    <div className="flex justify-between items-center text-slate-500 font-semibold">
                      <span>CGST @ 9%</span>
                      <span className="text-slate-900 font-bold">₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 font-semibold">
                      <span>SGST @ 9%</span>
                      <span className="text-slate-900 font-bold">₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Total Invoice Amount</span>
                <span className="text-base font-black text-slate-900">
                  ₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-1.5 text-xs border-t border-b border-slate-200 py-2.5">
                <div className="flex justify-between items-center text-slate-500 font-semibold">
                  <span>Received / Paid</span>
                  <span className="text-slate-700 font-bold">₹{savedAmountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-black text-rose-700">Balance Due</span>
                  <span className="font-black text-rose-700 text-sm">₹{savedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Amount (in words)</span>
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
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-soft space-y-6 max-w-2xl mx-auto animate-fadeIn pb-12">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
          Create New Invoice
        </h2>
        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
          GST & Plain Billing
        </span>
      </div>

      <div>
        <label className="text-xs font-black text-slate-700 tracking-wide block mb-1">Select Customer</label>
        {!selectedRestaurant ? (
          <div className="relative mt-1">
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all"
              placeholder="Search Restaurant/Customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="absolute left-3 top-3 text-slate-400 text-xs">🔍</span>
            {search && (
              <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-lg max-h-48 overflow-auto">
                {filteredRestaurants.map(r => (
                  <button
                    key={r.name}
                    className="block w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
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
          <div className="mt-1 flex items-center justify-between bg-sky-50/70 border border-sky-200 rounded-2xl p-3">
            <div>
              <span className="text-xs font-black text-slate-900 block">{selectedRestaurant}</span>
              {profile.mobile && <span className="text-[10px] text-slate-500 font-semibold">📞 +91-{profile.mobile}</span>}
            </div>
            <button onClick={() => setSelectedRestaurant('')} className="text-xs font-black text-sky-700 hover:text-sky-900 hover:underline cursor-pointer">
              Change
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-black text-slate-700 tracking-wide block mb-1">Invoice No.</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-2 text-xs font-black text-slate-400">INV-</span>
            <input
              type="number"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-3 py-2 text-xs font-black focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs"
              value={customInvoiceNo}
              onChange={e => setCustomInvoiceNo(e.target.value)}
              placeholder="3499"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-black text-slate-700 tracking-wide block mb-1">Bill Date</label>
          <input
            type="date"
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs cursor-pointer"
            value={billDate}
            onChange={e => setBillDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-black text-slate-700 tracking-wide block mb-1">
            Batch # <span className="text-[10px] text-sky-700 font-bold">(Active)</span>
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-2 text-xs font-black text-slate-400">#</span>
            <input
              type="number"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs font-black focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs"
              value={batchNum}
              onChange={e => setBatchNum(e.target.value)}
              placeholder={String(latestActiveBatch)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-black text-slate-700 tracking-wide block mb-1">Bill Type</label>
          <div className="mt-1 flex bg-slate-100 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setGstMode('none')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                gstMode === 'none' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Plain
            </button>
            <button
              onClick={() => setGstMode('gst')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                gstMode === 'gst' ? 'bg-sky-600 shadow-xs text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              GST
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
                <div key={i} className="space-y-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
                  {/* Item selection (full width) */}
                  <div>
                    <select
                      required
                      className="w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
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
                  </div>

                  {/* Inputs row: Qty, Rate, Total, Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Qty</span>
                        <input
                          className="w-16 sm:w-20 border border-customBorder rounded-xl px-2 py-1.5 text-xs font-bold text-center bg-white"
                          type="number"
                          placeholder="Qty"
                          value={it.qty}
                          onChange={e => updateItemQtyOrRate(i, 'qty', parseInt(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Rate (₹)</span>
                        <input
                          className="w-20 sm:w-24 border border-customBorder rounded-xl px-2 py-1.5 text-xs font-bold text-center bg-white"
                          type="number"
                          placeholder="Rate"
                          value={it.rate}
                          onChange={e => updateItemQtyOrRate(i, 'rate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Line Total</span>
                        <span className="text-xs font-black text-slate-900">
                          ₹{((it.qty || 0) * (it.rate || 0)).toLocaleString()}
                        </span>
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="w-7 h-7 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-black text-xs flex items-center justify-center cursor-pointer transition-all active:scale-95 ml-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock warning */}
                  {isOverStock && (
                    <span className="text-[10px] text-orange-600 font-bold block pt-1">
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
        className={`w-full py-3.5 rounded-2xl text-sm font-black shadow-soft transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
          saving
            ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 scale-[0.98] cursor-not-allowed opacity-90'
            : 'bg-sky-600 hover:bg-sky-700 hover:shadow-md text-white active:scale-95'
        }`}
      >
        {saving ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Creating Invoice...</span>
          </>
        ) : (
          '⚡ Generate & Preview'
        )}
      </button>
    </div>
  );
}
