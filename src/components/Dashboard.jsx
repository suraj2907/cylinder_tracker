import React from 'react';
import { Download } from 'lucide-react';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';

export default function Dashboard({ restaurants, batchStats, restMap, totAll, tot21, tot192, totEmpty, totOutstanding }) {
  return (
    <div className="space-y-6 fade">
      {/* Export Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-base font-extrabold text-textSlate">📊 Executive Operations Dashboard</h2>
          <p className="text-xs text-mutedSlate">Real-time LPG Cylinder Distribution & Outstanding Summary</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button 
            onClick={() => exportToPDF(restaurants, tot21, tot192, totAll)}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs shadow-soft">
            <Download size={14} /> PDF Report
          </button>
          <button 
            onClick={() => exportToExcel(restaurants, batchStats)}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs shadow-soft">
            <Download size={14} /> Excel Report
          </button>
        </div>
      </div>

      {/* Top Restaurants Card */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs uppercase tracking-wider text-sky-700">🏆 Top 20 Active Restaurants</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              {Object.keys(restMap).length} total
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-slate-50">
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">#</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Restaurant</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Outstanding</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21 KG</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2 KG</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">⚪ Khali</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Total Delivered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {restaurants.slice(0, 20).map((r, i) => (
                <tr key={r.name} className="hover:bg-slate-50 transition-colors">
                  <td className={`px-4 py-3 text-xs font-black ${i < 3 ? 'text-amber-600' : 'text-slate-400'}`}>{i + 1}</td>
                  <td className="px-4 py-3 text-xs font-bold text-textSlate">{r.name}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${r.outstanding > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                      {r.outstanding}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">{r.kg21}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">{r.kg192}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{r.empty}</span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-black ${r.total > 50 ? 'text-amber-600' : 'text-slate-900'}`}>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Batches Card */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        <div className="bg-slate-50 px-5 py-4 border-b border-customBorder">
          <span className="font-extrabold text-xs uppercase tracking-wider text-sky-700">📦 Recent 10 Batches</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-slate-50">
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
            <tbody className="divide-y divide-slate-100">
              {batchStats.slice(0, 10).map((b, i) => {
                const delivered = b.kg21 + b.kg192;
                const outstanding = delivered - b.empty;
                return (
                  <tr key={`${b.batch}-${i}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-black text-amber-600">#{b.batch}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-medium">{b.khaliDate || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{b.count}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">{b.kg21}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">{b.kg192}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{b.empty}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${outstanding > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                        {outstanding}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-slate-900">{delivered}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
