import React, { useState, useMemo } from 'react';
import { formatIsoDate, normType } from '../utils/dataUtils';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MFULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function RestaurantStatementModal({
  restaurantName,
  onClose,
  batches = [],
  payments = [],
  handleDeleteEntry,
  onDeletePayment
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonthStr = today.slice(0, 7);

  const [filterPeriod, setFilterPeriod] = useState(currentMonthStr); // "2026-07" or "all" or custom range
  const [rangeMode, setRangeMode] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Extract all activity entries (Deliveries, Khali Returns, Payments) for this restaurant
  const allRestaurantActivities = useMemo(() => {
    if (!restaurantName) return [];
    const normTarget = restaurantName.trim().toLowerCase();
    const list = [];

    // 1. Extract Cylinder Deliveries & Returns from all batches
    batches.forEach(b => {
      if (b.entries) {
        b.entries.forEach(e => {
          if ((e.name || "").trim().toLowerCase() === normTarget) {
            const rawDate = e.date || b.khaliDate || today;
            const normDate = formatIsoDate(rawDate);
            const normT = normType(e.type);
            list.push({
              id: e.id || `cyl_${normDate}_${b.batch}_${Math.random()}`,
              kind: 'cylinder',
              date: normDate,
              batchNum: b.batch,
              restaurantName: e.name,
              qty: e.qty,
              type: normT,
              isReturn: !!e.isReturn,
              userName: e.user_name || 'Suraj',
              originalEntry: e
            });
          }
        });
      }
    });

    // 2. Extract Payment Collections for this restaurant
    payments.forEach(p => {
      const pName = (p.restaurant_name || p.restaurantName || "").trim().toLowerCase();
      if (pName === normTarget) {
        const rawDate = p.date || (p.created_at ? p.created_at.slice(0, 10) : today);
        const pDate = formatIsoDate(rawDate);
        list.push({
          id: p.id || `pay_${pDate}_${p.amount}_${Math.random()}`,
          kind: 'payment',
          date: pDate,
          batchNum: p.batch_num || p.batchNum || 128,
          restaurantName: p.restaurant_name || p.restaurantName,
          amount: parseFloat(p.amount) || 0,
          paymentMode: p.payment_mode || p.paymentMode || 'Cash',
          userName: p.user_name || 'Suraj',
          note: p.note || '',
          rawPaymentObj: p
        });
      }
    });

    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [restaurantName, batches, payments, today]);

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

          {/* Total Payments Card */}
          <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">💰 Payment Received</div>
            <div className="text-lg font-black text-emerald-700 mt-0.5">₹{stats.totalPaid.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-800 font-bold mt-0.5">
              Cash: ₹{stats.paidCash.toLocaleString()} | UPI: ₹{stats.paidUPI.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Date-Wise Complete Passbook Table */}
        <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              📜 Passbook History Log ({filteredActivities.length} entries)
            </h3>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 font-semibold bg-slate-50 rounded-2xl border border-dashed my-auto">
              No activity entries recorded for {restaurantName} in this period.
            </div>
          ) : (
            <div className="overflow-y-auto border border-slate-200 rounded-2xl max-h-[380px] bg-white">
              
              {/* MOBILE CARDS VIEW (Clean & Spacious on Mobile Screens) */}
              <div className="block md:hidden divide-y divide-slate-100">
                {filteredActivities.map((item, idx) => (
                  <div key={item.id || idx} className="p-3.5 space-y-2 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">{item.date}</span>
                        <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          #{item.batchNum}
                        </span>
                      </div>
                      
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        item.kind === 'cylinder'
                          ? (item.isReturn ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-sky-100 text-sky-800 border border-sky-200')
                          : (item.paymentMode === 'UPI' ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-amber-100 text-amber-800 border border-amber-200')
                      }`}>
                        {item.kind === 'cylinder'
                          ? (item.isReturn ? '♻️ Khali Return' : '🚚 Delivery')
                          : `💳 Payment (${item.paymentMode})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <div>
                        {item.kind === 'cylinder' ? (
                          <div className="text-sm font-black text-slate-900">
                            {item.qty}x {item.type} {item.isReturn ? 'Khali' : 'Cylinder'}
                          </div>
                        ) : (
                          <div className="text-sm font-black text-emerald-600">
                            ₹{item.amount.toLocaleString()} <span className="text-xs text-slate-500 font-semibold">Received</span>
                          </div>
                        )}
                        {item.note && <div className="text-[11px] text-slate-500 italic mt-0.5">{item.note}</div>}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          👤 {item.userName || "Suraj"}
                        </span>

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
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW (Clean 6-Column Layout for Desktop Screens) */}
              <table className="hidden md:table w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 border-b border-customBorder z-10">
                  <tr>
                    <th className="py-2.5 px-3.5 text-[10px] font-bold text-mutedSlate uppercase">Date</th>
                    <th className="py-2.5 px-3.5 text-[10px] font-bold text-mutedSlate uppercase">Batch #</th>
                    <th className="py-2.5 px-3.5 text-[10px] font-bold text-mutedSlate uppercase">Activity & Details</th>
                    <th className="py-2.5 px-3.5 text-[10px] font-bold text-mutedSlate uppercase">Category</th>
                    <th className="py-2.5 px-3.5 text-[10px] font-bold text-mutedSlate uppercase">Recorded By</th>
                    <th className="py-2.5 px-3.5 text-[10px] font-bold text-mutedSlate uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3.5 text-xs font-bold text-slate-700">{item.date}</td>
                      <td className="py-2.5 px-3.5 text-xs font-black text-amber-600">#{item.batchNum}</td>
                      <td className="py-2.5 px-3.5 text-xs font-extrabold">
                        {item.kind === 'cylinder' ? (
                          <span className="text-slate-800">{item.qty}x {item.type} {item.isReturn ? 'Khali Return' : 'Cylinder Delivery'}</span>
                        ) : (
                          <span className="text-emerald-700 font-black">₹{item.amount.toLocaleString()} Received ({item.paymentMode}){item.note ? ` - ${item.note}` : ''}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-xs">
                        {item.kind === 'cylinder' ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.isReturn ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-sky-100 text-sky-800 border border-sky-200'
                          }`}>
                            {item.isReturn ? '♻️ Khali Return' : '🚚 Delivery'}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.paymentMode === 'UPI' ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            💳 Payment ({item.paymentMode})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200">
                          👤 {item.userName || "Suraj"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-xs text-right">
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

        {/* Modal Footer */}
        <div className="pt-3 border-t border-customBorder flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            Statement for {restaurantName}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 active:scale-95 transition-all shadow-md"
          >
            Close Passbook
          </button>
        </div>

      </div>
    </div>
  );
}
