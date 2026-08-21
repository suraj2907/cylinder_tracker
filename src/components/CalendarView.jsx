import React, { useState, useMemo } from 'react';
import { formatIsoDate, normType } from '../utils/dataUtils';
import RestaurantStatementModal from './RestaurantStatementModal';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MFULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarView({ 
  dateMap = {}, 
  selectedDate, 
  setSelectedDate, 
  handleDeleteEntry,
  payments = [],
  batches = [],
  onDeletePayment
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [cal, setCal] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  
  // Custom Date Range State
  const [rangeMode, setRangeMode] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("all");

  // Search & Activity Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [selectedPassbookHotel, setSelectedPassbookHotel] = useState(null);

  const yr = cal.getFullYear(), mo = cal.getMonth();
  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMo = new Date(yr, mo + 1, 0).getDate();
  const fmt = (d) => `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const activeMonths = useMemo(() => {
    const s = new Set();
    Object.keys(dateMap).forEach(d => { if (d) s.add(formatIsoDate(d).slice(0, 7)); });
    payments.forEach(p => { if (p.date) s.add(formatIsoDate(p.date).slice(0, 7)); });
    return s;
  }, [dateMap, payments]);

  // Combine Cylinder Deliveries & Payment Collections into a Master Date-Wise Timeline
  const combinedEntries = useMemo(() => {
    const list = [];

    // 1. Add Cylinder Deliveries & Returns
    Object.entries(dateMap).forEach(([dateStr, dObj]) => {
      const normDate = formatIsoDate(dateStr);
      if (dObj && dObj.details) {
        dObj.details.forEach(item => {
          const typeStr = normType(item.type);
          list.push({
            id: item.originalEntry?.id || `cyl_${normDate}_${item.name}_${item.batch}_${Math.random()}`,
            kind: 'cylinder',
            date: normDate,
            batchNum: item.batch,
            restaurantName: item.name,
            qty: item.qty,
            type: typeStr,
            isReturn: item.isReturn,
            userName: item.originalEntry?.user_name || 'Suraj',
            originalEntry: item.originalEntry
          });
        });
      }
    });

    // 2. Add Payment Collection Entries
    payments.forEach(p => {
      const rawDate = p.date || (p.created_at ? p.created_at.slice(0, 10) : today);
      const pDate = formatIsoDate(rawDate);
      list.push({
        id: p.id || `pay_${pDate}_${p.restaurant_name || p.restaurantName}_${p.amount}_${Math.random()}`,
        kind: 'payment',
        date: pDate,
        batchNum: p.batch_num || p.batchNum || 128,
        restaurantName: p.restaurant_name || p.restaurantName || "Unknown",
        amount: parseFloat(p.amount) || 0,
        paymentMode: p.payment_mode || p.paymentMode || 'Cash',
        userName: p.user_name || 'Suraj',
        note: p.note || '',
        rawPaymentObj: p
      });
    });

    return list;
  }, [dateMap, payments, today]);

  // Filtered timeline based on Single Date / Date Range, Search Query, and Activity Type
  const filteredTimeline = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return combinedEntries.filter(item => {
      // 1. Date Range / Calendar Filter
      let inDate = false;
      if (rangeMode) {
        inDate = item.date >= startDate && item.date <= endDate;
      } else if (selectedDate) {
        inDate = item.date === selectedDate;
      } else {
        const currentMonthPrefix = `${yr}-${String(mo + 1).padStart(2, "0")}`;
        inDate = item.date.startsWith(currentMonthPrefix);
      }

      // 2. Batch Filter
      const inBatch = selectedBatchFilter === "all" || String(item.batchNum) === String(selectedBatchFilter);

      // 3. Activity Type Filter (delivery / return / payment)
      let inType = true;
      if (activityTypeFilter === "delivery") {
        inType = item.kind === 'cylinder' && !item.isReturn;
      } else if (activityTypeFilter === "return") {
        inType = item.kind === 'cylinder' && item.isReturn;
      } else if (activityTypeFilter === "payment") {
        inType = item.kind === 'payment';
      }

      // 4. Text Search Filter (Hotel name, batch #, note, partner user)
      let inSearch = true;
      if (query) {
        const nameMatch = (item.restaurantName || "").toLowerCase().includes(query);
        const batchMatch = String(item.batchNum || "").includes(query);
        const userMatch = (item.userName || "").toLowerCase().includes(query);
        const noteMatch = (item.note || "").toLowerCase().includes(query);
        const dateMatch = (item.date || "").includes(query);
        inSearch = nameMatch || batchMatch || userMatch || noteMatch || dateMatch;
      }

      return inDate && inBatch && inType && inSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [combinedEntries, rangeMode, startDate, endDate, selectedDate, yr, mo, selectedBatchFilter, searchQuery, activityTypeFilter]);

  // Total summary numbers for current filter with 21kg & 19.2kg breakdown
  const filterStats = useMemo(() => {
    let del21 = 0, del192 = 0;
    let ret21 = 0, ret192 = 0;
    let totCash = 0, totUPI = 0;

    filteredTimeline.forEach(item => {
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
        if (item.paymentMode === 'UPI') totUPI += item.amount;
        else totCash += item.amount;
      }
    });

    const totDel = del21 + del192;
    const totRet = ret21 + ret192;
    const totalMoney = totCash + totUPI;

    return { del21, del192, ret21, ret192, totDel, totRet, totCash, totUPI, totalMoney };
  }, [filteredTimeline]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Calendar Header & View Switcher */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Operations & Calendar Log</span>
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-1">
              Select date or date range to view hotel delivery & payment history.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shadow-inner">
            <button
              onClick={() => { setRangeMode(false); setSelectedDate(today); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !rangeMode ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📅 Month / Single Date
            </button>
            <button
              onClick={() => setRangeMode(true)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                rangeMode ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📆 Date Range Filter
            </button>
          </div>
        </div>

        {/* Date Range Selector Controls */}
        {rangeMode ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-customBorder flex items-center justify-between flex-wrap gap-4 animate-fadeIn">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-bold text-mutedSlate uppercase mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-customBorder bg-white text-xs font-bold text-slate-800 shadow-sm"
                />
              </div>

              <span className="text-slate-400 font-bold mt-4">to</span>

              <div>
                <label className="block text-[10px] font-bold text-mutedSlate uppercase mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-customBorder bg-white text-xs font-bold text-slate-800 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-mutedSlate uppercase mb-1">Filter Batch</label>
                <select
                  value={selectedBatchFilter}
                  onChange={e => setSelectedBatchFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-customBorder bg-white text-xs font-bold text-slate-800 shadow-sm"
                >
                  <option value="all">All Batches</option>
                  {batches.map(b => (
                    <option key={b.batch} value={b.batch}>Batch #{b.batch}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Range Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => { setStartDate(today); setEndDate(today); }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setStartDate(d.toISOString().slice(0, 10));
                  setEndDate(today);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  setStartDate(`${yr}-${String(mo + 1).padStart(2, "0")}-01`);
                  setEndDate(today);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                This Month
              </button>
            </div>
          </div>
        ) : (
          /* Single Date Month Grid Controls */
          <div>
            <div className="flex items-center justify-between px-2 py-2 flex-wrap gap-3 border-b border-customBorder">
              <button 
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
                onClick={() => setCal(new Date(yr, mo - 1, 1))}>← Prev</button>
              <span className="font-black text-sm text-textSlate">{MFULL[mo]} {yr}</span>
              <button 
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
                onClick={() => setCal(new Date(yr, mo + 1, 1))}>Next →</button>
            </div>

            <div className="flex gap-1.5 py-2.5 border-b border-customBorder flex-wrap items-center overflow-x-auto bg-white">
              {MONTHS.map((m, i) => {
                const key = `${yr}-${String(i + 1).padStart(2, "0")}`;
                const active = activeMonths.has(key);
                return (
                  <button key={m} 
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                      active 
                        ? 'border-sky-300 bg-sky-50 text-sky-800 font-extrabold shadow-sm' 
                        : 'border-slate-200 bg-white text-slate-400 opacity-60 hover:opacity-100'
                    }`}
                    onClick={() => setCal(new Date(yr, i, 1))}>{m}</button>
                );
              })}
              <select 
                className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-slate-800 font-bold text-xs shadow-sm"
                value={yr}
                onChange={e => setCal(new Date(parseInt(e.target.value), mo, 1))}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-7 gap-1 px-3 py-2 text-center border-b border-customBorder bg-slate-50">
              {DAYS.map(d => <div key={d} className="text-[10px] text-mutedSlate font-extrabold uppercase tracking-wider">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2 p-3">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMo }).map((_, i) => {
                const d = i + 1, key = fmt(d), data = dateMap[key];
                const dayPayments = payments.filter(p => formatIsoDate(p.date) === key);
                const isTod = key === today, isSel = key === selectedDate;
                const total21 = (data?.["21kg"] || 0), total192 = (data?.["19.2kg"] || 0);
                const hasActivity = data || dayPayments.length > 0;
                
                let borderClass = 'border-slate-200 bg-white';
                if (isSel) {
                  borderClass = 'border-sky-500 bg-sky-50 shadow-md ring-2 ring-sky-300';
                } else if (hasActivity) {
                  borderClass = 'border-sky-200 bg-sky-50/40 hover:bg-sky-50 cursor-pointer shadow-sm';
                }

                let outlineClass = isTod ? 'ring-2 ring-amber-400' : '';

                return (
                  <div key={d} onClick={() => hasActivity && setSelectedDate(isSel ? null : key)}
                    className={`rounded-xl border p-2 flex flex-col justify-between min-h-[64px] transition-all ${borderClass} ${outlineClass}`}>
                    <div className={`text-xs font-black text-center ${
                      isTod ? 'text-amber-700 font-black' : hasActivity ? 'text-slate-900' : 'text-slate-400'
                    }`}>{d}</div>
                    {hasActivity && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {total21 > 0 && <div className="text-[9px] font-extrabold text-sky-800 text-center leading-tight truncate">🔵 {total21}</div>}
                        {total192 > 0 && <div className="text-[9px] font-extrabold text-teal-800 text-center leading-tight truncate">🟢 {total192}</div>}
                        {dayPayments.length > 0 && (
                          <div className="text-[9px] font-black text-emerald-700 text-center leading-tight truncate">
                            💳 ₹{dayPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards for Selected Month / Filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Cylinders Delivered Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-soft border-l-4 border-l-slate-800">
          <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">📦 Total Delivered</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{filterStats.totDel} units</div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Khali return: {filterStats.totRet}</div>
        </div>

        {/* 19.2kg Delivered Card */}
        <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-soft border-l-4 border-l-teal-600">
          <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">🟢 19.2 KG Delivered</div>
          <div className="text-2xl font-black text-teal-800 mt-1">{filterStats.del192} units</div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Khali return: {filterStats.ret192}</div>
        </div>

        {/* 21kg Delivered Card */}
        <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-soft border-l-4 border-l-sky-600">
          <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">🔵 21 KG Delivered</div>
          <div className="text-2xl font-black text-sky-800 mt-1">{filterStats.del21} units</div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Khali return: {filterStats.ret21}</div>
        </div>

        {/* Total Money Collection Card */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-soft border-l-4 border-l-emerald-600">
          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">💰 Total Collection</div>
          <div className="text-xl font-black text-emerald-600 mt-1">₹{filterStats.totalMoney.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
            Cash: ₹{filterStats.totCash.toLocaleString()} | UPI: ₹{filterStats.totUPI.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Master Date-Wise & Hotel-Wise Timeline Table WITH IN-HEADER SEARCH & FILTERS */}
      <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft space-y-4">
        {/* Timeline Header with Integrated Search & Activity Filter */}
        <div className="border-b border-customBorder pb-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-textSlate flex items-center gap-2">
              <span>📜 Date-Wise & Hotel-Wise Activity Timeline</span>
              <span className="text-xs font-bold text-slate-500">
                ({filteredTimeline.length} entries {rangeMode ? `between ${startDate} and ${endDate}` : selectedDate ? `on ${selectedDate}` : `in ${MFULL[mo]}`})
              </span>
            </h3>
          </div>

          {/* Search Bar & Type Filter Buttons Right Here in Timeline Header */}
          <div className="p-3 bg-slate-50 rounded-xl border border-customBorder flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Search hotel name, batch #, or partner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-customBorder bg-white text-xs font-semibold focus:border-accentCyan shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Activity Type Filter Buttons */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-customBorder shadow-sm flex-wrap">
              <button
                onClick={() => setActivityTypeFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activityTypeFilter === "all" ? "bg-sky-600 text-white font-extrabold shadow-sm" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                All ({combinedEntries.length})
              </button>
              <button
                onClick={() => setActivityTypeFilter("delivery")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activityTypeFilter === "delivery" ? "bg-sky-600 text-white font-extrabold shadow-sm" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                🚚 Delivery
              </button>
              <button
                onClick={() => setActivityTypeFilter("return")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activityTypeFilter === "return" ? "bg-emerald-600 text-white font-extrabold shadow-sm" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                ♻️ Khali Return
              </button>
              <button
                onClick={() => setActivityTypeFilter("payment")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  activityTypeFilter === "payment" ? "bg-amber-600 text-white font-extrabold shadow-sm" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                💳 Payment
              </button>
            </div>
          </div>
        </div>

        {filteredTimeline.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-semibold bg-slate-50 rounded-xl border border-dashed">
            No entries match your search or filter. Try clearing the search query or changing date filter.
          </div>
        ) : (
          <div className="overflow-x-auto border border-customBorder rounded-xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-customBorder">
                  <th className="py-3 px-4 text-[11px] font-bold text-mutedSlate uppercase">Date</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-mutedSlate uppercase">Batch #</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-mutedSlate uppercase">Hotel / Restaurant Name</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-mutedSlate uppercase">Entry Type & Details</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-mutedSlate uppercase">Recorded By (Partner)</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-mutedSlate uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTimeline.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-xs font-bold text-slate-700">{item.date}</td>
                    <td className="py-3 px-4 text-xs font-black text-amber-600">#{item.batchNum}</td>
                    <td className="py-3 px-4 text-xs font-extrabold text-slate-900">
                      <button
                        onClick={() => setSelectedPassbookHotel(item.restaurantName)}
                        className="hover:underline hover:text-sky-700 text-left font-extrabold"
                        title="Click to view hotel passbook statement"
                      >
                        📜 {item.restaurantName}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {item.kind === 'cylinder' ? (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.isReturn ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-sky-100 text-sky-800 border border-sky-200'
                          }`}>
                            {item.isReturn ? '♻️ Khali Return' : '🚚 Delivery'}
                          </span>
                          <span className="font-extrabold text-slate-800">{item.qty}x {item.type}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.paymentMode === 'UPI' ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            💳 Payment ({item.paymentMode})
                          </span>
                          <span className="font-black text-emerald-600 text-xs">₹{item.amount.toLocaleString()}</span>
                          {item.note && <span className="text-[10px] text-slate-400 italic font-medium">({item.note})</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200">
                        👤 {item.userName || "Suraj"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-right">
                      {item.kind === 'cylinder' && handleDeleteEntry && (
                        <button
                          onClick={() => handleDeleteEntry(item.batchNum, item.originalEntry)}
                          className="text-red-500 hover:text-red-700 font-bold p-1 text-xs"
                          title="Delete entry"
                        >
                          🗑️
                        </button>
                      )}
                      {item.kind === 'payment' && onDeletePayment && (
                        <button
                          onClick={() => onDeletePayment(item.rawPaymentObj)}
                          className="text-red-500 hover:text-red-700 font-bold p-1 text-xs"
                          title="Delete payment"
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
      </div>

      {/* Render Statement Modal when a hotel is selected */}
      {selectedPassbookHotel && (
        <RestaurantStatementModal
          restaurantName={selectedPassbookHotel}
          onClose={() => setSelectedPassbookHotel(null)}
          batches={batches}
          payments={payments}
          handleDeleteEntry={handleDeleteEntry}
          onDeletePayment={onDeletePayment}
        />
      )}
    </div>
  );
}
