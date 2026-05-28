import React, { useState, useMemo } from 'react';
import { Clock, Send, Search, AlertTriangle } from 'lucide-react';
import { norm } from '../utils/dataUtils';

export default function AgingTracker({ restaurants, batches }) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  
  // Find the latest delivery date for each restaurant
  const latestDeliveryDates = useMemo(() => {
    const dates = {};
    batches.forEach(b => {
      b.entries.forEach(e => {
        if (!e.isReturn) {
          const name = norm(e.name);
          if (e.date) {
            if (!dates[name] || e.date > dates[name]) {
              dates[name] = e.date;
            }
          }
        }
      });
    });
    return dates;
  }, [batches]);

  const agingData = useMemo(() => {
    const today = new Date("2026-05-28"); // Using the latest baseline date for realistic demo data

    return restaurants
      .map(r => {
        const lastDelDateStr = latestDeliveryDates[r.name] || "";
        let daysIdle = 0;
        if (lastDelDateStr) {
          const lastDel = new Date(lastDelDateStr);
          daysIdle = Math.max(0, Math.floor((today - lastDel) / (1000 * 60 * 60 * 24)));
        }

        // Aging severity
        let severity = "green";
        let label = "Active Rotation";
        if (r.outstanding > 0) {
          if (daysIdle > 15) {
            severity = "red";
            label = "Severely Idle";
          } else if (daysIdle > 7) {
            severity = "yellow";
            label = "Slow Rotation";
          }
        }

        return {
          ...r,
          lastDelDate: lastDelDateStr,
          daysIdle,
          severity,
          label
        };
      })
      .filter(r => r.outstanding > 0) // Only track those with outstanding cylinders
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortOrder === "desc") {
          return b.daysIdle - a.daysIdle;
        } else {
          return a.daysIdle - b.daysIdle;
        }
      });
  }, [restaurants, latestDeliveryDates, search, sortOrder]);

  const stats = useMemo(() => {
    let severe = 0;
    let slow = 0;
    let active = 0;
    agingData.forEach(r => {
      if (r.severity === "red") severe++;
      else if (r.severity === "yellow") slow++;
      else active++;
    });
    return { severe, slow, active };
  }, [agingData]);

  // Send WhatsApp reminder helper
  function handleWhatsApp(r) {
    const msg = `Pranam ${r.name}, Shree Balaji Agencies se namaste. Aapke paas humare ${r.outstanding} khali cylinders outstanding hain. Kripya unhe return schedule karein taaki hum cycle manage kar sakein. Dhanyawad!`;
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  }

  return (
    <div className="animate-fadeIn">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-cardBg border border-red-500/20 rounded-xl p-4 flex items-center gap-3.5 shadow-lg shadow-black/10">
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-red-400">{stats.severe}</div>
            <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider mt-0.5">Severely Idle (&gt;15 Days)</div>
          </div>
        </div>
        
        <div className="bg-cardBg border border-accentYellow/20 rounded-xl p-4 flex items-center gap-3.5 shadow-lg shadow-black/10">
          <div className="p-3 rounded-lg bg-accentYellow/10 text-accentYellow">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-accentYellow">{stats.slow}</div>
            <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider mt-0.5">Slow Rotation (8-15 Days)</div>
          </div>
        </div>

        <div className="bg-cardBg border border-green-500/20 rounded-xl p-4 flex items-center gap-3.5 shadow-lg shadow-black/10">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-green-400">{stats.active}</div>
            <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider mt-0.5">Active Rotation (0-7 Days)</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-cardBg border border-customBorder rounded-xl overflow-hidden shadow-lg shadow-black/20">
        <div className="bg-cardBg2 px-4 py-3.5 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
          <span className="font-bold text-xs uppercase tracking-wider text-accentCyan">🚨 Empty Cylinder Aging Tracker</span>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative w-full sm:w-44">
              <input 
                className="bg-cardBg border border-customBorder rounded-lg pl-9 pr-3 py-2 text-textSlate placeholder-mutedSlate focus:outline-none focus:border-accentCyan text-xs w-full transition-colors"
                placeholder="Search restaurant..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              <Search className="absolute left-3 top-2.5 text-mutedSlate" size={14} />
            </div>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="bg-cardBg border border-customBorder rounded-lg px-3 py-2 text-textSlate focus:outline-none focus:border-accentCyan text-xs w-full sm:w-48 transition-colors font-semibold"
            >
              <option value="desc">Sort: Idle Days (High to Low)</option>
              <option value="asc">Sort: Idle Days (Low to High)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-[#0d1520]">
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Restaurant</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Outstanding</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Last Delivery</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Days Idle</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Aging Status</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-customBorder/20">
              {agingData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-mutedSlate font-semibold">
                    No outstanding cylinders found! All clear! 🎉
                  </td>
                </tr>
              ) : (
                agingData.map((r) => (
                  <tr key={r.name} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold text-textSlate">{r.name}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-accentYellow/10 text-accentYellow border border-accentYellow/30">
                        {r.outstanding} cylinders
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-mutedSlate font-bold">{r.lastDelDate || "—"}</td>
                    <td className="px-4 py-3 text-xs text-textSlate font-extrabold">{r.daysIdle} days</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        r.severity === 'red' 
                          ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                          : r.severity === 'yellow'
                            ? 'bg-accentYellow/10 text-accentYellow border-accentYellow/30'
                            : 'bg-green-500/10 text-green-400 border-green-500/30'
                      }`}>
                        {r.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <button 
                        onClick={() => handleWhatsApp(r)}
                        className="px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 active:scale-95 border border-green-500/30 hover:border-green-500/50 text-green-400 font-bold rounded-lg flex items-center gap-1.5 transition-all duration-200 text-[10px]"
                        title="WhatsApp reminder bhejein">
                        <Send size={10} /> Send Reminder
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
