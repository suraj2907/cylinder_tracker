import React from 'react';
import Dashboard from './components/Dashboard';
import RestaurantsList from './components/RestaurantsList';
import BatchesList from './components/BatchesList';
import CalendarView from './components/CalendarView';
import AddEntry from './components/AddEntry';
import GasPredictor from './components/GasPredictor';
import { PaymentLedger } from './components/PaymentLedger';
import { PartnerActivityFeed } from './components/PartnerActivityFeed';
import { useUser } from './context/UserContext';
import { useHashNavigation } from './hooks/useHashNavigation';
import { useCylinderData } from './hooks/useCylinderData';
import { useBilling } from './hooks/useBilling';
import Login from './components/Login';
import GenerateBill from './components/GenerateBill';

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
    handleAddPayment,
    handleDeletePayment,
    handleUpdateBatchCost
  } = useCylinderData(currentUser);

  const {
    restaurantProfiles,
    bills,
    saveRestaurantProfile,
    createBill,
    deleteBill
  } = useBilling(currentUser);

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
      <div className="bg-white border-b border-customBorder sticky top-0 z-50 px-4 md:px-6 py-3.5 shadow-soft backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          
          {/* Brand & Partner Identity */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {/* LPG Cylinder Icon Badge */}   
              <div className="w-10 h-10 rounded-2xl bg-white p-1 shadow-md border border-emerald-500/40 flex items-center justify-center">
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
                    <text x="200" y="40" font-family="'Arial Black', 'Inter', sans-serif" fontWeight="900" fontSize="20" fill="#0b1329" textAnchor="middle" letterSpacing="2">SHREE BALAJI AGENCIES</text>
                  </g>
                </svg>
              </div>
              
              {/* Full Agency & Gaspoint Branding */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black text-slate-900 tracking-tight">M/S. SHREE BALAJI AGENCIES</span>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-red-50 text-red-700 border border-red-200 tracking-wide">
                    🔥 GAS POINT
                  </span>
                </div>
                <span className="text-xs font-extrabold text-sky-700 tracking-wide mt-0.5">
                  Cylinder Tracker & Partner Passbook Portal
                </span>
              </div>
            </div>

            {/* Secure Partner User Info & Sign Out Pill */}
            <div className="flex items-center p-1.5 bg-slate-100 border border-slate-200 rounded-xl gap-2.5">
              <span className="px-2.5 py-1 bg-white text-slate-900 rounded-lg text-xs font-extrabold shadow-sm border border-slate-200">
                {currentUser === 'Suraj' ? '👨‍💼 Suraj' : '👨‍💻 Shivam'}
              </span>
              <button
                onClick={logout}
                className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-800 transition-all uppercase tracking-wide cursor-pointer"
                title="Sign out of partner portal"
              >
                Sign Out
              </button>
            </div>

            {/* Global Wallet Indicator Pill */}
            <span className={`px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1 ${
              netBookingWallet >= 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}>
              <span>💰 Wallet:</span>
              <span>{netBookingWallet >= 0 ? `+₹${netBookingWallet.toLocaleString()}` : `-₹${Math.abs(netBookingWallet).toLocaleString()}`}</span>
            </span>

            {/* Live Realtime Status Pill */}
            {syncing ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200 animate-pulse">
                🔄 Syncing...
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Live Realtime
              </span>
            )}
          </div>

          {/* Desktop Tab Navigation */}
          <div className="hidden lg:flex items-center gap-1.5">
            {TABS.map(t => (
              <button 
                key={t.id} 
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t.id 
                    ? 'bg-sky-600 text-white shadow-soft font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Controls & Activity Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowActivityFeed(!showActivityFeed)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                showActivityFeed 
                  ? 'bg-sky-100 text-sky-800 border-sky-300' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="View Partner Live Log"
            >
              <span>⚡ Activity Feed</span>
              {activities.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-sky-600 text-white">
                  {activities.length}
                </span>
              )}
            </button>

            <button 
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              onClick={handleDownload}
              title="Download backup data">
              💾 Backup
            </button>
          </div>

        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex lg:hidden items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
          <select
            value={tab}
            onChange={e => setTab(e.target.value)}
            className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none text-xs font-bold flex-1"
          >
            <option value="dashboard">📊 Dashboard</option>
            <option value="batches">📦 Batches & Supply</option>
            <option value="payments">💰 Cashflow & Wallet</option>
            <option value="calendar">📅 Calendar Log</option>
            <option value="restaurants">🏪 Restaurants</option>
            <option value="billing">🧾 Generate Bill</option>
            <option value="gasPredictor">🔮 Gas Predictor</option>
          </select>

          <button 
            onClick={() => setTab("add")}
            className="px-3.5 py-2 rounded-xl text-xs font-black bg-sky-600 text-white shadow-soft flex items-center gap-1">
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
        
        {/* EXECUTIVE STAT STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-3">
          {[
            { label: "Total Delivered", value: totAll, color: "text-slate-900", border: "border-l-4 border-l-slate-900" },
            { label: "21 KG Del", value: tot21, color: "text-sky-700", border: "border-l-4 border-l-sky-600" },
            { label: "19.2 KG Del", value: tot192, color: "text-teal-700", border: "border-l-4 border-l-teal-600" },
            { label: "21 KG Khali", value: totEmpty21, color: "text-sky-700", border: "border-l-4 border-l-sky-400" },
            { label: "19.2 KG Khali", value: totEmpty192, color: "text-teal-700", border: "border-l-4 border-l-teal-400" },
            { label: "Total Khali", value: totEmpty, color: "text-slate-600", border: "border-l-4 border-l-slate-400" },
            { label: "Outstanding", value: totOutstanding, color: "text-amber-700", border: "border-l-4 border-l-amber-500" },
            { label: "Restaurants", value: Object.keys(restMap).length, color: "text-purple-700", border: "border-l-4 border-l-purple-500" },
            { label: "Batches", value: batches.length, color: "text-slate-700", border: "border-l-4 border-l-slate-300" }
          ].map(({ label, value, color, border }) => (
            <div key={label} className={`bg-white border border-customBorder rounded-2xl p-3.5 text-center shadow-soft hover:shadow-md transition-all ${border}`}>
              <div className={`text-xl font-black ${color}`}>{value.toLocaleString()}</div>
              <div className="text-[10px] font-bold text-mutedSlate uppercase tracking-wider mt-1 truncate" title={label}>{label}</div>
            </div>
          ))}
        </div>

        {/* ACTIVE TAB CONTENT */}
        <div key={tab} className="animate-fadeIn">
          {tab === "dashboard" && <Dashboard restaurants={restaurants} batchStats={batchStats} restMap={restMap} totAll={totAll} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totOutstanding={totOutstanding} />}
          {tab === "restaurants" && <RestaurantsList restaurants={restaurants} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totEmpty21={totEmpty21} totEmpty192={totEmpty192} totAll={totAll} totOutstanding={totOutstanding} search={search} setSearch={setSearch} sortBy={sortBy} setSortBy={setSortBy} batches={batches} payments={payments} handleDeleteEntry={handleDeleteEntry} onDeletePayment={handleDeletePayment} restaurantProfiles={restaurantProfiles} onSaveRestaurantProfile={saveRestaurantProfile} bills={bills} deleteBill={deleteBill} />}
          {tab === "billing" && <GenerateBill restaurants={restaurants} restaurantProfiles={restaurantProfiles} createBill={createBill} />}
          {tab === "payments" && <PaymentLedger payments={payments} onAddPayment={handleAddPayment} onDeletePayment={handleDeletePayment} batches={batches} onUpdateBatchCost={handleUpdateBatchCost} restMap={restMap} />}
          {tab === "calendar" && <CalendarView dateMap={dateMap} selectedDate={selectedDate} setSelectedDate={setSelectedDate} handleDeleteEntry={handleDeleteEntry} payments={payments} batches={batches} onDeletePayment={handleDeletePayment} />}
          {tab === "batches" && <BatchesList filteredBatches={filteredBatches} batchSearch={batchSearch} setBatchSearch={setBatchSearch} />}
          {tab === "add" && <AddEntry newEntry={newEntry} setNewEntry={setNewEntry} handleAdd={handleAdd} restMap={restMap} />}
          {tab === "gasPredictor" && <GasPredictor restaurants={restaurants} batches={batches} />}
        </div>
      </div>
    </div>
  );
}
