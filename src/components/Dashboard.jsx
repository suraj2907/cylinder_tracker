import React, { useMemo } from 'react';
import { FileText, TrendingUp, Package, Percent, ChevronRight } from 'lucide-react';
import { norm, getAllPartiesCurrentBalances } from '../utils/dataUtils';

export default function Dashboard({ restaurants = [], restaurantProfiles = {}, bills = [], payments = [], setTab }) {

  // Single-pass accurate party balance calculation
  const partyBalanceMap = useMemo(() => {
    return getAllPartiesCurrentBalances(restaurantProfiles, bills, payments);
  }, [restaurantProfiles, bills, payments]);

  // Total money pending to collect across customer accounts
  const totalToCollect = useMemo(() => {
    return Object.entries(partyBalanceMap).reduce((sum, [p, v]) => {
      if (p.toLowerCase().includes('gaspoint')) return sum;
      return sum + (v > 0 ? v : 0);
    }, 0);
  }, [partyBalanceMap]);

  // Top active customer restaurants sorted by highest pending balance
  const topActiveList = useMemo(() => {
    const list = (restaurants || []).map(r => ({
      ...r,
      balance: partyBalanceMap[norm(r.name)] || 0
    }));
    // Also include any customer profiles with positive balance not present in current cylinder deliveries
    Object.entries(partyBalanceMap).forEach(([normName, bal]) => {
      if (bal > 0 && !normName.toLowerCase().includes('gaspoint') && !list.some(r => norm(r.name) === normName)) {
        list.push({
          name: normName,
          outstanding: 0,
          total: 0,
          balance: bal
        });
      }
    });
    return list
      .filter(r => !r.name.toLowerCase().includes('gaspoint'))
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 10);
  }, [restaurants, partyBalanceMap]);

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-fadeIn pb-16 px-3 sm:px-6">

      {/* Main Pending Balance Hero Card */}
      <div className="bg-white border border-[#EEEEEE] rounded-3xl p-6 sm:p-8 text-center shadow-xs">
        <h1 className="text-xs font-bold text-[#737373] uppercase tracking-widest mb-1.5">
          AGENCY DASHBOARD • TOTAL MONEY PENDING
        </h1>
        <div className="text-3xl sm:text-5xl font-light text-[#1A1A1A] tracking-tight my-2">
          ₹ {totalToCollect.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-[11px] text-[#999999] font-medium">
          Live aggregate outstanding from {restaurants.length} active customer accounts
        </p>
      </div>

      {/* 4 Action Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Generate Bill */}
        <button
          id="btn-action-generate-bill"
          onClick={() => setTab('billing')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <FileText className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Generate Bill
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">GST & Plain Invoices</span>
        </button>

        {/* Cashflow */}
        <button
          id="btn-action-cashflow"
          onClick={() => setTab('payments')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <TrendingUp className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Cashflow
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">Daily Ledger & Collections</span>
        </button>

        {/* Inventory */}
        <button
          id="btn-action-inventory"
          onClick={() => setTab('inventory')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <Package className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Inventory
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">Live Stock & Purchases</span>
        </button>

        {/* Profit & Loss */}
        <button
          id="btn-action-reports"
          onClick={() => setTab('profitLoss')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <Percent className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Profit & Loss
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">Financial Margins</span>
        </button>
      </div>

      {/* Top Active Restaurants Section */}
      <div className="bg-white border border-[#EEEEEE] rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#EEEEEE]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#1A1A1A] tracking-tight">
              Top Active Restaurants
            </h2>
            <p className="text-xs text-[#737373]">Parties with assigned cylinders & pending amounts</p>
          </div>
          <button
            onClick={() => setTab('restaurants')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({restaurants.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {topActiveList.map((rest) => (
            <button
              key={rest.name}
              id={`btn-restaurant-row-${rest.name}`}
              onClick={() => setTab('restaurants')}
              className="w-full flex items-center justify-between p-3.5 bg-[#FDFDFD] hover:bg-[#F5F5F5] rounded-xl border border-[#EEEEEE] hover:border-[#CCCCCC] active:scale-[0.99] transition-all text-left cursor-pointer shadow-none"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="text-xs sm:text-sm font-semibold text-[#1A1A1A] truncate">
                  {rest.name}
                </div>
                <div className="text-[11px] text-[#737373] font-normal mt-0.5">
                  {rest.outstanding || 0} Cylinders Assigned
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`text-xs sm:text-sm font-bold ${rest.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  ₹ {rest.balance > 0 ? rest.balance.toLocaleString('en-IN') : '0'}
                </div>
                <ChevronRight className="w-4 h-4 text-[#CCCCCC]" />
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
