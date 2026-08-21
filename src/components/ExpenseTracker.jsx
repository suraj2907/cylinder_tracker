import React, { useState, useMemo, useEffect } from 'react';
import DateRangePicker, { PRESETS } from './DateRangePicker';

function formatLocalYMD(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
      startDate: formatLocalYMD(start),
      endDate: formatLocalYMD(now)
    };
  });

  const [recordingExpense, setRecordingExpense] = useState(false);
  const [managingCats, setManagingCats] = useState(false);
  const [managingItems, setManagingItems] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('flat'); // 'flat' | 'grouped'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter expenses by date range and search/category
  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      const inDate = e.expense_date >= dateRange.startDate && e.expense_date <= dateRange.endDate;
      if (!inDate) return false;

      if (selectedCategoryFilter !== 'ALL') {
        if (e.category_id !== selectedCategoryFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cat = (categories || []).find(c => c.id === e.category_id);
        const catName = (cat?.name || '').toLowerCase();
        const note = (e.note || '').toLowerCase();
        const mode = (e.payment_mode || '').toLowerCase();
        const amt = String(e.total_amount || '');
        const itemsStr = Array.isArray(e.items) ? e.items.map(i => i.item_name).join(' ').toLowerCase() : '';

        const matches = catName.includes(q) || note.includes(q) || mode.includes(q) || amt.includes(q) || itemsStr.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [expenses, dateRange, selectedCategoryFilter, searchQuery, categories]);

  // Group by category with subtotals (using filteredExpenses)
  const groupedExpenses = useMemo(() => {
    const groups = {};
    let grandTotal = 0;

    filteredExpenses.forEach(exp => {
      const cat = (categories || []).find(c => c.id === exp.category_id);
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
      list: Object.values(groups).sort((a, b) => b.subtotal - a.subtotal),
      grandTotal
    };
  }, [filteredExpenses, categories]);

  // Total amount of filtered expenses
  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);
  }, [filteredExpenses]);

  // Pagination calculation for flat view
  const totalPages = Math.ceil(filteredExpenses.length / (pageSize === 'ALL' ? (filteredExpenses.length || 1) : pageSize)) || 1;
  
  const paginatedExpenses = useMemo(() => {
    if (pageSize === 'ALL') return filteredExpenses;
    const startIdx = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(startIdx, startIdx + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedCategoryFilter, searchQuery, pageSize]);

  const exportExpensesToCSV = () => {
    const headers = ["Date", "Category", "Items Breakdown", "Payment Mode", "Notes", "Amount (INR)"];
    const rows = filteredExpenses.map(e => {
      const cat = (categories || []).find(c => c.id === e.category_id);
      const catName = cat ? cat.name : 'Uncategorized';
      const itemsStr = Array.isArray(e.items) ? e.items.map(i => `${i.item_name} (${i.qty}x${i.rate})`).join('; ') : '';
      return [
        e.expense_date,
        `"${catName}"`,
        `"${itemsStr}"`,
        e.payment_mode || 'Cash',
        `"${(e.note || '').replace(/"/g, '""')}"`,
        e.total_amount
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expenses_Report_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            💸 Business Expense Tracker
          </h2>
          <p className="text-xs text-slate-400 font-bold mt-1">Track business operations, fuel, repairs, salaries, vehicle EMIs, and overheads.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={exportExpensesToCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
          >
            📊 Export CSV
          </button>
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

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft md:col-span-2 flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Expenses In Period</span>
            <span className="text-3xl font-black text-slate-900 block mt-1.5 tracking-tight">
              ₹{Number(totalFilteredAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] font-bold text-slate-500 mt-1 block">
              {filteredExpenses.length} Transactions across {groupedExpenses.list.length} categories
            </span>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="px-3.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-black rounded-xl uppercase tracking-wider">
              💸 Outflow Logged
            </div>
            {groupedExpenses.list.length > 0 && (
              <span className="text-[11px] font-bold text-slate-600">
                Top: <strong className="text-slate-900">{groupedExpenses.list[0].categoryName}</strong> (₹{groupedExpenses.list[0].subtotal.toLocaleString()})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* View Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft flex flex-col md:flex-row items-center justify-between gap-3">
        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setViewMode('flat')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex-1 md:flex-initial ${
              viewMode === 'flat' ? 'bg-white text-sky-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📄 All Transactions ({filteredExpenses.length})
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex-1 md:flex-initial ${
              viewMode === 'grouped' ? 'bg-white text-sky-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📂 Category Groups ({groupedExpenses.list.length})
          </button>
        </div>

        {/* Category & Search Filter */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1 md:justify-end flex-wrap">
          <select
            value={selectedCategoryFilter}
            onChange={e => setSelectedCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-500"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="🔍 Search expense, note, #serial..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-sky-500 min-w-[200px] flex-1 md:flex-initial"
          />

          {viewMode === 'flat' && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-sky-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="ALL">All</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Expense Table / List */}
      {viewMode === 'flat' ? (
        /* Flat Paginated Table */
        <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
          <div className="bg-slate-50 px-5 py-3.5 border-b border-customBorder flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              📄 Expense Records ({filteredExpenses.length} Total)
            </h3>
            <span className="text-xs font-bold text-slate-500">
              Showing {filteredExpenses.length > 0 ? (pageSize === 'ALL' ? 1 : (currentPage - 1) * pageSize + 1) : 0} to{' '}
              {pageSize === 'ALL' ? filteredExpenses.length : Math.min(currentPage * pageSize, filteredExpenses.length)} of{' '}
              {filteredExpenses.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Items / Breakdown</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3">Notes</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedExpenses.map((exp, idx) => {
                  const cat = (categories || []).find(c => c.id === exp.category_id);
                  const catName = cat ? cat.name : 'Uncategorized';
                  return (
                    <tr key={exp.id || idx} className="hover:bg-slate-50/70 transition-all">
                      <td className="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">{exp.expense_date}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-100 text-[11px] font-extrabold">
                          {catName}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 max-w-xs">
                        {Array.isArray(exp.items) && exp.items.length > 0 ? (
                          exp.items.map((line, lidx) => (
                            <div key={lidx} className="text-[11px] text-slate-700 font-semibold truncate">
                              • {line.item_name} {line.qty > 1 ? `(${line.qty} x ₹${line.rate})` : ''}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 font-medium italic">{catName}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-black uppercase text-slate-700 border border-slate-200">
                          {exp.payment_mode || 'Cash'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-medium italic max-w-xs truncate" title={exp.note}>
                        {exp.note || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700 whitespace-nowrap">
                        ₹{Number(exp.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (window.confirm("Sach me ye expense entry delete karni hai?")) {
                              deleteExpense(exp.id);
                            }
                          }}
                          className="text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                        >
                          ✕ Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paginatedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-semibold italic text-xs">
                      No expenses match the current filter or date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && pageSize !== 'ALL' && (
            <div className="bg-slate-50 px-5 py-3 border-t border-customBorder flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs font-bold text-slate-500">
                Page {currentPage} of {totalPages}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  ⏮ First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  ◀ Prev
                </button>

                {/* Page Number Pills */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-sky-600 text-white shadow-soft'
                          : 'bg-white border text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next ▶
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Last ⏭
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grouped Category Breakdown View */
        <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft">
          <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              📂 Category-Wise Expense Groups ({groupedExpenses.list.length} Categories)
            </h3>
            <span className="text-xs font-black text-rose-600">
              Total: ₹{groupedExpenses.grandTotal.toLocaleString()}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {groupedExpenses.list.map(group => (
              <div key={group.categoryName} className="p-5 space-y-3">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">{group.categoryName}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-[10px] font-black text-slate-700">
                      {group.items.length} items
                    </span>
                  </div>
                  <span className="text-sm font-black text-rose-600">
                    Subtotal: ₹{Number(group.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
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
                            {Array.isArray(exp.items) && exp.items.length > 0 ? (
                              exp.items.map((line, idx) => (
                                <div key={idx} className="text-[11px] text-slate-700 font-semibold">
                                  • {line.item_name} {line.qty > 1 ? `(${line.qty} x ₹${line.rate})` : ''}
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-400 font-medium italic">{group.categoryName}</span>
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
      )}

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
  const [customItemName, setCustomItemName] = useState('');
  const [customItemRate, setCustomItemRate] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    return itemsList.reduce((sum, item) => sum + ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)), 0);
  }, [itemsList]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal + (parseFloat(additionalCharges) || 0) - (parseFloat(discount) || 0));
  }, [subtotal, additionalCharges, discount]);

  const handleAddItem = (item) => {
    // Add item with default rate or 0
    setItemsList(prev => [
      ...prev,
      { item_name: item.name, qty: 1, rate: Number(item.default_rate) || 0, amount: Number(item.default_rate) || 0 }
    ]);
    setShowItemPicker(false);
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;
    const rate = parseFloat(customItemRate) || 0;
    setItemsList(prev => [
      ...prev,
      { item_name: customItemName.trim(), qty: 1, rate: rate, amount: rate }
    ]);
    setCustomItemName('');
    setCustomItemRate('');
  };

  const updateLineItem = (idx, field, val) => {
    setItemsList(prev => prev.map((item, i) => {
      if (i === idx) {
        const updated = { ...item, [field]: val };
        const q = parseFloat(field === 'qty' ? val : item.qty) || 0;
        const r = parseFloat(field === 'rate' ? val : item.rate) || 0;
        updated.amount = q * r;
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
      alert("Kripya ek Expense Category select kijiye.");
      return;
    }
    if (itemsList.length === 0) {
      alert("Kripya kam se kam ek Item / Salary detail add kijiye.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        category_id: selectedCat,
        expense_date: expenseDate,
        items: itemsList,
        additional_charges: Number(additionalCharges) || 0,
        discount: Number(discount) || 0,
        total_amount: Number(totalAmount),
        payment_mode: paymentMode,
        note
      });
      alert("✅ Expense successfully record ho gaya!");
      onClose();
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-[99] p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto animate-scaleUp flex flex-col border border-slate-100">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center text-lg font-black">
              💸
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900">Record Business Expense</h3>
              <p className="text-xs text-slate-400 font-semibold">Add operating expenses, fuel, repairs, and staff salaries</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 flex-1">
          
          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
              Expense Category <span className="text-rose-500">*</span>
            </label>
            <select
              required
              className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-3 text-xs font-extrabold text-slate-800 outline-none transition-all"
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
            >
              <option value="">-- Select Expense Category --</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                Expense Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
              >
                <option value="Cash">💵 Cash</option>
                <option value="UPI">📱 UPI (GPay/PhonePe/Paytm)</option>
                <option value="Bank Transfer">💳 Bank Transfer / NEFT</option>
                <option value="Cheque">🏦 Cheque</option>
                <option value="Card">💳 Card</option>
              </select>
            </div>
          </div>

          {/* Expense Items Breakdown Panel */}
          <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50/70 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <div>
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Expense Items & Line Breakdown
                </span>
                <span className="text-[11px] font-semibold text-slate-400">Specify description, quantity and rate/amount</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemPicker(!showItemPicker)}
                  className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1"
                >
                  📋 Pick From Catalog
                </button>
              </div>
            </div>

            {/* Catalog Item Picker Dropdown */}
            {showItemPicker && (
              <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2 max-h-48 overflow-y-auto shadow-md animate-fadeIn">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Select item from catalog:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {expenseItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddItem(item)}
                      className="text-left px-3 py-2 text-xs font-bold hover:bg-sky-50 rounded-xl border border-transparent hover:border-sky-200 transition-all flex items-center justify-between group"
                    >
                      <span className="text-slate-800 group-hover:text-sky-900">• {item.name}</span>
                      {item.default_rate > 0 && (
                        <span className="text-sky-700 font-extrabold text-[11px]">₹{item.default_rate}</span>
                      )}
                    </button>
                  ))}
                  {expenseItems.length === 0 && (
                    <div className="text-xs text-slate-400 col-span-2 py-2 italic">Catalog is empty. You can type custom items below.</div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Item Quick Adder */}
            <div className="flex flex-col sm:flex-row gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
              <input
                type="text"
                placeholder="➕ Or type custom item name (e.g. Manish Driver Salary)..."
                value={customItemName}
                onChange={e => setCustomItemName(e.target.value)}
                className="flex-1 bg-transparent px-3 py-1.5 text-xs font-bold text-slate-800 outline-none w-full"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomItem();
                  }
                }}
              />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  placeholder="Rate (₹)"
                  value={customItemRate}
                  onChange={e => setCustomItemRate(e.target.value)}
                  className="w-24 sm:w-28 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-800 outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomItem();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Table Header for Line Items (Clear distinction of Qty vs Rate vs Amount) */}
            {itemsList.length > 0 && (
              <div className="bg-slate-200/70 rounded-xl px-3.5 py-2 grid grid-cols-12 gap-2 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                <div className="col-span-5 sm:col-span-5">Item / Description</div>
                <div className="col-span-2 sm:col-span-2 text-center">Qty</div>
                <div className="col-span-2 sm:col-span-2 text-center">Rate / Salary (₹)</div>
                <div className="col-span-2 sm:col-span-2 text-right">Amount (₹)</div>
                <div className="col-span-1 sm:col-span-1 text-center">Del</div>
              </div>
            )}

            {/* Line Items Rows */}
            <div className="space-y-2">
              {itemsList.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-12 gap-2 items-center shadow-xs">
                  
                  {/* Item Name */}
                  <div className="col-span-5 sm:col-span-5 min-w-0">
                    <input
                      type="text"
                      className="w-full text-xs font-extrabold text-slate-800 outline-none bg-transparent"
                      value={item.item_name}
                      onChange={e => updateLineItem(idx, 'item_name', e.target.value)}
                    />
                  </div>

                  {/* Quantity Input */}
                  <div className="col-span-2 sm:col-span-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-2 py-1.5 text-xs font-black text-center text-slate-900 outline-none"
                        value={item.qty}
                        onChange={e => updateLineItem(idx, 'qty', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Rate / Salary Input */}
                  <div className="col-span-2 sm:col-span-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Rate ₹"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-2 py-1.5 text-xs font-black text-center text-slate-900 outline-none"
                        value={item.rate}
                        onChange={e => updateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Computed Amount (Never cut off) */}
                  <div className="col-span-2 sm:col-span-2 text-right">
                    <span className="text-xs font-black text-rose-700 block truncate" title={`₹${Number(item.amount).toLocaleString('en-IN')}`}>
                      ₹{Number(item.amount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Delete Action */}
                  <div className="col-span-1 sm:col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(idx)}
                      className="w-7 h-7 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 text-xs font-black flex items-center justify-center transition-all cursor-pointer mx-auto"
                      title="Remove Item"
                    >
                      ✕
                    </button>
                  </div>

                </div>
              ))}

              {itemsList.length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-300 rounded-2xl text-slate-400 text-xs font-semibold">
                  <span>No items added yet. Click <strong>"Pick From Catalog"</strong> or type custom item above.</span>
                </div>
              )}
            </div>
          </div>

          {/* Charges and Discounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                Additional Charges (+)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 outline-none"
                value={additionalCharges}
                onChange={e => setAdditionalCharges(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                Discount (-)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 outline-none"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
              />
            </div>
          </div>

          {/* Note / Remarks */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-600 uppercase tracking-wider block">
              Notes & Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid Manish Bhaiya driver monthly salary, diesel bill etc."
              className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Total Amount & Submit Bottom Bar */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Grand Total Outflow</span>
            <span className="text-2xl font-black text-rose-700 block">
              ₹{Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-7 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-soft hover:shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Recording...' : '💾 Save & Record Expense'}
            </button>
          </div>
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
