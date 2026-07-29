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
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  const [form, setForm] = useState({
    batchNum: "128",
    restaurantName: "",
    amount: "",
    paymentMode: "Cash",
    date: new Date().toISOString().split('T')[0],
    note: ""
  });

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
        paymentCount: bPayments.length,
        entriesCount: b.entries ? b.entries.length : 0
      };
    }).sort((a, b) => b.batchNum - a.batchNum);
  }, [batches, payments]);

  // Overall totals
  const totalCostAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.bookingCost, 0), [batchSummaries]);
  const totalCollectedAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.totalCollected, 0), [batchSummaries]);
  const totalCashAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.totalCash, 0), [batchSummaries]);
  const totalUPIAll = useMemo(() => batchSummaries.reduce((s, b) => s + b.totalUPI, 0), [batchSummaries]);
  const netWalletBalance = totalCollectedAll - totalCostAll;

  // Filter payments table
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const nameMatch = !search || (p.restaurant_name || p.restaurantName || "").toLowerCase().includes(search.toLowerCase()) || String(p.batch_num || p.batchNum || "").includes(search);
      const modeMatch = modeFilter === "all" || (p.payment_mode || p.paymentMode) === modeFilter;
      return nameMatch && modeMatch;
    }).sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
  }, [payments, search, modeFilter]);

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
      batchNum: "128",
      restaurantName: "",
      amount: "",
      paymentMode: "Cash",
      date: new Date().toISOString().split('T')[0],
      note: ""
    });
    setShowAddModal(false);
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
            Track date-wise collections per batch & compare with booking cost (Suraj & Shivam).
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
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

      {/* Batch Cashflow Summary Table */}
      <div className="bg-white rounded-2xl border border-customBorder shadow-soft overflow-hidden">
        <div className="p-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-3 bg-slate-50">
          <h3 className="text-sm font-bold text-textSlate flex items-center gap-2">
            <span>📦 Batch-Wise Cashflow & Booking Balance Summary</span>
          </h3>
          <div className="text-xs text-mutedSlate font-semibold">
            {batchSummaries.length} Active Batches
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-customBorder">
                <th className="py-3 px-4 text-xs font-bold text-mutedSlate uppercase">Batch #</th>
                <th className="py-3 px-4 text-xs font-bold text-mutedSlate uppercase">Booking Cost</th>
                <th className="py-3 px-4 text-xs font-bold text-mutedSlate uppercase">Total Collection</th>
                <th className="py-3 px-4 text-xs font-bold text-mutedSlate uppercase">Cash / UPI Breakup</th>
                <th className="py-3 px-4 text-xs font-bold text-mutedSlate uppercase text-right">Agla Batch Booking Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batchSummaries.map((b) => (
                <tr key={b.batchNum} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-black text-amber-600 text-xs">#{b.batchNum}</td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-800">
                    {b.bookingCost > 0 ? `₹${b.bookingCost.toLocaleString()}` : <span className="text-slate-400 italic">Not set</span>}
                  </td>
                  <td className="py-3 px-4 text-xs font-black text-emerald-600">
                    ₹{b.totalCollected.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-[11px] text-slate-500 font-medium">
                    Cash: ₹{b.totalCash.toLocaleString()} | UPI: ₹{b.totalUPI.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-xs font-black text-right">
                    {b.bookingCost === 0 ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Enter Cost in Batches Tab
                      </span>
                    ) : b.isProfit ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        🟢 Profit: +₹{b.netPosition.toLocaleString()}
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                        🔴 Pocket se: -₹{Math.abs(b.netPosition).toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Date-wise Payment Entries Log */}
      <div className="bg-white rounded-2xl border border-customBorder shadow-soft p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-textSlate flex items-center gap-2">
            <span>📜 Date-wise Payment Collections Log</span>
          </h3>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search restaurant or batch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-customBorder bg-slate-50 text-xs font-semibold focus:border-accentCyan w-48 transition-all"
            />

            <select
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-customBorder bg-slate-50 text-xs font-semibold focus:border-accentCyan transition-all"
            >
              <option value="all">All Modes</option>
              <option value="Cash">💵 Cash Only</option>
              <option value="UPI">📱 UPI Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-customBorder rounded-xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-customBorder">
                <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Date</th>
                <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Batch #</th>
                <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Restaurant</th>
                <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Amount</th>
                <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Mode</th>
                <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate">Recorded By</th>
                <th className="py-2.5 px-3 text-[11px] font-bold text-mutedSlate text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-mutedSlate font-semibold">
                    No payment collection entries recorded yet. Click "Record Payment Collection" to add one.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-medium text-slate-600">{p.date || "N/A"}</td>
                    <td className="py-2.5 px-3 text-xs font-black text-amber-600">#{p.batch_num || p.batchNum || 128}</td>
                    <td className="py-2.5 px-3 text-xs font-bold text-textSlate">{p.restaurant_name || p.restaurantName}</td>
                    <td className="py-2.5 px-3 text-xs font-black text-emerald-600">₹{parseFloat(p.amount).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-xs font-bold">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                        (p.payment_mode || p.paymentMode) === 'UPI' 
                          ? 'bg-sky-100 text-sky-700 border border-sky-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {(p.payment_mode || p.paymentMode) === 'UPI' ? '📱 UPI' : '💵 Cash'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-600">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Collection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-customBorder shadow-glass max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-customBorder pb-3">
              <h3 className="text-base font-bold text-textSlate flex items-center gap-2">
                <span>➕ Record Batch Payment Collection</span>
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

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
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  list="restaurant-payment-list-ledger"
                  placeholder="e.g. Simran Restaurant"
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
                    Amount (₹) *
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
                  placeholder="e.g. GPay or Cash received"
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
