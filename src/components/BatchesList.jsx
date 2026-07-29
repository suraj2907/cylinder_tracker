import React, { useState } from 'react';
import { useUser } from '../context/UserContext';

export default function BatchesList({ 
  filteredBatches = [], 
  batchSearch = "", 
  setBatchSearch,
  payments = [],
  onUpdateBatchCost,
  onAddPayment,
  onDeletePayment,
  restMap = {}
}) {
  const { currentUser } = useUser();
  const [selectedBatchForPayment, setSelectedBatchForPayment] = useState(null);
  const [editingCostBatch, setEditingCostBatch] = useState(null);
  const [tempCost, setTempCost] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    restaurantName: "",
    amount: "",
    paymentMode: "Cash",
    date: new Date().toISOString().split('T')[0],
    note: ""
  });

  function handleSaveCost(batchNum) {
    const val = parseFloat(tempCost);
    if (isNaN(val) || val < 0) {
      alert("Please enter a valid booking cost amount!");
      return;
    }
    if (onUpdateBatchCost) {
      onUpdateBatchCost(batchNum, val);
    }
    setEditingCostBatch(null);
  }

  function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!paymentForm.restaurantName.trim() || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      alert("Please enter restaurant name and valid amount!");
      return;
    }

    onAddPayment({
      batchNum: selectedBatchForPayment,
      restaurantName: paymentForm.restaurantName.trim(),
      amount: parseFloat(paymentForm.amount),
      paymentMode: paymentForm.paymentMode,
      date: paymentForm.date,
      note: paymentForm.note.trim(),
      user_name: currentUser
    });

    setPaymentForm({
      restaurantName: "",
      amount: "",
      paymentMode: "Cash",
      date: new Date().toISOString().split('T')[0],
      note: ""
    });
    setSelectedBatchForPayment(null);
  }

  return (
    <div className="space-y-6 fade">
      {/* Header & Search */}
      <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-extrabold text-textSlate flex items-center gap-2">
            <span>📦 Cylinder Batches & Booking Cashflow</span>
          </h2>
          <p className="text-xs text-mutedSlate">
            Track date-wise payment collections vs agency booking cost per batch (e.g. Batch #128 onwards).
          </p>
        </div>

        <input 
          className="bg-slate-50 border border-customBorder rounded-xl px-4 py-2 text-textSlate placeholder-slate-400 focus:outline-none focus:border-accentCyan text-xs w-full sm:w-60 shadow-sm transition-all font-semibold"
          placeholder="Search batch # or date..." 
          value={batchSearch} 
          onChange={e => setBatchSearch(e.target.value)} 
        />
      </div>

      {/* Batches Financial & Delivery Cards */}
      <div className="space-y-4">
        {filteredBatches.map((b) => {
          const delivered = b.kg21 + b.kg192;
          const outstanding = delivered - b.empty;
          const out21 = b.kg21 - b.empty21;
          const out192 = b.kg192 - b.empty192;

          // Calculate batch payment collections
          const batchPayments = payments.filter(p => (p.batch_num || p.batchNum) === b.batch);
          const totalCash = batchPayments.filter(p => (p.payment_mode || p.paymentMode) === 'Cash').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          const totalUPI = batchPayments.filter(p => (p.payment_mode || p.paymentMode) === 'UPI').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          const totalCollected = totalCash + totalUPI;

          const bookingCost = parseFloat(b.bookingCost || b.booking_cost || 0);
          const netPosition = totalCollected - bookingCost;
          const isProfit = netPosition >= 0;

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

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedBatchForPayment(b.batch)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1"
                  >
                    <span>➕ Add Payment ({b.batch})</span>
                  </button>
                </div>
              </div>

              {/* Financial Cashflow Strip */}
              <div className="p-4 bg-slate-50/50 border-b border-customBorder grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* 1. Agency Booking Cost */}
                <div className="bg-white p-3 rounded-xl border border-customBorder shadow-sm flex flex-col justify-between">
                  <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider flex items-center justify-between">
                    <span>Agency Booking Cost</span>
                    <button 
                      onClick={() => {
                        setEditingCostBatch(b.batch);
                        setTempCost(bookingCost || "");
                      }}
                      className="text-sky-600 hover:text-sky-800 text-[10px] font-bold underline"
                    >
                      {editingCostBatch === b.batch ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  {editingCostBatch === b.batch ? (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={tempCost}
                        onChange={e => setTempCost(e.target.value)}
                        className="w-full px-2 py-1 border border-sky-400 rounded-lg text-xs font-bold"
                      />
                      <button
                        onClick={() => handleSaveCost(b.batch)}
                        className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="text-base font-black text-slate-800 mt-1">
                      ₹{bookingCost.toLocaleString()}
                    </div>
                  )}
                </div>

                {/* 2. Total Payments Collected */}
                <div className="bg-white p-3 rounded-xl border border-customBorder shadow-sm">
                  <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider">Total Collection</div>
                  <div className="text-base font-black text-emerald-600 mt-1">₹{totalCollected.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    Cash: ₹{totalCash.toLocaleString()} | UPI: ₹{totalUPI.toLocaleString()}
                  </div>
                </div>

                {/* 3. Batch Profit / Pocket Position */}
                <div className="bg-white p-3 rounded-xl border border-customBorder shadow-sm sm:col-span-2">
                  <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider">
                    Batch Net Position (Agla Batch Booking Balance)
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {bookingCost === 0 ? (
                      <span className="text-xs text-slate-500 font-semibold italic">
                        Enter booking cost to calculate profit/pocket balance
                      </span>
                    ) : isProfit ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span>🟢 Profit / Surplus:</span>
                        <span>+₹{netPosition.toLocaleString()} (Paisa bacha hai!)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                        <span>🔴 Pocket Se Daalna Padega:</span>
                        <span>-₹{Math.abs(netPosition).toLocaleString()} (Agency booking me kam hai)</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Stats Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-customBorder">
                {/* 21kg Category */}
                <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-100">
                  <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">🔵 21 KG Cylinders</div>
                  <div className="text-xs font-bold text-slate-700 mt-1 flex items-center justify-between">
                    <span>Delivered: <strong className="text-sky-800">{b.kg21}</strong></span>
                    <span>Khali: <strong className="text-slate-600">{b.empty21}</strong></span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${out21 > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      Out: {out21}
                    </span>
                  </div>
                </div>

                {/* 19.2kg Category */}
                <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                  <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">🟢 19.2 KG Cylinders</div>
                  <div className="text-xs font-bold text-slate-700 mt-1 flex items-center justify-between">
                    <span>Delivered: <strong className="text-teal-800">{b.kg192}</strong></span>
                    <span>Khali: <strong className="text-slate-600">{b.empty192}</strong></span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${out192 > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      Out: {out192}
                    </span>
                  </div>
                </div>

                {/* Total Summary */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Totals</div>
                  <div className="text-xs font-bold text-slate-700 mt-1 flex items-center justify-between">
                    <span>Total Del: <strong className="text-slate-900">{delivered}</strong></span>
                    <span>Total Khali: <strong className="text-slate-600">{b.empty}</strong></span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${outstanding > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      Out: {outstanding}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date-wise Payments List for Batch */}
              <div className="p-4 bg-white">
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>📅 Date-wise Payment Entries for Batch #{b.batch}</span>
                  <span className="text-[11px] font-semibold text-slate-500">{batchPayments.length} entries</span>
                </div>

                {batchPayments.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No payment entries recorded for Batch #{b.batch} yet. Click "+ Add Payment ({b.batch})" to record cash/UPI received on a date.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-customBorder rounded-xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-customBorder">
                          <th className="py-2 px-3 text-[10px] font-bold text-mutedSlate">Date</th>
                          <th className="py-2 px-3 text-[10px] font-bold text-mutedSlate">Restaurant</th>
                          <th className="py-2 px-3 text-[10px] font-bold text-mutedSlate">Amount</th>
                          <th className="py-2 px-3 text-[10px] font-bold text-mutedSlate">Mode</th>
                          <th className="py-2 px-3 text-[10px] font-bold text-mutedSlate">Recorded By</th>
                          <th className="py-2 px-3 text-[10px] font-bold text-mutedSlate text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batchPayments.sort((x, y) => new Date(y.date) - new Date(x.date)).map((p, idx) => (
                          <tr key={p.id || idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-xs font-medium text-slate-600">{p.date}</td>
                            <td className="py-2 px-3 text-xs font-bold text-slate-900">{p.restaurant_name || p.restaurantName}</td>
                            <td className="py-2 px-3 text-xs font-black text-emerald-600">₹{parseFloat(p.amount).toLocaleString()}</td>
                            <td className="py-2 px-3 text-xs font-bold">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                                (p.payment_mode || p.paymentMode) === 'UPI' 
                                  ? 'bg-sky-100 text-sky-700 border border-sky-200' 
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {(p.payment_mode || p.paymentMode) === 'UPI' ? '📱 UPI' : '💵 Cash'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs font-semibold text-slate-600">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold">
                                👤 {p.user_name || "Suraj"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-right">
                              {onDeletePayment && (
                                <button
                                  onClick={() => onDeletePayment(p)}
                                  className="text-red-500 hover:text-red-700 font-bold p-1 text-xs"
                                  title="Delete payment entry"
                                >
                                  🗑️
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Payment Modal for Selected Batch */}
      {selectedBatchForPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-customBorder shadow-glass max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-customBorder pb-3">
              <h3 className="text-base font-bold text-textSlate flex items-center gap-2">
                <span>➕ Record Payment for Batch #{selectedBatchForPayment}</span>
              </h3>
              <button 
                onClick={() => setSelectedBatchForPayment(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  list="restaurant-payment-list-batch"
                  placeholder="e.g. Simran Restaurant"
                  value={paymentForm.restaurantName}
                  onChange={e => setPaymentForm({ ...paymentForm, restaurantName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                />
                <datalist id="restaurant-payment-list-batch">
                  {Object.keys(restMap || {}).sort().map(r => <option key={r} value={r} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                    Amount Received (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentForm.paymentMode}
                    onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                  >
                    <option value="Cash">💵 Cash Hand-over</option>
                    <option value="UPI">📱 UPI / Online</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                    Recorded By
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs font-extrabold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received by Suraj on field"
                  value={paymentForm.note}
                  onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedBatchForPayment(null)}
                  className="px-4 py-2 rounded-xl border border-customBorder text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  Save Payment Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
