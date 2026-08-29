import React, { useState, lazy, Suspense, useMemo } from 'react';
import { LayoutGrid, Users, Calendar, BarChart3, Boxes } from 'lucide-react';
import Dashboard from './components/Dashboard';
import RestaurantsList from './components/RestaurantsList';
import BatchesList from './components/BatchesList';
import AddEntry from './components/AddEntry';
import ReceivePaymentModal from './components/ReceivePaymentModal';
import { PaymentLedger } from './components/PaymentLedger';
import { PartnerActivityFeed } from './components/PartnerActivityFeed';
import { useUser } from './context/UserContext';
import { useHashNavigation } from './hooks/useHashNavigation';
import { useCylinderData } from './hooks/useCylinderData';
import { useBilling } from './hooks/useBilling';
import Login from './components/Login';
import PublicLedgerView from './components/PublicLedgerView';
import { useInventory } from './hooks/useInventory';
import { useExpenses } from './hooks/useExpenses';

// Auto-retry helper for dynamic lazy imports when a new build is deployed
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        return new Promise(() => {}); // never resolves as page is reloading
      }
      throw error;
    }
  });

// Lazy load secondary tabs with auto-retry on build changes
const CalendarView = lazyWithRetry(() => import('./components/CalendarView'));
const GenerateBill = lazyWithRetry(() => import('./components/GenerateBill'));
const InventoryManager = lazyWithRetry(() => import('./components/InventoryManager'));
const ExpenseTracker = lazyWithRetry(() => import('./components/ExpenseTracker'));
const SalesSummaryDashboard = lazyWithRetry(() => import('./components/SalesSummaryDashboard'));
const ProfitLossReport = lazyWithRetry(() => import('./components/ProfitLossReport'));
const Gstr3bReport = lazyWithRetry(() => import('./components/Gstr3bReport'));
const OutstandingBills = lazyWithRetry(() => import('./components/OutstandingBills'));

