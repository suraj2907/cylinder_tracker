import React, { useState, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function BatchesList({ 
  filteredBatches = [], 
  batchSearch = "", 
  setBatchSearch,
  handleDeleteBatch,
  handleUpdateBatchCost,
  handleAdd,
  batches = []
}) {
  const [expandedEntriesBatch, setExpandedEntriesBatch] = useState(null);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);

  // "maxB >= 132 ? 133 : maxB + 1" always took the 133 branch (maxB starts at 132 and only
  // grows), silently ignoring the real latest batch number - same bug as GenerateBill/AddEntry.
  const nextSuggestedBatch = useMemo(() => {
    let maxB = 132;
    (batches || []).forEach(b => {
      const num = parseInt(b.batch || b.batch_num, 10);
      if (!isNaN(num) && num > maxB) maxB = num;
    });
    return maxB + 1;
  }, [batches]);

  const [newBatchNum, setNewBatchNum] = useState('');
  const [newBatchKhaliDate, setNewBatchKhaliDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newBatchCost, setNewBatchCost] = useState('');
  const [newBatchNote, setNewBatchNote] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  const handleOpenNewBatchModal = () => {
    setNewBatchNum(String(nextSuggestedBatch));
    setNewBatchKhaliDate(new Date().toISOString().slice(0, 10));
    setNewBatchCost('');
    setNewBatchNote('');
    setShowNewBatchModal(true);
  };

  const handleSaveNewBatch = async (e) => {
    e.preventDefault();
    const bNum = parseInt(newBatchNum, 10);
    if (!bNum) {
      alert('Batch number daalo');
      return;
    }
    setSavingBatch(true);
    try {
      const costVal = parseFloat(newBatchCost) || 0;
      await supabase.from('batches').upsert({
        batch_num: bNum,
        khali_date: newBatchKhaliDate || new Date().toISOString().slice(0, 10),
        booking_cost: costVal,
        note: newBatchNote ? newBatchNote.trim() : null
      });

      if (costVal > 0 && typeof handleUpdateBatchCost === 'function') {
        handleUpdateBatchCost(bNum, costVal);
      }

      setShowNewBatchModal(false);
    } catch (err) {
      alert('Batch save nahi hua: ' + err.message);
    } finally {
      setSavingBatch(false);
    }
  };

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

        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleOpenNewBatchModal}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-black transition-all shadow-soft flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>➕ Start Batch #{nextSuggestedBatch}</span>
          </button>

          <input 
            className="bg-slate-50 border border-customBorder rounded-xl px-4 py-2 text-textSlate placeholder-slate-400 focus:outline-none focus:border-accentCyan text-xs w-full sm:w-48 shadow-sm transition-all font-semibold"
            placeholder="Search batch # or date..." 
            value={batchSearch} 
            onChange={e => setBatchSearch(e.target.value)} 
          />
        </div>
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

      {/* Start New Batch Modal */}
      {showNewBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                ➕ Start New Batch #{newBatchNum}
              </h3>
              <button
                onClick={() => setShowNewBatchModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewBatch} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Batch Number</label>
                <input
                  type="number"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black focus:outline-none focus:border-sky-500 focus:bg-white"
                  value={newBatchNum}
                  onChange={e => setNewBatchNum(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Khali / Start Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-sky-500 focus:bg-white"
                  value={newBatchKhaliDate}
                  onChange={e => setNewBatchKhaliDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Booking Cost (₹) (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 95000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black focus:outline-none focus:border-sky-500 focus:bg-white"
                  value={newBatchCost}
                  onChange={e => setNewBatchCost(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Driver name, vehicle #, supply notes"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-white"
                  value={newBatchNote}
                  onChange={e => setNewBatchNote(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewBatchModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBatch}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-black shadow-soft cursor-pointer disabled:opacity-50"
                >
                  {savingBatch ? 'Saving...' : `Start Batch #${newBatchNum}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
