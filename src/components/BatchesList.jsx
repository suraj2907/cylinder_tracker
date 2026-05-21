import React from 'react';

export default function BatchesList({ filteredBatches, batchSearch, setBatchSearch }) {
  return (
    <div className="bg-cardBg border border-customBorder rounded-xl mb-6 overflow-hidden shadow-lg shadow-black/20">
      <div className="bg-cardBg2 px-4 py-3.5 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-accentCyan">📦 All Batches</span>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-mutedSlate/20 text-mutedSlate border border-mutedSlate/40">
            {filteredBatches.length}
          </span>
        </div>
        <input 
          className="bg-cardBg border border-customBorder rounded-lg px-3 py-2 text-textSlate placeholder-mutedSlate focus:outline-none focus:border-accentCyan text-xs w-full sm:w-48 transition-colors"
          placeholder="Search batch or date..." 
          value={batchSearch} 
          onChange={e => setBatchSearch(e.target.value)} 
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-customBorder bg-[#0d1520]">
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Batch #</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Khali Date</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Entries</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21KG</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2KG</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">⚪ Khali</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Outstanding</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Total Delivered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-customBorder/20">
            {filteredBatches.map((b, i) => {
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
  );
}

