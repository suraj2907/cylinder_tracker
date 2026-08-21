import React, { useState, useMemo } from 'react';
import DateRangePicker, { PRESETS } from './DateRangePicker';

export default function ExpenseTracker({
  categories = [],
  expenseItems = [],
  expenses = [],
  saveCategory,
  deleteCategory,
  saveExpenseItem,
  deleteExpenseItem,
  saveExpense,
  deleteExpense
}) {
  const [dateRange, setDateRange] = useState(() => {
    // Default to this month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10)
    };
  });

  const [recordingExpense, setRecordingExpense] = useState(false);
  const [managingCats, setManagingCats] = useState(false);
  const [managingItems, setManagingItems] = useState(false);

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      return e.expense_date >= dateRange.startDate && e.expense_date <= dateRange.endDate;
    });
  }, [expenses, dateRange]);

  // Group by category with subtotals
  const groupedExpenses = useMemo(() => {
    const groups = {};
    let grandTotal = 0;

    filteredExpenses.forEach(exp => {
      const cat = categories.find(c => c.id === exp.category_id);
      const catName = cat ? cat.name : 'Uncategorized';
      if (!groups[catName]) {
        groups[catName] = {
          categoryName: catName,
          items: [],
          subtotal: 0
        };
      }
      groups[catName].items.push(exp);
      const amt = parseFloat(exp.total_amount) || 0;
      groups[catName].subtotal += amt;
      grandTotal += amt;
    });

    return {
      list: Object.values(groups),
      grandTotal
    };
  }, [filteredExpenses, categories]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Business Expense Tracker
          </h2>
          <p className="text-xs text-slate-400 font-bold mt-1">Track business operations, fuel, repairs, salaries, and overheads.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setManagingCats(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            📂 Categories
          </button>
          <button
            onClick={() => setManagingItems(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            📋 Catalog
          </button>
          <button
            onClick={() => setRecordingExpense(true)}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-black transition-all shadow-soft flex items-center gap-1.5 cursor-pointer"
          >
            ➕ Log Expense
          </button>
        </div>
      </div>

      {/* Date Range Selector and Hero Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft flex flex-col justify-between">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date Period Filter</label>
          <div className="mt-2.5">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft md:col-span-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Expenses In Period</span>
            <span className="text-3xl font-black text-slate-900 block mt-1.5 tracking-tight">
              ₹{Number(groupedExpenses.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-black rounded-xl uppercase tracking-wider">
            💸 Outflow Logged
          </div>
        </div>
      </div>

      {/* Grouped Expense List */}
      <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
        <div className="bg-slate-50 px-5 py-4 border-b border-customBorder">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            📂 Grouped Outflow Summary
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {groupedExpenses.list.map(group => (
            <div key={group.categoryName} className="p-5 space-y-3">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-xs font-black text-slate-800">{group.categoryName}</span>
                <span className="text-xs font-black text-rose-600">Subtotal: ₹{group.subtotal.toLocaleString()}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                      <th className="py-2">Date</th>
                      <th className="py-2">Items Breakdown</th>
                      <th className="py-2">Payment Mode</th>
                      <th className="py-2">Notes</th>
                      <th className="py-2 text-right">Amount</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {group.items.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-semibold text-slate-600">{exp.expense_date}</td>
                        <td className="py-2.5 font-medium text-slate-800">
                          {Array.isArray(exp.items) ? (
                            exp.items.map((line, idx) => (
                              <div key={idx} className="text-[11px] text-slate-700 font-semibold">
                                • {line.item_name} ({line.qty} x ₹{line.rate})
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400">Generic Expense</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-black uppercase text-slate-700 border">
                            {exp.payment_mode || 'Cash'}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-500 italic max-w-xs truncate">{exp.note || '-'}</td>
                        <td className="py-2.5 text-right font-bold text-rose-700">₹{Number(exp.total_amount).toFixed(2)}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              if (window.confirm("Sach me ye expense entry delete karni hai?")) {
                                deleteExpense(exp.id);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ✕ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {groupedExpenses.list.length === 0 && (
            <div className="text-center py-12 text-slate-400 font-semibold italic text-xs">
              No expenses recorded in this date range.
            </div>
          )}
        </div>
      </div>

      {/* Record Expense Modal */}
      {recordingExpense && (
        <RecordExpenseModal
          categories={categories}
          expenseItems={expenseItems}
          onClose={() => setRecordingExpense(false)}
          onSave={saveExpense}
        />
      )}

      {/* Manage Categories Overlay */}
      {managingCats && (
        <ManageMetadataModal
          title="📂 Manage Expense Categories"
          items={categories}
          onClose={() => setManagingCats(false)}
          onAdd={saveCategory}
          onDelete={deleteCategory}
        />
      )}

      {/* Manage Reusable Expense Items Overlay */}
      {managingItems && (
        <ManageMetadataModal
          title="📋 Manage Expense Catalog Items"
          items={expenseItems}
          onClose={() => setManagingItems(false)}
          onAdd={(name) => saveExpenseItem(name, 0)}
          onDelete={deleteExpenseItem}
          showRate={true}
          onSaveRate={saveExpenseItem}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// SUB-COMPONENT: Record Expense Modal Form
// ----------------------------------------------------
function RecordExpenseModal({ categories, expenseItems, onClose, onSave }) {
  const [selectedCat, setSelectedCat] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [itemsList, setItemsList] = useState([]);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [note, setNote] = useState('');
  
  // Custom states
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    return itemsList.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  }, [itemsList]);

  const totalAmount = useMemo(() => {
    return subtotal + Number(additionalCharges) - Number(discount);
  }, [subtotal, additionalCharges, discount]);

  const handleAddItem = (item) => {
    // Add item with default rate or 0
    setItemsList(prev => [
      ...prev,
      { item_name: item.name, qty: 1, rate: Number(item.default_rate) || 0, amount: Number(item.default_rate) || 0 }
    ]);
    setShowItemPicker(false);
  };

  const updateLineItem = (idx, field, val) => {
    setItemsList(prev => prev.map((item, i) => {
      if (i === idx) {
        const updated = { ...item, [field]: val };
        updated.amount = updated.qty * updated.rate;
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveLineItem = (idx) => {
    setItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCat) {
      alert("Please choose an expense category.");
      return;
    }
    if (itemsList.length === 0) {
      alert("Please add at least one line item cost details.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        category_id: selectedCat,
        expense_date: expenseDate,
        items: itemsList,
        additional_charges: Number(additionalCharges),
        discount: Number(discount),
        total_amount: Number(totalAmount),
        payment_mode: paymentMode,
        note
      });
      alert("Expense successfully recorded!");
      onClose();
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99] p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-fadeIn flex flex-col">
        <div className="flex justify-between items-center border-b pb-2 shrink-0">
          <h3 className="text-base font-black text-slate-900">💸 Record Business Expense</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto">
          {/* Category Dropdown */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Expense Category</label>
            <select
              required
              className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
            >
              <option value="">Choose category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Expense Date</label>
              <input
                type="date"
                required
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Mode</label>
              <select
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Items Sub-panel */}
          <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-[10px] font-black text-slate-500 uppercase">Expense Items</span>
              <button
                type="button"
                onClick={() => setShowItemPicker(true)}
                className="text-xs font-black text-sky-700 hover:underline cursor-pointer"
              >
                + Add Catalog Item
              </button>
            </div>

            {showItemPicker && (
              <div className="p-3 bg-white border rounded-xl space-y-2 max-h-36 overflow-y-auto shadow-sm animate-fadeIn">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Select item from catalog:</span>
                {expenseItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddItem(item)}
                    className="block w-full text-left py-1 text-xs font-semibold hover:bg-slate-50 rounded"
                  >
                    • {item.name} {item.default_rate > 0 ? `(₹${item.default_rate})` : ''}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {itemsList.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="flex-[2] text-xs font-bold text-slate-800">{item.item_name}</span>
                  <input
                    type="number"
                    placeholder="Qty"
                    className="flex-1 border rounded-lg px-2 py-1 text-[11px] font-bold text-center"
                    value={item.qty}
                    onChange={e => updateLineItem(idx, 'qty', parseInt(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    placeholder="Rate"
                    className="flex-1 border rounded-lg px-2 py-1 text-[11px] font-bold text-center"
                    value={item.rate}
                    onChange={e => updateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                  />
                  <span className="w-16 text-right text-xs font-black text-slate-700">₹{item.amount}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(idx)}
                    className="text-red-500 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {itemsList.length === 0 && (
                <span className="text-slate-400 italic text-[11px] text-center block">No items added to cost breakdown.</span>
              )}
            </div>
          </div>

          {/* Charges and Discounts */}
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Additional Charges (+)</label>
              <input
                type="number"
                placeholder="0"
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-1.5 text-xs font-bold"
                value={additionalCharges}
                onChange={e => setAdditionalCharges(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Discount (-)</label>
              <input
                type="number"
                placeholder="0"
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-1.5 text-xs font-bold"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Notes & Reminders</label>
            <input
              type="text"
              placeholder="e.g. Paid driver monthly bonus..."
              className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Total Amount & Submit */}
        <div className="border-t pt-3 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase">Grand Total</span>
            <span className="text-xl font-black text-slate-900 block">₹{totalAmount.toLocaleString()}</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Recording...' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// SUB-COMPONENT: Manage Categories & Items Metadata
// ----------------------------------------------------
function ManageMetadataModal({ title, items, onClose, onAdd, onDelete, showRate = false, onSaveRate }) {
  const [newValue, setNewValue] = useState('');
  const [newRate, setNewRate] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    try {
      if (showRate && onSaveRate) {
        await onSaveRate(newValue.trim(), parseFloat(newRate) || 0);
      } else {
        await onAdd(newValue.trim());
      }
      setNewValue('');
      setNewRate('');
    } catch (e) {
      alert("Failed to add entry: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-fadeIn">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
        </div>

        {/* List of current items */}
        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl px-3 py-1 bg-slate-50/50">
          {items.map(item => (
            <div key={item.id} className="py-2.5 flex justify-between items-center text-xs font-bold text-slate-800">
              <span>
                {item.name} {showRate && item.default_rate > 0 ? `(₹${item.default_rate})` : ''}
              </span>
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
                    onDelete(item.id);
                  }
                }}
                className="text-red-500 hover:text-red-700 font-extrabold"
              >
                Delete
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-4 text-center text-slate-450 italic">No entries saved yet.</div>
          )}
        </div>

        {/* Form to add new item */}
        <form onSubmit={handleAdd} className="space-y-3 border-t pt-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Add New Item Name</label>
            <input
              required
              className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
              placeholder="e.g. Fuel / Diesel..."
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
            />
          </div>
          {showRate && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Default Rate (₹)</label>
              <input
                type="number"
                placeholder="e.g. 500"
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md cursor-pointer"
          >
            Add To Database List
          </button>
        </form>
      </div>
    </div>
  );
}
