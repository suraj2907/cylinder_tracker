import React, { useState, useMemo } from 'react';
import { formatIsoDate } from '../utils/dataUtils';

export default function InventoryManager({
  items = [],
  purchaseBills = [],
  stockAdjustments = [],
  partyItemPrices = [],
  restaurants = [],
  saveItem,
  saveStockAdjustment,
  savePurchaseBill,
  deletePurchaseBill,
  savePartyPrice,
  deletePartyPrice
}) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'purchases'
  
  // Catalog states
  const [catalogSearch, setCatalogSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // item object being edited/viewed
  const [creatingItem, setCreatingItem] = useState(false); // boolean for new item modal

  // Purchase states
  const [recordingPurchase, setRecordingPurchase] = useState(false);
  const [viewingPurchaseBill, setViewingPurchaseBill] = useState(null); // bill object to show print preview

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                            (item.hsn_code && item.hsn_code.includes(catalogSearch));
      const matchesLowStock = !lowStockFilter || (item.current_stock <= (item.low_stock_threshold || 0));
      return matchesSearch && matchesLowStock;
    });
  }, [items, catalogSearch, lowStockFilter]);

  const handleDeleteBill = async (id) => {
    if (window.confirm("Kya aap sach me ye purchase bill delete karna chahte hain? Stock quantity adjust ho jayegi.")) {
      try {
        await deletePurchaseBill(id);
        alert("Purchase bill successfully deleted!");
      } catch (err) {
        alert("Delete fail: " + err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-customBorder shadow-soft">
        <div>
          <h2 className="text-xl font-black text-textSlate flex items-center gap-2">
            📦 Inventory & Stock Catalog
          </h2>
          <p className="text-xs text-muted font-bold mt-1">Manage cylinders, track purchases, custom hotel rates, and adjustments.</p>
        </div>

        <div className="flex bg-slate-100 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'catalog' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📋 Catalog
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'purchases' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🚚 Stock Purchases
          </button>
        </div>
      </div>

      {activeTab === 'catalog' ? (
        <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft flex flex-col">
          {/* Top Filters & Controls */}
          <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <input
                className="bg-white border border-customBorder rounded-xl px-3.5 py-2 text-textSlate placeholder-slate-400 focus:outline-none focus:border-accentCyan text-xs w-full sm:w-48 shadow-sm transition-all"
                placeholder="Search items..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-customBorder px-3 py-2 rounded-xl shadow-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lowStockFilter}
                  onChange={e => setLowStockFilter(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                ⚠️ Low Stock Only
              </label>
            </div>
            
            <button
              onClick={() => setCreatingItem(true)}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              ➕ Create New Item
            </button>
          </div>

          {/* Catalog Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-customBorder bg-slate-50">
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Item Name</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">HSN Code</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Type</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Sales Price</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Purchase Price</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Stock Qty</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const isLow = item.current_stock <= (item.low_stock_threshold || 0);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-semibold">{item.hsn_code || '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black border ${
                          item.item_type === 'service' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {item.item_type || 'product'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right font-bold">
                        ₹{Number(item.default_rate).toFixed(2)}
                        <span className="text-[9px] text-slate-400 font-semibold block">
                          {item.price_includes_tax ? 'tax incl.' : 'tax excl.'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-slate-600">
                        ₹{Number(item.purchase_price).toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-xs text-right font-black ${
                        isLow ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {item.current_stock} units
                        {isLow && <span className="text-[9px] text-rose-500 font-bold block">⚠️ Low Stock</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-[11px] font-extrabold transition-all shadow-xs cursor-pointer"
                        >
                          ✏️ Edit & Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-xs font-semibold text-slate-400">
                      No items found matching the search filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Stock Purchases View */
        <div className="bg-white border border-customBorder rounded-2xl overflow-hidden shadow-soft flex flex-col">
          <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              🚚 Stock Purchase Invoices
            </h3>
            <button
              onClick={() => setRecordingPurchase(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              ➕ Record Purchase Invoice
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-customBorder bg-slate-50">
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Date</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Invoice No</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Supplier</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Items Count</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Total Amount</th>
                  <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseBills.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{p.purchase_date}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-800">{p.invoice_no || `#${p.id}`}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-semibold">{p.supplier_name}</td>
                    <td className="px-4 py-3 text-xs text-right font-semibold text-slate-800">
                      {Array.isArray(p.items) ? p.items.length : 0} items
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-black text-emerald-700">₹{Number(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-xs text-right space-x-2">
                      <button
                        onClick={() => setViewingPurchaseBill(p)}
                        className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-850 hover:bg-sky-100 text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                      >
                        📄 View / Print
                      </button>
                      <button
                        onClick={() => handleDeleteBill(p.id)}
                        className="px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {purchaseBills.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-xs font-semibold text-slate-400">
                      No stock purchase invoices logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Edit & Details Side Panel / Modal */}
      {editingItem && (
        <ItemDetailModal
          item={editingItem}
          restaurants={restaurants}
          partyItemPrices={partyItemPrices}
          stockAdjustments={stockAdjustments}
          purchaseBills={purchaseBills}
          onClose={() => setEditingItem(null)}
          onSave={saveItem}
          onSaveAdjustment={saveStockAdjustment}
          onSavePartyPrice={savePartyPrice}
          onDeletePartyPrice={deletePartyPrice}
        />
      )}

      {/* Create New Item Modal */}
      {creatingItem && (
        <InventoryFormsModal
          mode="createItem"
          items={items}
          onClose={() => setCreatingItem(false)}
          onSaveItem={saveItem}
        />
      )}

      {/* Multi-Item Record Purchase Modal */}
      {recordingPurchase && (
        <PurchaseBillModal
          items={items}
          onClose={() => setRecordingPurchase(false)}
          onSavePurchase={savePurchaseBill}
        />
      )}

      {/* Purchase Invoice Print Modal */}
      {viewingPurchaseBill && (
        <PurchaseInvoicePrintModal
          bill={viewingPurchaseBill}
          onClose={() => setViewingPurchaseBill(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// SUB-COMPONENT: Item Details & Tabs Manager (Modal)
// ----------------------------------------------------
function ItemDetailModal({
  item,
  restaurants,
  partyItemPrices,
  stockAdjustments,
  purchaseBills,
  onClose,
  onSave,
  onSaveAdjustment,
  onSavePartyPrice,
  onDeletePartyPrice
}) {
  const [modalTab, setModalTab] = useState('pricing'); // 'pricing' | 'stock' | 'party' | 'timeline'
  const [name, setName] = useState(item.name);
  const [hsnCode, setHsnCode] = useState(item.hsn_code || '27111900');
  const [itemType, setItemType] = useState(item.item_type || 'product');
  const [defaultRate, setDefaultRate] = useState(item.default_rate || 0);
  const [purchasePrice, setPurchasePrice] = useState(item.purchase_price || 0);
  const [priceIncludesTax, setPriceIncludesTax] = useState(item.price_includes_tax !== false);
  const [gstRate, setGstRate] = useState(item.gst_rate || 18);
  const [gstApplicable, setGstApplicable] = useState(item.gst_applicable !== false);
  const [lowStockThreshold, setLowStockThreshold] = useState(item.low_stock_threshold || 10);
  
  // Custom states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [showPartyPriceModal, setShowPartyPriceModal] = useState(false);
  const [selectedParty, setSelectedParty] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const [saving, setSaving] = useState(false);

  // Filter custom prices for this item
  const itemPartyPrices = useMemo(() => {
    return partyItemPrices.filter(p => p.item_id === item.id);
  }, [partyItemPrices, item.id]);

  // Unified Item Timeline calculations
  const timeline = useMemo(() => {
    const events = [];

    // 1. Purchases from purchaseBills items
    purchaseBills.forEach(pb => {
      if (Array.isArray(pb.items)) {
        pb.items.forEach(line => {
          if (line.item_id === item.id) {
            events.push({
              date: pb.purchase_date,
              type: 'Purchase',
              qty: parseFloat(line.qty),
              detail: `Purchase Invoice #${pb.invoice_no || pb.id} from ${pb.supplier_name || 'Gaspoint'}`,
              rawDate: new Date(pb.purchase_date)
            });
          }
        });
      }
    });

    // 2. Adjustments
    stockAdjustments.filter(a => a.item_id === item.id).forEach(a => {
      events.push({
        date: formatIsoDate(a.created_at),
        type: 'Adjustment',
        qty: parseFloat(a.adjustment_qty),
        detail: `Manual correction: ${a.reason || 'None'}`,
        rawDate: new Date(a.created_at)
      });
    });

    // Sort descending by date
    return events.sort((a, b) => b.rawDate - a.rawDate);
  }, [purchaseBills, stockAdjustments, item.id]);

  const handleUpdateItem = async () => {
    setSaving(true);
    try {
      await onSave({
        id: item.id,
        name,
        hsn_code: hsnCode,
        item_type: itemType,
        default_rate: parseFloat(defaultRate) || 0,
        purchase_price: parseFloat(purchasePrice) || 0,
        price_includes_tax: priceIncludesTax,
        gst_rate: parseFloat(gstRate) || 0,
        gst_applicable: gstApplicable,
        low_stock_threshold: parseFloat(lowStockThreshold) || 0
      });
      alert("Item details successfully updated!");
    } catch (e) {
      alert("Failed to update item: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!adjustQty) return;
    try {
      await onSaveAdjustment(item.id, adjustQty, adjustReason);
      setShowAdjustModal(false);
      setAdjustQty('');
      setAdjustReason('');
    } catch (e) {
      alert("Adjustment failed: " + e.message);
    }
  };

  const handleAddPartyPrice = async () => {
    if (!selectedParty || !customPrice) return;
    try {
      await onSavePartyPrice(selectedParty, item.id, customPrice);
      setShowPartyPriceModal(false);
      setSelectedParty('');
      setCustomPrice('');
    } catch (e) {
      alert("Custom pricing failed: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99] p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto relative animate-fadeIn flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-900">📦 {item.name} Details</h3>
            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">HSN: {item.hsn_code || '27111900'}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
        </div>

        {/* Edit fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Item Name</label>
            <input
              className="mt-1 w-full border border-customBorder bg-white rounded-xl px-3 py-2 text-xs font-bold"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">HSN Code</label>
            <input
              className="mt-1 w-full border border-customBorder bg-white rounded-xl px-3 py-2 text-xs font-bold"
              value={hsnCode}
              onChange={e => setHsnCode(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Item Type</label>
            <div className="mt-1 flex bg-slate-200 rounded-xl p-1">
              <button
                onClick={() => setItemType('product')}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  itemType === 'product' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Product
              </button>
              <button
                onClick={() => setItemType('service')}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  itemType === 'service' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Service
              </button>
            </div>
          </div>
        </div>

        {/* Tab switch inside Edit Modal */}
        <div className="flex border-b border-slate-200 gap-4 text-xs font-bold shrink-0">
          {[
            { id: 'pricing', label: '💰 Pricing & Tax' },
            { id: 'stock', label: '📊 Adjust Stock' },
            { id: 'party', label: '🏪 Hotel Prices' },
            { id: 'timeline', label: '🕒 Timeline' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setModalTab(t.id)}
              className={`pb-2 transition-all cursor-pointer ${
                modalTab === t.id ? 'border-b-2 border-sky-600 text-sky-700 font-extrabold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab contents */}
        <div className="flex-1 overflow-y-auto min-h-[250px]">
          {modalTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Sales Price (Rate)</label>
                  <input
                    type="number"
                    className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                    value={defaultRate}
                    onChange={e => setDefaultRate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Purchase Price</label>
                  <input
                    type="number"
                    className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={priceIncludesTax}
                      onChange={e => setPriceIncludesTax(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    Sales Price Includes Tax
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gstApplicable}
                      onChange={e => setGstApplicable(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    GST Tax Applicable
                  </label>
                </div>
              </div>

              {gstApplicable && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">GST Rate (%)</label>
                    <select
                      className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                      value={gstRate}
                      onChange={e => setGstRate(e.target.value)}
                    >
                      <option value={0}>0% (Tax Free)</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18% (LPG standard)</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Low Stock Limit (Warning)</label>
                    <input
                      type="number"
                      className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                      value={lowStockThreshold}
                      onChange={e => setLowStockThreshold(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleUpdateItem}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving..." : "💾 Save Pricing Configuration"}
              </button>
            </div>
          )}

          {modalTab === 'stock' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Current Stock</span>
                  <span className="text-xl font-black text-slate-900">{item.current_stock} units</span>
                </div>
                <button
                  onClick={() => setShowAdjustModal(true)}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  🛠️ Adjust Stock Manual
                </button>
              </div>

              {/* Adjust Stock modal overlay */}
              {showAdjustModal && (
                <div className="p-4 border border-orange-200 rounded-2xl bg-orange-50/50 space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-orange-800 uppercase tracking-wide">Manual Stock Adjustment</h4>
                    <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Qty (e.g. +5 or -3)"
                      className="border border-customBorder bg-white rounded-xl px-3 py-1.5 text-xs font-bold"
                      value={adjustQty}
                      onChange={e => setAdjustQty(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Reason (e.g. Broken valve)"
                      className="border border-customBorder bg-white rounded-xl px-3 py-1.5 text-xs font-bold"
                      value={adjustReason}
                      onChange={e => setAdjustReason(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleAddAdjustment}
                    className="w-full py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 cursor-pointer"
                  >
                    Apply Adjustment
                  </button>
                </div>
              )}
            </div>
          )}

          {modalTab === 'party' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="text-xs font-bold text-slate-600 uppercase">Hotel Specific Custom Pricing</h4>
                <button
                  onClick={() => setShowPartyPriceModal(true)}
                  className="text-xs font-black text-sky-700 hover:underline cursor-pointer"
                >
                  + Add Custom Price
                </button>
              </div>

              {showPartyPriceModal && (
                <div className="p-4 border border-sky-200 rounded-2xl bg-sky-50/50 space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-sky-800 uppercase tracking-wide">Set Hotel Custom Rate</h4>
                    <button onClick={() => setShowPartyPriceModal(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="border border-customBorder bg-white rounded-xl px-3 py-1.5 text-xs font-bold"
                      value={selectedParty}
                      onChange={e => setSelectedParty(e.target.value)}
                    >
                      <option value="">Select Hotel...</option>
                      {restaurants.map(r => (
                        <option key={r.name} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Price override (₹)"
                      className="border border-customBorder bg-white rounded-xl px-3 py-1.5 text-xs font-bold"
                      value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleAddPartyPrice}
                    className="w-full py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 cursor-pointer"
                  >
                    Save Hotel Pricing
                  </button>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-3 py-2 text-[10px] font-bold text-mutedSlate uppercase">Hotel</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-mutedSlate uppercase text-right">Custom Price</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-mutedSlate uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemPartyPrices.map(p => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-bold text-slate-800">{p.restaurant_name}</td>
                        <td className="px-3 py-2 font-black text-slate-900 text-right">₹{Number(p.price).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => onDeletePartyPrice(p.id)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {itemPartyPrices.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-4 text-slate-400 italic">No custom hotel rates set.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modalTab === 'timeline' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase">Item Timeline (Stock Log)</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-3 py-2 text-[10px] font-bold text-mutedSlate uppercase">Date</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-mutedSlate uppercase">Event</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-mutedSlate uppercase">Details</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-mutedSlate uppercase text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {timeline.map((ev, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-semibold text-slate-600">{ev.date}</td>
                        <td className="px-3 py-2 font-bold">
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black border ${
                            ev.type === 'Purchase' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            ev.type === 'Adjustment' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>
                            {ev.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{ev.detail}</td>
                        <td className={`px-3 py-2 font-black text-right ${ev.qty >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {ev.qty >= 0 ? `+${ev.qty}` : ev.qty}
                        </td>
                      </tr>
                    ))}
                    {timeline.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-slate-400 italic">No timeline events logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// SUB-COMPONENT: Forms Modal (Item Creation Form Only)
// ----------------------------------------------------
function InventoryFormsModal({ mode, items, onClose, onSaveItem }) {
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('27111900');
  const [defaultRate, setDefaultRate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [lowStockLimit, setLowStockLimit] = useState('5');
  const [itemType, setItemType] = useState('product');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      await onSaveItem({
        name,
        hsn_code: hsnCode,
        default_rate: parseFloat(defaultRate) || 0,
        purchase_price: parseFloat(purchasePrice) || 0,
        low_stock_threshold: parseFloat(lowStockLimit) || 0,
        item_type: itemType,
        gst_applicable: true,
        gst_rate: 18
      });
      alert("New item added to catalog!");
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99] p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-fadeIn">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-base font-black text-slate-900">➕ Create New Catalog Item</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Item Name</label>
            <input
              required
              className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 19.2kg Cylinder"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">HSN Code</label>
              <input
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
              <select
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold bg-white"
                value={itemType}
                onChange={e => setItemType(e.target.value)}
              >
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Sales Rate (₹)</label>
              <input
                type="number"
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                value={defaultRate}
                onChange={e => setDefaultRate(e.target.value)}
                placeholder="2900"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Purchase Price (₹)</label>
              <input
                type="number"
                className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                placeholder="2500"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Low Stock Limit (Warning)</label>
            <input
              type="number"
              className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-xs font-bold"
              value={lowStockLimit}
              onChange={e => setLowStockLimit(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Processing...' : 'Create Catalog Item'}
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// SUB-COMPONENT: Multi-Item Purchase Bill Modal
// ----------------------------------------------------
function PurchaseBillModal({ items, onClose, onSavePurchase }) {
  const [supplierName, setSupplierName] = useState('Gaspoint Petroleum (India) Limited');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [purchaseNote, setPurchaseNote] = useState('');
  
  // Multiple line items array
  const [purchaseLines, setPurchaseLines] = useState([
    { item_id: '', qty: 1, rate: 0, gst_rate: 18 }
  ]);

  const [saving, setSaving] = useState(false);

  const handleLineItemChange = (idx, itemId) => {
    const matched = items.find(i => i.id === itemId);
    const matchedPrice = matched ? parseFloat(matched.purchase_price || 0) : 0;
    const matchedGst = matched ? parseFloat(matched.gst_rate || 18) : 18;
    setPurchaseLines(prev => prev.map((ln, i) => (
      i === idx ? { ...ln, item_id: itemId, rate: matchedPrice, gst_rate: matchedGst } : ln
    )));
  };

  const handleLineValueChange = (idx, field, value) => {
    setPurchaseLines(prev => prev.map((ln, i) => (
      i === idx ? { ...ln, [field]: value } : ln
    )));
  };

  const addLineRow = () => {
    setPurchaseLines(prev => [...prev, { item_id: '', qty: 1, rate: 0, gst_rate: 18 }]);
  };

  const removeLineRow = (idx) => {
    setPurchaseLines(prev => prev.filter((_, i) => i !== idx));
  };

  // Compute calculated values
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalGst = 0;

    purchaseLines.forEach(ln => {
      const qty = parseFloat(ln.qty) || 0;
      const rate = parseFloat(ln.rate) || 0;
      const lineTaxable = qty * rate; // Rate is exclusive of tax
      const lineGst = lineTaxable * (parseFloat(ln.gst_rate || 18) / 100);

      subtotal += lineTaxable;
      totalGst += lineGst;
    });

    return {
      subtotal,
      cgst: totalGst / 2,
      sgst: totalGst / 2,
      total: subtotal + totalGst
    };
  }, [purchaseLines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (purchaseLines.length === 0 || purchaseLines.some(ln => !ln.item_id || !ln.qty || ln.rate === '')) {
      alert("Sabhi items select karein aur rate/qty fill karein!");
      return;
    }
    setSaving(true);
    try {
      const itemsList = purchaseLines.map(ln => {
        const itemObj = items.find(i => i.id === ln.item_id);
        const taxable = ln.qty * ln.rate;
        const lineTax = taxable * (parseFloat(ln.gst_rate || 18) / 100);
        return {
          item_id: ln.item_id,
          item_name: itemObj ? itemObj.name : 'Unknown',
          qty: ln.qty,
          rate: ln.rate,
          amount: taxable + lineTax,
          gst_rate: ln.gst_rate
        };
      });

      await onSavePurchase({
        supplier_name: supplierName,
        purchase_date: purchaseDate,
        items: itemsList,
        subtotal: calculations.subtotal,
        taxable_amount: calculations.subtotal,
        cgst: calculations.cgst,
        sgst: calculations.sgst,
        total_amount: calculations.total,
        invoice_no: invoiceNo,
        note: purchaseNote
      });

      alert("Purchase invoice successfully recorded and stock updated!");
      onClose();
    } catch (err) {
      alert("Failed to save purchase: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99] p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 space-y-4 animate-fadeIn flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3 shrink-0">
          <h3 className="text-base font-black text-slate-900">🚚 Record Stock Purchase Invoice</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
        </div>

        {/* Invoice Header details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 shrink-0">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Supplier Name</label>
            <input
              required
              className="mt-1 w-full border border-customBorder bg-white rounded-xl px-3 py-2 text-xs font-bold"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="e.g. Gaspoint Petroleum"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Purchase Invoice #</label>
            <input
              className="mt-1 w-full border border-customBorder bg-white rounded-xl px-3 py-2 text-xs font-bold"
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value)}
              placeholder="e.g. 145"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Purchase Date</label>
            <input
              type="date"
              required
              className="mt-1 w-full border border-customBorder bg-white rounded-xl px-3 py-1.5 text-xs font-bold"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Purchase Line Items (Rates are tax exclusive)</span>
            <button type="button" onClick={addLineRow} className="text-xs font-black text-sky-700 hover:underline">+ Add Item Row</button>
          </div>

          <div className="space-y-2">
            {purchaseLines.map((ln, i) => (
              <div key={i} className="flex gap-2.5 items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-200">
                <select
                  required
                  className="flex-[2] border border-customBorder bg-white rounded-lg px-2.5 py-1.5 text-xs font-bold w-full"
                  value={ln.item_id}
                  onChange={e => handleLineItemChange(i, e.target.value)}
                >
                  <option value="">Choose item...</option>
                  {items.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Qty"
                  required
                  className="w-16 border border-customBorder bg-white rounded-lg px-2 py-1 text-xs font-bold text-center"
                  value={ln.qty}
                  onChange={e => handleLineValueChange(i, 'qty', parseInt(e.target.value) || 0)}
                />

                <input
                  type="number"
                  placeholder="Rate (Excl.)"
                  required
                  step="0.01"
                  className="w-24 border border-customBorder bg-white rounded-lg px-2 py-1 text-xs font-bold text-center"
                  value={ln.rate}
                  onChange={e => handleLineValueChange(i, 'rate', parseFloat(e.target.value) || 0)}
                />

                <select
                  className="w-20 border border-customBorder bg-white rounded-lg px-2 py-1 text-xs font-bold bg-white"
                  value={ln.gst_rate}
                  onChange={e => handleLineValueChange(i, 'gst_rate', parseFloat(e.target.value) || 18)}
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>

                <span className="text-xs font-black text-slate-700 w-24 text-right">
                  ₹{((ln.qty * ln.rate) * (1 + ln.gst_rate / 100)).toFixed(2)}
                </span>

                {purchaseLines.length > 1 && (
                  <button type="button" onClick={() => removeLineRow(i)} className="text-red-500 hover:text-red-750 font-bold text-xs px-1">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes & Totals block */}
        <div className="grid grid-cols-2 gap-4 border-t pt-3.5 shrink-0 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Purchase Note / Reference</label>
            <textarea
              className="w-full border border-customBorder rounded-xl px-3 py-1.5 text-xs font-bold bg-white"
              rows={2}
              value={purchaseNote}
              onChange={e => setPurchaseNote(e.target.value)}
              placeholder="e.g. Received via Vehicle CG-04-1234..."
            />
          </div>

          <div className="space-y-1.5 text-right font-semibold text-slate-500">
            <div className="flex justify-between">
              <span>Taxable Subtotal</span>
              <span>₹{calculations.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>CGST (9% approx)</span>
              <span>₹{calculations.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST (9% approx)</span>
              <span>₹{calculations.sgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-slate-900 border-t pt-1.5">
              <span>Total Amount (Paid)</span>
              <span className="text-emerald-700">₹{calculations.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? 'Saving Purchase Invoice...' : '🚚 Save & Add to Stock'}
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// SUB-COMPONENT: Purchase Invoice Print Preview Modal
// ----------------------------------------------------
function PurchaseInvoicePrintModal({ bill, onClose }) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99] p-4 overflow-y-auto no-print-modal">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 relative flex flex-col max-h-[95vh]">
        
        {/* Controls */}
        <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0 no-print">
          <button onClick={onClose} className="text-sm font-bold text-sky-700 hover:underline cursor-pointer">
            ← Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer shadow-sm"
          >
            🖨️ Print Purchase Invoice
          </button>
        </div>

        {/* Printable Area */}
        <div id="bill-print-area" className="flex-1 overflow-y-auto p-4 border border-slate-200 rounded-2xl bg-white leading-relaxed">
          <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">M/S SHREE BALAJI AGENCIES</h2>
              <p className="text-[10px] text-slate-500 mt-1">Kamthi Line Beside SBI ATM, Rajnandgaon, Chhattisgarh, 491441</p>
              <p className="text-[10px] text-slate-500">📞 9407922288 | GSTIN: 22SNZPS3600E1ZH</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-lg uppercase">
                Purchase Invoice
              </span>
            </div>
            <div className="text-right text-[10px] font-bold text-slate-700 space-y-1">
              <div>Invoice No: <span className="font-black text-slate-900">{bill.invoice_no || `#${bill.id}`}</span></div>
              <div>Purchase Date: {bill.purchase_date}</div>
              <div>Filer: {bill.created_by || 'Suraj'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[11px] mb-4">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Supplier / Billed From</p>
              <p className="font-extrabold text-slate-900 text-xs">{bill.supplier_name}</p>
              <p className="text-slate-500 mt-0.5">66/67 GR, SILTARA GROWTH CENTRE, PHASE - 2, SILTARA, RAIPUR, Chhattisgarh, 493111</p>
              <p className="text-slate-500 font-semibold">GSTIN: 22AABCG0745J2ZX | PAN: AABCG0745J</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Billed To (Recipient)</p>
              <p className="font-extrabold text-slate-900 text-xs">M/S SHREE BALAJI AGENCIES</p>
              <p className="text-slate-500 mt-0.5">Kamthi Line Beside SBI ATM, Rajnandgaon, Chhattisgarh, 491441</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-xs border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-slate-350 font-bold text-slate-650 bg-slate-50/50">
                <th className="py-2 px-1">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Rate (Excl.)</th>
                <th className="py-2 text-right">Tax %</th>
                <th className="py-2 text-right px-1">Line Total (Incl.)</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(bill.items) && bill.items.map((it, idx) => (
                <tr key={idx} className="border-b border-slate-100 text-slate-800">
                  <td className="py-2 px-1 font-bold">{it.item_name}</td>
                  <td className="py-2 text-right font-black text-slate-900">{it.qty} PCS</td>
                  <td className="py-2 text-right">₹{Number(it.rate).toFixed(2)}</td>
                  <td className="py-2 text-right">{it.gst_rate}%</td>
                  <td className="py-2 text-right px-1 font-black text-slate-900">
                    ₹{Number(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div className="flex justify-end pt-2 border-t">
            <div className="w-64 space-y-1.5 text-xs text-right text-slate-500 font-semibold">
              <div className="flex justify-between">
                <span>Subtotal (Taxable)</span>
                <span className="text-slate-800">₹{Number(bill.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (9%)</span>
                <span className="text-slate-800">₹{Number(bill.cgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (9%)</span>
                <span className="text-slate-800">₹{Number(bill.sgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-900 border-t pt-1.5">
                <span>Grand Total</span>
                <span className="text-emerald-700">₹{Number(bill.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 text-[9px] text-slate-400 space-y-0.5 leading-relaxed font-semibold italic">
            <p>1. Input Tax Credit (ITC) has been calculated for dynamic GSTR-3B filings.</p>
            <p>2. Stock addition has been successfully allocated to live inventory stock.</p>
            <p>3. Note: {bill.note || 'None'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
