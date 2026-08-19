import React, { useState, useMemo } from 'react';
import DateRangePicker from './DateRangePicker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getInvoiceLabel } from '../utils/dataUtils';

export default function SalesSummaryDashboard({
  bills = [],
  restaurants = [],
  deleteBill
}) {
  const [isAllTime, setIsAllTime] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    // Default to this month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10)
    };
  });

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'paid' | 'unpaid'
  const [partyFilter, setPartyFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('all'); // 'all' | 'Suraj' | 'Shivam'

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesDate = isAllTime || (bill.bill_date >= dateRange.startDate && bill.bill_date <= dateRange.endDate);
      const matchesStatus = statusFilter === 'all' ||
                            (statusFilter === 'paid' && bill.payment_status === 'paid') ||
                            (statusFilter === 'unpaid' && bill.payment_status !== 'paid');
      const matchesParty = !partyFilter || bill.restaurant_name === partyFilter;
      const matchesStaff = staffFilter === 'all' || 
                           (staffFilter === 'Suraj' && bill.created_by?.toLowerCase().includes('suraj')) ||
                           (staffFilter === 'Shivam' && bill.created_by?.toLowerCase().includes('shivam'));

      return matchesDate && matchesStatus && matchesParty && matchesStaff;
    });
  }, [bills, dateRange, isAllTime, statusFilter, partyFilter, staffFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalPaid = 0;

    filteredBills.forEach(b => {
      totalSales += parseFloat(b.total_amount) || 0;
      totalPaid += parseFloat(b.amount_paid) || 0;
    });

    const totalUnpaid = totalSales - totalPaid;

    return {
      totalSales,
      totalPaid,
      totalUnpaid
    };
  }, [filteredBills]);

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredBills.map(b => ({
      "Invoice No": getInvoiceLabel(b),
      "Date": b.bill_date,
      "Restaurant Name": b.restaurant_name,
      "GST Mode": (b.gst_mode || 'gst').toUpperCase(),
      "Taxable Value": b.taxable_amount,
      "CGST": b.cgst,
      "SGST": b.sgst,
      "Total Amount": b.total_amount,
      "Amount Paid": b.amount_paid,
      "Outstanding": b.total_amount - b.amount_paid,
      "Payment Status": b.payment_status,
      "Created By": b.created_by
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Summary");
    XLSX.writeFile(workbook, `Sales_Summary_${isAllTime ? 'AllTime' : dateRange.startDate + '_to_' + dateRange.endDate}.xlsx`);
  };

  // Export to PDF
  const exportToPdf = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("M/S SHREE BALAJI AGENCIES", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Sales Summary Report: ${isAllTime ? 'All Time Records' : dateRange.startDate + ' to ' + dateRange.endDate}`, 14, 22);

    const headers = [["Inv No", "Date", "Customer", "Subtotal", "Tax", "Total", "Status"]];
    const data = filteredBills.map(b => [
      getInvoiceLabel(b),
      b.bill_date,
      b.restaurant_name,
      `₹${(parseFloat(b.taxable_amount) || 0).toFixed(2)}`,
      `₹${((parseFloat(b.cgst) || 0) + (parseFloat(b.sgst) || 0)).toFixed(2)}`,
      `₹${(parseFloat(b.total_amount) || 0).toFixed(2)}`,
      (b.payment_status || 'unpaid').toUpperCase()
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [2, 132, 195] }
    });

    doc.save(`Sales_Summary_${dateRange.startDate}_to_${dateRange.endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header and Export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            📈 Sales Summary Report
          </h2>
          <p className="text-xs text-muted font-bold mt-1">Detailed overview of generated invoices, tax values, and collected balances.</p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={exportToExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            📊 Export Excel
          </button>
          <button
            onClick={exportToPdf}
            className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            🧾 Export PDF
          </button>
        </div>
      </div>

      {/* Date Range & Quick Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date Filter */}
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Billing Period</label>
            <button
              type="button"
              onClick={() => setIsAllTime(!isAllTime)}
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border transition-all cursor-pointer ${
                isAllTime ? 'bg-sky-600 text-white border-sky-600 shadow-xs' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {isAllTime ? '🌐 All Time' : '📅 Date Filter'}
            </button>
          </div>
          {!isAllTime ? (
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          ) : (
            <div className="text-xs font-bold text-sky-800 bg-sky-50 p-2 rounded-xl border border-sky-200 text-center">
              All {bills.length.toLocaleString()} Historical Bills
            </div>
          )}
        </div>

        {/* Customer/Party Filter */}
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Customer (Party)</label>
          <select
            className="w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
            value={partyFilter}
            onChange={e => setPartyFilter(e.target.value)}
          >
            <option value="">All customers...</option>
            {restaurants.map(r => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Payment Status Filter */}
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Status</label>
          <div className="flex bg-slate-100 rounded-xl p-1">
            {['all', 'paid', 'unpaid'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  statusFilter === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Staff Filter */}
        <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Staff Created By</label>
          <div className="flex bg-slate-100 rounded-xl p-1">
            {['all', 'Suraj', 'Shivam'].map(staff => (
              <button
                key={staff}
                onClick={() => setStaffFilter(staff)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  staffFilter === staff ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {staff}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-customBorder border-l-4 border-l-sky-500 rounded-2xl p-5 shadow-soft">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Total Sales value</span>
          <span className="text-xl font-black text-slate-900 block mt-1.5">
            ₹{metrics.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-white border border-customBorder border-l-4 border-l-emerald-500 rounded-2xl p-5 shadow-soft">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Total Amount Received</span>
          <span className="text-xl font-black text-emerald-800 block mt-1.5">
            ₹{metrics.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-white border border-customBorder border-l-4 border-l-amber-500 rounded-2xl p-5 shadow-soft">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Total Outstanding Balance</span>
          <span className="text-xl font-black text-amber-800 block mt-1.5">
            ₹{metrics.totalUnpaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                <th className="px-4 py-3">Inv No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3 text-right">Taxable</th>
                <th className="px-4 py-3 text-right">CGST</th>
                <th className="px-4 py-3 text-right">SGST</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.map(bill => {
                const outstanding = bill.total_amount - bill.amount_paid;
                return (
                  <tr key={bill.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {getInvoiceLabel(bill)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-650">{bill.bill_date}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{bill.restaurant_name}</td>
                    <td className="px-4 py-3 text-slate-500 font-semibold">{bill.created_by || 'Suraj'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">₹{bill.taxable_amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">₹{bill.cgst.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">₹{bill.sgst.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">₹{bill.total_amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                        bill.payment_status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}>
                        {bill.payment_status === 'paid' ? 'Paid' : `Unpaid (₹${outstanding.toFixed(0)})`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm("Sach me ye bill delete krna hai?")) {
                            deleteBill(bill.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 font-semibold italic">
                    No sales invoices matching these filters.
                    {bills.length === 0 && <span className="block mt-1 text-[10px]">Use the bulk importer to import old mybillbook reports first.</span>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
