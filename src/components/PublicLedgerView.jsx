import React, { useState, useEffect, useMemo, useRef } from 'react';
import { publicClient } from '../utils/supabaseClient';
import { norm, isNewBill, isNewPayment } from '../utils/dataUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function formatDateDisplay(dStr) {
  if (!dStr) return '—';
  try {
    const [y, m, d] = dStr.split('-');
    if (y && m && d) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(m, 10) - 1;
      return `${d} ${months[mIdx] || m} ${y}`;
    }
  } catch {
    // Return raw if failed
  }
  return dStr;
}

export default function PublicLedgerView({ token }) {
  const [restaurantProfile, setRestaurantProfile] = useState(null);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    async function loadFullLedger() {
      try {
        let partyName = token ? decodeURIComponent(token).trim() : '';
        if (partyName.startsWith('Qm') || partyName.includes('==')) {
          try {
            partyName = decodeURIComponent(atob(partyName));
          } catch {
            // keep partyName as is
          }
        }

        if (!partyName) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/public-ledger?party=${encodeURIComponent(partyName)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch public statement payload');
        }
        const payload = await response.json();

        setRestaurantProfile(payload.restaurant || { name: partyName, previous_balance: 0 });
        setLedgerRows(Array.isArray(payload.legacyRows) ? payload.legacyRows : []);
        setBills(Array.isArray(payload.bills) ? payload.bills : []);
        setPayments(Array.isArray(payload.payments) ? payload.payments : []);

        setLoading(false);
      } catch (err) {
        console.error('Error loading public statement:', err);
        setNotFound(true);
        setLoading(false);
      }
    }

    loadFullLedger();
  }, [token]);

  // Combine historical ledger rows + newly added bills & payments
  const { combinedTimeline, totalsSummary, dateRange } = useMemo(() => {
    const list = [];
    const normTarget = norm(restaurantProfile?.name || '');

    // 1. Historical official ledger entries
    (ledgerRows || []).forEach((e, idx) => {
      if (!e.entry_date || e.voucher_type === 'Balance') return;
      const credit = parseFloat(e.credit) || 0;
      const debit = parseFloat(e.debit) || 0;
      list.push({
        id: `leg_${idx}_${e.entry_date}_${e.sr_no}`,
        date: e.entry_date,
        voucher: e.voucher_type === 'Invoice' ? 'Sales Invoice' : e.voucher_type,
        srNo: e.sr_no || '—',
        paymentMode: e.payment_mode || '—',
        credit,
        debit,
        balance: e.balance !== null && e.balance !== undefined ? parseFloat(e.balance) : null,
        status: e.payment_status ? (e.payment_status.charAt(0).toUpperCase() + e.payment_status.slice(1)) : 'Paid',
        isOfficial: true
      });
    });

    // 2. Real-time bills generated on or after 18-Aug-2026
    (bills || []).forEach(b => {
      if (isNewBill(b)) {
        const bDate = b.bill_date;
        const debit = parseFloat(b.total_amount) || 0;
        const paid = parseFloat(b.amount_paid) || 0;
        const status = b.payment_status ? (b.payment_status.charAt(0).toUpperCase() + b.payment_status.slice(1)) : (paid >= debit ? 'Paid' : 'Unpaid');
        list.push({
          id: `bill_${b.id || bDate}_${debit}`,
          date: bDate,
          voucher: 'Sales Invoice',
          srNo: b.invoice_no || b.legacy_invoice_no || '—',
          paymentMode: '—',
          credit: 0,
          debit,
          balance: null,
          status,
          isOfficial: false
        });
      }
    });

    // 3. Real-time payments recorded on or after 18-Aug-2026
    (payments || []).forEach(p => {
      if (isNewPayment(p)) {
        const pDate = p.date || (p.created_at ? p.created_at.slice(0, 10) : '');
        const credit = parseFloat(p.amount) || 0;
        list.push({
          id: `pay_${p.id || pDate}_${credit}`,
          date: pDate,
          voucher: 'Payment-in',
          srNo: p.id ? String(p.id).slice(-4) : '—',
          paymentMode: p.payment_mode || p.mode || 'UPI',
          credit,
          debit: 0,
          balance: null,
          status: '—',
          isOfficial: false
        });
      }
    });

    // Sort chronologically
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Compute running balance accurately
    const baseBal = parseFloat(restaurantProfile?.previous_balance || 0);
    let runningBal = list.length > 0 && list[0].balance !== null ? list[0].balance : baseBal;

    let totCredit = 0;
    let totDebit = 0;

    const computedList = list.map((item, idx) => {
      totCredit += item.credit;
      totDebit += item.debit;

      if (item.isOfficial && item.balance !== null) {
        runningBal = item.balance;
      } else {
        runningBal = runningBal + item.debit - item.credit;
      }

      return {
        ...item,
        runningBalance: runningBal
      };
    });

    // Min & Max Dates
    const firstDate = computedList.length > 0 ? computedList[0].date : '';
    const lastDate = computedList.length > 0 ? computedList[computedList.length - 1].date : '';
    const dateRangeStr = firstDate && lastDate ? `${formatDateDisplay(firstDate)} - ${formatDateDisplay(lastDate)}` : 'Current Statement';

    // Total Receivable Amount
    const finalBalance = computedList.length > 0 ? computedList[computedList.length - 1].runningBalance : baseBal;

    return {
      combinedTimeline: computedList,
      totalsSummary: {
        totalCredit: totCredit,
        totalDebit: totDebit,
        finalBalance: Math.max(0, finalBalance)
      },
      dateRange: dateRangeStr
    };
  }, [ledgerRows, bills, payments, restaurantProfile]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const element = document.getElementById('party-ledger-report');
      if (!element) {
        window.print();
        return;
      }
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const safeName = (restaurantProfile?.name || 'Party').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Party_Ledger_${safeName}.pdf`);
    } catch (e) {
      console.error('Error generating PDF:', e);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Official Party Ledger...</p>
        </div>
      </div>
    );
  }

  if (notFound || !restaurantProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-soft border border-slate-100 text-center max-w-sm">
          <div className="text-3xl mb-2">🔍</div>
          <h2 className="text-base font-extrabold text-slate-900">Statement Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">Link may have expired or restaurant name is invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-6 font-sans">
      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center no-print">
        <div className="text-xs font-bold text-slate-500">
          Showing statement for <span className="font-extrabold text-slate-900">{restaurantProfile.name}</span>
        </div>
        <button
          onClick={handleDownloadPdf}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-soft active:scale-95 transition-all cursor-pointer"
        >
          <span>Download PDF</span> 📥
        </button>
      </div>

      {/* Main Printable Ledger Document Container */}
      <div
        ref={reportRef}
        id="party-ledger-report"
        className="bg-white max-w-4xl mx-auto p-6 sm:p-10 rounded-2xl shadow-soft border border-slate-200 text-slate-800 text-xs print:p-0 print:border-none print:shadow-none"
      >
        {/* Document Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
          {/* Company Branding */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">M/S Shree Balaji Agencies</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Commercial LPG Cylinder Partner</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 font-medium pt-1">Kamthi Line Beside SBI ATM, Rajnandgaon, Chhattisgarh, 491441</p>
            <p className="text-[11px] text-slate-600 font-medium">Phone No: +91- 9407922288 &nbsp;|&nbsp; GSTIN: 22SNZPS3600E1ZH</p>
          </div>

          {/* Report Title & Summary Box */}
          <div className="w-full sm:w-auto text-left sm:text-right space-y-2">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Party Ledger Report</h2>
            <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/70 text-left text-[11px] space-y-1 shadow-xs min-w-[220px]">
              <div className="text-[10px] text-slate-500 font-semibold border-b border-slate-200 pb-1">
                Date: {dateRange}
              </div>
              <div className="flex justify-between font-black text-slate-900 text-xs pt-0.5">
                <span>Total Receivable Amount:</span>
                <span className="text-rose-700">₹{totalsSummary.finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium text-[10px]">
                <span>Total Sales Amount:</span>
                <span>₹{totalsSummary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium text-[10px]">
                <span>Total Received Amount:</span>
                <span>₹{totalsSummary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Address Details */}
        <div className="py-4 border-b border-slate-200 flex justify-between items-end text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">To,</span>
            <h3 className="text-sm font-black text-slate-900">{restaurantProfile.name}</h3>
            {restaurantProfile.address ? <p className="text-slate-600 font-medium">{restaurantProfile.address}</p> : null}
            {restaurantProfile.mobile ? <p className="text-slate-600 font-semibold">Phone No: +91- {restaurantProfile.mobile}</p> : null}
            {restaurantProfile.gst_num ? <p className="text-slate-600 font-semibold">GSTIN: {restaurantProfile.gst_num}</p> : null}
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-y border-slate-300">
                <th className="py-2.5 px-2">Date</th>
                <th className="py-2.5 px-2">Voucher</th>
                <th className="py-2.5 px-2">Sr No</th>
                <th className="py-2.5 px-2">Payment Mode</th>
                <th className="py-2.5 px-2 text-right">Credit (₹)</th>
                <th className="py-2.5 px-2 text-right">Debit (₹)</th>
                <th className="py-2.5 px-2 text-right">Balance (₹)</th>
                <th className="py-2.5 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {combinedTimeline.map((row, idx) => {
                const isPaid = (row.status || '').toLowerCase() === 'paid';
                return (
                  <tr key={row.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-2 whitespace-nowrap text-slate-600 font-medium">
                      {formatDateDisplay(row.date)}
                    </td>
                    <td className="py-2 px-2 font-bold text-slate-800 whitespace-nowrap">
                      {row.voucher}
                    </td>
                    <td className="py-2 px-2 text-slate-600 font-semibold">
                      {row.srNo}
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {row.paymentMode}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-emerald-700">
                      {row.credit > 0 ? row.credit.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">
                      {row.debit > 0 ? row.debit.toFixed(1) : '0.0'}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-slate-900">
                      {row.runningBalance.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      {row.voucher === 'Sales Invoice' ? (
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isPaid ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                        }`}>
                          {row.status}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Closing Balance Row */}
              <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-300">
                <td colSpan={6} className="py-2.5 px-2 uppercase tracking-wide">Closing Balance</td>
                <td className="py-2.5 px-2 text-right text-rose-700 text-xs">
                  ₹{totalsSummary.finalBalance.toFixed(1)}
                </td>
                <td></td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black text-slate-900 border-t border-b-2 border-slate-400">
                <td colSpan={4} className="py-2.5 px-2 uppercase tracking-wide">Total</td>
                <td className="py-2.5 px-2 text-right text-emerald-800">
                  {totalsSummary.totalCredit.toFixed(1)}
                </td>
                <td className="py-2.5 px-2 text-right">
                  {totalsSummary.totalDebit.toFixed(1)}
                </td>
                <td className="py-2.5 px-2 text-right text-rose-700">
                  {totalsSummary.finalBalance.toFixed(1)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bank & Signature Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 text-[10px] text-slate-500">
          <div className="space-y-1">
            <span className="font-bold text-slate-700 uppercase">Bank Transfer Details:</span>
            <p>Account Name: <span className="font-bold text-slate-800">Shree Balaji Agencies</span></p>
            <p>Bank: <span className="font-bold text-slate-800">State Bank of India (SBI)</span></p>
            <p>UPI / Contact: <span className="font-bold text-slate-800">9407922288</span></p>
          </div>
          <div className="text-right flex flex-col justify-end">
            <p className="font-bold text-slate-800 text-xs uppercase">For M/S Shree Balaji Agencies</p>
            <p className="text-[10px] text-slate-400 pt-6">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
