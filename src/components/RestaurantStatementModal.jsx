import React, { useState, useEffect, useMemo, memo } from 'react';
import { formatIsoDate, normType, getInvoiceLabel, getPartyCurrentBalance, norm } from '../utils/dataUtils';
import { supabase } from '../utils/supabaseClient';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MFULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
  restaurantProfiles = {}
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonthStr = today.slice(0, 7);

  const profile = restaurantProfiles[restaurantName] || {};
  const openingBalance = parseFloat(profile.previous_balance || 0);

  const [filterPeriod, setFilterPeriod] = useState(currentMonthStr);
  const [rangeMode, setRangeMode] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [activeSection, setActiveSection] = useState('passbook');
  const [selectedBillForPrint, setSelectedBillForPrint] = useState(null);
  const [displayCount, setDisplayCount] = useState(40);
  const [ledgerRows, setLedgerRows] = useState([]);

  const restaurantBills = useMemo(() => {
    if (!restaurantName) return [];
    const normTarget = norm(restaurantName);
    return bills.filter(b => norm(b.restaurant_name || '') === normTarget);
  }, [bills, restaurantName]);

  // Fetch this restaurant's historical ledger rows from the database using case-insensitive ilike
  useEffect(() => {
    let active = true;
    if (!restaurantName) return;
    supabase
      .from('legacy_ledger_entries')
      .select('*')
      .ilike('restaurant_name', restaurantName.trim())
      .order('entry_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('Error fetching ledger history', error); return; }
        if (active) setLedgerRows(data || []);
      });
    return () => { active = false; };
  }, [restaurantName]);

  // Unified activity timeline for this restaurant
  const allRestaurantActivities = useMemo(() => {
    const list = [];
    const normTarget = norm(restaurantName);

    // 1. Historical ledger rows from database
    ledgerRows.forEach((e, idx) => {
      if (!e.entry_date || e.voucher_type === 'Balance') return;
      list.push({
        id: `official_ledger_${idx}_${e.entry_date}_${e.sr_no}`,
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

    // 3. Extract Real-Time Payment Collections
    const paymentKeys = new Set();
    payments.forEach(p => {
      const pName = norm(p.restaurant_name || p.restaurantName);
      if (pName === normTarget) {
        const rawDate = p.date || today;
        const pDate = formatIsoDate(rawDate);
        const pAmt = parseFloat(p.amount) || 0;
        const pKey = `${pDate}_${pAmt}`;
        paymentKeys.add(pKey);

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
    });

    // 4. Extract Real-Time Sales Invoices (Bills) on/after 18/08/2026
    bills.forEach(b => {
      const pName = norm(b.restaurant_name || "");
      if (pName === normTarget) {
        const rawDate = b.bill_date || today;
        const bDate = formatIsoDate(rawDate);
        if (bDate >= '2026-08-18') {
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
            userName: b.created_by || 'Suraj',
            note: b.note || '',
            rawBillObj: b
          });
        }
      }
    });

    // Base balance up to 17/08/2026 from official synced CSV ledgers
    const baseBalance = parseFloat(profile.previous_balance || 0);

    // Fast string sorting (100x faster than new Date instantiation)
    const sortedAsc = [...list].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    
    let currentBalance = baseBalance;
    const listWithBalance = sortedAsc.map(item => {
      if (item.isOfficialLedger && item.officialBalance !== null && !isNaN(item.officialBalance)) {
        currentBalance = item.officialBalance;
      } else {
        if (item.kind === 'bill') {
          const paidOnBill = item.rawBillObj ? (parseFloat(item.rawBillObj.amount_paid) || 0) : 0;
          const unpaidOnBill = Math.max(0, item.amount - paidOnBill);
          currentBalance += unpaidOnBill;
        } else if (item.kind === 'payment') {
          currentBalance -= item.amount;
        }
      }
      return {
        ...item,
        runningBalance: Math.max(0, currentBalance)
      };
    });

    // Return sorted descending using fast string comparison
    return listWithBalance.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [restaurantName, ledgerRows, batches, payments, bills, restaurantProfiles, today]);

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
    return filteredActivities.slice(0, displayCount);
  }, [filteredActivities, displayCount]);

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

  // Available Months for dropdown
  const availableMonths = useMemo(() => {
    const s = new Set();
    allRestaurantActivities.forEach(item => {
      if (item.date) s.add(item.date.slice(0, 7));
    });
    s.add(currentMonthStr);
    return Array.from(s).sort().reverse();
  }, [allRestaurantActivities, currentMonthStr]);

  const closingBalance = useMemo(() => {
    return getPartyCurrentBalance(restaurantName, restaurantProfiles, bills, payments);
  }, [restaurantName, restaurantProfiles, bills, payments]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-2.5 sm:p-5 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-customBorder shadow-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 my-auto max-h-[95vh] flex flex-col justify-between overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-customBorder pb-3 flex-wrap gap-2">
          <div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
              🏪 Hotel Passbook Statement
            </span>
            <h2 className="text-lg sm:text-xl font-black text-textSlate mt-0.5">
              {restaurantName}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 text-lg flex items-center justify-center shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Filter Period Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl">
            <button
              onClick={() => setRangeMode(false)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                !rangeMode ? 'bg-sky-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setRangeMode(true)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
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
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm focus:border-sky-500"
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
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-bold"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-bold"
              />
            </div>
          )}
        </div>

        {/* Summary KPIs Strip for this Hotel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Delivered Card */}
          <div className="bg-sky-50/70 p-3 rounded-2xl border border-sky-200">
            <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">📦 Total Delivered</div>
            <div className="text-lg font-black text-sky-950 mt-0.5">{stats.totalDel} units</div>
            <div className="text-[10px] text-sky-800 font-bold mt-0.5">
              19.2kg: {stats.del192} | 21kg: {stats.del21}
            </div>
          </div>

          {/* Khali Returned Card */}
          <div className="bg-teal-50/70 p-3 rounded-2xl border border-teal-200">
            <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">♻️ Khali Returned</div>
            <div className="text-lg font-black text-teal-950 mt-0.5">{stats.totalRet} units</div>
            <div className="text-[10px] text-teal-800 font-bold mt-0.5">
              19.2kg: {stats.ret192} | 21kg: {stats.ret21}
            </div>
          </div>

          {/* Outstanding Empty Card */}
          <div className={`p-3 rounded-2xl border ${
            stats.totalOut > 0 ? 'bg-amber-50/80 border-amber-300' : 'bg-emerald-50/80 border-emerald-200'
          }`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">⚠️ Outstanding Khali</div>
            <div className={`text-lg font-black mt-0.5 ${stats.totalOut > 0 ? 'text-amber-950' : 'text-emerald-900'}`}>
              {stats.totalOut} cylinders
            </div>
            <div className="text-[10px] font-bold mt-0.5 text-slate-700">
              19.2kg: {stats.out192} | 21kg: {stats.out21}
            </div>
          </div>

          {/* Closing Balance Card */}
          <div className={`p-3 rounded-2xl border ${
            closingBalance > 0 ? 'bg-rose-50/70 border-rose-250 text-rose-900' : 'bg-emerald-50/70 border-emerald-250 text-emerald-950'
          }`}>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${closingBalance > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
              🔴 Closing Balance (Outstanding)
            </div>
            <div className="text-lg font-black mt-0.5">
              ₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className={`text-[10px] font-bold mt-0.5 ${closingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              Opening Bal: ₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Date-Wise Complete Passbook Table / Invoices List */}
        <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-[220px]">
          
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
              🧾 Invoices ({restaurantBills.length})
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
                <div className="overflow-y-auto border border-slate-200 rounded-2xl max-h-[380px] bg-white">
                  
                  {/* MOBILE CARDS VIEW (Clean & Spacious on Mobile Screens) */}
                  <div className="block md:hidden divide-y divide-slate-100 no-print">
                    {visibleActivities.map((item, idx) => (
                      <div key={item.id || idx} className="p-3.5 space-y-2 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-900">{item.date}</span>
                            {item.kind !== 'bill' && (
                              <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                #{item.batchNum}
                              </span>
                            )}
                          </div>
                          
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.kind === 'cylinder'
                              ? (item.isReturn ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-sky-100 text-sky-800 border border-sky-200')
                              : item.kind === 'bill'
                                ? 'bg-indigo-100 text-indigo-850 border border-indigo-200'
                                : (item.paymentMode === 'UPI' ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-amber-100 text-amber-800 border border-amber-200')
                          }`}>
                            {item.kind === 'cylinder'
                              ? (item.isReturn ? '♻️ Khali Return' : '🚚 Delivery')
                              : item.kind === 'bill'
                                ? '🧾 Invoice Sales'
                                : `💳 Payment (${item.paymentMode})`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <div>
                            {item.kind === 'cylinder' ? (
                              <div className="text-sm font-black text-slate-900">
                                {item.qty}x {item.type} {item.isReturn ? 'Khali' : 'Cylinder'}
                              </div>
                            ) : item.kind === 'bill' ? (
                              <div className="text-sm font-black text-slate-900">
                                {item.invoiceLabel} <span className="text-xs text-rose-600 font-black">₹{item.amount.toLocaleString()}</span>
                              </div>
                            ) : (
                              <div className="text-sm font-black text-emerald-600">
                                ₹{item.amount.toLocaleString()} <span className="text-xs text-slate-500 font-semibold">Received</span>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              Recorded by: {item.userName}
                            </div>
                          </div>

                          {item.kind === 'cylinder' && handleDeleteEntry && (
                            <button
                              onClick={() => handleDeleteEntry(item.batchNum, item.originalEntry)}
                              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold active:scale-95 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                          {item.kind === 'payment' && onDeletePayment && (
                            <button
                              onClick={() => onDeletePayment(item.rawPaymentObj)}
                              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold active:scale-95 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                          {item.kind === 'bill' && deleteBill && (
                            <button
                              onClick={() => handleDeleteBill(item.rawBillObj.id, item.rawBillObj.invoice_no)}
                              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold active:scale-95 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DESKTOP TABLE VIEW */}
                  <table className="hidden md:table w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-mutedSlate">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Details / Invoice</th>
                        <th className="px-4 py-3 text-right">Batch</th>
                        <th className="px-4 py-3 text-right">Delivered</th>
                        <th className="px-4 py-3 text-right">Khali Ret</th>
                        <th className="px-4 py-3 text-right text-rose-650">Bill Amt (₹)</th>
                        <th className="px-4 py-3 text-right text-emerald-700">Paid (₹)</th>
                        <th className="px-4 py-3 text-right text-slate-800">Closing Bal (₹)</th>
                        <th className="px-4 py-3">By</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleActivities.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700">{item.date}</td>
                          <td className="px-4 py-3 font-bold">
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
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {item.kind === 'cylinder' ? (
                              <span className="font-semibold text-slate-600">{item.type} Cylinder</span>
                            ) : item.kind === 'bill' ? (
                              <button
                                onClick={() => setSelectedBillForPrint(item.rawBillObj)}
                                className="text-indigo-650 hover:underline font-bold"
                              >
                                {item.invoiceLabel}
                              </button>
                            ) : (
                              <span className="font-semibold text-slate-600">Collection</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-500">
                            {item.kind === 'bill' ? '-' : `#${item.batchNum}`}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {item.kind === 'cylinder' && !item.isReturn ? `${item.qty} units` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {item.kind === 'cylinder' && item.isReturn ? `${item.qty} units` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-rose-600">
                            {item.kind === 'bill' ? `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-emerald-700">
                            {item.kind === 'payment' ? `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 bg-slate-50/50">
                            ₹{(item.runningBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-bold">{item.userName}</td>
                          <td className="px-4 py-3 text-right no-print">
                            {item.kind === 'cylinder' && handleDeleteEntry && (
                              <button
                                onClick={() => handleDeleteEntry(item.batchNum, item.originalEntry || item.rawEntryObj)}
                                className="text-red-500 hover:text-red-700 font-bold p-1 text-xs cursor-pointer active:scale-95"
                                title="Delete entry"
                              >
                                🗑️
                              </button>
                            )}
                            {item.kind === 'payment' && onDeletePayment && (
                              <button
                                onClick={() => onDeletePayment(item.rawPaymentObj)}
                                className="text-red-500 hover:text-red-700 font-bold p-1 text-xs cursor-pointer active:scale-95"
                                title="Delete payment"
                              >
                                🗑️
                              </button>
                            )}
                            {item.kind === 'bill' && deleteBill && (
                              <button
                                onClick={async () => {
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
                                }}
                                className="text-red-500 hover:text-red-700 font-bold p-1 text-xs cursor-pointer active:scale-95"
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
                <div className="overflow-y-auto border border-slate-200 rounded-2xl max-h-[380px] bg-white">
                  <table className="w-full text-left text-xs border-collapse">
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
                          <td className="px-4 py-3 text-right font-black text-slate-955">
                            ₹{Number(b.total_amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right no-print flex justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedBillForPrint(b)}
                              className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-[11px] font-extrabold transition-all shadow-xs cursor-pointer"
                            >
                              🖨️ View
                            </button>
                            <button
                              onClick={() => handleDeleteBill(b.id, b.invoice_no)}
                              className="px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-[11px] font-bold transition-all cursor-pointer"
                              title="Delete Invoice"
                            >
                              🗑️
                            </button>
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
        <div className="pt-3 border-t border-customBorder flex items-center justify-between no-print">
          <span className="text-xs font-semibold text-slate-500">
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

      {/* Invoice Print Overlay Modal (Only render on top when print is clicked) */}
      {selectedBillForPrint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto relative animate-fadeIn">
            
            {/* Top controls */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Invoice Print Preview
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-black uppercase tracking-wider hover:bg-sky-700 transition-all shadow-sm cursor-pointer"
                >
                  🖨️ Print / Save PDF
                </button>
                <button
                  onClick={() => setSelectedBillForPrint(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all border cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* Print Area content */}
            <div id="bill-print-area" className="border border-slate-200 rounded-2xl p-6 bg-white">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">M/S SHREE BALAJI AGENCIES</h2>
                  <p className="text-[10px] text-slate-500 mt-1">Kamthi Line Beside SBI ATM, Rajnandgaon, Chhattisgarh, 491441</p>
                  <p className="text-[10px] text-slate-500">📞 9407922288 | ✉️ msspagency@gmail.com</p>
                  {selectedBillForPrint.gst_mode === 'gst' && <p className="text-[10px] text-slate-500 font-bold">GSTIN: 22SNZPS3600E1ZH</p>}
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 bg-slate-950 text-white text-[9px] font-black rounded uppercase tracking-wider">
                    {selectedBillForPrint.gst_mode === 'gst' ? 'TAX INVOICE' : 'BILL'}
                  </span>
                  <p className="text-xs font-bold text-slate-700 mt-2">Invoice No: {getInvoiceLabel(selectedBillForPrint)}</p>
                  <p className="text-[10px] text-slate-500">Date: {selectedBillForPrint.bill_date}</p>
                </div>
              </div>

              <div className="mb-4 text-xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bill To</p>
                <p className="font-extrabold text-slate-900">{selectedBillForPrint.restaurant_name}</p>
                {/* GST Details of customer if GST Bill */}
                {selectedBillForPrint.gst_mode === 'gst' && selectedBillForPrint.gst_num && <p className="text-[10px] text-slate-500 mt-0.5">GSTIN: {selectedBillForPrint.gst_num}</p>}
              </div>

              <table className="w-full text-left text-[11px] border-collapse mb-4">
                <thead>
                  <tr className="border-b border-slate-300 font-bold text-slate-700">
                    <th className="py-2">Item</th>
                    {selectedBillForPrint.gst_mode === 'gst' && <th className="py-2">HSN</th>}
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.isArray(selectedBillForPrint.items) && selectedBillForPrint.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-800">{it.description}</td>
                      {selectedBillForPrint.gst_mode === 'gst' && <td className="py-2 text-slate-600">{it.hsn || '27111900'}</td>}
                      <td className="py-2 text-right text-slate-700">{it.qty}</td>
                      <td className="py-2 text-right text-slate-700">₹{Number(it.rate).toFixed(2)}</td>
                      <td className="py-2 text-right text-slate-900 font-semibold">₹{(it.qty * it.rate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <div className="w-52 space-y-1 text-[11px]">
                  {selectedBillForPrint.gst_mode === 'gst' && (
                    <>
                      <div className="flex justify-between text-slate-500">
                        <span>Taxable Amount</span>
                        <span>₹{Number(selectedBillForPrint.taxable_amount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>CGST @9%</span>
                        <span>₹{Number(selectedBillForPrint.cgst || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>SGST @9%</span>
                        <span>₹{Number(selectedBillForPrint.sgst || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t border-slate-350 pt-1 font-black text-xs text-slate-900">
                    <span>Total</span>
                    <span>₹{Number(selectedBillForPrint.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 text-[9px] text-slate-400">
                <p>Terms: Goods once sold will not be taken back. Empty cylinder returnable; loss/damage chargeable.</p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default memo(RestaurantStatementModal);
