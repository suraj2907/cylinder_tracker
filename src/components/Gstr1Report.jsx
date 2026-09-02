import React, { useState, useMemo } from 'react';
import DateRangePicker, { PRESETS } from './DateRangePicker';
import { getInvoiceLabel } from '../utils/dataUtils';

// This business and every real customer are in Chhattisgarh (state code 22) - matches what
// mybillbook's own GSTR-1 export shows for every row, so it's a safe constant rather than a
// field we'd need to store per party.
const STATE_CODE = '22';
const STATE_NAME = 'Chhattisgarh';

export default function Gstr1Report({ bills = [], restaurantProfiles = {} }) {
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { startDate: fmt(start), endDate: fmt(now) };
  });

  const rows = useMemo(() => {
    const { startDate, endDate } = dateRange;
    return bills
      .filter(b => b.bill_date >= startDate && b.bill_date <= endDate)
      .map(b => {
        const profile = restaurantProfiles[b.restaurant_name] || {};
        const taxable = parseFloat(b.taxable_amount) || 0;
        const cgst = parseFloat(b.cgst) || 0;
        const sgst = parseFloat(b.sgst) || 0;
        const total = parseFloat(b.total_amount) || 0;
        const taxPct = taxable > 0 ? Math.round(((cgst + sgst) / taxable) * 100) : 0;
        return {
          id: b.id,
          gstin: profile.gst_num || '',
          customerName: b.restaurant_name,
          invoiceNo: getInvoiceLabel(b),
          invoiceDate: b.bill_date,
          invoiceValue: total,
          taxPct,
          taxableValue: taxable,
          cgst,
          sgst,
          igst: 0
        };
      })
      .sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''));
  }, [bills, dateRange, restaurantProfiles]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    invoiceValue: acc.invoiceValue + r.invoiceValue,
    taxableValue: acc.taxableValue + r.taxableValue,
    cgst: acc.cgst + r.cgst,
    sgst: acc.sgst + r.sgst
  }), { invoiceValue: 0, taxableValue: 0, cgst: 0, sgst: 0 }), [rows]);

  const handleDownloadCsv = () => {
    const { startDate, endDate } = dateRange;
    const header = 'GSTIN,Customer Name,State Code,State Name,Invoice Number,Invoice Date,Invoice Value,Total Tax(%),Taxable Value,CGST,SGST,IGST\n';
    const body = rows.map(r =>
      `${r.gstin},"${r.customerName}",${STATE_CODE},${STATE_NAME},${r.invoiceNo},${r.invoiceDate},${r.invoiceValue.toFixed(2)},${r.taxPct},${r.taxableValue.toFixed(2)},${r.cgst.toFixed(2)},${r.sgst.toFixed(2)},${r.igst.toFixed(2)}`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `GSTR1_Sales_${startDate}_to_${endDate}.csv`);
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
            🧾 GSTR-1 (Sales)
          </h2>
          <p className="text-xs text-muted font-bold mt-1">Every GST tax invoice, for CA filing / matching against mybillbook's export.</p>
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
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Invoice Value</span>
          <span className="text-lg font-black text-slate-900 mt-1">₹{totals.invoiceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5">{rows.length} invoices</span>
        </div>
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft flex flex-col justify-center">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Taxable Value / Tax</span>
          <span className="text-lg font-black text-slate-900 mt-1">₹{totals.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-slate-400 font-bold mt-0.5">CGST ₹{totals.cgst.toFixed(2)} + SGST ₹{totals.sgst.toFixed(2)}</span>
        </div>
      </div>

      {/* Data */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        {rows.length === 0 ? (
          <div className="text-center py-12 text-xs font-semibold text-slate-400">No GST sales invoices in this period.</div>
        ) : (
          <>
            {/* MOBILE CARDS */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {rows.map(r => (
                <div key={r.id} className="p-4 space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">{r.customerName}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{r.gstin || 'No GSTIN'}</span>
                    </div>
                    <span className="text-sm font-black text-emerald-700 shrink-0">₹{r.invoiceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>{r.invoiceNo} · {r.invoiceDate}</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{r.taxPct}% GST</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold pt-1 border-t border-slate-100">
                    <span>Taxable: ₹{r.taxableValue.toFixed(2)}</span>
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
                    <th className="px-3 py-2.5">GSTIN</th>
                    <th className="px-3 py-2.5">Customer Name</th>
                    <th className="px-3 py-2.5">State</th>
                    <th className="px-3 py-2.5">Invoice #</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-right">Invoice Value</th>
                    <th className="px-3 py-2.5 text-right">Tax %</th>
                    <th className="px-3 py-2.5 text-right">Taxable Value</th>
                    <th className="px-3 py-2.5 text-right">CGST</th>
                    <th className="px-3 py-2.5 text-right">SGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-slate-500">{r.gstin || '-'}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{r.customerName}</td>
                      <td className="px-3 py-2.5 text-slate-500">{STATE_CODE} - {STATE_NAME}</td>
                      <td className="px-3 py-2.5 text-sky-700 font-bold">{r.invoiceNo}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.invoiceDate}</td>
                      <td className="px-3 py-2.5 text-right font-black text-slate-900">₹{r.invoiceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{r.taxPct}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{r.taxableValue.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{r.cgst.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{r.sgst.toFixed(2)}</td>
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