export default function App() {
  const { session, currentUser, logout, loading: authLoading } = useUser();
  const { tab, setTab, TABS } = useHashNavigation();
  const {
    batches,
    payments,
    activities,
    showActivityFeed,
    setShowActivityFeed,
    selectedDate,
    setSelectedDate,
    search,
    setSearch,
    sortBy,
    setSortBy,
    batchSearch,
    setBatchSearch,
    newEntry,
    setNewEntry,
    toast,
    loading,
    syncing,
    restMap,
    dateMap,
    batchStats,
    restaurants,
    tot21,
    tot192,
    totEmpty,
    totEmpty21,
    totEmpty192,
    totAll,
    totOutstanding,
    filteredBatches,
    netBookingWallet,
    handleDownload,
    handleAdd,
    handleDeleteEntry,
    handleDeleteBatch,
    removeDeliveryEntries,
    handleAddPayment,
    handleDeletePayment,
    handleUpdateBatchCost
  } = useCylinderData(currentUser);

  const {
    items: itemsCatalog,
    purchaseBills,
    stockAdjustments,
    partyItemPrices,
    itemStockLedger,
    saveItem,
    saveStockAdjustment,
    savePurchaseBill,
    deletePurchaseBill,
    savePartyPrice,
    deletePartyPrice,
    deductStock,
    restoreStock
  } = useInventory(currentUser);

  const {
    restaurantProfiles,
    bills,
    legacyLedgerEntries,
    nextSuggestedInvoiceNo,
    saveRestaurantProfile,
    createBill,
    deleteBill,
    recordBillPayment
  } = useBilling(currentUser, handleAdd, removeDeliveryEntries, deductStock, restoreStock);

  const {
    categories: expenseCategories,
    expenseItems,
    expenses,
    saveCategory,
    deleteCategory,
    saveExpenseItem,
    deleteExpenseItem,
    saveExpense,
    deleteExpense
  } = useExpenses(currentUser);

  const [showReceivePaymentModal, setShowReceivePaymentModal] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  // Compute low stock items for real-time commercial cylinders alerts (19.2kg & 21kg)
  const lowStockItems = useMemo(() => {
    return (itemsCatalog || []).filter(item => {
      const n = (item.name || '').toLowerCase();
      // Focus on active commercial filled cylinders
      const isCommercial = n.includes('19.2') || n.includes('21');
      if (!isCommercial) return false;
      const threshold = item.low_stock_threshold !== undefined ? item.low_stock_threshold : 5;
      return (item.current_stock || 0) <= threshold;
    });
  }, [itemsCatalog]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin"></div>
        <div className="text-xs font-bold text-slate-800 bg-white px-4 py-2 rounded-xl shadow-soft border border-slate-100">
          Loading Partner Session...
        </div>
      </div>
    );
  }

  // Public Ledger View (No login required)
  const urlParams = new URLSearchParams(window.location.search);
  const publicToken = urlParams.get('ledger');
  if (publicToken) {
    return <PublicLedgerView token={publicToken} />;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-inter">
      {/* Toast Notification (Top floating so it never covers mobile bottom navigation) */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-2xl font-black text-xs z-[9999] shadow-xl border border-white/20 transition-all animate-fadeIn ${
          toast.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999] flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin"></div>
          <div className="text-xs font-bold text-slate-800 bg-white px-4 py-2 rounded-xl shadow-soft">
            Connecting to Database...
          </div>
        </div>
      )}

      {/* LIGHT EXECUTIVE HEADER */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-3 md:px-6 py-2.5 md:py-3 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Brand & Partner Identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* LPG Cylinder Icon Badge */}   
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white p-0.5 shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 512 512" className="w-full h-full">
                <path d="M 190 75 C 190 60 205 50 225 50 L 287 50 C 307 50 322 60 322 75 L 322 110 L 190 110 Z" fill="none" stroke="#dc2626" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="236" y="75" width="40" height="35" rx="6" fill="#fbbf24"/>
                <path d="M 165 190 C 165 125 202 112 256 112 C 310 112 347 125 347 190 L 347 205 L 165 205 Z" fill="#10b981"/>
                <path d="M 165 205 L 347 205 L 347 345 C 347 385 312 400 256 400 C 200 400 165 385 165 345 Z" fill="#ef4444"/>
                <path d="M 190 400 L 322 400 C 322 420 305 430 285 430 L 227 430 C 207 430 190 420 190 400 Z" fill="#ffffff"/>
                <path d="M 256 165 C 256 165 298 215 298 255 C 298 280 279 300 256 300 C 233 300 214 280 214 255 C 214 215 256 165 256 165 Z" fill="#ffffff"/>
                <path d="M 256 200 C 256 200 280 230 280 255 C 280 270 270 280 256 280 C 242 280 232 270 232 255 C 232 230 256 200 256 200 Z" fill="#1d4ed8"/>
                <path d="M 256 230 C 256 230 268 245 268 255 C 268 262 262 268 256 268 C 250 268 244 262 244 255 C 244 245 256 230 256 230 Z" fill="#f59e0b"/>
                <g transform="translate(36, 420)">
                  <rect x="0" y="0" width="440" height="60" rx="16" fill="#FFFFFF"/>
                  <text x="200" y="40" fontFamily="'Arial Black', 'Inter', sans-serif" fontWeight="900" fontSize="20" fill="#0b1329" textAnchor="middle" letterSpacing="2">SHREE BALAJI AGENCIES</text>
                </g>
              </svg>
            </div>
            
            {/* Full Agency & Gaspoint Branding */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm md:text-base font-black tracking-tight text-slate-900 truncate">
                  Shree Balaji Agencies
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span> Live Sync
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 truncate">
                Gaspoint Petroleum • LPG Distributor
              </p>
            </div>
          </div>

          {/* User Partner Badge & Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Quick Receive Payment Modal Trigger */}
            <button
              onClick={() => setShowReceivePaymentModal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black transition-all shadow-soft flex items-center gap-1 cursor-pointer shrink-0"
              title="Receive Party Payment"
            >
              <span>💳</span>
              <span className="hidden sm:inline">Receive Payment</span>
              <span className="inline sm:hidden">Pay</span>
            </button>

            {/* Quick Add Entry Trigger */}
            <button
              onClick={() => setTab("add")}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-black transition-all shadow-soft flex items-center gap-1 cursor-pointer shrink-0"
              title="Add Supply / Khali Entry"
            >
              <span>➕</span>
              <span className="hidden sm:inline">Add Entry</span>
              <span className="inline sm:hidden">Entry</span>
            </button>

            {/* Activity Stream Drawer Button (Visible on Tablet/Desktop) */}
            <button
              onClick={() => setShowActivityFeed(!showActivityFeed)}
              className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold transition-all shadow-xs items-center gap-1 cursor-pointer"
              title="Recent Operations Log"
            >
              <span>🔔</span>
              <span className="hidden md:inline">Log</span>
              <span className="px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black">
                {activities.length}
              </span>
            </button>

            {/* Secure Partner User Info & Sign Out Pill (Desktop & Tablet) */}
            <div className="hidden sm:flex items-center p-0.5 md:p-1 bg-slate-100 rounded-xl gap-0.5 md:gap-1">
              <span className="px-2 py-0.5 bg-white text-slate-900 rounded-lg text-[11px] md:text-xs font-extrabold shadow-xs">
                {currentUser === 'Suraj' ? '👨‍💼 Suraj' : '👨‍💻 Shivam'}
              </span>
              <button
                onClick={logout}
                className="px-1 py-0.5 text-[10px] font-bold text-red-600 hover:text-red-800 uppercase cursor-pointer"
                title="Sign out"
              >
                ✕
              </button>
            </div>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              onClick={() => setShowMobileNav(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white active:scale-95 text-xs font-black transition-all shadow-soft flex items-center justify-center cursor-pointer"
              title="Open Navigation Menu"
            >
              <span className="text-base leading-none">☰</span>
            </button>
          </div>
        </div>

        {/* Desktop Tab Navigation Pills */}
        <div className="max-w-7xl mx-auto hidden lg:flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-slate-100">
          {TABS.map(t => (
            <button 
              key={t.id} 
              className={`px-3 py-1.2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                tab === t.id 
                  ? 'bg-sky-600 text-white shadow-soft' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              onClick={() => setTab(t.id)}>
              <span>{t.label}</span>
              {t.id === 'inventory' && lowStockItems.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] rounded-full font-black animate-pulse">
                  {lowStockItems.length} Low
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile Quick Header Bar with Active Module & Full Menu Trigger */}
        <div className="flex lg:hidden items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setShowMobileNav(true)}
            className="flex-1 flex items-center justify-between px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/90 active:scale-[0.99] border border-slate-200 rounded-xl text-xs font-black text-slate-800 transition-all shadow-2xs cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-slate-400 font-bold uppercase text-[9px]">VIEWING:</span>
              <span className="truncate text-sky-900">{TABS.find(t => t.id === tab)?.label || '📊 Dashboard'}</span>
            </div>
            <span className="text-slate-700 font-black text-[11px] shrink-0 flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
              All Tabs ☰
            </span>
          </button>
        </div>
      </div>

      {/* Real-time Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 md:px-6 py-2 text-xs font-bold text-amber-950 flex items-center justify-between gap-2 animate-fadeIn">
          <div className="max-w-7xl mx-auto flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-[11px] truncate">
                <strong>Low Stock:</strong> {lowStockItems.map(i => `${i.name} (${i.current_stock || 0} left)`).join(', ')}
              </span>
            </div>
            <button
              onClick={() => setTab('inventory')}
              className="px-2.5 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-wider cursor-pointer shadow-xs shrink-0"
            >
              Stock →
            </button>
          </div>
        </div>
      )}

      {/* Activity Feed Drawer Popup */}
      {showActivityFeed && (
        <div className="max-w-7xl mx-auto p-4 animate-fadeIn">
          <PartnerActivityFeed 
            activities={activities} 
            onClose={() => setShowActivityFeed(false)} 
            />
        </div>
      )}

      {/* MAIN CONTAINER (with pb-28 so mobile content is never hidden behind bottom nav) */}
      <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6 pb-28 lg:pb-8">

        {/* ACTIVE TAB CONTENT */}
        <Suspense fallback={
          <div className="bg-white border border-customBorder rounded-2xl p-12 text-center shadow-soft animate-pulse">
            <div className="text-sm font-extrabold text-sky-700 uppercase tracking-wider">⚡ Loading view...</div>
          </div>
        }>
          <div key={tab} className="animate-fadeIn">
            {tab === "dashboard" && <Dashboard restaurants={restaurants} batchStats={batchStats} restMap={restMap} totAll={totAll} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totOutstanding={totOutstanding} restaurantProfiles={restaurantProfiles} bills={bills} payments={payments} purchaseBills={purchaseBills} legacyLedgerEntries={legacyLedgerEntries} setTab={setTab} />}
            {tab === "restaurants" && <RestaurantsList restaurants={restaurants} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totEmpty21={totEmpty21} totEmpty192={totEmpty192} totAll={totAll} totOutstanding={totOutstanding} search={search} setSearch={setSearch} sortBy={sortBy} setSortBy={setSortBy} batches={batches} payments={payments} handleDeleteEntry={handleDeleteEntry} onDeletePayment={handleDeletePayment} restaurantProfiles={restaurantProfiles} onSaveRestaurantProfile={saveRestaurantProfile} bills={bills} legacyLedgerEntries={legacyLedgerEntries} deleteBill={deleteBill} removeDeliveryEntries={removeDeliveryEntries} />}
            {tab === "billing" && <GenerateBill restaurants={restaurants} restaurantProfiles={restaurantProfiles} createBill={createBill} itemsCatalog={itemsCatalog} partyItemPrices={partyItemPrices} bills={bills} payments={payments} nextSuggestedInvoiceNo={nextSuggestedInvoiceNo} batches={batches} legacyLedgerEntries={legacyLedgerEntries} />}
            {tab === "outstandingBills" && <OutstandingBills bills={bills} recordBillPayment={recordBillPayment} />}
            {tab === "inventory" && <InventoryManager items={itemsCatalog} purchaseBills={purchaseBills} stockAdjustments={stockAdjustments} partyItemPrices={partyItemPrices} restaurants={restaurants} saveItem={saveItem} saveStockAdjustment={saveStockAdjustment} savePurchaseBill={savePurchaseBill} deletePurchaseBill={deletePurchaseBill} savePartyPrice={savePartyPrice} deletePartyPrice={deletePartyPrice} />}
            {tab === "expenses" && <ExpenseTracker categories={expenseCategories} expenseItems={expenseItems} expenses={expenses} saveCategory={saveCategory} deleteCategory={deleteCategory} saveExpenseItem={saveExpenseItem} deleteExpenseItem={deleteExpenseItem} saveExpense={saveExpense} deleteExpense={deleteExpense} />}
            {tab === "salesReport" && <SalesSummaryDashboard bills={bills} restaurants={restaurants} deleteBill={deleteBill} />}
            {tab === "profitLoss" && <ProfitLossReport items={itemsCatalog} purchaseBills={purchaseBills} stockAdjustments={stockAdjustments} bills={bills} expenses={expenses} itemStockLedger={itemStockLedger} />}
            {tab === "gstReport" && <Gstr3bReport items={itemsCatalog} purchaseBills={purchaseBills} bills={bills} />}
            {tab === "payments" && <PaymentLedger payments={payments} onAddPayment={handleAddPayment} onDeletePayment={handleDeletePayment} batches={batches} onUpdateBatchCost={handleUpdateBatchCost} restMap={restMap} />}
            {tab === "calendar" && <CalendarView dateMap={dateMap} selectedDate={selectedDate} setSelectedDate={setSelectedDate} handleDeleteEntry={handleDeleteEntry} payments={payments} batches={batches} bills={bills} deleteBill={deleteBill} removeDeliveryEntries={removeDeliveryEntries} restaurantProfiles={restaurantProfiles} onDeletePayment={handleDeletePayment} />}
            {tab === "batches" && <BatchesList filteredBatches={filteredBatches} batchSearch={batchSearch} setBatchSearch={setBatchSearch} handleDeleteBatch={handleDeleteBatch} handleUpdateBatchCost={handleUpdateBatchCost} handleAdd={handleAdd} batches={batches} />}
            {tab === "add" && <AddEntry newEntry={newEntry} setNewEntry={setNewEntry} handleAdd={handleAdd} restMap={restMap} batches={batches} />}
          </div>
        </Suspense>

        <ReceivePaymentModal
          isOpen={showReceivePaymentModal}
          onClose={() => setShowReceivePaymentModal(false)}
          restaurants={restaurants}
          restaurantProfiles={restaurantProfiles}
          bills={bills}
          payments={payments}
          batches={batches}
          legacyLedgerEntries={legacyLedgerEntries}
          onPaymentSuccess={(payPayload) => {
            if (payPayload && handleAddPayment) handleAddPayment(payPayload);
          }}
        />

        {/* FULL-FEATURED MOBILE NAVIGATION DRAWER */}
        {showMobileNav && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end no-print animate-fadeIn">
            <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-slideInRight">
              
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    🔥
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Shree Balaji Agencies</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Gaspoint Petroleum • Navigation</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileNav(false)}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-black cursor-pointer transition-all active:scale-95"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-4 space-y-4 flex-1">
                
                {/* Active Partner Info Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-black text-base">
                      {currentUser === 'Suraj' ? '👨‍💼' : '👨‍💻'}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">{currentUser}</div>
                      <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Partner Logged In
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { logout(); setShowMobileNav(false); }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-black border border-rose-200 flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    Logout ✕
                  </button>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setShowReceivePaymentModal(true); setShowMobileNav(false); }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-soft flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    💳 Receive Pay
                  </button>
                  <button
                    onClick={() => { setTab("add"); setShowMobileNav(false); }}
                    className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-black shadow-soft flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    ➕ Add Entry
                  </button>
                </div>

                {/* Categorized Modules List */}
                <div className="space-y-3.5 pt-1">
                  
                  {/* Category 1: Operations */}
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                      Operations & Customers
                    </div>
                    <div className="space-y-1">
                      {[
                        { id: "dashboard", label: "📊 Dashboard", desc: "Overview & outstanding money" },
                        { id: "restaurants", label: "🏪 Customer Directory & Ledger", desc: "Party passbooks & cylinder holdings" },
                        { id: "calendar", label: "📅 Operations Calendar", desc: "Daily cylinder supply logs" },
                        { id: "batches", label: "📦 Batches & Supply", desc: "Active batch status & costs" }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => { setTab(item.id); setShowMobileNav(false); }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                            tab === item.id ? 'bg-sky-600 text-white shadow-soft font-black' : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800 border border-slate-100'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{item.label}</div>
                            <div className={`text-[10px] ${tab === item.id ? 'text-sky-100' : 'text-slate-400'}`}>{item.desc}</div>
                          </div>
                          <span className="text-xs font-bold opacity-60">→</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category 2: Billing & Stock */}
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                      Billing & Inventory
                    </div>
                    <div className="space-y-1">
                      {[
                        { id: "billing", label: "🧾 Create New Invoice", desc: "Generate GST & Supply bills" },
                        { id: "inventory", label: "📦 Stock & Inventory", desc: "Live stock & catalog rates", badge: lowStockItems.length > 0 ? `${lowStockItems.length} Low` : null },
                        { id: "outstandingBills", label: "⏳ Pending Invoices", desc: "Unpaid customer invoices" }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => { setTab(item.id); setShowMobileNav(false); }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                            tab === item.id ? 'bg-sky-600 text-white shadow-soft font-black' : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800 border border-slate-100'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.badge && (
                                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] ${tab === item.id ? 'text-sky-100' : 'text-slate-400'}`}>{item.desc}</div>
                          </div>
                          <span className="text-xs font-bold opacity-60">→</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category 3: Financials */}
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                      Financials & Reports
                    </div>
                    <div className="space-y-1">
                      {[
                        { id: "expenses", label: "💸 Expense Tracker", desc: "Vehicle, driver & shop expenses" },
                        { id: "payments", label: "💰 Cashflow & Wallet", desc: "Daily payment collections log" },
                        { id: "salesReport", label: "📈 Reports & Analytics", desc: "Sales volume & party trends" },
                        { id: "profitLoss", label: "📊 Profit & Loss", desc: "P&L statements & gross margin" },
                        { id: "gstReport", label: "🧾 GSTR-3B Report", desc: "Monthly tax liability & ITC" }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => { setTab(item.id); setShowMobileNav(false); }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                            tab === item.id ? 'bg-sky-600 text-white shadow-soft font-black' : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800 border border-slate-100'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{item.label}</div>
                            <div className={`text-[10px] ${tab === item.id ? 'text-sky-100' : 'text-slate-400'}`}>{item.desc}</div>
                          </div>
                          <span className="text-xs font-bold opacity-60">→</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 text-center text-[10px] text-slate-400 font-bold">
                Shree Balaji Agencies • Gaspoint Petroleum Live Sync
              </div>

            </div>
          </div>
        )}
      </div>

      {/* FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 z-40 shadow-lg flex justify-around items-center">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
            tab === 'dashboard' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-700 font-semibold'
          }`}
        >
          <LayoutGrid size={18} strokeWidth={tab === 'dashboard' ? 2.5 : 1.8} />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => setTab('restaurants')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
            tab === 'restaurants' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-700 font-semibold'
          }`}
        >
          <Users size={18} strokeWidth={tab === 'restaurants' ? 2.5 : 1.8} />
          <span className="text-[10px]">Directory</span>
        </button>

        <button
          onClick={() => setTab('billing')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
            tab === 'billing' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-700 font-semibold'
          }`}
        >
          <span className="text-base leading-none">🧾</span>
          <span className="text-[10px]">Bill</span>
        </button>

        <button
          onClick={() => setTab('inventory')}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
            tab === 'inventory' ? 'text-sky-600 font-black' : 'text-slate-500 hover:text-slate-700 font-semibold'
          }`}
        >
          <Boxes size={18} strokeWidth={tab === 'inventory' ? 2.5 : 1.8} />
          <span className="text-[10px]">Stock</span>
        </button>

        <button
          onClick={() => setShowMobileNav(true)}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
            showMobileNav ? 'text-sky-600 font-black' : 'text-slate-800 hover:text-slate-900 font-black'
          }`}
        >
          <span className="text-base leading-none">☰</span>
          <span className="text-[10px]">Menu</span>
        </button>
      </div>
    </div>
  );
}
