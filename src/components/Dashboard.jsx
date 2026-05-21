import React from 'react';
import { Download } from 'lucide-react';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';

export default function Dashboard({ restaurants, batchStats, restMap, totAll, tot21, tot192, totEmpty, totOutstanding }) {
  return (
    <>
      {/* Export Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 mb-5">
        <button 
          onClick={() => exportToPDF(restaurants, tot21, tot192, totAll)}
          className="px-4 py-2 bg-accentOrange hover:bg-opacity-90 active:scale-95 text-white font-bold rounded-lg flex items-center gap-2 transition-all duration-200 text-sm shadow-md shadow-accentOrange/10">
          <Download size={16} /> PDF Report
        </button>
        <button 
          onClick={() => exportToExcel(restaurants, batchStats)}
          className="px-4 py-2 bg-accentBlueGreen hover:bg-opacity-90 active:scale-95 text-white font-bold rounded-lg flex items-center gap-2 transition-all duration-200 text-sm shadow-md shadow-accentBlueGreen/10">
          <Download size={16} /> Excel Report
        </button>
      </div>

      {/* Top Restaurants Card */}
      <div className="bg-cardBg border border-customBorder rounded-xl mb-6 overflow-hidden shadow-lg shadow-black/20">
        <div className="bg-cardBg2 px-4 py-3.5 border-b border-customBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase tracking-wider text-accentCyan">🏆 Top 20 Restaurants</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-mutedSlate/20 text-mutedSlate border border-mutedSlate/40">
              {Object.keys(restMap).length} total
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-[#0d1520]">
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">#</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Restaurant</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21 KG</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2 KG</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">⚪ Khali</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Outstanding</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Total Delivered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-customBorder/20">
              {restaurants.slice(0, 20).map((r, i) => (
                <tr key={r.name} className="hover:bg-white/[0.02] transition-colors">
                  <td className={`px-4 py-3 text-xs font-bold ${i < 3 ? 'text-accentOrange' : 'text-mutedSlate'}`}>{i + 1}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-textSlate">{r.name}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">{r.kg21}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">{r.kg192}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-mutedSlate/15 text-mutedSlate border border-mutedSlate/30">{r.empty}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${r.outstanding > 0 ? 'bg-accentYellow/10 text-accentYellow border-accentYellow/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                      {r.outstanding}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-extrabold ${r.total > 50 ? 'text-accentOrange' : 'text-textSlate'}`}>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Batches Card */}
      <div className="bg-cardBg border border-customBorder rounded-xl mb-4 overflow-hidden shadow-lg shadow-black/20">
        <div className="bg-cardBg2 px-4 py-3.5 border-b border-customBorder">
          <span className="font-bold text-xs uppercase tracking-wider text-accentCyan">📦 Recent 10 Batches</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-[#0d1520]">
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Batch</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Khali Date</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Entries</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21KG</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2KG</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">⚪ Khali</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Outstanding</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-customBorder/20">
              {batchStats.slice(0, 10).map((b, i) => {
                const delivered = b.kg21 + b.kg192;
                const outstanding = delivered - b.empty;
                return (
                  <tr key={`${b.batch}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-accentOrange">#{b.batch}</td>
                    <td className="px-4 py-3 text-xs text-mutedSlate">{b.khaliDate || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-mutedSlate/15 text-mutedSlate border border-mutedSlate/30">{b.count}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">{b.kg21}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">{b.kg192}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-mutedSlate/15 text-mutedSlate border border-mutedSlate/30">{b.empty}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${outstanding > 0 ? 'bg-accentYellow/10 text-accentYellow border-accentYellow/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                        {outstanding}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-textSlate">{delivered}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
