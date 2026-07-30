import React, { useState, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { norm } from '../utils/dataUtils';

export function PaymentLedger({ 
  payments = [], 
  onAddPayment, 
  onDeletePayment, 
  batches = [],
  onUpdateBatchCost,
  restMap = {}
}) {
  const { currentUser } = useUser();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBatchForPayment, setSelectedBatchForPayment] = useState(128);
  const [editingCostBatch, setEditingCostBatch] = useState(null);
  const [tempCost, setTempCost] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    batchNum: "128",
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

  // Calculate Batch Cashflow summaries
  const batchSummaries = useMemo(() => {
    return batches.map(b => {
      const bNum = b.batch;
      const bPayments = payments.filter(p => (p.batch_num || p.batchNum) === bNum);
      
      const totalCash = bPayments.filter(p => (p.payment_mode || p.paymentMode) === 'Cash').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const totalUPI = bPayments.filter(p => (p.payment_mode || p.paymentMode) === 'UPI').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const totalCollected = totalCash + totalUPI;

      const bookingCost = parseFloat(b.bookingCost || b.booking_cost || 0);
      const netPosition = totalCollected - bookingCost;
      const isProfit = netPosition >= 0;

      return {
        batchNum: bNum,
        khaliDate: b.khaliDate,
        bookingCost,
        totalCash,
        totalUPI,
        totalCollected,
        netPosition,
        isProfit,
        bPayments
      };
    }).sort((a, b) => b.batchNum - a.batchNum);
  }, [batches, payments]);

  // Overall totals
  const totalCostAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.bookingCost, 0), [batchSummaries]);
  const totalCollectedAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.totalCollected, 0), [batchSummaries]);
  const totalCashAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.totalCash, 0), [batchSummaries]);
  const totalUPIAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.totalUPI, 0), [batchSummaries]);
  const netWalletBalance = totalCollectedAll - totalCostAll;

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.restaurantName.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      alert("Please enter restaurant name and valid amount!");
      return;
    }

    onAddPayment({
      batchNum: form.batchNum ? parseInt(form.batchNum) : 128,
      restaurantName: norm(form.restaurantName),
      amount: parseFloat(form.amount),
      paymentMode: form.paymentMode,
      date: form.date,
      note: form.note.trim(),
      user_name: currentUser
    });

    setForm({
      batchNum: form.batchNum || "128",
      restaurantName: "",
      amount: "",
      paymentMode: "Cash",
      date: new Date().toISOString().split('T')[0],
      note: ""
    });
    setShowAddModal(false);
  }

  function openPaymentModalForBatch(bNum) {
    setForm(prev => ({ ...prev, batchNum: String(bNum) }));
    setShowAddModal(true);
  }

  return (
    <div className="space-y-6 fade">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-xl font-black text-textSlate flex items-center gap-2">
            <span>💰 Batch Cashflow & Wallet Manager</span>
          </h2>
          <p className="text-xs font-medium text-mutedSlate mt-1">
            Track date-wise collections per batch & compare with booking cost (Suraj ↔ Shivam).
          </p>
        </div>

        <button
          onClick={() => openPaymentModalForBatch(128)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-soft hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 justify-center"
        >
          <span>➕ Record Payment Collection</span>
        </button>
      </div>

      {/* Booking Wallet Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-customBorder shadow-soft">
          <div className="text-xs font-bold text-mutedSlate uppercase tracking-wider">Total Collection</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalCollectedAll.toLocaleString()}</div>
          <div className="text-[10px] font-semibold text-slate-400 mt-1">All batches collection</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-customBorder shadow-soft">
          <div className="text-xs font-bold text-mutedSlate uppercase tracking-wider">Cash in Hand</div>
          <div className="text-2xl font-black text-amber-600 mt-1">₹{totalCashAll.toLocaleString()}</div>
          <div className="text-[10px] font-semibold text-slate-400 mt-1">Physical Cash</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-customBorder shadow-soft">
          <div className="text-xs font-bold text-mutedSlate uppercase tracking-wider">UPI / Bank Transfer</div>
          <div className="text-2xl font-black text-sky-600 mt-1">₹{totalUPIAll.toLocaleString()}</div>
          <div className="text-[10px] font-semibold text-slate-400 mt-1">Digital transfer</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-customBorder shadow-soft">
          <div className="text-xs font-bold text-mutedSlate uppercase tracking-wider">Net Booking Wallet</div>
          <div className={`text-2xl font-black mt-1 ${netWalletBalance >= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
            {netWalletBalance >= 0 ? `+₹${netWalletBalance.toLocaleString()}` : `-₹${Math.abs(netWalletBalance).toLocaleString()}`}
          </div>
          <div className="text-[10px] font-semibold text-slate-400 mt-1">
            {netWalletBalance >= 0 ? '🟢 Extra Cash for Next Booking' : '🔴 Pocket se lagana padega'}
          </div>
        </div>
      </div>

      {/* Batch Financial Cards Section */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-textSlate flex items-center gap-2">
            <span>📦 Batch Financial Cashflow Cards (Starting #128)</span>
          </h3>
          <input
            type="text"
            placeholder="Search hotel or batch..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-customBorder bg-white text-xs font-semibold focus:border-accentCyan w-48 shadow-sm"
          />
        </div>

        {batchSummaries.map((b) => {
          const filteredBatchPayments = b.bPayments.filter(p => {
            if (!search) return true;
            return (p.restaurant_name || p.restaurantName || "").toLowerCase().includes(search.toLowerCase()) || String(p.batch_num || p.batchNum).includes(search);
          }).sort((x, y) => new Date(y.date) - new Date(x.date));

          return (
            <div key={b.batchNum} className="bg-white border border-customBorder rounded-2xl shadow-soft overflow-hidden hover:shadow-md transition-all">
              {/* Batch Card Header */}
              <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
                    Batch #{b.batchNum}
                  </span>
                  {b.khaliDate && (
                    <span className="text-xs text-slate-500 font-semibold">
                      Khali Date: <span className="font-bold text-slate-700">{b.khaliDate}</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={() => openPaymentModalForBatch(b.batchNum)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1"
                >
                  <span>➕ Add Payment (#{b.batchNum})</span>
                </button>
              </div>

              {/* Financial Strip */}
              <div className="p-4 bg-slate-50/50 border-b border-customBorder grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* 1. Booking Cost */}
                <div className="bg-white p-3 rounded-xl border border-customBorder shadow-sm flex flex-col justify-between">
                  <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider flex items-center justify-between">
                    <span>Agency Booking Cost</span>
                    <button 
                      onClick={() => {
                        setEditingCostBatch(b.batchNum);
                        setTempCost(b.bookingCost || "");
                      }}
                      className="text-sky-600 hover:text-sky-800 text-[10px] font-bold underline"
                    >
                      {editingCostBatch === b.batchNum ? "Cancel" : "Edit Cost"}
                    </button>
                  </div>

                  {editingCostBatch === b.batchNum ? (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={tempCost}
                        onChange={e => setTempCost(e.target.value)}
                        className="w-full px-2 py-1 border border-sky-400 rounded-lg text-xs font-bold"
                      />
                      <button
                        onClick={() => handleSaveCost(b.batchNum)}
                        className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="text-base font-black text-slate-800 mt-1">
                      ₹{b.bookingCost.toLocaleString()}
                    </div>
                  )}
                </div>

                {/* 2. Total Collection */}
                <div className="bg-white p-3 rounded-xl border border-customBorder shadow-sm">
                  <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider">Total Collection</div>
                  <div className="text-base font-black text-emerald-600 mt-1">₹{b.totalCollected.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    Cash: ₹{b.totalCash.toLocaleString()} | UPI: ₹{b.totalUPI.toLocaleString()}
                  </div>
                </div>

                {/* 3. Batch Profit / Pocket Position */}
                <div className="bg-white p-3 rounded-xl border border-customBorder shadow-sm sm:col-span-2">
                  <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider">
                    Agla Batch Booking Status
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {b.bookingCost === 0 ? (
                      <span className="text-xs text-slate-500 font-semibold italic">
                        Enter booking cost to calculate profit/pocket balance
                      </span>
                    ) : b.isProfit ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span>🟢 Profit / Surplus:</span>
                        <span>+₹{b.netPosition.toLocaleString()} (Paisa bacha hai!)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                        <span>🔴 Pocket Se Daalna Padega:</span>
                        <span>-₹{Math.abs(b.netPosition).toLocaleString()} (Agency booking me kam hai)</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Date-wise Collections Table */}
              <div className="p-4 bg-white space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>📜 Date-wise Collections Recorded for Batch #{b.batchNum}</span>
                  <span className="text-[11px] font-semibold text-slate-500">{filteredBatchPayments.length} entries</span>
                </div>

                {filteredBatchPayments.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 font-semibold bg-slate-50 rounded-xl border border-dashed">
                    No payment entries recorded for Batch #{b.batchNum} yet. Click "+ Add Payment" to record.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-customBorder rounded-xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-customBorder">
                          <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate uppercase">Date</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate uppercase">Restaurant / Hotel Name</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate uppercase">Amount</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate uppercase">Mode</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate uppercase">Recorded By</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-mutedSlate uppercase text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBatchPayments.map((p, idx) => (
                          <tr key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 text-xs font-medium text-slate-600">{p.date || "N/A"}</td>
                            <td className="py-2.5 px-3 text-xs font-extrabold text-slate-900">{p.restaurant_name || p.restaurantName}</td>
                            <td className="py-2.5 px-3 text-xs font-black text-emerald-600">₹{parseFloat(p.amount).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-xs font-bold">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] ${
                                (p.payment_mode || p.paymentMode) === 'UPI' 
                                  ? 'bg-sky-100 text-sky-700 border border-sky-200' 
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {(p.payment_mode || p.paymentMode) === 'UPI' ? '📱 UPI' : '💵 Cash'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-xs font-semibold text-slate-600">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-800 border border-slate-200">
                                👤 {p.user_name || "Suraj"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-right">
                              {onDeletePayment && (
                                <button
                                  onClick={() => onDeletePayment(p)}
                                  className="text-red-500 hover:text-red-700 font-bold p-1 text-xs"
                                  title="Delete entry"
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

      {/* Record Payment Collection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl border border-customBorder shadow-glass max-w-md w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-customBorder pb-3">
              <div>
                <h3 className="text-base font-bold text-textSlate flex items-center gap-2">
                  <span>➕ Record Payment Collection</span>
                </h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                    Batch # *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 128"
                    value={form.batchNum}
                    onChange={e => setForm({ ...form, batchNum: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={form.paymentMode}
                    onChange={e => setForm({ ...form, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                  >
                    <option value="Cash">💵 Cash Hand-over</option>
                    <option value="UPI">📱 UPI / Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                  Restaurant / Hotel Name *
                </label>
                <input
                  type="text"
                  required
                  list="restaurant-payment-list-ledger"
                  placeholder="Type or select restaurant..."
                  value={form.restaurantName}
                  onChange={e => setForm({ ...form, restaurantName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                />
                <datalist id="restaurant-payment-list-ledger">
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
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-mutedSlate uppercase mb-1">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received on field"
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-customBorder text-xs font-semibold focus:border-accentCyan text-textSlate"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-customBorder text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  Save Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
