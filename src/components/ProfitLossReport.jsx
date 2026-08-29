import React, { useState, useMemo } from 'react';
import DateRangePicker from './DateRangePicker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getTotalStockValueAsOf } from '../utils/stockLedgerUtils';

function formatLocalYMD(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ProfitLossReport({
  items = [],
  purchaseBills = [],
  stockAdjustments = [],
  bills = [],
  expenses = [],
  itemStockLedger = []
}) {
  const [dateRange, setDateRange] = useState(() => {
    // Default to this month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: formatLocalYMD(start),
      endDate: formatLocalYMD(now)
    };
  });

  const getDayBefore = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() - 1);
    return formatLocalYMD(d);
  };

  // Compute P&L data for the period
  const plData = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const prevDate = getDayBefore(startDate);

    // 1. Sales
    const totalSales = (bills || [])
      .filter(b => b.bill_date >= startDate && b.bill_date <= endDate)
      .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);

    // 2. Sales Returns
    const salesReturns = 0;

    // 3. Purchases from purchaseBills total_amount in range
    const totalPurchases = (purchaseBills || [])
      .filter(p => p.purchase_date >= startDate && p.purchase_date <= endDate)
      .reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);

    // 4. Purchase Returns
    const purchaseReturns = 0;

    // 5. Tax Payable (Sales GST portion: CGST + SGST)
    const taxPayable = (bills || [])
      .filter(b => b.bill_date >= startDate && b.bill_date <= endDate && b.gst_mode === 'gst')
      .reduce((sum, b) => sum + (parseFloat(b.cgst) || 0) + (parseFloat(b.sgst) || 0), 0);

    // 6. Tax Receivable (Purchase GST portion: CGST + SGST directly from purchaseBills)
    const taxReceivable = (purchaseBills || [])
      .filter(p => p.purchase_date >= startDate && p.purchase_date <= endDate)
      .reduce((sum, p) => sum + (parseFloat(p.cgst) || 0) + (parseFloat(p.sgst) || 0), 0);

    const stockTransactions = { purchaseBills, bills };
    const openingStockValue = getTotalStockValueAsOf(prevDate, items, itemStockLedger, stockTransactions);
    const closingStockValue = getTotalStockValueAsOf(endDate, items, itemStockLedger, stockTransactions);

    const taxableSales = (bills || [])
      .filter(b => b.bill_date >= startDate && b.bill_date <= endDate)
      .reduce((sum, b) => {
        const tax = (parseFloat(b.cgst) || 0) + (parseFloat(b.sgst) || 0);
        const amt = parseFloat(b.total_amount) || 0;
        return sum + (b.taxable_amount ? parseFloat(b.taxable_amount) : Math.max(0, amt - tax));
      }, 0);

    const rawGrossProfit = totalSales - salesReturns - totalPurchases + purchaseReturns - taxPayable + taxReceivable - openingStockValue + closingStockValue;
    const grossProfit = Number.isFinite(rawGrossProfit) ? Math.round(rawGrossProfit * 100) / 100 : 0;

    const otherIncome = 0;

    const totalExpenses = (expenses || [])
      .filter(e => (e.expense_date || e.date || '').slice(0, 10) >= startDate && (e.expense_date || e.date || '').slice(0, 10) <= endDate)
      .reduce((sum, e) => sum + (parseFloat(e.total_amount || e.amount) || 0), 0);

    const rawNetProfit = grossProfit + otherIncome - totalExpenses;
    const netProfit = Number.isFinite(rawNetProfit) ? Math.round(rawNetProfit * 100) / 100 : 0;

    return {
      totalSales: Number.isFinite(totalSales) ? totalSales : 0,
      taxableSales: Number.isFinite(taxableSales) ? taxableSales : 0,
      salesReturns: 0,
      totalPurchases: Number.isFinite(totalPurchases) ? totalPurchases : 0,
      purchaseReturns: 0,
      taxPayable: Number.isFinite(taxPayable) ? taxPayable : 0,
      taxReceivable: Number.isFinite(taxReceivable) ? taxReceivable : 0,
      openingStockValue,
      closingStockValue,
      grossProfit,
      otherIncome,
      totalExpenses: Number.isFinite(totalExpenses) ? totalExpenses : 0,
      netProfit
    };
  }, [items, purchaseBills, stockAdjustments, bills, expenses, dateRange, itemStockLedger]);

  const exportExcel = () => {
    const data = [
      { Particulars: "Revenue / Sales", Amount: plData.totalSales },
      { Particulars: "Sale Returns", Amount: plData.salesReturns },
      { Particulars: "Cost of Goods / Purchases", Amount: plData.totalPurchases },
      { Particulars: "Purchase Returns", Amount: plData.purchaseReturns },
      { Particulars: "GST Tax Payable (CGST+SGST)", Amount: plData.taxPayable },
      { Particulars: "GST Tax Receivable (ITC)", Amount: plData.taxReceivable },
      { Particulars: "Opening Stock Valuation", Amount: plData.openingStockValue },
      { Particulars: "Closing Stock Valuation", Amount: plData.closingStockValue },
      { Particulars: "Gross Profit", Amount: plData.grossProfit },
      { Particulars: "Other Income", Amount: plData.otherIncome },
      { Particulars: "Indirect Expenses", Amount: plData.totalExpenses },
      { Particulars: "Net Profit", Amount: plData.netProfit }
    ];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "P&L Report");
    XLSX.writeFile(workbook, `Profit_Loss_Report_${dateRange.startDate}_to_${dateRange.endDate}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("M/S SHREE BALAJI AGENCIES", 14, 15);
    doc.setFontSize(11);
    doc.text(`Trading Account & Profit & Loss Statement`, 14, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Period: ${dateRange.startDate} to ${dateRange.endDate}`, 14, 27);

    const headers = [["Particulars", "Amount (INR)"]];
    const data = [
      ["Revenue (Sales Invoice Total)", `INR ${plData.totalSales.toFixed(2)}`],
      ["Less: Sale Returns", `INR ${plData.salesReturns.toFixed(2)}`],
      ["Purchases (Stock Purchases)", `INR ${plData.totalPurchases.toFixed(2)}`],
      ["Plus: Purchase Returns", `INR ${plData.purchaseReturns.toFixed(2)}`],
      ["Less: GST Tax Payable (Outward Sales GST)", `INR ${plData.taxPayable.toFixed(2)}`],
      ["Plus: GST Input Tax Credit (Receivable)", `INR ${plData.taxReceivable.toFixed(2)}`],
      ["Less: Opening Stock value", `INR ${plData.openingStockValue.toFixed(2)}`],
      ["Plus: Closing Stock value", `INR ${plData.closingStockValue.toFixed(2)}`],
      ["Gross Trading Profit", `INR ${plData.grossProfit.toFixed(2)}`],
      ["Plus: Other Non-operating Income", `INR ${plData.otherIncome.toFixed(2)}`],
      ["Less: Indirect Operating Expenses", `INR ${plData.totalExpenses.toFixed(2)}`],
      ["NET OPERATING PROFIT / LOSS", `INR ${plData.netProfit.toFixed(2)}`]
    ];

    doc.autoTable({
      head: headers,
      body: data,
      startY: 33,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [124, 58, 237] }
    });

    doc.save(`Profit_Loss_${dateRange.startDate}_to_${dateRange.endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            📊 Trading Profit & Loss Report
          </h2>
          <p className="text-xs text-muted font-bold mt-1">Trading account summary with sales, purchases, tax reconciliations, and opening/closing stock.</p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={exportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            📊 Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            🧾 Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Date Filter */}
        <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft flex flex-col justify-between">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Accounting Period</label>
          <div className="mt-2.5">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Big P&L Card */}
        <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft md:col-span-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Net Period Profit</span>
            <span className={`text-2xl font-black block mt-1.5 ${
              plData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              ₹{Number(plData.netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`px-4 py-2.5 border text-[10px] font-black rounded-xl uppercase tracking-wider ${
            plData.netProfit >= 0 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {plData.netProfit >= 0 ? '📈 Profit / Surfeit' : '📉 Net Deficit'}
          </div>
        </div>
      </div>

      {/* P&L Statement Details */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft max-w-xl mx-auto">
        <div className="bg-slate-50 px-5 py-4 border-b border-customBorder text-center">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Statement of Operations
          </h3>
          <span className="text-[9px] text-slate-400 font-bold block mt-0.5">({dateRange.startDate} to {dateRange.endDate})</span>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Sale (+)</span>
              <span className="font-extrabold text-slate-900">₹{Number(plData.totalSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>Cr. Note / Sale Return (-)</span>
              <span>-₹{Number(plData.salesReturns).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Purchase (-)</span>
              <span className="font-extrabold text-slate-900">-₹{Number(plData.totalPurchases).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>Dr. Note / Purchase Return (+)</span>
              <span>+₹{Number(plData.purchaseReturns).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-rose-600">
              <span>Tax Payable (-)</span>
              <span className="font-black">-₹{Number(plData.taxPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-emerald-600">
              <span>Tax Receivable (+)</span>
              <span className="font-black">+₹{Number(plData.taxReceivable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>Opening Stock (-)</span>
              <span className="font-bold">-₹{Number(plData.openingStockValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>Closing Stock (+)</span>
              <span className="font-bold">+₹{Number(plData.closingStockValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="border-t border-b border-slate-200 py-3 my-2.5 flex justify-between font-black text-xs text-slate-900 uppercase">
              <span>Gross Profit</span>
              <span className={`text-sm ${plData.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{Number(plData.grossProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>Other Income (+)</span>
              <span>+₹{Number(plData.otherIncome).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-rose-600">
              <span>Indirect Expenses (-)</span>
              <span className="font-black">-₹{Number(plData.totalExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="border-t-2 border-slate-900 pt-3.5 my-2.5 flex justify-between font-black text-sm text-slate-900 uppercase">
              <span>Net Profit</span>
              <span className={`text-base ${plData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{Number(plData.netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
