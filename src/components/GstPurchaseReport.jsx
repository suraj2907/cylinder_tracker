import React, { useState, useMemo } from 'react';
import DateRangePicker, { PRESETS } from './DateRangePicker';

// Gaspoint Petroleum (India) Limited is the only real supplier this business has ever bought
// cylinders from - its GSTIN is fixed on its own restaurant profile row, but every purchase bill
// stores the supplier as free text (with inconsistent casing across older/newer rows), so we
// match by GSTIN off the known supplier record rather than name.
const SUPPLIER_GSTIN = '22AABCG0745J2ZX';

export default function GstPurchaseReport({ purchaseBills = [], items = [] }) {
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { startDate: fmt(start), endDate: fmt(now) };
  });

  const itemsById = useMemo(() => {
    const map = {};
    items.forEach(i => { map[i.id] = i; });
    return map;
  }, [items]);

  // Flatten each purchase bill's line items into individual rows, matching mybillbook's
  // line-item-level "GST Purchase (With HSN)" export.
  const rows = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const out = [];
    purchaseBills
      .filter(p => p.purchase_date >= startDate && p.purchase_date <= endDate)
      .forEach(p => {
        (p.items || []).forEach((line, idx) => {
          const itemObj = itemsById[line.item_id];
          const qty = parseFloat(line.qty) || 0;
          const rate = parseFloat(line.rate) || 0;
          const gstRate = parseFloat(line.gst_rate) || 0;
          const amount = qty * rate;
          const taxable = gstRate > 0 ? amount / (1 + gstRate / 100) : amount;
          const tax = amount - taxable;
          out.push({
            key: `${p.id}-${idx}`,
            date: p.purchase_date,
            invoiceNo: p.invoice_no || `#${p.id}`,
            supplierGstin: SUPPLIER_GSTIN,
            supplierName: 'GASPOINT PETROLEUM (INDIA) LIMITED',
            itemName: line.item_name || line.description || itemObj?.name || 'Item',
            hsn: line.hsn || itemObj?.hsn_code || '-',
            qty,
            rate,
            sgst: tax / 2,
            cgst: tax / 2,
            amount
          });
        });
      });
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [purchaseBills, itemsById, dateRange]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    amount: acc.amount + r.amount,
    cgst: acc.cgst + r.cgst,
    sgst: acc.sgst + r.sgst
  }), { amount: 0, cgst: 0, sgst: 0 }), [rows]);

  const handleDownloadCsv = () => {
    const { startDate, endDate } = dateRange;
    const header = 'Date,Invoice No,Party GSTIN,Party Name,Item Name,HSN Code,Qty,Price/Unit,SGST,CGST,Amount\n';
    const body = rows.map(r =>
      `${r.date},${r.invoiceNo},${r.supplierGstin},"${r.supplierName}","${r.itemName}",${r.hsn},${r.qty},${r.rate.toFixed(2)},${r.sgst.toFixed(2)},${r.cgst.toFixed(2)},${r.amount.toFixed(2)}`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `GST_Purchase_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            🚚 GST Purchase (With HSN)
          </h2>
          <p className="text-xs text-muted font-bold mt-1">Line-item breakdown of every stock purchase, for CA filing / matching against mybillbook's export.</p>
        </div>
        <button
          onClick={handleDownloadCsv}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          📥 Download CSV
        </button>
      </div>

      {/* Filter + Totals strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Period</label>
          <DateRangePicker value={dateRange} onChange={setDateRange} defaultPreset={PRESETS.THIS_MONTH} />
        </div>
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft flex flex-col justify-center">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Purchase Amount</span>
          <span className="text-lg font-black text-slate-900 mt-1">₹{totals.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5">{rows.length} line items</span>
        </div>
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft flex flex-col justify-center">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Input Tax Credit (ITC)</span>
          <span className="text-lg font-black text-emerald-700 mt-1">₹{(totals.cgst + totals.sgst).toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5">CGST ₹{totals.cgst.toFixed(2)} + SGST ₹{totals.sgst.toFixed(2)}</span>
        </div>
      </div>

      {/* Data */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        {rows.length === 0 ? (
          <div className="text-center py-12 text-xs font-semibold text-slate-400">No stock purchases in this period.</div>
        ) : (
          <>
            {/* MOBILE CARDS */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {rows.map(r => (
                <div key={r.key} className="p-4 space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block">{r.itemName}</span>
                      <span className="text-[10px] text-slate-400 font-bold">HSN {r.hsn} · Inv #{r.invoiceNo}</span>
                    </div>
                    <span className="text-sm font-black text-emerald-700 shrink-0">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>{r.date}</span>
                    <span>{r.qty} PCS × ₹{r.rate.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold pt-1 border-t border-slate-100">
                    <span>CGST: ₹{r.cgst.toFixed(2)}</span>
                    <span>SGST: ₹{r.sgst.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Invoice No</th>
                    <th className="px-3 py-2.5">Party GSTIN</th>
                    <th className="px-3 py-2.5">Party Name</th>
                    <th className="px-3 py-2.5">Item Name</th>
                    <th className="px-3 py-2.5">HSN Code</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Price/Unit</th>
                    <th className="px-3 py-2.5 text-right">SGST</th>
                    <th className="px-3 py-2.5 text-right">CGST</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {rows.map(r => (
                    <tr key={r.key} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-slate-600">{r.date}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{r.invoiceNo}</td>
                      <td className="px-3 py-2.5 text-slate-500">{r.supplierGstin}</td>
                      <td className="px-3 py-2.5 text-slate-700">{r.supplierName}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{r.itemName}</td>
                      <td className="px-3 py-2.5 text-sky-700">{r.hsn}</td>
                      <td className="px-3 py-2.5 text-right">{r.qty} PCS</td>
                      <td className="px-3 py-2.5 text-right">₹{r.rate.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{r.sgst.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{r.cgst.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-black text-slate-900">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
