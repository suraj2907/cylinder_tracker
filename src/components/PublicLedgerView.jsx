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
  
  // Default to Last 6 Months (Covers entire financial year from March 2026 to present)
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

  // Passbook sorting: Latest transaction on TOP (newest first)
  const displayTimeline = useMemo(() => {
    return [...filteredTimeline].sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      const rank = { 'Payment-in': 1, 'Payment': 1, 'Sales Invoice': 2, 'Invoice': 2 };
      return (rank[a.voucher] || 2) - (rank[b.voucher] || 2);
    });
  }, [filteredTimeline]);

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

      // Summary Box (Right) - perfectly aligned to right table edge (196mm)
      const boxWidth = 75;
      const boxX = pageWidth - 14 - boxWidth;
      const boxY = 26;
      const boxHeight = 25;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(255, 255, 255);
      doc.rect(boxX, boxY, boxWidth, boxHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`Date: ${dateRangeLabel}`, boxX + 3, boxY + 4.5);

      doc.line(boxX, boxY + 6, boxX + boxWidth, boxY + 6);

      // Total Receivable (Bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(20, 20, 20);
      doc.text('Total Receivable Amount:', boxX + 3, boxY + 10.5);
      doc.text(`Rs. ${totalsSummary.finalBalance.toFixed(1)}`, boxX + boxWidth - 3, boxY + 10.5, { align: 'right' });
      
      // Overdue Amount
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(70, 70, 70);
      doc.text('Overdue Amount:', boxX + 3, boxY + 14.5);
      doc.text(`Rs. ${totalsSummary.overdueAmount.toFixed(1)}`, boxX + boxWidth - 3, boxY + 14.5, { align: 'right' });

      // Total Sales Amount
      doc.text('Total Sales Amount:', boxX + 3, boxY + 18);
      doc.text(`Rs. ${totalsSummary.totalDebit.toFixed(1)}`, boxX + boxWidth - 3, boxY + 18, { align: 'right' });

      // Total Received Amount
      doc.text('Total Received Amount:', boxX + 3, boxY + 21.5);
      doc.text(`Rs. ${totalsSummary.totalCredit.toFixed(1)}`, boxX + boxWidth - 3, boxY + 21.5, { align: 'right' });

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
    <div className="min-h-screen bg-slate-50 p-2.5 sm:p-6 font-sans text-slate-800 flex flex-col items-center">
      {/* Top Compact Navigation Bar */}
      <div className="w-full max-w-2xl bg-white p-3 sm:p-4 rounded-2xl shadow-xs border border-slate-200 flex justify-between items-center gap-2 mb-3 no-print">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🔥</span>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-slate-900 truncate">Shree Balaji Agencies</h1>
            <p className="text-[10px] text-slate-400 font-bold truncate">📞 +91-9407922288 • Rajnandgaon</p>
          </div>
        </div>

        {/* Small Compact Download PDF Button */}
        <button
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          title="Download Statement PDF"
        >
          <span>{downloadingPdf ? 'Saving...' : 'Download PDF'}</span>
          <span className="text-[11px]">📥</span>
        </button>
      </div>

      {/* Main Container */}
      <div
        ref={reportRef}
        id="party-ledger-report"
        className="w-full max-w-2xl bg-white p-4 sm:p-7 rounded-2xl shadow-xs border border-slate-200 text-xs space-y-4"
      >
        {/* Customer Header & Pending Card */}
        <div className="space-y-3">
          {/* Party Name & Location */}
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Statement</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{restaurantProfile.name}</h2>
              <p className="text-slate-500 text-[11px] font-medium">{restaurantProfile.address || 'Chhattisgarh, 491441'}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg shrink-0 border border-slate-200">
              Party Ledger
            </span>
          </div>

          {/* Clean Pending Due Card (No Opening/Closing Clutter) */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            totalsSummary.finalBalance > 0
              ? 'bg-rose-50/80 border-rose-200 text-rose-950'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          }`}>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                totalsSummary.finalBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {totalsSummary.finalBalance > 0 ? '🔴 Pending Amount' : '✅ Current Balance'}
              </span>
              <div className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
                ₹{totalsSummary.finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                totalsSummary.finalBalance > 0
                  ? 'bg-rose-100/80 text-rose-800 border-rose-300'
                  : 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
              }`}>
                {totalsSummary.finalBalance > 0 ? 'Payment Due' : 'All Clear'}
              </span>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                {dateRangeLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions Section Title */}
        <div className="pt-2">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
              📋 Transactions ({filteredTimeline.length})
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {filteredTimeline.length > 0 ? `${formatDateShort(filteredTimeline[0].date)} to ${formatDateShort(filteredTimeline[filteredTimeline.length - 1].date)}` : ''}
            </span>
          </div>

          {filteredTimeline.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              No transactions recorded in the last 3 months.
            </div>
          ) : (
            <>
              {/* MOBILE VERTICAL CARD VIEW (Zero Horizontal Scrolling!) */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {displayTimeline.map((row, idx) => {
                  const isPayment = row.voucher === 'Payment-in' || row.voucher === 'Payment';
                  const isPaid = (row.status || '').toLowerCase() === 'paid';
                  const isUnpaid = (row.status || '').toLowerCase() === 'unpaid';

                  return (
                    <div key={row.id || idx} className="py-3 space-y-1.5">
                      {/* Row 1: Date & Voucher Type Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">{formatDateDisplay(row.date)}</span>
                          {row.srNo && row.srNo !== '—' && (
                            <span className="text-[10px] font-bold text-slate-400">#{row.srNo}</span>
                          )}
                        </div>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          isPayment
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                        }`}>
                          {isPayment ? `💳 ${row.paymentMode || 'Payment'}` : `🧾 Invoice`}
                        </span>
                      </div>

                      {/* Row 2: Amount & Status Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isPayment ? (
                            <span className="text-sm font-black text-emerald-700">
                              -₹{row.credit.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                            </span>
                          ) : (
                            <span className="text-sm font-black text-rose-700">
                              +₹{row.debit.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                            </span>
                          )}

                          {!isPayment && (
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isUnpaid
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {row.status || 'Unpaid'}
                            </span>
                          )}
                        </div>

                        {/* Running Balance */}
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-slate-600">
                            Bal: <span className="font-black text-slate-900">₹{row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (Visible on tablet & desktop screens) */}
              <div className="hidden sm:block overflow-x-auto mt-2">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-extrabold uppercase border-y border-slate-200">
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">Ref / Sr</th>
                      <th className="py-2 px-2">Mode</th>
                      <th className="py-2 px-2 text-right text-emerald-700">Credit (Paid)</th>
                      <th className="py-2 px-2 text-right text-rose-700">Debit (Bill)</th>
                      <th className="py-2 px-2 text-right">Balance</th>
                      <th className="py-2 px-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayTimeline.map((row, idx) => {
                      const isPaid = (row.status || '').toLowerCase() === 'paid';
                      const isUnpaid = (row.status || '').toLowerCase() === 'unpaid';

                      return (
                        <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-2 whitespace-nowrap text-slate-700 font-medium">{formatDateDisplay(row.date)}</td>
                          <td className="py-2 px-2 font-bold text-slate-900 whitespace-nowrap">{row.voucher}</td>
                          <td className="py-2 px-2 text-slate-500 font-semibold">{row.srNo}</td>
                          <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{row.paymentMode}</td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-700">
                            {row.credit > 0 ? `₹${row.credit.toFixed(1)}` : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-rose-700">
                            {row.debit > 0 ? `₹${row.debit.toFixed(1)}` : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-black text-slate-900">
                            ₹{row.runningBalance.toFixed(1)}
                          </td>
                          <td className="py-2 px-2 text-left whitespace-nowrap">
                            {row.voucher === 'Sales Invoice' ? (
                              <span className={`inline-block font-black text-[10px] ${
                                isPaid ? 'text-emerald-700' : isUnpaid ? 'text-rose-700' : 'text-amber-700'
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
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Compact Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-slate-400">
          <div>
            <span>M/S Shree Balaji Agencies • GSTIN: 22SNZPS3600E1ZH</span>
          </div>
          <div>
            <span>UPI / Phone: +91-9407922288</span>
          </div>
        </div>
      </div>
    </div>
  );
}
