import React, { useState, useMemo, memo } from 'react';
import RestaurantStatementModal from './RestaurantStatementModal';
import RestaurantProfileModal from './RestaurantProfileModal';
import { norm, getAllPartiesCurrentBalances } from '../utils/dataUtils';

function RestaurantsList({ 
  restaurants, 
  tot21, 
  tot192, 
  totEmpty, 
  totEmpty21, 
  totEmpty192, 
  totAll, 
  totOutstanding, 
  search, 
  setSearch, 
  sortBy, 
  setSortBy,
  batches = [],
  payments = [],
  handleDeleteEntry,
  onDeletePayment,
  restaurantProfiles = {},
  onSaveRestaurantProfile,
  bills = [],
  deleteBill,
  removeDeliveryEntries
}) {
  const [selectedHotelForPassbook, setSelectedHotelForPassbook] = useState(null);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [collectOnly, setCollectOnly] = useState(false);

  // Single-pass ultra-fast party financial balance map computation (<1ms)
  const partyFinancialMap = useMemo(() => {
    return getAllPartiesCurrentBalances(restaurantProfiles, bills, payments);
  }, [restaurantProfiles, bills, payments]);

  const totalRupeeOutstandingAll = useMemo(() => {
    return Object.values(partyFinancialMap).reduce((acc, val) => acc + (val > 0 ? val : 0), 0);
  }, [partyFinancialMap]);

  // Filter restaurants by "Collect" status (outstanding cylinders or rupee balance > 0)
  const displayedRestaurants = useMemo(() => {
    if (collectOnly) {
      return restaurants.filter(r => (parseFloat(r.outstanding) || 0) > 0 || (partyFinancialMap[norm(r.name)] || 0) > 0);
    }
    return restaurants;
  }, [restaurants, collectOnly, partyFinancialMap]);

  return (
    <div className="bg-white border border-customBorder rounded-2xl mb-6 overflow-hidden shadow-soft fade space-y-4">
      <div className="bg-slate-50 px-5 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs uppercase tracking-wider text-sky-700">🏪 All Partner Restaurants & Hotel Passbooks</span>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
            {displayedRestaurants.length}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Collect Filter Toggle */}
          <button
            type="button"
            onClick={() => setCollectOnly(!collectOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer ${
              collectOnly 
                ? 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold animate-pulseGlow' 
                : 'bg-white text-slate-600 border-customBorder hover:bg-slate-50'
            }`}
          >
            Collect {collectOnly ? 'ON 🟡' : 'OFF ⚪'}
          </button>
          
          <input 
            className="bg-white border border-customBorder rounded-xl px-3.5 py-2 text-textSlate placeholder-slate-400 focus:outline-none focus:border-accentCyan text-xs w-full sm:w-48 shadow-sm transition-all"
            placeholder="Search restaurant..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <select 
            className="bg-white border border-customBorder rounded-xl px-3.5 py-2 text-textSlate focus:outline-none focus:border-accentCyan text-xs w-full sm:w-48 shadow-sm transition-all font-semibold"
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="total">Sort: Total Delivered</option>
            <option value="21kg">Sort: 21 KG Del</option>
            <option value="19.2kg">Sort: 19.2 KG Del</option>
            <option value="empty21">Sort: 21 KG Khali</option>
            <option value="empty192">Sort: 19.2 KG Khali</option>
            <option value="empty">Sort: Total Khali</option>
            <option value="outstanding">Sort: Cylinder Outstanding</option>
            <option value="az">Sort: A - Z</option>
            <option value="za">Sort: Z - A</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-customBorder bg-slate-50">
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">#</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Restaurant</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🧯 Cyl. Outstanding</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">💰 Payment Balance (₹)</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21 KG Del</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2 KG Del</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🔵 21 KG Khali</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">🟢 19.2 KG Khali</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">⚪ Total Khali</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3">Grand Total Del</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Passbook</th>
              <th className="text-[11px] font-bold uppercase tracking-wider text-mutedSlate px-4 py-3 text-right">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedRestaurants.map((r, i) => {
              const rupeeBal = partyFinancialMap[norm(r.name)] || 0;
              return (
                <tr key={r.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-bold text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 text-xs font-bold text-textSlate">
                    <button
                      onClick={() => setSelectedHotelForPassbook(r.name)}
                      className="hover:underline hover:text-sky-700 text-left font-extrabold"
                    >
                      {r.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${r.outstanding > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                      {r.outstanding} PCS
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black border ${rupeeBal > 0 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                      {rupeeBal > 0 ? `₹${rupeeBal.toLocaleString('en-IN')}` : '₹0'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">{r.kg21}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">{r.kg192}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">{r.empty21}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">{r.empty192}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{r.empty}</span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-black ${r.total > 50 ? 'text-amber-600' : 'text-slate-900'}`}>{r.total}</td>
                  <td className="px-4 py-3 text-xs text-right">
                    <button
                      onClick={() => setSelectedHotelForPassbook(r.name)}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-[11px] font-bold transition-all shadow-xs"
                    >
                      📜 Passbook
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-right">
                    <button
                      onClick={() => setEditingRestaurant(r.name)}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold transition-all shadow-xs"
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-customBorder bg-slate-50">
              <td colSpan={2} className="px-4 py-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-900">GRAND TOTAL</td>
              <td className="px-4 py-3.5 text-xs">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${totOutstanding > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                  {totOutstanding} PCS
                </span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  ₹{totalRupeeOutstandingAll.toLocaleString('en-IN')}
                </span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">{tot21}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">{tot192}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">{totEmpty21}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">{totEmpty192}</span>
              </td>
              <td className="px-4 py-3.5 text-xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{totEmpty}</span>
              </td>
              <td className="px-4 py-3.5 text-xs font-black text-slate-900">{totAll}</td>
              <td className="px-4 py-3.5"></td>
              <td className="px-4 py-3.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Render Statement Modal when a hotel is selected */}
      {selectedHotelForPassbook && (
        <RestaurantStatementModal
          restaurantName={selectedHotelForPassbook}
          onClose={() => setSelectedHotelForPassbook(null)}
          batches={batches}
          payments={payments}
          handleDeleteEntry={handleDeleteEntry}
          onDeletePayment={onDeletePayment}
          bills={bills}
          deleteBill={deleteBill}
          removeDeliveryEntries={removeDeliveryEntries}
          restaurantProfiles={restaurantProfiles}
        />
      )}

      {/* Render Profile Edit Modal when a restaurant profile is being edited */}
      {editingRestaurant && (
        <RestaurantProfileModal
          restaurantName={editingRestaurant}
          existingProfile={restaurantProfiles[editingRestaurant]}
          onClose={() => setEditingRestaurant(null)}
          onSave={onSaveRestaurantProfile}
        />
      )}
    </div>
  );
}

export default memo(RestaurantsList);
