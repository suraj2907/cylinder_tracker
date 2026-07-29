import React, { useState, useMemo } from 'react';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MFULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarView({ dateMap, selectedDate, setSelectedDate, handleDeleteEntry }) {
  const today = new Date().toISOString().slice(0, 10);
  const [cal, setCal] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const yr = cal.getFullYear(), mo = cal.getMonth();
  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMo = new Date(yr, mo + 1, 0).getDate();
  const fmt = (d) => `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const activeMonths = useMemo(() => {
    const s = new Set();
    Object.keys(dateMap).forEach(d => { if (d) s.add(d.slice(0, 7)); });
    return s;
  }, [dateMap]);

  return (
    <div className="space-y-6 fade">
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
          <span className="font-extrabold text-xs uppercase tracking-wider text-sky-700">📅 Daily Delivery Calendar</span>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">🔵 21kg</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">🟢 19.2kg</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">⚪ Khali</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3 border-b border-customBorder bg-slate-50/50">
            <button 
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
              onClick={() => setCal(new Date(yr, mo - 1, 1))}>← Prev</button>
            <span className="font-black text-sm text-textSlate">{MFULL[mo]} {yr}</span>
            <button 
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
              onClick={() => setCal(new Date(yr, mo + 1, 1))}>Next →</button>
          </div>

          <div className="flex gap-1.5 px-4 py-3 border-b border-customBorder flex-wrap items-center overflow-x-auto bg-white">
            {MONTHS.map((m, i) => {
              const key = `${yr}-${String(i + 1).padStart(2, "0")}`;
              const active = activeMonths.has(key);
              return (
                <button key={m} 
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    active 
                      ? 'border-sky-300 bg-sky-50 text-sky-800 font-extrabold shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-400 opacity-60 hover:opacity-100'
                  }`}
                  onClick={() => setCal(new Date(yr, i, 1))}>{m}</button>
              );
            })}
            <select 
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-bold text-xs shadow-sm"
              value={yr}
              onChange={e => setCal(new Date(parseInt(e.target.value), mo, 1))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-7 gap-1 px-3 py-2.5 text-center border-b border-customBorder bg-slate-50">
            {DAYS.map(d => <div key={d} className="text-[10px] text-mutedSlate font-extrabold uppercase tracking-wider">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-2 p-4">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMo }).map((_, i) => {
              const d = i + 1, key = fmt(d), data = dateMap[key];
              const isTod = key === today, isSel = key === selectedDate;
              const total21 = (data?.["21kg"] || 0), total192 = (data?.["19.2kg"] || 0), totalEmpty = (data?.["Empty"] || 0);
              
              let borderClass = 'border-slate-200 bg-white';
              if (isSel) {
                borderClass = 'border-sky-500 bg-sky-50 shadow-md ring-2 ring-sky-300';
              } else if (data) {
                borderClass = 'border-sky-200 bg-sky-50/40 hover:bg-sky-50 cursor-pointer shadow-sm';
              }

              let outlineClass = isTod ? 'ring-2 ring-amber-400' : '';

              return (
                <div key={d} onClick={() => data && setSelectedDate(isSel ? null : key)}
                  className={`rounded-xl border p-2 flex flex-col justify-between min-h-[64px] transition-all ${borderClass} ${outlineClass}`}>
                  <div className={`text-xs font-black text-center ${
                    isTod ? 'text-amber-700 font-black' : data ? 'text-slate-900' : 'text-slate-400'
                  }`}>{d}</div>
                  {data && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {total21 > 0 && <div className="text-[10px] font-extrabold text-sky-800 text-center leading-tight truncate">🔵 {total21}</div>}
                      {total192 > 0 && <div className="text-[10px] font-extrabold text-teal-800 text-center leading-tight truncate">🟢 {total192}</div>}
                      {totalEmpty > 0 && <div className="text-[10px] font-bold text-slate-500 text-center leading-tight truncate">⚪ {totalEmpty}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Date Drawer Details */}
      {selectedDate && dateMap[selectedDate] && (
        <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft space-y-4 fade">
          <div className="flex items-center justify-between border-b border-customBorder pb-3">
            <h3 className="text-sm font-extrabold text-textSlate flex items-center gap-2">
              <span>📅 Entries on {selectedDate}</span>
              <span className="text-xs font-bold text-mutedSlate">({dateMap[selectedDate].details.length} total entries)</span>
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              ✕ Close
            </button>
          </div>

          <div className="overflow-x-auto border border-customBorder rounded-xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-customBorder">
                  <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Restaurant</th>
                  <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Qty & Type</th>
                  <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Category</th>
                  <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Batch #</th>
                  <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dateMap[selectedDate].details.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-bold text-textSlate">{item.name}</td>
                    <td className="py-2.5 px-3 text-xs font-black text-sky-800">{item.qty}x {item.type}</td>
                    <td className="py-2.5 px-3 text-xs font-bold">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] ${
                        item.isReturn ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-sky-100 text-sky-800 border border-sky-200'
                      }`}>
                        {item.isReturn ? '♻️ Khali Return' : '🚚 Delivery'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-500">#{item.batch}</td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <button
                        onClick={() => handleDeleteEntry(item.batch, item.originalEntry)}
                        className="text-red-500 hover:text-red-700 font-bold text-xs p-1 rounded hover:bg-red-50"
                        title="Delete entry"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
