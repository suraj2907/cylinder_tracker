import React, { useState, useEffect, useMemo, memo } from 'react';
import { formatIsoDate, normType, getInvoiceLabel, getPartyCurrentBalance, norm, isNewPayment, isNewBill, ZERO_BALANCE_PARTIES } from '../utils/dataUtils';
import { exportPartyLedgerPDF, exportPartyLedgerExcel, shareInvoicePDFOnWhatsApp, exportBillPDF } from '../utils/exportUtils';
import { supabase } from '../utils/supabaseClient';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MFULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function numberToWords(num) {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return `${num} Rupees Only`;
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Rupees Only' : 'Rupees Only';
  return str.trim();
}

function RestaurantStatementModal({
  restaurantName,
  onClose,
  batches = [],
  payments = [],
  handleDeleteEntry,
  onDeletePayment,
  bills = [],
  deleteBill,
  removeDeliveryEntries,
  restaurantProfiles = {},
  onEditBill
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonthStr = today.slice(0, 7);

  const isZeroHotel = ZERO_BALANCE_PARTIES.some(h => norm(h) === norm(restaurantName));
  const profile = restaurantProfiles[restaurantName] || restaurantProfiles[norm(restaurantName)] || {};
  const openingBalance = isZeroHotel ? 0 : parseFloat(profile.previous_balance || 0);

  const [filterPeriod, setFilterPeriod] = useState(currentMonthStr);
  const [rangeMode, setRangeMode] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [activeSection, setActiveSection] = useState('passbook');
  const [activeTab, setActiveTab] = useState("all");
  const [ledgerRows, setLedgerRows] = useState([]);
  const [displayCount, setDisplayCount] = useState(25);
  const [selectedBillForPrint, setSelectedBillForPrint] = useState(null);

  const restaurantBills = useMemo(() => {
    if (!restaurantName) return [];
    const normTarget = norm(restaurantName);
    return bills.filter(b => norm(b.restaurant_name || '') === normTarget);
  }, [bills, restaurantName]);

  // Load historical ledger entries from API with Supabase fallback
  useEffect(() => {
    async function loadOfficialLedger() {
      if (!restaurantName) return;
      try {
        const response = await fetch(`/api/public-ledger?party=${encodeURIComponent(restaurantName.trim())}`);
        if (response.ok) {
          const json = await response.json();
          if (json.legacyRows && json.legacyRows.length > 0) {
            setLedgerRows(json.legacyRows);
            return;
          }
        }
        const { data, error } = await supabase
          .from('legacy_ledger_entries')
          .select('*')
          .ilike('restaurant_name', `%${restaurantName.trim()}%`)
          .order('entry_date', { ascending: true });

        if (!error && data) {
          setLedgerRows(data);
        }
      } catch (err) {
        console.warn('Error loading legacy ledger:', err);
      }
    }
    loadOfficialLedger();
  }, [restaurantName]);

  // Combine and sort all activities for this restaurant
  const allRestaurantActivities = useMemo(() => {
    const list = [];
    const normTarget = norm(restaurantName);

    // 1. Historical ledger rows from database (exact CSV sequence)
    ledgerRows.forEach((e, idx) => {
      if (!e.entry_date || e.voucher_type === 'Balance') return;
      list.push({
        id: `official_ledger_${idx}_${e.entry_date}_${e.sr_no}`,
        ledgerIndex: idx,
        kind: e.voucher_type === 'Payment-in' ? 'payment' : (e.voucher_type === 'Invoice' || e.voucher_type === 'Sales Invoice' ? 'bill' : 'ledger'),
        date: e.entry_date,
        voucher: e.voucher_type,
        srNo: e.sr_no,
        paymentMode: e.payment_mode,
        credit: parseFloat(e.credit) || 0,
        debit: parseFloat(e.debit) || 0,
        amount: e.voucher_type === 'Payment-in' ? (parseFloat(e.credit) || 0) : (parseFloat(e.debit) || 0),
        invoiceLabel: e.sr_no ? `INV-${String(e.sr_no).padStart(4, '0')}` : 'INV-0000',
        paymentStatus: e.payment_status,
        userName: 'Official Ledger',
        note: e.payment_mode ? `Payment Mode: ${e.payment_mode}` : '',
        isOfficialLedger: true,
        officialBalance: e.balance !== null && e.balance !== undefined ? parseFloat(e.balance) : null
      });
    });

    // 2. Extract Cylinder deliveries/returns for this restaurant
    batches.forEach(b => {
      (b.entries || []).forEach(e => {
        if (norm(e.name) === normTarget) {
          const rawDate = e.date || b.khaliDate || today;
          const entryDate = formatIsoDate(rawDate);
          list.push({
            id: e.id || `cyl_${entryDate}_${e.name}_${Math.random()}`,
            kind: 'cylinder',
            date: entryDate,
            batchNum: b.batch,
            name: e.name,
            qty: e.qty,
            type: normType(e.type),
            isReturn: !!e.isReturn,
            userName: e.user_name || 'Suraj',
            rawEntryObj: e,
            originalEntry: e
          });
        }
      });
    });

    // 3. Extract Real-Time Payment Collections (ONLY new live payments created after legacy import)
    payments.forEach(p => {
      if (isNewPayment(p)) {
        const pName = norm(p.restaurant_name || p.restaurantName);
        if (pName === normTarget) {
          const rawDate = p.date || today;
          const pDate = formatIsoDate(rawDate);
          const pAmt = parseFloat(p.amount) || 0;

          list.push({
            id: p.id ? `pay_${p.id}` : `pay_${pDate}_${pAmt}_${Math.random()}`,
            kind: 'payment',
            date: pDate,
            batchNum: p.batch_num || p.batchNum || '-',
            restaurantName: p.restaurant_name || p.restaurantName,
            amount: pAmt,
            credit: pAmt,
            debit: 0,
            voucher: 'Payment-in',
            paymentMode: p.mode || p.payment_mode || p.paymentMode || 'UPI',
            userName: p.created_by || p.user_name || 'Suraj',
            note: p.notes || p.note || '',
            rawPaymentObj: p
          });
        }
      }
    });

    // 4. Extract Real-Time Sales Invoices (ONLY new live bills created after legacy import)
    bills.forEach(b => {
      if (isNewBill(b)) {
        const pName = norm(b.restaurant_name || "");
        if (pName === normTarget) {
          const rawDate = b.bill_date || today;
          const bDate = formatIsoDate(rawDate);

          let deliveredQty = 0;
          const itemSummaryList = [];
          if (Array.isArray(b.items)) {
            b.items.forEach(it => {
              const q = parseFloat(it.qty) || 0;
              deliveredQty += q;
              const desc = (it.description || it.item_name || it.name || '').toLowerCase();
              if (desc.includes('21')) itemSummaryList.push(`${q}x 21kg`);
              else if (desc.includes('19.2') || desc.includes('commercial') || desc.includes('lpg')) itemSummaryList.push(`${q}x 19.2kg`);
              else if (q > 0) itemSummaryList.push(`${q} units`);
            });
          }
          const itemsSummary = itemSummaryList.join(', ');

          list.push({
            id: b.id || `bill_${bDate}_${b.total_amount}_${Math.random()}`,
            kind: 'bill',
            date: bDate,
            batchNum: '-',
            restaurantName: b.restaurant_name,
            amount: parseFloat(b.total_amount) || 0,
            debit: parseFloat(b.total_amount) || 0,
            credit: 0,
            voucher: 'Sales Invoice',
            invoiceLabel: getInvoiceLabel(b),
            deliveredQty: deliveredQty > 0 ? deliveredQty : undefined,
            itemsSummary: itemsSummary || undefined,
            userName: b.created_by || 'Suraj',
            note: b.note || '',
            rawBillObj: b
          });
        }
      }
    });

    // Base balance from official synced profiles (Zero ONLY for Rasoi Restaurant and Route 66)
    const isZeroHotel = ZERO_BALANCE_PARTIES.some(h => norm(h) === normTarget);
    const baseBalance = isZeroHotel ? 0 : parseFloat(profile.previous_balance || 0);

    // Precise chronological ascending sort:
    // Pattern on same date: 1. INVOICE -> 2. SUPPLY -> 3. PAYMENT
    const sortedAsc = [...list].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      if (a.ledgerIndex !== undefined && b.ledgerIndex !== undefined) {
        return a.ledgerIndex - b.ledgerIndex;
      }
      const typeRank = { bill: 1, cylinder: 2, ledger: 3, payment: 4 };
      const rankA = typeRank[a.kind] || 2;
      const rankB = typeRank[b.kind] || 2;
      if (rankA !== rankB) return rankA - rankB;
      return (a.srNo || 0) - (b.srNo || 0);
    });
    
    let currentBalance = (ledgerRows && ledgerRows.length > 0) ? 0 : baseBalance;
    const listWithBalance = sortedAsc.map(item => {
      if (item.isOfficialLedger && item.officialBalance !== null && item.officialBalance !== undefined) {
        currentBalance = item.officialBalance;
      } else {
        const debit = parseFloat(item.debit) || 0;
        const credit = parseFloat(item.credit) || 0;
        
        if (debit > 0) {
          currentBalance += debit;
        }
        if (credit > 0) {
          currentBalance = Math.max(0, currentBalance - credit);
        }
      }
      
      return {
        ...item,
        runningBalance: currentBalance
      };
    });

    // Sort for UI display (newest date first; within same date: Aakhri transaction on top -> 1. PAYMENT -> 2. SUPPLY -> 3. INVOICE)
    return listWithBalance.sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      if (a.ledgerIndex !== undefined && b.ledgerIndex !== undefined) {
        return b.ledgerIndex - a.ledgerIndex;
      }
      const typeRank = { payment: 1, ledger: 2, cylinder: 3, bill: 4 };
      const rankA = typeRank[a.kind] || 2;
      const rankB = typeRank[b.kind] || 2;
      if (rankA !== rankB) return rankA - rankB;
      return (b.srNo || 0) - (a.srNo || 0);
    });
  }, [restaurantName, ledgerRows, batches, payments, bills, restaurantProfiles, today, profile.previous_balance]);

  // Filter activities based on Month / Date Range / All Time
  const filteredActivities = useMemo(() => {
    return allRestaurantActivities.filter(item => {
      if (rangeMode) {
        return item.date >= startDate && item.date <= endDate;
      } else if (filterPeriod === "all") {
        return true;
      } else {
        return item.date.startsWith(filterPeriod);
      }
    });
  }, [allRestaurantActivities, filterPeriod, rangeMode, startDate, endDate]);

  const visibleActivities = useMemo(() => {
    if (filterPeriod === 'all' && displayCount === 25) {
      return filteredActivities.slice(0, 100);
    }
    return filteredActivities.slice(0, displayCount);
  }, [filteredActivities, displayCount, filterPeriod]);

  // Calculate Summary KPIs for filtered period
  const stats = useMemo(() => {
    let del21 = 0, del192 = 0;
    let ret21 = 0, ret192 = 0;
    let paidCash = 0, paidUPI = 0;

    filteredActivities.forEach(item => {
      if (item.kind === 'cylinder') {
        const is21 = item.type === "21kg";
        if (item.isReturn) {
          if (is21) ret21 += item.qty;
          else ret192 += item.qty;
        } else {
          if (is21) del21 += item.qty;
          else del192 += item.qty;
        }
      } else if (item.kind === 'payment') {
        if (item.paymentMode === 'UPI') paidUPI += item.amount;
        else paidCash += item.amount;
      }
    });

    const totalDel = del21 + del192;
    const totalRet = ret21 + ret192;
    const out21 = del21 - ret21;
    const out192 = del192 - ret192;
    const totalOut = totalDel - totalRet;
    const totalPaid = paidCash + paidUPI;

    return { del21, del192, totalDel, ret21, ret192, totalRet, out21, out192, totalOut, paidCash, paidUPI, totalPaid };
  }, [filteredActivities]);

  // Calculate Lifetime Overall Cylinder Holding for this party (across complete history)
  const overallStats = useMemo(() => {
    let del21 = 0, del192 = 0;
    let ret21 = 0, ret192 = 0;

    allRestaurantActivities.forEach(item => {
      if (item.kind === 'cylinder') {
        const is21 = item.type === "21kg";
        if (item.isReturn) {
          if (is21) ret21 += item.qty;
          else ret192 += item.qty;
        } else {
          if (is21) del21 += item.qty;
          else del192 += item.qty;
        }
      }
    });

    const totalDel = del21 + del192;
    const totalRet = ret21 + ret192;
    const out21 = Math.max(0, del21 - ret21);
    const out192 = Math.max(0, del192 - ret192);
    const totalOut = totalDel - totalRet;

    return { del21, del192, totalDel, ret21, ret192, totalRet, out21, out192, totalOut };
  }, [allRestaurantActivities]);

  // Available Months for dropdown
  const availableMonths = useMemo(() => {
    const s = new Set();
    allRestaurantActivities.forEach(item => {
      if (item.date) s.add(item.date.slice(0, 7));
    });
    s.add(currentMonthStr);
    return Array.from(s).sort().reverse();
  }, [allRestaurantActivities, currentMonthStr]);


  // Live computed net balance of this party from all activities
  const netPartyOutstanding = useMemo(() => {
    if (allRestaurantActivities && allRestaurantActivities.length > 0) {
      return allRestaurantActivities[0]?.runningBalance ?? openingBalance;
    }
    return openingBalance;
  }, [allRestaurantActivities, openingBalance]);

  const closingBalance = netPartyOutstanding;

  const performDeleteBill = async (item) => {
    const invLabel = item.invoiceLabel || (item.rawBillObj ? `INV-${item.rawBillObj.invoice_no}` : 'Invoice');
    if (window.confirm(`Are you sure you want to delete ${invLabel}?`)) {
      try {
        if (item.rawBillObj?.id) {
          await deleteBill(item.rawBillObj.id, removeDeliveryEntries);
        } else if (item.isOfficialLedger && item.srNo) {
          await supabase.from('legacy_ledger_entries').delete().eq('sr_no', item.srNo).ilike('restaurant_name', restaurantName.trim());
          setLedgerRows(prev => prev.filter(r => r.sr_no !== item.srNo));
        }
        alert(`✅ ${invLabel} successfully deleted!`);
      } catch (err) {
        console.error('Error deleting bill:', err);
        alert(`Delete nahi hua: ${err.message || 'Error'}`);
      }
    }
  };

  const handleShareBillOnWhatsApp = async (bill) => {
    if (!bill) return;
    const bProf = getBillProfile(bill.restaurant_name);
    await shareInvoicePDFOnWhatsApp(bill, bProf);
  };

  const getBillProfile = (rName) => {
    const rawProf = (restaurantProfiles && (restaurantProfiles[rName] || restaurantProfiles[norm(rName)])) || profile || {};
    return {
      ...rawProf,
      current_balance: netPartyOutstanding,
      previous_balance: parseFloat(rawProf.previous_balance !== undefined ? rawProf.previous_balance : openingBalance)
    };
  };

  return (
    <div className="modal-overlay-universal no-print">
      <div className="modal-card-universal max-w-6xl border border-customBorder p-2.5 sm:p-5 space-y-2 sm:space-y-3.5">
        
        {/* Modal Header (Compact 1-line on mobile) */}
        <div className="flex items-center justify-between border-b border-customBorder pb-2 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 text-xs sm:text-sm flex items-center justify-center cursor-pointer shrink-0"
              title="Back"
            >
              ←
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded uppercase tracking-wider">
                  Passbook
                </span>
                <h2 className="text-xs sm:text-base font-black text-slate-900 truncate">
                  {restaurantName}
                </h2>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 text-xs sm:text-sm flex items-center justify-center shrink-0 cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Compact Current Balance Header Strip */}
        <div className="bg-slate-50 rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 flex items-center justify-between border border-slate-200 gap-2">
          <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Balance (Outstanding)</div>
            <div className="text-base sm:text-2xl font-black text-rose-600 truncate">
              ₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">{restaurantName}</div>
            <div className="text-[9.5px] sm:text-[11px] text-slate-500 font-medium">
              Holding: <span className="font-bold text-amber-700">{overallStats.totalOut} Cyl</span> {profile.mobile ? `• ${profile.mobile}` : ''}
            </div>
          </div>
        </div>

        {/* Filter Period Controls & Export Buttons (Compact 2-row layout on mobile) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-0.5 p-0.5 bg-white border border-slate-200 rounded-lg">
              <button
                onClick={() => setRangeMode(false)}
                className={`px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                  !rangeMode ? 'bg-sky-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Month View
              </button>
              <button
                onClick={() => setRangeMode(true)}
                className={`px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                  rangeMode ? 'bg-sky-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Date Range
              </button>
            </div>

            {!rangeMode ? (
              <select
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 sm:py-1 text-[11px] sm:text-xs font-bold text-slate-800 shadow-sm focus:border-sky-500 flex-1 sm:flex-initial"
              >
                <option value="all">All Time (Complete History)</option>
                {availableMonths.map(mStr => {
                  const [y, m] = mStr.split('-');
                  const mName = MFULL[parseInt(m) - 1] || mStr;
                  return (
                    <option key={mStr} value={mStr}>{mName} {y}</option>
                  );
                })}
              </select>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] sm:text-xs font-bold"
                />
                <span className="text-[10px] text-slate-400 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] sm:text-xs font-bold"
                />
              </div>
            )}
          </div>

          {/* Download Party Statement Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const pLabel = rangeMode ? `${startDate} to ${endDate}` : (filterPeriod === 'all' ? 'All Time' : filterPeriod);
                exportPartyLedgerPDF(restaurantName, filteredActivities, profile, pLabel, stats);
              }}
              className="flex-1 sm:flex-initial px-2.5 py-1 sm:py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[10px] sm:text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
              title="Download PDF Ledger Statement"
            >
              <span>📄</span>
              <span>PDF</span>
            </button>
            <button
              onClick={() => {
                const pLabel = rangeMode ? `${startDate} to ${endDate}` : (filterPeriod === 'all' ? 'All Time' : filterPeriod);
                exportPartyLedgerExcel(restaurantName, filteredActivities, profile, pLabel, stats);
              }}
              className="flex-1 sm:flex-initial px-2.5 py-1 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10px] sm:text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
              title="Download Excel Spreadsheet"
            >
              <span>📊</span>
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Summary KPIs Strip for this Hotel (Micro-cards on mobile) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          {/* Delivered Card */}
          <div className="bg-sky-50/70 py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-lg sm:rounded-xl border border-sky-200">
            <div className="text-[8px] sm:text-[9px] font-bold text-sky-800 uppercase tracking-wider">📦 Delivered</div>
            <div className="text-xs sm:text-sm font-black text-sky-950">{stats.totalDel} units</div>
            <div className="text-[8px] sm:text-[9px] text-sky-800 font-bold">
              19.2: {stats.del192} | 21: {stats.del21}
            </div>
          </div>

          {/* Khali Returned Card */}
          <div className="bg-teal-50/70 py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-lg sm:rounded-xl border border-teal-200">
            <div className="text-[8px] sm:text-[9px] font-bold text-teal-800 uppercase tracking-wider">♻️ Returned</div>
            <div className="text-xs sm:text-sm font-black text-teal-950">{stats.totalRet} units</div>
            <div className="text-[8px] sm:text-[9px] text-teal-800 font-bold">
              19.2: {stats.ret192} | 21: {stats.ret21}
            </div>
          </div>

          {/* Outstanding Empty Card */}
          <div className={`py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-lg sm:rounded-xl border ${
            overallStats.totalOut > 0 ? 'bg-amber-50/80 border-amber-300' : 'bg-emerald-50/80 border-emerald-200'
          }`}>
            <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-700 truncate">
              {filterPeriod === 'all' && !rangeMode ? '⚠️ Outstanding' : '⚠️ Total Holding'}
            </div>
            <div className={`text-xs sm:text-sm font-black ${overallStats.totalOut > 0 ? 'text-amber-950' : 'text-emerald-900'}`}>
              {overallStats.totalOut} cyl
            </div>
            <div className="text-[8px] sm:text-[9px] font-bold text-slate-700 truncate">
              {filterPeriod === 'all' && !rangeMode ? (
                `19.2: ${overallStats.out192} | 21: ${overallStats.out21}`
              ) : (
                `Net: ${stats.totalOut >= 0 ? `+${stats.totalOut}` : `${stats.totalOut}`} units`
              )}
            </div>
          </div>

          {/* Closing Balance Card */}
          <div className={`py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-lg sm:rounded-xl border ${
            closingBalance > 0 ? 'bg-rose-50/70 border-rose-250 text-rose-900' : 'bg-emerald-50/70 border-emerald-250 text-emerald-950'
          }`}>
            <div className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${closingBalance > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
              🔴 Closing Bal
            </div>
            <div className="text-xs sm:text-sm font-black truncate">
              ₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[8px] sm:text-[9px] font-semibold opacity-75 truncate">
              Opening: ₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Date-Wise Complete Passbook Table / Invoices List */}
        <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-[350px]">
          
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 max-w-[280px] no-print">
            <button
              onClick={() => setActiveSection('passbook')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSection === 'passbook' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📜 Ledger History
            </button>
            <button
              onClick={() => setActiveSection('invoices')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSection === 'invoices' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🧾 Invoices ({restaurantBills.length + ledgerRows.filter(r => r.voucher_type === 'Invoice' || r.voucher_type === 'Sales Invoice').length})
            </button>
          </div>

          {activeSection === 'passbook' ? (
            <>
              <div className="flex items-center justify-between no-print">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  📜 Passbook History Log ({filteredActivities.length} entries)
                </h3>
              </div>

{filteredActivities.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-semibold bg-slate-50 rounded-2xl border border-dashed my-auto no-print">
                  No activity entries recorded for {restaurantName} in this period.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto overflow-y-auto border border-slate-200 rounded-2xl max-h-[460px] flex-1 bg-white shadow-inner">
                  
                  {/* MOBILE CARDS VIEW (Spacious & Clean for Mobile & Tablets) */}
                  <div className="block lg:hidden divide-y divide-slate-100 no-print">
                    {visibleActivities.map((item, idx) => (
                      <div key={item.id || idx} className="p-4 space-y-2.5 hover:bg-slate-50/80 transition-colors bg-white">
                        
                        {/* Top Row: Date, Batch & Type Badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 tracking-tight">📅 {item.date}</span>
                            {item.batchNum && (
                              <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shadow-2xs">
                                #{item.batchNum}
                              </span>
                            )}
                          </div>
                          
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-2xs ${
                            item.kind === 'cylinder'
                              ? (item.isReturn ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-sky-50 text-sky-800 border border-sky-200')
                              : item.kind === 'bill'
                                ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                                : (item.paymentMode === 'UPI' ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-amber-50 text-amber-900 border border-amber-200')
                          }`}>
                            {item.kind === 'cylinder'
                              ? (item.isReturn ? '♻️ Khali Return' : '🚚 Supply Delivery')
                              : item.kind === 'bill'
                                ? '🧾 Invoice Bill'
                                : `💳 Payment (${item.paymentMode})`}
                          </span>
                        </div>

                        {/* Middle Row: Details & Amount */}
                        <div className="flex items-center justify-between pt-1 gap-2">
                          <div className="min-w-0">
                            {item.kind === 'cylinder' ? (
                              <div className="text-sm font-black text-slate-900">
                                {item.qty}x {item.type} {item.isReturn ? 'Khali' : 'Cylinder'}
                              </div>
                            ) : item.kind === 'bill' ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-indigo-950">{item.invoiceLabel}</span>
                                  <span className="text-sm text-rose-600 font-black">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {item.itemsSummary && (
                                  <span className="text-[11px] font-extrabold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 mt-1 inline-block">
                                    📦 {item.itemsSummary} Supplied
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm font-black text-emerald-700">
                                ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500 font-semibold">Received</span>
                              </div>
                            )}
                            <div className="text-[11px] text-slate-400 font-bold mt-0.5">
                              Recorded by: <span className="text-slate-600">{item.userName || 'System'}</span>
                            </div>
                          </div>

                          {/* Delete Action Button */}
                          <div className="shrink-0">
                            {item.kind === 'cylinder' && handleDeleteEntry && (
                              <button
                                onClick={() => handleDeleteEntry(item.batchNum, item.originalEntry)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black active:scale-95 cursor-pointer transition-all shadow-2xs"
                              >
                                Delete
                              </button>
                            )}
                            {item.kind === 'payment' && onDeletePayment && (
                              <button
                                onClick={() => onDeletePayment(item.rawPaymentObj)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black active:scale-95 cursor-pointer transition-all shadow-2xs"
                              >
                                Delete
                              </button>
                            )}
                            {item.kind === 'bill' && item.rawBillObj && onEditBill && (
                              <button
                                onClick={() => onEditBill(item.rawBillObj)}
                                className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-black active:scale-95 cursor-pointer transition-all shadow-2xs mr-1.5"
                              >
                                Edit
                              </button>
                            )}
                            {item.kind === 'bill' && deleteBill && (
                              <button
                                onClick={() => performDeleteBill(item)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black active:scale-95 cursor-pointer transition-all shadow-2xs"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DESKTOP TABLE VIEW (100% Fit & No Overflow) */}
                  <table className="hidden lg:table w-full table-fixed text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-mutedSlate">
                        <th className="w-[10%] px-2 py-2.5">Date</th>
                        <th className="w-[8%] px-2 py-2.5">Type</th>
                        <th className="w-[16%] px-2 py-2.5">Details / Invoice</th>
                        <th className="w-[5%] px-1.5 py-2.5 text-center">Batch</th>
                        <th className="w-[9%] px-2 py-2.5 text-right">Delivered</th>
                        <th className="w-[8%] px-2 py-2.5 text-right">Khali Ret</th>
                        <th className="w-[10%] px-2 py-2.5 text-right text-rose-650">Bill Amt (₹)</th>
                        <th className="w-[9%] px-2 py-2.5 text-right text-emerald-700">Paid (₹)</th>
                        <th className="w-[11%] px-2 py-2.5 text-right text-slate-800">Closing Bal</th>
                        <th className="w-[9%] px-2 py-2.5">By</th>
                        <th className="w-[5%] px-1.5 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleActivities.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-2 py-2 font-semibold text-slate-700 truncate">{item.date}</td>
                          <td className="px-2 py-2 font-bold">
                            {item.kind === 'cylinder' ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black border ${
                                item.isReturn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-sky-50 text-sky-700 border-sky-200'
                              }`}>
                                {item.isReturn ? '♻️ Return' : '🚚 Supply'}
                              </span>
                            ) : item.kind === 'bill' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black border bg-indigo-50 text-indigo-700 border-indigo-200">
                                🧾 Invoice
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black border ${
                                item.paymentMode === 'UPI' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                💳 {item.paymentMode}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 font-bold text-slate-800">
                            {item.kind === 'cylinder' ? (
                              <span className="font-semibold text-slate-600 truncate block">{item.type} Cylinder</span>
                            ) : item.kind === 'bill' ? (
                              <div>
                                <button
                                  onClick={() => setSelectedBillForPrint(item.rawBillObj)}
                                  className="text-indigo-650 hover:underline font-black cursor-pointer truncate block"
                                >
                                  {item.invoiceLabel}
                                </button>
                                {item.itemsSummary && (
                                  <span className="text-[10px] text-sky-800 font-bold block truncate">
                                    {item.itemsSummary}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="font-semibold text-slate-600 truncate block">Collection</span>
                            )}
                          </td>
                          <td className="px-1.5 py-2 text-center font-bold text-slate-500">
                            {item.batchNum ? `#${item.batchNum}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right font-black text-slate-800">
                            {item.kind === 'cylinder' && !item.isReturn ? (
                              `${item.qty} units`
                            ) : item.kind === 'bill' && item.deliveredQty ? (
                              <span className="text-sky-800 font-black">{item.itemsSummary || `${item.deliveredQty} units`}</span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-2 text-right font-bold text-slate-800">
                            {item.kind === 'cylinder' && item.isReturn ? `${item.qty} units` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right font-black text-rose-600">
                            {item.kind === 'bill' ? `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right font-black text-emerald-700">
                            {item.kind === 'payment' ? `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right font-black text-slate-900 bg-slate-50/50">
                            ₹{(item.runningBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-2 text-slate-600 font-bold whitespace-normal">{item.userName}</td>
                          <td className="px-1.5 py-2 text-center no-print">
                            {item.kind === 'cylinder' && handleDeleteEntry && (
                              <button
                                onClick={() => handleDeleteEntry(item.batchNum, item.originalEntry || item.rawEntryObj)}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-2xs inline-flex items-center justify-center"
                                title="Delete entry"
                              >
                                🗑️
                              </button>
                            )}
                            {item.kind === 'payment' && onDeletePayment && (
                              <button
                                onClick={() => onDeletePayment(item.rawPaymentObj)}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-2xs inline-flex items-center justify-center"
                                title="Delete payment"
                              >
                                🗑️
                              </button>
                            )}
                            {item.kind === 'bill' && item.rawBillObj && onEditBill && (
                              <button
                                onClick={() => onEditBill(item.rawBillObj)}
                                className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-2xs inline-flex items-center justify-center mr-1"
                                title="Edit Invoice"
                              >
                                ✏️
                              </button>
                            )}
                            {item.kind === 'bill' && deleteBill && (
                              <button
                                onClick={() => performDeleteBill(item)}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-2xs inline-flex items-center justify-center"
                                title="Delete Invoice"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {visibleActivities.length < filteredActivities.length && (
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 no-print">
                    <span>
                      Showing {visibleActivities.length} of {filteredActivities.length} total entries
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDisplayCount(prev => prev + 100)}
                        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-black transition-all cursor-pointer"
                      >
                        + Load More (+100)
                      </button>
                      <button
                        onClick={() => setDisplayCount(filteredActivities.length)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-black transition-all cursor-pointer"
                      >
                        ⚡ Show All ({filteredActivities.length})
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            </>
          ) : (
            // INVOICES LIST VIEW
            <>
              <div className="flex items-center justify-between no-print">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  🧾 Generated Invoices History
                </h3>
              </div>

              {restaurantBills.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-semibold bg-slate-50 rounded-2xl border border-dashed my-auto no-print">
                  No invoices generated for {restaurantName} yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[420px] overflow-y-auto">
                  {/* MOBILE VIEW (< 640px): Clean Cards */}
                  <div className="block sm:hidden divide-y divide-slate-100 p-2 space-y-2">
                    {restaurantBills.map(b => (
                      <div key={b.id} className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-black text-xs text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 truncate">
                              {getInvoiceLabel(b)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              {b.bill_date}
                            </span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-black border shrink-0 ${
                            b.gst_mode === 'gst' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {b.gst_mode === 'gst' ? 'GST' : 'Plain'}
                          </span>
                        </div>

                        <div className="pt-0.5">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Invoice Total</span>
                          <span className="text-sm font-black text-slate-900">
                            ₹{Number(b.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center flex-wrap gap-1.5">
                          <button
                            onClick={() => handleShareBillOnWhatsApp(b)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-700 shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>📤</span> WhatsApp
                          </button>
                          <button
                            onClick={() => setSelectedBillForPrint(b)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600 text-white text-[11px] font-black hover:bg-sky-700 shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>👁️</span> View
                          </button>
                          {onEditBill && (
                            <button
                              onClick={() => onEditBill(b)}
                              className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold flex items-center justify-center cursor-pointer shrink-0"
                              title="Edit Invoice"
                            >
                              ✏️
                            </button>
                          )}
                          <button
                            onClick={() => performDeleteBill({ rawBillObj: b, invoiceLabel: getInvoiceLabel(b) })}
                            className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center cursor-pointer shrink-0"
                            title="Delete Invoice"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DESKTOP VIEW (>= 640px): Full Table */}
                  <table className="hidden sm:table w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-mutedSlate">
                        <th className="px-4 py-3">Invoice No</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {restaurantBills.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-extrabold text-slate-900">
                            {getInvoiceLabel(b)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{b.bill_date}</td>
                          <td className="px-4 py-3 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black border ${
                              b.gst_mode === 'gst' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {b.gst_mode === 'gst' ? 'GST Tax Invoice' : 'Plain Bill'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">
                            ₹{Number(b.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right no-print">
                            <div className="flex justify-end items-center gap-1.5">
                              <button
                                onClick={() => handleShareBillOnWhatsApp(b)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95"
                                title="Send on WhatsApp"
                              >
                                <span>📤</span> WhatsApp
                              </button>
                              <button
                                onClick={() => setSelectedBillForPrint(b)}
                                className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-[11px] font-extrabold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                🖨️ View
                              </button>
                              {onEditBill && (
                                <button
                                  onClick={() => onEditBill(b)}
                                  className="px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 text-[11px] font-bold transition-all cursor-pointer"
                                  title="Edit Invoice"
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                onClick={() => performDeleteBill({ rawBillObj: b, invoiceLabel: getInvoiceLabel(b) })}
                                className="px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-[11px] font-bold transition-all cursor-pointer"
                                title="Delete Invoice"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-customBorder flex items-center justify-between no-print shrink-0">
          <span className="text-xs font-semibold text-slate-500 truncate">
            Statement for {restaurantName}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Close Passbook
          </button>
        </div>

      </div>

      {/* Invoice Print & WhatsApp Preview Modal */}
      {selectedBillForPrint && (
        <div className="modal-overlay-universal no-print">
          <div className="modal-card-universal max-w-2xl border border-slate-100 p-3.5 sm:p-5 space-y-3 animate-fadeIn">
            
            {/* Top Header & Close */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">🧾</span>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider truncate">
                    Invoice Preview ({getInvoiceLabel(selectedBillForPrint)})
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold">{selectedBillForPrint.restaurant_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBillForPrint(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-colors text-sm shrink-0"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Prominent Action Buttons Bar (100% Mobile & Desktop Clear) */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              <button
                onClick={() => handleShareBillOnWhatsApp(selectedBillForPrint)}
                className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-center"
              >
                <span className="text-sm">📤</span>
                <span className="truncate">Share PDF</span>
              </button>
              <button
                onClick={() => exportBillPDF(selectedBillForPrint, getBillProfile(selectedBillForPrint.restaurant_name))}
                className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-center"
              >
                <span className="text-sm">📄</span>
                <span className="truncate">Download PDF</span>
              </button>
              <button
                onClick={() => window.print()}
                className="py-2.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-center"
              >
                <span className="text-sm">🖨️</span>
                <span className="truncate">Print Bill</span>
              </button>
            </div>

            {/* Print Area content (Scrollable & 100% Mobile Auto-Fit) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden pr-0.5 space-y-3">
              <div id="bill-print-area" className="border border-slate-200 rounded-2xl p-2.5 sm:p-5 bg-white shadow-soft text-xs space-y-3 max-w-full overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-3 gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="text-[8px] sm:text-[9px] font-black text-emerald-700 uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate">Authorized LPG Distributor</span>
                    </div>
                    <h2 className="text-sm sm:text-lg md:text-xl font-black text-slate-900 tracking-tight truncate">M/S SHREE BALAJI AGENCIES</h2>
                    <p className="text-[9.5px] sm:text-[10px] text-slate-600 font-medium mt-0.5">Kamthi Line Beside SBI ATM, Rajnandgaon, CG</p>
                    <p className="text-[9.5px] sm:text-[10px] text-slate-600 font-semibold">📞 9407922288 | ✉️ msspagency@gmail.com</p>
                    {selectedBillForPrint.gst_mode === 'gst' && (
                      <p className="text-[9.5px] sm:text-[10.5px] font-extrabold text-slate-800 mt-0.5">
                        GSTIN: <span className="text-sky-800 font-black">22SNZPS3600E1ZH</span>
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-black rounded-lg sm:rounded-xl uppercase tracking-wider ${
                      selectedBillForPrint.gst_mode === 'gst' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 border border-slate-300'
                    }`}>
                      {selectedBillForPrint.gst_mode === 'gst' ? 'TAX INVOICE' : 'PLAIN BILL'}
                    </span>
                    <p className="text-[11px] sm:text-xs font-black text-sky-800 mt-1">Invoice: {getInvoiceLabel(selectedBillForPrint)}</p>
                    <p className="text-[9.5px] sm:text-[10.5px] text-slate-600 font-bold">Date: {selectedBillForPrint.bill_date}</p>
                  </div>
                </div>

                {/* Bill To & Customer Info */}
                <div className="bg-slate-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200">
                  <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest block">BILL TO</span>
                  <p className="font-black text-slate-900 text-xs sm:text-sm">{selectedBillForPrint.restaurant_name}</p>
                  {getBillProfile(selectedBillForPrint.restaurant_name).address && (
                    <p className="text-slate-600 text-[10px] sm:text-[11px] font-medium">{getBillProfile(selectedBillForPrint.restaurant_name).address}</p>
                  )}
                  {getBillProfile(selectedBillForPrint.restaurant_name).mobile && (
                    <p className="text-slate-700 text-[10px] sm:text-[11px] font-bold">Phone: +91 {getBillProfile(selectedBillForPrint.restaurant_name).mobile}</p>
                  )}
                  {(selectedBillForPrint.gst_num || getBillProfile(selectedBillForPrint.restaurant_name).gst_num) && (
                    <p className="text-slate-800 text-[10px] sm:text-[11px] font-black">
                      GSTIN: {selectedBillForPrint.gst_num || getBillProfile(selectedBillForPrint.restaurant_name).gst_num}
                    </p>
                  )}
                </div>

                {/* Line Items Table (100% Fluid & Mobile Optimized) */}
                <div className="border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left text-[11px] sm:text-xs border-collapse table-auto">
                    <thead>
                      <tr className="border-b border-slate-200 font-black text-slate-700 bg-slate-100/70 text-[9px] sm:text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-1.5 sm:px-3 w-6 text-center">#</th>
                        <th className="py-2 px-1.5 sm:px-3">Item Description</th>
                        {selectedBillForPrint.gst_mode === 'gst' && <th className="hidden sm:table-cell py-2 px-2">HSN</th>}
                        <th className="py-2 px-1.5 sm:px-3 text-center sm:text-right">Qty</th>
                        <th className="py-2 px-1.5 sm:px-3 text-right">Rate</th>
                        <th className="py-2 px-1.5 sm:px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.isArray(selectedBillForPrint.items) && selectedBillForPrint.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-1.5 sm:px-3 font-medium text-slate-400 text-center">{idx + 1}</td>
                          <td className="py-2 px-1.5 sm:px-3 font-black text-slate-900">
                            <div>{it.description || it.item_name || 'Cylinder'}</div>
                            {selectedBillForPrint.gst_mode === 'gst' && (
                              <span className="sm:hidden text-[9px] text-slate-400 font-normal block">HSN: {it.hsn || '27111900'}</span>
                            )}
                          </td>
                          {selectedBillForPrint.gst_mode === 'gst' && <td className="hidden sm:table-cell py-2 px-2 text-slate-500 font-semibold">{it.hsn || '27111900'}</td>}
                          <td className="py-2 px-1.5 sm:px-3 text-center sm:text-right font-black text-slate-900 whitespace-nowrap">{it.qty} PCS</td>
                          <td className="py-2 px-1.5 sm:px-3 text-right font-semibold whitespace-nowrap">₹{Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-1.5 sm:px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            ₹{((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100/70 font-black text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={2} className="py-2 px-1.5 sm:px-3 text-[10px] sm:text-[11px] uppercase tracking-wider">TOTAL PCS</td>
                        {selectedBillForPrint.gst_mode === 'gst' && <td className="hidden sm:table-cell"></td>}
                        <td className="py-2 px-1.5 sm:px-3 text-center sm:text-right font-black whitespace-nowrap">
                          {(selectedBillForPrint.items || []).reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0)} PCS
                        </td>
                        <td className="py-2 px-1.5 sm:px-3"></td>
                        <td className="py-2 px-1.5 sm:px-3 text-right font-black text-xs sm:text-sm text-sky-900 whitespace-nowrap">
                          ₹{Number(selectedBillForPrint.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

              {/* Subtotals & Bank details Footer Grid */}
              {(() => {
                const totAmt = Number(selectedBillForPrint.total_amount || selectedBillForPrint.amount || selectedBillForPrint.debit || 0);
                const paidAmt = Number(selectedBillForPrint.amount_paid || (selectedBillForPrint.payment_status === 'paid' ? totAmt : 0));
                const bName = selectedBillForPrint.restaurant_name || selectedBillForPrint.restaurantName || restaurantName || '';
                const selDate = selectedBillForPrint.bill_date || selectedBillForPrint.entry_date || selectedBillForPrint.date || '';
                const selNo = parseInt(selectedBillForPrint.invoice_no || selectedBillForPrint.sr_no || selectedBillForPrint.srNo, 10) || 0;
                const otherBills = (bills || []).filter(b => b && b.id !== selectedBillForPrint.id && (b.bill_date < selDate || (b.bill_date === selDate && (parseInt(b.invoice_no, 10) || 0) < selNo)));
                const prevBal = getPartyCurrentBalance(bName, restaurantProfiles, otherBills, payments);
                const currentBal = prevBal + totAmt - paidAmt;

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Bank Details & QR */}
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[10.5px] space-y-1">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest block mb-0.5">Bank Details</span>
                          <div className="grid grid-cols-3 gap-y-0.5 text-slate-600">
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

                        <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                          <img src="/payment-qr.png" alt="Payment QR" className="w-12 h-12 border border-slate-200 rounded-xl shrink-0 bg-white p-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-slate-900 block">UPI ID: 9407922288-1@okbizaxis</span>
                            <span className="text-[8.5px] text-slate-400 font-semibold block">Scan with GPay, PhonePe, Paytm</span>
                          </div>
                        </div>
                      </div>

                      {/* Tax Breakdown & Balance Due */}
                      <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        {selectedBillForPrint.gst_mode === 'gst' && (
                          <div className="space-y-1 text-xs border-b border-slate-200 pb-1.5 text-slate-600">
                            <div className="flex justify-between">
                              <span>Taxable Amount</span>
                              <span className="font-black text-slate-900">₹{Number(selectedBillForPrint.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 font-semibold">
                              <span>CGST @ 9%</span>
                              <span className="font-bold text-slate-900">₹{Number(selectedBillForPrint.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 font-semibold">
                              <span>SGST @ 9%</span>
                              <span className="font-bold text-slate-900">₹{Number(selectedBillForPrint.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Total Amount</span>
                          <span className="text-sm font-black text-slate-900">
                            ₹{totAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs border-t border-b border-slate-200 py-1.5">
                          <div className="flex justify-between items-center text-slate-500 font-semibold">
                            <span>Received Amount</span>
                            <span className="text-slate-700 font-bold">₹{paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500 font-semibold">
                            <span>Previous Balance</span>
                            <span className="text-slate-700 font-bold">₹{prevBal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center pt-0.5 border-t border-slate-200/60">
                            <span className="font-black text-rose-700 text-xs uppercase">Current Balance</span>
                            <span className="font-black text-rose-700 text-sm">
                              ₹{currentBal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Total in words */}
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-500">Balance in Words:</span>
                      <span className="font-black text-slate-900">
                        {numberToWords(Math.round(currentBal > 0 ? currentBal : totAmt))}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 text-[9.5px] text-slate-400 flex items-center justify-between border-t border-slate-100">
                <p>Terms: Goods once sold will not be taken back. Empty cylinders returnable.</p>
                <p className="font-bold text-slate-600">Authorized Signatory • M/S SHREE BALAJI AGENCIES</p>
              </div>
            </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default memo(RestaurantStatementModal);
