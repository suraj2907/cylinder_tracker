import React, { useState } from 'react';

export default function BatchesList({ 
  filteredBatches = [], 
  batchSearch = "", 
  setBatchSearch,
  handleDeleteBatch
}) {
  const [expandedEntriesBatch, setExpandedEntriesBatch] = useState(null);

  return (
    <div className="space-y-6 fade">
      {/* Header & Search */}
      <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-extrabold text-textSlate flex items-center gap-2">
            <span>📦 Cylinder Batches & Operations</span>
          </h2>
          <p className="text-xs text-mutedSlate">
            Monitor cylinder supply, 21kg & 19.2kg deliveries, and empty returns per batch.
          </p>
        </div>

        <input 
          className="bg-slate-50 border border-customBorder rounded-xl px-4 py-2 text-textSlate placeholder-slate-400 focus:outline-none focus:border-accentCyan text-xs w-full sm:w-60 shadow-sm transition-all font-semibold"
          placeholder="Search batch # or date..." 
          value={batchSearch} 
          onChange={e => setBatchSearch(e.target.value)} 
        />
      </div>

      {/* Batches Delivery Cards */}
      <div className="space-y-4">
        {filteredBatches.map((b) => {
          const delivered = b.kg21 + b.kg192;
          const outstanding = delivered - b.empty;
          const out21 = b.kg21 - b.empty21;
          const out192 = b.kg192 - b.empty192;
          const isEntriesExpanded = expandedEntriesBatch === b.batch;

          return (
            <div key={b.batch} className="bg-white border border-customBorder rounded-2xl shadow-soft overflow-hidden hover:shadow-md transition-all">
              {/* Card Header */}
              <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
                    Batch #{b.batch}
                  </span>
                  {b.khaliDate && (
                    <span className="text-xs text-slate-500 font-semibold">
                      Khali Date: <span className="font-bold text-slate-700">{b.khaliDate}</span>
                    </span>
                  )}
                  {b.note && (
                    <span className="text-xs text-amber-700 italic font-medium">
                      📝 {b.note}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setExpandedEntriesBatch(isEntriesExpanded ? null : b.batch)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isEntriesExpanded ? "🔼 Hide Deliveries" : "🚚 Show Deliveries (" + (b.entries ? b.entries.length : 0) + ")"}</span>
                  </button>
                  {handleDeleteBatch && (
                    <button
                      onClick={() => handleDeleteBatch(b.batch)}
                      className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer active:scale-95"
                      title={`Delete Batch #${b.batch}`}
                    >
                      <span>🗑️ Delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Delivery Stats Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 21kg Category */}
                <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100">
                  <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">🔵 21 KG Cylinders</div>
                  <div className="text-xs font-bold text-slate-700 mt-2 flex items-center justify-between">
                    <span>Delivered: <strong className="text-sky-800 text-sm">{b.kg21}</strong></span>
                    <span className='text-lg'>Khali: <strong className="text-slate-600">{b.empty21}</strong></span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${out21 > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      Out: {out21}
                    </span>
                  </div>
                </div>

                {/* 19.2kg Category */}
                <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-100">
                  <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">🟢 19.2 KG Cylinders</div>
                  <div className="text-xs font-bold text-slate-700 mt-2 flex items-center justify-between">
                    <span>Delivered: <strong className="text-teal-800 text-sm">{b.kg192}</strong></span>
                    <span className='text-lg'>Khali: <strong className="text-slate-600">{b.empty192}</strong></span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${out192 > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      Out: {out192}
                    </span>
                  </div>
                </div>

                {/* Total Summary */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Totals</div>
                  <div className="text-xs font-bold text-slate-700 mt-2 flex items-center justify-between">
                    <span>Delivered: <strong className="text-slate-900 text-sm">{delivered}</strong></span>
                    <span className='text-lg'>Khali: <strong className="text-slate-600">{b.empty}</strong></span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${outstanding > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      Out: {outstanding}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible Delivery Entries List */}
              {isEntriesExpanded && (
                <div className="p-4 bg-slate-50 border-t border-customBorder space-y-2 fade">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>🚚 Cylinder Delivery & Collection Entries for Batch #{b.batch}</span>
                    <span className="text-[11px] font-semibold text-slate-500">{b.entries ? b.entries.length : 0} entries</span>
                  </div>
                  {(!b.entries || b.entries.length === 0) ? (
                    <div className="text-xs text-slate-400 font-semibold text-center py-4 bg-white rounded-xl border">
                      No cylinder entries recorded for this batch.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-customBorder rounded-xl bg-white">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-100 border-b border-customBorder">
                            <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate">Date</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate">Restaurant / Hotel Name</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate">Qty & Type</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate">Category</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {b.entries.map((e, idx) => (
                            <tr key={e.id || idx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-xs font-medium text-slate-600">{e.date || "-"}</td>
                              <td className="py-2.5 px-3 text-xs font-bold text-slate-900">{e.name}</td>
                              <td className="py-2.5 px-3 text-xs font-black text-sky-800">{e.qty}x {e.type}</td>
                              <td className="py-2.5 px-3 text-xs font-bold">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] ${
                                  e.isReturn ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-sky-100 text-sky-800 border border-sky-200'
                                }`}>
                                  {e.isReturn ? '♻️ Khali Return' : '🚚 Delivery'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-xs font-semibold text-slate-600">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-800 border border-slate-200">
                                  👤 {e.user_name || "Suraj"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
