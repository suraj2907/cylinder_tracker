import React, { lazy, Suspense } from 'react';
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

// Lazy load secondary tabs for instant initial bundle loading and 0ms navigation
const CalendarView = lazy(() => import('./components/CalendarView'));
const GenerateBill = lazy(() => import('./components/GenerateBill'));
const InventoryManager = lazy(() => import('./components/InventoryManager'));
const ExpenseTracker = lazy(() => import('./components/ExpenseTracker'));
const SalesSummaryDashboard = lazy(() => import('./components/SalesSummaryDashboard'));
const ProfitLossReport = lazy(() => import('./components/ProfitLossReport'));
const Gstr3bReport = lazy(() => import('./components/Gstr3bReport'));
const OutstandingBills = lazy(() => import('./components/OutstandingBills'));

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
    restaurantProfiles,
    bills,
    nextSuggestedInvoiceNo,
    saveRestaurantProfile,
    createBill,
    deleteBill,
    recordBillPayment
  } = useBilling(currentUser, handleAdd, removeDeliveryEntries);

  const {
    items: itemsCatalog,
    purchaseBills,
    stockAdjustments,
    partyItemPrices,
    saveItem,
    saveStockAdjustment,
    savePurchaseBill,
    deletePurchaseBill,
    savePartyPrice,
    deletePartyPrice
  } = useInventory(currentUser);

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

  const [showReceivePaymentModal, setShowReceivePaymentModal] = React.useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin"></div>
        <div className="text-xs font-bold text-slate-850 bg-white px-4 py-2 rounded-xl shadow-soft border border-slate-100">
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
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl font-bold text-xs z-[9999] shadow-glass transition-all animate-fadeIn ${
          toast.ok ? 'bg-emerald-600 text-white' : 'bg-orange-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin"></div>
          <div className="text-xs font-bold text-slate-800 bg-white px-4 py-2 rounded-xl shadow-soft">
            Connecting to Database...
          </div>
        </div>
      )}

      {/* LIGHT EXECUTIVE HEADER */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-50 px-4 md:px-6 py-3 shadow-soft backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand & Partner Identity */}
          <div className="flex items-center gap-3">
            {/* LPG Cylinder Icon Badge */}   
            <div className="w-9 h-9 rounded-2xl bg-white p-1 shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
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
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight">M/S. SHREE BALAJI AGENCIES</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                  GAS POINT
                </span>
              </div>
              <span className="hidden sm:block text-[11px] font-bold text-sky-700 tracking-wide">
                Cylinder Tracker & Partner Portal
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            {/* Global Wallet Indicator Pill */}
            <span className={`hidden sm:flex px-2.5 py-1 rounded-xl text-xs font-black border items-center gap-1 ${
              netBookingWallet >= 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}>
              <span>💰</span>
              <span>{netBookingWallet >= 0 ? `+₹${netBookingWallet.toLocaleString()}` : `-₹${Math.abs(netBookingWallet).toLocaleString()}`}</span>
            </span>

            {/* Quick Receive Payment */}
            <button
              onClick={() => setShowReceivePaymentModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-soft transition-all flex items-center gap-1 cursor-pointer"
              title="Receive Party Payment & Update Ledger"
            >
              <span>💳</span>
              <span className="hidden sm:inline">Receive Payment</span>
            </button>

            {/* Secure Partner User Info & Sign Out Pill */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
              <span className="px-2 py-0.5 bg-white text-slate-900 rounded-lg text-xs font-extrabold shadow-xs">
                {currentUser === 'Suraj' ? '👨‍💼 Suraj' : '👨‍💻 Shivam'}
              </span>
              <button
                onClick={logout}
                className="px-1.5 py-0.5 text-[11px] font-bold text-red-600 hover:text-red-800 uppercase cursor-pointer"
                title="Sign out"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Tab Navigation Pills */}
        <div className="max-w-7xl mx-auto hidden lg:flex items-center gap-1.5 flex-wrap mt-3 pt-2.5 border-t border-slate-100">
          {TABS.map(t => (
            <button 
              key={t.id} 
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                tab === t.id 
                  ? 'bg-sky-600 text-white shadow-soft' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Mobile Navigation Dropdown & Quick Add */}
        <div className="flex lg:hidden items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-100">
          <select
            value={tab}
            onChange={e => setTab(e.target.value)}
            className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none text-xs font-black flex-1 shadow-inner cursor-pointer"
          >
            <option value="dashboard">📊 Dashboard</option>
            <option value="restaurants">🏪 Customer Directory & Ledger</option>
            <option value="billing">🧾 Create New Invoice</option>
            <option value="inventory">📦 Stock & Inventory</option>
            <option value="expenses">💸 Expense Tracker</option>
            <option value="salesReport">📈 Reports & Analytics</option>
            <option value="profitLoss">📊 Profit & Loss</option>
            <option value="gstReport">🧾 GSTR-3B Report</option>
            <option value="calendar">📅 Operations Calendar</option>
            <option value="batches">📦 Batches & Supply</option>
            <option value="payments">💰 Cashflow & Wallet</option>
            <option value="outstandingBills">⏳ Pending Invoices</option>
          </select>

          <button 
            onClick={() => setTab("add")}
            className="px-3.5 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 active:scale-95 text-white shadow-soft flex items-center gap-1 cursor-pointer shrink-0">
            ➕ Add Entry
          </button>
        </div>
      </div>

      {/* Activity Feed Drawer Popup */}
      {showActivityFeed && (
        <div className="max-w-7xl mx-auto p-4 animate-fadeIn">
          <PartnerActivityFeed 
            activities={activities} 
            onClose={() => setShowActivityFeed(false)} 
            />
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* ACTIVE TAB CONTENT */}
        <Suspense fallback={
          <div className="bg-white border border-customBorder rounded-2xl p-12 text-center shadow-soft animate-pulse">
            <div className="text-sm font-extrabold text-sky-700 uppercase tracking-wider">⚡ Loading view...</div>
          </div>
        }>
          <div key={tab} className="animate-fadeIn">
            {tab === "dashboard" && <Dashboard restaurants={restaurants} batchStats={batchStats} restMap={restMap} totAll={totAll} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totOutstanding={totOutstanding} restaurantProfiles={restaurantProfiles} bills={bills} payments={payments} setTab={setTab} />}
            {tab === "restaurants" && <RestaurantsList restaurants={restaurants} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totEmpty21={totEmpty21} totEmpty192={totEmpty192} totAll={totAll} totOutstanding={totOutstanding} search={search} setSearch={setSearch} sortBy={sortBy} setSortBy={setSortBy} batches={batches} payments={payments} handleDeleteEntry={handleDeleteEntry} onDeletePayment={handleDeletePayment} restaurantProfiles={restaurantProfiles} onSaveRestaurantProfile={saveRestaurantProfile} bills={bills} deleteBill={deleteBill} removeDeliveryEntries={removeDeliveryEntries} />}
            {tab === "billing" && <GenerateBill restaurants={restaurants} restaurantProfiles={restaurantProfiles} createBill={createBill} itemsCatalog={itemsCatalog} partyItemPrices={partyItemPrices} bills={bills} payments={payments} nextSuggestedInvoiceNo={nextSuggestedInvoiceNo} />}
            {tab === "outstandingBills" && <OutstandingBills bills={bills} recordBillPayment={recordBillPayment} />}
            {tab === "inventory" && <InventoryManager items={itemsCatalog} purchaseBills={purchaseBills} stockAdjustments={stockAdjustments} partyItemPrices={partyItemPrices} restaurants={restaurants} saveItem={saveItem} saveStockAdjustment={saveStockAdjustment} savePurchaseBill={savePurchaseBill} deletePurchaseBill={deletePurchaseBill} savePartyPrice={savePartyPrice} deletePartyPrice={deletePartyPrice} />}
            {tab === "expenses" && <ExpenseTracker categories={expenseCategories} expenseItems={expenseItems} expenses={expenses} saveCategory={saveCategory} deleteCategory={deleteCategory} saveExpenseItem={saveExpenseItem} deleteExpenseItem={deleteExpenseItem} saveExpense={saveExpense} deleteExpense={deleteExpense} />}
            {tab === "salesReport" && <SalesSummaryDashboard bills={bills} restaurants={restaurants} deleteBill={deleteBill} />}
            {tab === "profitLoss" && <ProfitLossReport items={itemsCatalog} purchaseBills={purchaseBills} stockAdjustments={stockAdjustments} bills={bills} expenses={expenses} />}
            {tab === "gstReport" && <Gstr3bReport items={itemsCatalog} purchaseBills={purchaseBills} bills={bills} />}
            {tab === "payments" && <PaymentLedger payments={payments} onAddPayment={handleAddPayment} onDeletePayment={handleDeletePayment} batches={batches} onUpdateBatchCost={handleUpdateBatchCost} restMap={restMap} />}
            {tab === "calendar" && <CalendarView dateMap={dateMap} selectedDate={selectedDate} setSelectedDate={setSelectedDate} handleDeleteEntry={handleDeleteEntry} payments={payments} batches={batches} onDeletePayment={handleDeletePayment} />}
            {tab === "batches" && <BatchesList filteredBatches={filteredBatches} batchSearch={batchSearch} setBatchSearch={setBatchSearch} handleDeleteBatch={handleDeleteBatch} />}
            {tab === "add" && <AddEntry newEntry={newEntry} setNewEntry={setNewEntry} handleAdd={handleAdd} restMap={restMap} />}
          </div>
        </Suspense>

        <ReceivePaymentModal
          isOpen={showReceivePaymentModal}
          onClose={() => setShowReceivePaymentModal(false)}
          restaurants={restaurants}
          restaurantProfiles={restaurantProfiles}
          bills={bills}
          payments={payments}
          onPaymentSuccess={(payPayload) => {
            if (payPayload && handleAddPayment) handleAddPayment(payPayload);
          }}
        />
      </div>

      {/* FIXED MOBILE BOTTOM NAVIGATION BAR (matching AI Studio screenshot) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 py-2 px-6 z-50 shadow-md flex justify-around items-center">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            tab === 'dashboard' ? 'text-slate-900 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <LayoutGrid size={18} strokeWidth={tab === 'dashboard' ? 2.4 : 1.8} />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => setTab('restaurants')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            tab === 'restaurants' ? 'text-slate-900 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Users size={18} strokeWidth={tab === 'restaurants' ? 2.4 : 1.8} />
          <span className="text-[10px]">Directory</span>
        </button>

        <button
          onClick={() => setTab('calendar')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            tab === 'calendar' ? 'text-slate-900 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Calendar size={18} strokeWidth={tab === 'calendar' ? 2.4 : 1.8} />
          <span className="text-[10px]">Calendar</span>
        </button>

        <button
          onClick={() => setTab('salesReport')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            tab === 'salesReport' || tab === 'profitLoss' || tab === 'gstReport' ? 'text-slate-900 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <BarChart3 size={18} strokeWidth={tab === 'salesReport' ? 2.4 : 1.8} />
          <span className="text-[10px]">Reports</span>
        </button>

        <button
          onClick={() => setTab('inventory')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            tab === 'inventory' ? 'text-slate-900 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Boxes size={18} strokeWidth={tab === 'inventory' ? 2.4 : 1.8} />
          <span className="text-[10px]">Stock</span>
        </button>
      </div>
    </div>
  );
}
