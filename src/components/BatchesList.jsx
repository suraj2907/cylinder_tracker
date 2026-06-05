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
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Khali Date & Note</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-center">🔵 21KG Category Details</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-center">🟢 19.2KG Category Details</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-center">Total Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-customBorder/20">
            {filteredBatches.map((b, i) => {
              const delivered = b.kg21 + b.kg192;
              const outstanding = delivered - b.empty;
              const out21 = b.kg21 - b.empty21;
              const out192 = b.kg192 - b.empty192;
              return (
                <tr key={`${b.batch}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-4 text-xs font-black text-accentOrange">#{b.batch}</td>
                  <td className="px-4 py-4 text-xs">
                    <div className="font-bold text-textSlate">{b.khaliDate || "—"}</div>
                    {b.note && (
                      <div className="text-[10px] text-accentYellow/80 font-bold italic mt-1 flex items-center gap-1">
                        <span>📝</span>
                        <span className="truncate max-w-[200px]" title={b.note}>{b.note}</span>
                      </div>
                    )}
                  </td>
                  
                  {/* 21KG Details */}
                  <td className="px-4 py-4 text-xs text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accentCyan/5 text-accentCyan border border-accentCyan/20 font-extrabold" title="Delivered">
                        <span className="text-[9px] text-mutedSlate font-bold uppercase mr-0.5">Del:</span> {b.kg21}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-mutedSlate/10 text-textSlate border border-mutedSlate/25 font-extrabold" title="Empty Returns (Khali)">
                        <span className="text-[9px] text-mutedSlate font-bold uppercase mr-0.5">Empty:</span> {b.empty21}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border font-extrabold ${
                        out21 > 0 
                          ? 'bg-accentYellow/10 text-accentYellow border-accentYellow/20 animate-pulse' 
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                      }`} title="Outstanding with customers">
                        <span className="text-[9px] text-mutedSlate font-bold uppercase mr-0.5">Out:</span> {out21}
                      </span>
                    </div>
                  </td>
                  
                  {/* 19.2KG Details */}
                  <td className="px-4 py-4 text-xs text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accentBlueGreen/5 text-accentBlueGreen border border-accentBlueGreen/20 font-extrabold" title="Delivered">
                        <span className="text-[9px] text-mutedSlate font-bold uppercase mr-0.5">Del:</span> {b.kg192}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-mutedSlate/10 text-textSlate border border-mutedSlate/25 font-extrabold" title="Empty Returns (Khali)">
                        <span className="text-[9px] text-mutedSlate font-bold uppercase mr-0.5">Empty:</span> {b.empty192}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border font-extrabold ${
                        out192 > 0 
                          ? 'bg-accentYellow/10 text-accentYellow border-accentYellow/20 animate-pulse' 
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                      }`} title="Outstanding with customers">
                        <span className="text-[9px] text-mutedSlate font-bold uppercase mr-0.5">Out:</span> {out192}
                      </span>
                    </div>
                  </td>

                  {/* Total Summary */}
                  <td className="px-4 py-4 text-xs text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-[10px] font-bold text-textSlate">
                        Del: <span className="font-black text-white">{delivered}</span> | Empty: <span className="font-black text-mutedSlate">{b.empty}</span>
                      </div>
                      <div className={`px-2.5 py-1 rounded text-[10px] font-black border ${
                        outstanding > 0 
                          ? 'bg-accentOrange/10 text-accentOrange border-accentOrange/20' 
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        Out: {outstanding}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


