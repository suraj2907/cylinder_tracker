import React, { useState, useEffect, useMemo, useRef } from 'react';
import { publicClient } from '../utils/supabaseClient';
import { norm, isNewBill, isNewPayment } from '../utils/dataUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function formatDateShort(dStr) {
  if (!dStr) return '—';
  try {
    const [y, m, d] = dStr.split('-');
    if (y && m && d) {
      return `${d}-${m}-${y}`;
    }
  } catch {
    // Return raw
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
  
  // Date filter state: '6months' (default), '3months', '1month', 'all', 'custom'
  const [filterPreset, setFilterPreset] = useState('6months');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
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

        let payload = null;
        try {
          const response = await fetch(`/api/public-ledger?party=${encodeURIComponent(partyName)}`);
          if (response.ok) {
            payload = await response.json();
          }
        } catch (apiErr) {
          console.warn('Public API endpoint error, using direct Supabase client fallback', apiErr);
        }

        if (!payload || !payload.restaurant) {
          // Direct Supabase Client Fallback
          const rawTarget = partyName.trim();
          const { data: restList } = await publicClient
            .from('restaurants')
            .select('name, mobile, previous_balance, address, gst_num')
            .or(`name.ilike.%${rawTarget}%,name.ilike.${rawTarget}`)
            .limit(5);

          const restData = restList?.[0] || null;
          const canonicalName = restData?.name || rawTarget;

          const searchTerms = [rawTarget, canonicalName];
          if (restData?.name) searchTerms.push(restData.name);
          const stopWords = ['hotel', 'cafe', 'dhaba', 'dhabha', 'restaurant', 'restuarant', 'private', 'limited', 'project', 'and', 'the'];
          rawTarget.split(/\s+/).forEach(w => {
            const cleanW = w.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanW.length >= 4 && !stopWords.includes(cleanW)) {
              searchTerms.push(cleanW);
            }
          });

          const orFilter = [...new Set(searchTerms)].map(t => `restaurant_name.ilike.%${t}%`).join(',');

          const [
            { data: legacyRows },
            { data: billsData },
            { data: paymentsData }
          ] = await Promise.all([
            publicClient
              .from('legacy_ledger_entries')
              .select('*')
              .or(orFilter)
              .not('entry_date', 'is', null)
              .order('entry_date', { ascending: true }),
            publicClient
              .from('bills')
              .select('*')
              .or(orFilter)
              .order('bill_date', { ascending: true }),
            publicClient
              .from('payments')
              .select('*')
              .or(orFilter)
              .order('date', { ascending: true })
          ]);

          payload = {
            restaurant: restData || { name: canonicalName, previous_balance: 0 },
            legacyRows: legacyRows || [],
            bills: billsData || [],
            payments: paymentsData || []
          };
        }

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

  // Combine full history of transactions
  const fullTimeline = useMemo(() => {
    const list = [];

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
        dueDate: e.due_date || '',
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
          dueDate: b.due_date || '',
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
          paymentMode: p.payment_mode || p.mode || 'Upi',
          credit,
          debit: 0,
          balance: null,
          dueDate: '',
          status: '—',
          isOfficial: false
        });
      }
    });

    // Sort chronologically ascending
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Compute running balance accurately across all time
    const baseBal = parseFloat(restaurantProfile?.previous_balance || 0);
    let runningBal = baseBal;

    return list.map((item) => {
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
  }, [ledgerRows, bills, payments, restaurantProfile]);

  // Compute filtered timeline, opening balance, totals, and date range
  const {
    filteredTimeline,
    openingBalance,
    totalsSummary,
    dateRangeLabel,
    startDateStr,
    endDateStr
  } = useMemo(() => {
    if (!fullTimeline || fullTimeline.length === 0) {
      const base = parseFloat(restaurantProfile?.previous_balance || 0);
      return {
        filteredTimeline: [],
        openingBalance: base,
        totalsSummary: { totalCredit: 0, totalDebit: 0, finalBalance: base, overdueAmount: 0 },
        dateRangeLabel: 'Current Statement',
        startDateStr: '',
        endDateStr: ''
      };
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    let startLimit = '';
    let endLimit = todayStr;

    if (filterPreset === '6months') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      startLimit = d.toISOString().slice(0, 10);
    } else if (filterPreset === '3months') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      startLimit = d.toISOString().slice(0, 10);
    } else if (filterPreset === '1month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      startLimit = d.toISOString().slice(0, 10);
    } else if (filterPreset === 'custom') {
      startLimit = customStartDate || '2000-01-01';
      endLimit = customEndDate || todayStr;
    } else {
      // 'all'
      startLimit = fullTimeline[0]?.date || '2000-01-01';
      endLimit = fullTimeline[fullTimeline.length - 1]?.date || todayStr;
    }

    // Determine Opening Balance just before startLimit
    const priorItems = fullTimeline.filter(item => (item.date || '') < startLimit);
    let openBal = parseFloat(restaurantProfile?.previous_balance || 0);
    if (priorItems.length > 0) {
      openBal = priorItems[priorItems.length - 1].runningBalance;
    }

    // Items within the window
    const inWindow = fullTimeline.filter(item => {
      const d = item.date || '';
      return d >= startLimit && d <= endLimit;
    });

    let totCredit = 0;
    let totDebit = 0;
    let overdueAmt = 0;

    inWindow.forEach(item => {
      totCredit += item.credit;
      totDebit += item.debit;
      if (item.voucher === 'Sales Invoice' && item.status !== 'Paid') {
        overdueAmt += item.debit;
      }
    });

    const finalBal = inWindow.length > 0 ? inWindow[inWindow.length - 1].runningBalance : openBal;

    const actualFirstDate = inWindow.length > 0 ? inWindow[0].date : startLimit;
    const actualLastDate = inWindow.length > 0 ? inWindow[inWindow.length - 1].date : endLimit;
    const dateRange = `${formatDateShort(actualFirstDate)} - ${formatDateShort(actualLastDate)}`;

    return {
      filteredTimeline: inWindow,
      openingBalance: openBal,
      totalsSummary: {
        totalCredit: totCredit,
        totalDebit: totDebit,
        finalBalance: Math.max(0, finalBal),
        overdueAmount: overdueAmt
      },
      dateRangeLabel: dateRange,
      startDateStr: actualFirstDate,
      endDateStr: actualLastDate
    };
  }, [fullTimeline, filterPreset, customStartDate, customEndDate, restaurantProfile]);

  // High-Quality Multi-Page Vector PDF Generator matching BillBook exact format
  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Top Header: Balaji Agencies Logo & Info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text('M/S Shree Balaji Agencies', 14, 16);

      doc.setFontSize(12);
      doc.text('Party Ledger Report', pageWidth - 14, 16, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text('Kamthi Line Beside SBI ATM , Chhattisgarh, 491441', 14, 21);
      doc.text('Phone No: +91- 9407922288   GSTIN: 22SNZPS3600E1ZH', 14, 25.5);

      // Customer Info Box (Left)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('To', 14, 33);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(restaurantProfile?.name || 'Party', 14, 38);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      const address = restaurantProfile?.address || 'Chhattisgarh, 491441';
      doc.text(address.length > 50 ? address.slice(0, 50) + '...' : address, 14, 42.5);
      if (restaurantProfile?.mobile) {
        doc.text(`Phone No: +91- ${restaurantProfile.mobile}`, 14, 47);
      }

      // Summary Box (Right)
      const boxX = pageWidth - 80;
      const boxY = 28;
      const boxWidth = 66;
      const boxHeight = 25;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(255, 255, 255);
      doc.rect(boxX, boxY, boxWidth, boxHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      doc.text(`Date: ${dateRangeLabel}`, boxX + 3, boxY + 5);

      doc.line(boxX, boxY + 6.5, boxX + boxWidth, boxY + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.text(`Total Receivable Amount: ₹${totalsSummary.finalBalance.toFixed(1)}`, boxX + 3, boxY + 10.5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Overdue Amount: ₹${totalsSummary.overdueAmount.toFixed(1)}`, boxX + 3, boxY + 14.5);
      doc.text(`Total Sales Amount: ₹${totalsSummary.totalDebit.toFixed(1)}`, boxX + 3, boxY + 18.5);
      doc.text(`Total Received Amount: ₹${totalsSummary.totalCredit.toFixed(1)}`, boxX + 3, boxY + 22.5);

      // Build Table Data
      const tableRows = [];

      // Opening Balance Row
      tableRows.push([
        '',
        'Opening Balance',
        '',
        '',
        '',
        openingBalance > 0 ? openingBalance.toFixed(1) : '',
        openingBalance.toFixed(1),
        ''
      ]);

      // All Transactions
      filteredTimeline.forEach(item => {
        let dueOrStatus = '';
        if (item.voucher === 'Sales Invoice') {
          if (item.status === 'Paid') {
            dueOrStatus = 'Paid';
          } else {
            dueOrStatus = item.dueDate ? `${formatDateShort(item.dueDate)}\n${item.status}` : item.status;
          }
        }
        tableRows.push([
          formatDateDisplay(item.date),
          item.voucher,
          item.srNo || '—',
          item.paymentMode || '—',
          item.credit > 0 ? item.credit.toFixed(1) : '',
          item.debit > 0 ? item.debit.toFixed(1) : (item.voucher === 'Payment-in' ? '0.0' : ''),
          item.runningBalance.toFixed(1),
          dueOrStatus
        ]);
      });

      // Closing Balance Row
      tableRows.push([
        '',
        'Closing Balance',
        '',
        '',
        '',
        totalsSummary.finalBalance.toFixed(1),
        totalsSummary.finalBalance.toFixed(1),
        ''
      ]);

      // Total Row
      tableRows.push([
        'Total',
        '',
        '',
        '',
        totalsSummary.totalCredit.toFixed(1),
        (totalsSummary.totalDebit + (openingBalance || 0)).toFixed(1),
        '',
        ''
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['Date', 'Voucher', 'Sr No', 'Payment Mode', 'Credit', 'Debit', 'Balance', 'Due Date (overdue by)']],
        body: tableRows,
        theme: 'plain',
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [40, 40, 40],
          fontStyle: 'bold',
          fontSize: 8,
          lineWidth: 0.2,
          lineColor: [210, 210, 210]
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [40, 40, 40],
          lineWidth: 0.1,
          lineColor: [230, 230, 230]
        },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 26, fontStyle: 'bold' },
          2: { cellWidth: 16 },
          3: { cellWidth: 26 },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 26 }
        },
        didParseCell: function(data) {
          // Highlight Opening/Closing/Total rows
          if (data.row.index === 0 || data.row.index === tableRows.length - 2 || data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            if (data.row.index === tableRows.length - 1) {
              data.cell.styles.fillColor = [245, 245, 245];
            }
          }
          // Due Date Status colors
          if (data.column.index === 7 && data.cell.raw) {
            const val = String(data.cell.raw);
            if (val.includes('Paid') && !val.includes('Unpaid') && !val.includes('Partially')) {
              data.cell.styles.textColor = [16, 149, 79]; // green
            } else if (val.includes('Unpaid')) {
              data.cell.styles.textColor = [220, 38, 38]; // red
            } else if (val.includes('Partially')) {
              data.cell.styles.textColor = [217, 119, 6]; // amber
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      const safeName = (restaurantProfile?.name || 'Party').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Party_Ledger_${safeName}.pdf`);
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
    <div className="min-h-screen bg-slate-100 p-2 sm:p-6 font-sans text-slate-800">
      {/* Top Filter & Action Bar (Hidden during print) */}
      <div className="max-w-5xl mx-auto mb-4 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-3 no-print">
        {/* Preset Period Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="text-slate-400 mr-1 text-[11px]">Period:</span>
          {[
            { id: '6months', label: 'Last 6 Months' },
            { id: '3months', label: 'Last 3 Months' },
            { id: '1month', label: 'This Month' },
            { id: 'all', label: 'All Time' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilterPreset(btn.id)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterPreset === btn.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span> 📥
          </button>
        </div>
      </div>

      {/* Main Printable Ledger Document Container */}
      <div
        ref={reportRef}
        id="party-ledger-report"
        className="bg-white max-w-5xl mx-auto p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 text-xs print:p-0 print:border-none print:shadow-none"
      >
        {/* Document Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 border-b border-slate-200">
          {/* Company Branding */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">M/S Shree Balaji Agencies</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Commercial LPG Cylinder Partner</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 font-medium pt-1">Kamthi Line Beside SBI ATM , Chhattisgarh, 491441</p>
            <p className="text-[11px] text-slate-600 font-medium">Phone No: +91- 9407922288 &nbsp;|&nbsp; GSTIN: 22SNZPS3600E1ZH</p>
          </div>

          {/* Title */}
          <div className="text-left sm:text-right">
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Party Ledger Report</h2>
          </div>
        </div>

        {/* Customer Details & Summary Cards */}
        <div className="py-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {/* Customer Address Details */}
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">To,</span>
            <h3 className="text-sm font-black text-slate-900">{restaurantProfile.name}</h3>
            <p className="text-slate-600 font-medium text-[11px]">{restaurantProfile.address || 'Chhattisgarh, 491441'}</p>
            {restaurantProfile.mobile ? (
              <p className="text-slate-600 font-semibold text-[11px]">Phone No: +91- {restaurantProfile.mobile}</p>
            ) : null}
            {restaurantProfile.gst_num ? (
              <p className="text-slate-600 font-semibold text-[11px]">GSTIN: {restaurantProfile.gst_num}</p>
            ) : null}
          </div>

          {/* Right Summary Box matching BillBook */}
          <div className="sm:ml-auto w-full sm:w-72 border border-slate-300 rounded-xl p-3 bg-slate-50/70 text-[11px] space-y-1">
            <div className="text-[10px] text-slate-600 font-bold border-b border-slate-200 pb-1">
              Date: {dateRangeLabel}
            </div>
            <div className="flex justify-between font-black text-slate-900 text-xs pt-0.5">
              <span>Total Receivable Amount:</span>
              <span className="text-rose-700">₹{totalsSummary.finalBalance.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium text-[10px]">
              <span>Overdue Amount:</span>
              <span>₹{totalsSummary.overdueAmount.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium text-[10px]">
              <span>Total Sales Amount:</span>
              <span>₹{totalsSummary.totalDebit.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium text-[10px]">
              <span>Total Received Amount:</span>
              <span>₹{totalsSummary.totalCredit.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-y border-slate-300">
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2">Voucher</th>
                <th className="py-2 px-2">Sr No</th>
                <th className="py-2 px-2">Payment Mode</th>
                <th className="py-2 px-2 text-right">Credit</th>
                <th className="py-2 px-2 text-right">Debit</th>
                <th className="py-2 px-2 text-right">Balance</th>
                <th className="py-2 px-2 text-left">Due Date (overdue by)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Opening Balance Row */}
              <tr className="bg-slate-50/80 font-bold text-slate-800">
                <td className="py-2 px-2 text-slate-400">—</td>
                <td className="py-2 px-2">Opening Balance</td>
                <td className="py-2 px-2 text-slate-400">—</td>
                <td className="py-2 px-2 text-slate-400">—</td>
                <td className="py-2 px-2 text-right text-slate-400">—</td>
                <td className="py-2 px-2 text-right">{openingBalance > 0 ? openingBalance.toFixed(1) : '—'}</td>
                <td className="py-2 px-2 text-right font-black">{openingBalance.toFixed(1)}</td>
                <td className="py-2 px-2 text-slate-400">—</td>
              </tr>

              {/* Transactions List */}
              {filteredTimeline.map((row, idx) => {
                const isPaid = (row.status || '').toLowerCase() === 'paid';
                const isUnpaid = (row.status || '').toLowerCase() === 'unpaid';
                const isPartially = (row.status || '').toLowerCase().includes('partially');

                return (
                  <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2 whitespace-nowrap text-slate-600 font-medium">
                      {formatDateDisplay(row.date)}
                    </td>
                    <td className="py-2 px-2 font-bold text-slate-800 whitespace-nowrap">
                      {row.voucher}
                    </td>
                    <td className="py-2 px-2 text-slate-600 font-semibold">
                      {row.srNo}
                    </td>
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                      {row.paymentMode}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-emerald-700">
                      {row.credit > 0 ? row.credit.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">
                      {row.debit > 0 ? row.debit.toFixed(1) : (row.voucher === 'Payment-in' ? '0.0' : '—')}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-slate-900">
                      {row.runningBalance.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-left whitespace-nowrap">
                      {row.voucher === 'Sales Invoice' ? (
                        <div>
                          {row.dueDate && !isPaid ? (
                            <div className="text-[10px] text-slate-500">{formatDateDisplay(row.dueDate)}</div>
                          ) : null}
                          <span className={`inline-block font-extrabold text-[10px] ${
                            isPaid ? 'text-emerald-700' : isUnpaid ? 'text-rose-700' : isPartially ? 'text-amber-700' : 'text-slate-600'
                          }`}>
                            {row.status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Closing Balance Row */}
              <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-300">
                <td className="py-2 px-2 text-slate-400">—</td>
                <td className="py-2 px-2">Closing Balance</td>
                <td colSpan={3}></td>
                <td className="py-2 px-2 text-right text-rose-700 font-black">
                  {totalsSummary.finalBalance.toFixed(1)}
                </td>
                <td className="py-2 px-2 text-right text-rose-700 font-black">
                  {totalsSummary.finalBalance.toFixed(1)}
                </td>
                <td></td>
              </tr>
            </tbody>
            <tfoot>
              {/* Total Summary Row */}
              <tr className="bg-slate-100 font-black text-slate-900 border-t border-b-2 border-slate-400">
                <td className="py-2.5 px-2 uppercase tracking-wide">Total</td>
                <td colSpan={3}></td>
                <td className="py-2.5 px-2 text-right text-emerald-800">
                  {totalsSummary.totalCredit.toFixed(1)}
                </td>
                <td className="py-2.5 px-2 text-right">
                  {(totalsSummary.totalDebit + (openingBalance || 0)).toFixed(1)}
                </td>
                <td colSpan={2}></td>
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
