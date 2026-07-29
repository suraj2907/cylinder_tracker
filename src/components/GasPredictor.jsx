import React, { useState, useMemo } from 'react';
import { Search, Flame, AlertCircle } from 'lucide-react';
import { norm } from '../utils/dataUtils';

export default function GasPredictor({ restaurants, batches }) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  
  const profiles = useMemo(() => {
    const today = new Date();
    const result = [];

    const deliveriesMap = {};
    batches.forEach(b => {
      b.entries.forEach(e => {
        if (!e.isReturn && e.date) {
          const name = norm(e.name);
          if (!deliveriesMap[name]) {
            deliveriesMap[name] = [];
          }
          deliveriesMap[name].push({
            date: new Date(e.date),
            qty: e.qty,
            dateStr: e.date
          });
        }
      });
    });

    restaurants.forEach(r => {
      const deliveries = deliveriesMap[r.name] || [];
      if (deliveries.length === 0) return;

      deliveries.sort((a, b) => a.date - b.date);

      const totalDelQty = deliveries.reduce((sum, d) => sum + d.qty, 0);
      const dFirst = deliveries[0].date;
      const dLast = deliveries[deliveries.length - 1].date;
      
      let daysSpan = Math.max(30, Math.floor((dLast - dFirst) / (1000 * 60 * 60 * 24)));
      let rate = totalDelQty / daysSpan;
      if (rate === 0) rate = 0.05;

      const latest = deliveries[deliveries.length - 1];
      const daysSinceLast = Math.max(0, Math.floor((today - latest.date) / (1000 * 60 * 60 * 24)));
      
      const expectedLifespan = latest.qty / rate;
      const remainingDays = expectedLifespan - daysSinceLast;

      let severity = "green";
      let statusText = "Stocked";
      if (remainingDays <= 0) {
        severity = "red";
        statusText = "Depleted / Critical";
      } else if (remainingDays <= 2.5) {
        severity = "yellow";
        statusText = "Running Low";
      }

      result.push({
        name: r.name,
        totalDelivered: totalDelQty,
        rate: rate * 7,
        lastDelDate: latest.dateStr,
        lastDelQty: latest.qty,
        daysSinceLast,
        remainingDays: Math.round(remainingDays * 10) / 10,
        severity,
        statusText
      });
    });

    return result
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortOrder === "asc") {
          return a.remainingDays - b.remainingDays;
        } else {
          return b.remainingDays - a.remainingDays;
        }
      });
  }, [restaurants, batches, search, sortOrder]);

  const stats = useMemo(() => {
    let depleted = 0;
    let low = 0;
    let stocked = 0;
    profiles.forEach(p => {
      if (p.severity === "red") depleted++;
      else if (p.severity === "yellow") low++;
      else stocked++;
    });
    return { depleted, low, stocked };
  }, [profiles]);

  return (
    <div className="space-y-6 fade">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-red-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-soft">
          <div className="p-3 rounded-xl bg-red-50 text-red-600">
            <Flame size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-red-600">{stats.depleted}</div>
            <div className="text-xs font-bold text-mutedSlate uppercase tracking-wider mt-0.5">Critical / Gas Empty</div>
          </div>
        </div>
        
        <div className="bg-white border border-amber-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-soft">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600">{stats.low}</div>
            <div className="text-xs font-bold text-mutedSlate uppercase tracking-wider mt-0.5">Running Low (&lt;2.5 Days)</div>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-soft">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <Flame size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{stats.stocked}</div>
            <div className="text-xs font-bold text-mutedSlate uppercase tracking-wider mt-0.5">Stocked &amp; Safe</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
          <span className="font-extrabold text-xs uppercase tracking-wider text-sky-700">🔮 Gas Depletion Predictor</span>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative w-full sm:w-48">
              <input 
                className="bg-white border border-customBorder rounded-xl pl-9 pr-3 py-2 text-textSlate placeholder-slate-400 focus:outline-none focus:border-accentCyan text-xs w-full shadow-sm transition-all"
                placeholder="Search restaurant..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            </div>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="bg-white border border-customBorder rounded-xl px-3.5 py-2 text-textSlate focus:outline-none focus:border-accentCyan text-xs w-full sm:w-52 shadow-sm transition-all font-semibold"
            >
              <option value="asc">Sort: Days Left (Low to High)</option>
              <option value="desc">Sort: Days Left (High to Low)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-slate-50">
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Restaurant</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Usage Rate</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Last Delivery</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Days Since Del</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Days Remaining</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-mutedSlate font-semibold">
                    No active delivery profiles found!
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-textSlate">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-bold">
                      {p.rate.toFixed(1)} cylinders / week
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-bold">
                      {p.lastDelQty} cylinders ({p.lastDelDate})
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-semibold">
                      {p.daysSinceLast} days ago
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.remainingDays <= 0 ? (
                        <span className="text-red-600 font-extrabold text-xs">
                          🔥 Gas Depleted! ({Math.abs(p.remainingDays)} days ago)
                        </span>
                      ) : (
                        <span className={`font-extrabold text-xs ${p.severity === 'yellow' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          ⏳ {p.remainingDays} days left
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        p.severity === 'red' 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : p.severity === 'yellow'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {p.statusText}
                      </span>
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
