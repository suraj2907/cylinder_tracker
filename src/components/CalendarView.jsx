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
    <>
      <div className="bg-cardBg border border-customBorder rounded-xl mb-6 overflow-hidden shadow-lg shadow-black/20">
        <div className="bg-cardBg2 px-4 py-3.5 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
          <span className="font-bold text-xs uppercase tracking-wider text-accentCyan">📅 Delivery Calendar</span>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">🔵 21kg</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">🟢 19.2kg</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-mutedSlate/15 text-mutedSlate border border-mutedSlate/30">⚪ Khali</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-3 border-b border-customBorder/20">
            <button 
              className="px-3 py-1.5 rounded-lg border border-mutedSlate/40 bg-mutedSlate/10 hover:bg-mutedSlate/20 text-mutedSlate text-[11px] font-bold transition-all duration-200 active:scale-95"
              onClick={() => setCal(new Date(yr, mo - 1, 1))}>← Prev</button>
            <span className="font-bold text-sm text-textSlate">{MFULL[mo]} {yr}</span>
            <button 
              className="px-3 py-1.5 rounded-lg border border-mutedSlate/40 bg-mutedSlate/10 hover:bg-mutedSlate/20 text-mutedSlate text-[11px] font-bold transition-all duration-200 active:scale-95"
              onClick={() => setCal(new Date(yr, mo + 1, 1))}>Next →</button>
          </div>

          <div className="flex gap-1.5 px-4 py-2 border-b border-customBorder/20 flex-wrap items-center overflow-x-auto">
            {MONTHS.map((m, i) => {
              const key = `${yr}-${String(i + 1).padStart(2, "0")}`;
              const active = activeMonths.has(key);
              return (
                <button key={m} 
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 active:scale-95 border ${
                    active 
                      ? 'border-accentCyan/40 bg-accentCyan/10 text-accentCyan opacity-100 hover:bg-accentCyan/20' 
                      : 'border-customBorder bg-transparent text-mutedSlate opacity-40 hover:opacity-75'
                  }`}
                  onClick={() => setCal(new Date(yr, i, 1))}>{m}</button>
              );
            })}
            <select 
              className="bg-cardBg2 border border-customBorder rounded-lg px-2 py-1 text-textSlate focus:outline-none focus:border-accentCyan text-xs w-20 transition-colors"
              value={yr}
              onChange={e => setCal(new Date(parseInt(e.target.value), mo, 1))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-7 gap-1 px-3 py-2 text-center border-b border-customBorder/10 bg-[#0d1520]/20">
            {DAYS.map(d => <div key={d} className="text-[10px] text-mutedSlate font-bold uppercase tracking-wider">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1.5 p-3">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMo }).map((_, i) => {
              const d = i + 1, key = fmt(d), data = dateMap[key];
              const isTod = key === today, isSel = key === selectedDate;
              const total21 = (data?.["21kg"] || 0), total192 = (data?.["19.2kg"] || 0), totalEmpty = (data?.["Empty"] || 0);
              
              let borderClass = 'border-customBorder/20 bg-transparent';
              if (isSel) {
                borderClass = 'border-accentOrange bg-accentOrange/10';
              } else if (data) {
                borderClass = 'border-accentCyan/30 bg-accentCyan/[0.03] hover:bg-accentCyan/[0.08] cursor-pointer';
              }

              let outlineClass = isTod ? 'outline outline-2 outline-accentYellow' : '';

              return (
                <div key={d} onClick={() => data && setSelectedDate(isSel ? null : key)}
                  className={`rounded-lg border p-1 flex flex-col justify-between min-h-[56px] transition-all duration-200 ${borderClass} ${outlineClass}`}>
                  <div className={`text-[11px] font-bold text-center ${
                    isTod ? 'text-accentYellow' : data ? 'text-textSlate' : 'text-mutedSlate/40'
                  }`}>{d}</div>
                  {data && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {total21 > 0 && <div className="text-[9px] font-bold text-accentCyan text-center leading-tight truncate">🔵{total21}</div>}
                      {total192 > 0 && <div className="text-[9px] font-bold text-accentBlueGreen text-center leading-tight truncate">🟢{total192}</div>}
                      {totalEmpty > 0 && <div className="text-[9px] font-bold text-mutedSlate text-center leading-tight truncate">⚪{totalEmpty}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDate && dateMap[selectedDate] && (
        <div className="bg-cardBg border border-customBorder rounded-xl mb-6 overflow-hidden shadow-lg shadow-black/20 animate-fadeIn">
          <div className="bg-cardBg2 px-4 py-3.5 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-accentCyan">📋 Details for {selectedDate}</span>
            <div className="flex gap-2 flex-wrap">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">21kg: {dateMap[selectedDate]["21kg"]}</span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">19.2kg: {dateMap[selectedDate]["19.2kg"]}</span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-mutedSlate/15 text-mutedSlate border border-mutedSlate/30">Khali: {dateMap[selectedDate]["Empty"] || 0}</span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accentYellow/10 text-accentYellow border border-accentYellow/30">Total: {(dateMap[selectedDate]["21kg"] || 0) + (dateMap[selectedDate]["19.2kg"] || 0)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-customBorder bg-[#0d1520]">
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Restaurant</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Qty</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Type</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Batch</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-customBorder/20">
                {dateMap[selectedDate].details.map((d, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold text-textSlate">{d.name}</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-textSlate">{d.qty}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        d.isReturn
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : d.type === '21kg' 
                            ? 'bg-accentCyan/10 text-accentCyan border-accentCyan/30' 
                            : 'bg-accentBlueGreen/10 text-accentBlueGreen border-accentBlueGreen/30'
                      }`}>
                        {d.isReturn ? `♻️ Khali (${d.type})` : `🚚 Dena (${d.type})`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-mutedSlate font-bold">#{d.batch}</td>
                    <td className="px-4 py-3 text-xs">
                      <button 
                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/30 hover:border-red-500/50 text-red-400 font-bold rounded-lg flex items-center gap-1 transition-all duration-200 text-[10px]"
                        onClick={() => handleDeleteEntry(d.batch, d.originalEntry)}
                        title="Delete this entry">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

