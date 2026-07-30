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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-5 animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl border border-customBorder shadow-glass max-w-4xl w-full p-5 sm:p-6 space-y-5 my-6 max-h-[92vh] flex flex-col justify-between">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-customBorder pb-4 flex-wrap gap-3">
          <div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
              🏪 Hotel Passbook Statement
            </span>
            <h2 className="text-xl font-black text-textSlate mt-1 flex items-center gap-2">
              <span>{restaurantName}</span>
            </h2>
          </div>

          {/* Period Filter Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
              <button
                onClick={() => setRangeMode(false)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  !rangeMode ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Month View
              </button>
              <button
                onClick={() => setRangeMode(true)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  rangeMode ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Date Range
              </button>
            </div>

            {!rangeMode ? (
              <select
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="bg-white border border-customBorder rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:border-accentCyan"
              >
                <option value="all">All Time (All History)</option>
                {availableMonths.map(mStr => {
                  const [y, m] = mStr.split('-');
                  const mName = MFULL[parseInt(m) - 1] || mStr;
                  return (
                    <option key={mStr} value={mStr}>{mName} {y}</option>
                  );
                })}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border text-xs font-bold"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border text-xs font-bold"
                />
              </div>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 font-extrabold text-xl px-2 py-1 rounded-xl hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Summary KPIs Strip for this Hotel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Delivered Card */}
          <div className="bg-sky-50/60 p-3.5 rounded-xl border border-sky-200">
            <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">📦 Total Delivered</div>
            <div className="text-xl font-black text-sky-900 mt-1">{stats.totalDel} units</div>
            <div className="text-[10px] text-sky-700 font-bold mt-0.5">
              19.2kg: {stats.del192} | 21kg: {stats.del21}
            </div>
          </div>

          {/* Khali Returned Card */}
          <div className="bg-teal-50/60 p-3.5 rounded-xl border border-teal-200">
            <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">♻️ Khali Returned</div>
            <div className="text-xl font-black text-teal-900 mt-1">{stats.totalRet} units</div>
            <div className="text-[10px] text-teal-700 font-bold mt-0.5">
              19.2kg: {stats.ret192} | 21kg: {stats.ret21}
            </div>
          </div>

          {/* Outstanding Empty Card */}
          <div className={`p-3.5 rounded-xl border ${
            stats.totalOut > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-emerald-50/70 border-emerald-200'
          }`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">⚠️ Outstanding Khali</div>
            <div className={`text-xl font-black mt-1 ${stats.totalOut > 0 ? 'text-amber-900' : 'text-emerald-800'}`}>
              {stats.totalOut} cylinders
            </div>
            <div className="text-[10px] font-bold mt-0.5 text-slate-600">
              19.2kg: {stats.out192} | 21kg: {stats.out21}
            </div>
          </div>

          {/* Total Payments Card */}
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">💰 Total Payment Received</div>
            <div className="text-xl font-black text-emerald-700 mt-1">₹{stats.totalPaid.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-800 font-bold mt-0.5">
              Cash: ₹{stats.paidCash.toLocaleString()} | UPI: ₹{stats.paidUPI.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Date-Wise Complete Passbook Table */}
        <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              📜 Date-Wise Complete Passbook Entries ({filteredActivities.length} entries)
            </h3>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 font-semibold bg-slate-50 rounded-xl border border-dashed my-auto">
              No activity entries recorded for {restaurantName} in this period.
            </div>
          ) : (
            <div className="overflow-y-auto border border-customBorder rounded-xl max-h-[420px] bg-white">
              <table className="w-full text-left border-collapse">
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
            Statement generated for {restaurantName}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 active:scale-95 transition-all"
          >
            Close Passbook
          </button>
        </div>

      </div>
    </div>
  );
}
