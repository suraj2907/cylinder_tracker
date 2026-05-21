import React from 'react';

export default function RestaurantsList({ restaurants, tot21, tot192, totEmpty, totEmpty21, totEmpty192, totAll, totOutstanding, search, setSearch, sortBy, setSortBy }) {
  return (
    <div className="bg-cardBg border border-customBorder rounded-xl mb-6 overflow-hidden shadow-lg shadow-black/20">
      <div className="bg-cardBg2 px-4 py-3.5 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-accentCyan">🏪 All Restaurants</span>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-mutedSlate/20 text-mutedSlate border border-mutedSlate/40">
            {restaurants.length}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <input 
            className="bg-cardBg border border-customBorder rounded-lg px-3 py-2 text-textSlate placeholder-mutedSlate focus:outline-none focus:border-accentCyan text-xs w-full sm:w-40 transition-colors"
            placeholder="Search restaurant..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <select 
            className="bg-cardBg border border-customBorder rounded-lg px-3 py-2 text-textSlate focus:outline-none focus:border-accentCyan text-xs w-full sm:w-44 transition-colors"
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="total">Sort: Total Delivered</option>
            <option value="21kg">Sort: 21 KG Del</option>
            <option value="19.2kg">Sort: 19.2 KG Del</option>
            <option value="empty21">Sort: 21 KG Khali</option>
            <option value="empty192">Sort: 19.2 KG Khali</option>
            <option value="empty">Sort: Total Khali</option>
            <option value="outstanding">Sort: Outstanding</option>
            <option value="az">Sort: A - Z</option>
            <option value="za">Sort: Z - A</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-customBorder bg-[#0d1520]">
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">#</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Restaurant</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21 KG Del</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2 KG Del</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21 KG Khali</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2 KG Khali</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">⚪ Total Khali</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Outstanding</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Grand Total Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-customBorder/20">
            {restaurants.map((r, i) => (
              <tr key={r.name} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-xs font-bold text-mutedSlate">{i + 1}</td>
                <td className="px-4 py-3 text-xs font-semibold text-textSlate">{r.name}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">{r.kg21}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">{r.kg192}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">{r.empty21}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">{r.empty192}</span>
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
          <tfoot>
            <tr className="border-t border-customBorder bg-[#0d1520]">
              <td colSpan={2} className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-accentOrange">GRAND TOTAL</td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">{tot21}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">{tot192}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/30">{totEmpty21}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accentBlueGreen/10 text-accentBlueGreen border border-accentBlueGreen/30">{totEmpty192}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-mutedSlate/15 text-mutedSlate border border-mutedSlate/30">{totEmpty}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${totOutstanding > 0 ? 'bg-accentYellow/10 text-accentYellow border-accentYellow/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                  {totOutstanding}
                </span>
              </td>
              <td className="px-4 py-3.5 text-sm font-black text-accentOrange">{totAll}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

