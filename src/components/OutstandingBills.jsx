import React, { useState, useMemo } from 'react';
import { getInvoiceLabel } from '../utils/dataUtils';

export default function OutstandingBills({
  bills = [],
  recordBillPayment
}) {
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState(null); // Bill for recording payment
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter bills to only show unpaid or partially paid
  const pendingBills = useMemo(() => {
    return bills.filter(b => {
      const isPending = b.payment_status !== 'paid' && (parseFloat(b.total_amount) - parseFloat(b.amount_paid || 0)) > 0.05;
      const matchesSearch = !search || b.restaurant_name.toLowerCase().includes(search.toLowerCase()) ||
                            String(b.id).includes(search) || String(b.invoice_no || '').includes(search);
      return isPending && matchesSearch;
    });
  }, [bills, search]);

  const handleOpenPayModal = (bill) => {
    setSelectedBill(bill);
    const balance = parseFloat(bill.total_amount) - parseFloat(bill.amount_paid || 0);
    setPayAmount(balance.toFixed(2));
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedBill || !payAmount) return;
    const amt = Number(payAmount);
    const balance = Number(selectedBill.total_amount) - Number(selectedBill.amount_paid || 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }
    if (amt > balance + 0.05) {
      alert(`Payment pending balance (₹${balance.toFixed(2)}) se zyada nahi ho sakta.`);
      return;
    }
    setSaving(true);
    try {
      await recordBillPayment({
        billId: selectedBill.id,
        amount: amt,
        paymentMode: payMode,
        paymentDate: new Date().toISOString().slice(0, 10),
        note: payNote || `Against Invoice ${getInvoiceLabel(selectedBill)}`
      });

      alert("Payment collection recorded successfully!");
      setSelectedBill(null);
      setPayAmount('');
      setPayNote('');
    } catch (err) {
      alert("Failed to save payment: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            ⏳ Outstanding Payments (Pending Bills)
          </h2>
          <p className="text-xs text-muted font-bold mt-1">Track and collect unpaid and partially paid customer sales invoices.</p>
        </div>

        <input
          className="bg-white border border-customBorder rounded-xl px-3.5 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-accentCyan text-xs w-full sm:w-60 shadow-sm transition-all"
          placeholder="Search party name or Invoice..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Pending bills table */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-customBorder bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Customer Party</th>
                <th className="px-4 py-3">Bill Date</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Pending Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-xs text-slate-750">
              {pendingBills.map(b => {
                const balance = parseFloat(b.total_amount) - parseFloat(b.amount_paid || 0);
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">{getInvoiceLabel(b)}</td>
                    <td className="px-4 py-3 font-extrabold text-slate-950">{b.restaurant_name}</td>
                    <td className="px-4 py-3 text-slate-500">{b.bill_date}</td>
                    <td className="px-4 py-3 text-right text-slate-900">₹{parseFloat(b.total_amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">₹{parseFloat(b.amount_paid || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-rose-600 font-black">₹{balance.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black border ${
                        b.payment_status === 'partially_paid' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {b.payment_status === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenPayModal(b)}
                        className="px-3 py-1 rounded-xl bg-sky-600 text-white hover:bg-sky-750 font-black text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        💰 Collect Payment
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pendingBills.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 italic">
                    No pending invoices found. Great job!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99] p-4">
          <form onSubmit={handleSavePayment} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-black text-slate-900">💰 Record Payment Collection</h3>
              <button type="button" onClick={() => setSelectedBill(null)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer font-extrabold">✕</button>
            </div>

            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Party / Hotel</span>
                <span className="text-sm font-black text-slate-900 block mt-0.5">{selectedBill.restaurant_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice No</span>
                  <span className="text-xs font-black text-slate-900 block mt-0.5">{getInvoiceLabel(selectedBill)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Pending Balance</span>
                  <span className="text-xs font-black text-rose-600 block mt-0.5">
                    ₹{(parseFloat(selectedBill.total_amount) - parseFloat(selectedBill.amount_paid || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Mode</label>
                  <select
                    className="w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    value={payMode}
                    onChange={e => setPayMode(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / Digital</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Reference Date</label>
                  <span className="w-full inline-block bg-slate-50 border border-customBorder rounded-xl px-3 py-2 text-xs font-bold text-slate-500">
                    {new Date().toISOString().slice(0, 10)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Collection Note</label>
                <input
                  type="text"
                  className="w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="e.g. Paid part payment..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Record Collection & Close Invoice'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
