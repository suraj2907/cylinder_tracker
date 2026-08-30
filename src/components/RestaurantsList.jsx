import React, { useState, useMemo, memo } from 'react';
import { Search, MessageCircle } from 'lucide-react';
import RestaurantStatementModal from './RestaurantStatementModal';
import RestaurantProfileModal from './RestaurantProfileModal';
import { norm, isNewBill, getAllPartiesCurrentBalances } from '../utils/dataUtils';

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
  legacyLedgerEntries = [],
  deleteBill,
  removeDeliveryEntries,
  onEditBill
}) {
  const [selectedHotelForPassbook, setSelectedHotelForPassbook] = useState(null);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [collectOnly, setCollectOnly] = useState(false);

  // Single-pass ultra-fast party financial balance map computation (<1ms)
  const partyFinancialMap = useMemo(() => {
    return getAllPartiesCurrentBalances(restaurantProfiles, bills, payments, legacyLedgerEntries);
  }, [restaurantProfiles, bills, payments, legacyLedgerEntries]);

  const totalRupeeOutstandingAll = useMemo(() => {
    return Object.values(partyFinancialMap).reduce((acc, val) => acc + (val > 0 ? val : 0), 0);
  }, [partyFinancialMap]);

  // Combine delivered restaurants + profile-only restaurants so new restaurants show immediately
  const displayedRestaurants = useMemo(() => {
    const map = new Map();
    (restaurants || []).forEach(r => map.set(norm(r.name), { ...r }));

    Object.values(restaurantProfiles || {}).forEach(p => {
      if (p && p.name && !map.has(norm(p.name))) {
        map.set(norm(p.name), {
          name: p.name,
          mobile: p.mobile || '',
          gst_num: p.gst_num || '',
          address: p.address || '',
          kg21: 0,
          kg192: 0,
          empty: 0,
          empty21: 0,
          empty192: 0,
          total: 0,
          outstanding: 0
        });
      }
    });

    let list = Array.from(map.values());

    if (search) {
      const q = search.toLowerCase().trim();
      const qNorm = q.replace(/u/g, 'a');
      list = list.filter(r => {
        const n = r.name.toLowerCase();
        const nNorm = n.replace(/u/g, 'a');
        return n.includes(q) || nNorm.includes(qNorm) || (r.mobile && String(r.mobile).includes(q));
      });
    }

    if (collectOnly) {
      list = list.filter(r => (partyFinancialMap[norm(r.name)] || 0) > 0);
    }

    return list.sort((a, b) => {
      if (sortBy === "21kg") return b.kg21 - a.kg21;
      if (sortBy === "19.2kg") return b.kg192 - a.kg192;
      if (sortBy === "empty") return b.empty - a.empty;
      if (sortBy === "empty21") return b.empty21 - a.empty21;
      if (sortBy === "empty192") return b.empty192 - a.empty192;
      if (sortBy === "outstanding") return b.outstanding - a.outstanding;
      if (sortBy === "az") return a.name.localeCompare(b.name);
      if (sortBy === "za") return b.name.localeCompare(a.name);
      return b.total - a.total;
    });
  }, [restaurants, restaurantProfiles, search, collectOnly, partyFinancialMap, sortBy]);

  const handleSendReminder = (restaurant, pendingAmount) => {
    const prof = restaurantProfiles[restaurant.name] || restaurant;
    const link = `${window.location.origin}/?ledger=${encodeURIComponent(restaurant.name)}`;
    const message =
      `Hi sir/ma'am,\n` +
      `Your payment of ₹${pendingAmount.toLocaleString('en-IN')} is pending.\n\n` +
      `You can view the ledger statement by clicking on link below:\n${link}\n\n` +
      `Please clear the payment as soon as possible.\n\n` +
      `Thank you,\nM/S Shree Balaji Agencies`;

    let phone = (prof.mobile || restaurant.mobile || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone; // India country code

    if (!phone) {
      alert('Is restaurant ka mobile number saved nahi hai — pehle Edit se add karo.');
      return;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="flex flex-col flex-1 pb-20 max-w-7xl mx-auto w-full animate-fadeIn overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 pt-3 pb-3 gap-2">
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#1A1A1A] truncate">
            Customer Directory & Ledger
          </h1>
          <p className="text-[11px] sm:text-xs text-[#737373] truncate">Live balances & cylinder tracking</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-black transition-all shadow-soft flex items-center gap-1 cursor-pointer shrink-0"
            title="Add New Customer / Restaurant"
          >
            <span>➕ Add Party</span>
          </button>
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#737373] bg-[#F5F5F5] px-2 py-1 rounded-md border border-[#EEEEEE] shrink-0">
            {displayedRestaurants.length} Parties
          </span>
        </div>
      </div>

      {/* Search Bar & Controls */}
      <div className="px-4 mb-3 flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full flex items-center">
          <Search className="w-4 h-4 text-[#999999] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            id="search-restaurants-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search restaurants..."
            className="w-full bg-white text-[#1A1A1A] placeholder-[#999999] text-xs font-normal pl-10 pr-4 py-2.5 rounded-xl border border-[#EEEEEE] focus:border-[#1A1A1A] focus:outline-none transition-all shadow-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 text-xs text-[#999999] hover:text-[#1A1A1A] cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-white border border-[#EEEEEE] rounded-xl px-3 py-2.5 text-[#1A1A1A] text-xs font-semibold focus:outline-none shadow-none cursor-pointer w-full sm:w-auto"
        >
          <option value="total">Sort: Total Cylinders</option>
          <option value="21kg">Sort: 21 KG Delivered</option>
          <option value="19.2kg">Sort: 19.2 KG Delivered</option>
          <option value="empty">Sort: Khali Received</option>
          <option value="outstanding">Sort: Cylinder Outstanding</option>
          <option value="az">Sort: A - Z</option>
          <option value="za">Sort: Z - A</option>
        </select>
      </div>

      {/* Segmented Filter Control */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-2 p-0.5 bg-[#F5F5F5] rounded-xl border border-[#EEEEEE] max-w-md">
          <button
            id="tab-all-parties"
            onClick={() => {
              setCollectOnly(false);
              setSortBy('total');
            }}
            className={`py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
              !collectOnly
                ? 'bg-white text-[#1A1A1A] font-semibold shadow-none border border-[#E5E5E5]'
                : 'text-[#737373] hover:text-[#1A1A1A] font-medium'
            }`}
          >
            All Parties ({restaurants.length})
          </button>
          <button
            id="tab-pending-only"
            onClick={() => {
              setCollectOnly(true);
              setSortBy('az');
            }}
            className={`py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
              collectOnly
                ? 'bg-white text-[#1A1A1A] font-semibold shadow-none border border-[#E5E5E5]'
                : 'text-[#737373] hover:text-[#1A1A1A] font-medium'
            }`}
          >
            Pending Payments Only
          </button>
        </div>
      </div>

      {/* MOBILE CARD LIST VIEW (Screens < 1024px) */}
      <div className="block lg:hidden px-4 space-y-2.5">
        {displayedRestaurants.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-[#EEEEEE]">
            <p className="text-xs text-[#999999]">No restaurants match your search.</p>
          </div>
        ) : (
          displayedRestaurants.map((party) => {
            const rupeeBal = partyFinancialMap[norm(party.name)] || 0;
            const out192 = (party.kg192 || 0) - (party.empty192 || 0);
            const out21 = (party.kg21 || 0) - (party.empty21 || 0);
            const totOut = party.outstanding !== undefined ? party.outstanding : (out192 + out21);

            return (
              <div
                key={party.name}
                id={`card-party-${party.name}`}
                className="group relative flex items-center justify-between p-3 bg-white rounded-xl border border-[#EEEEEE] hover:border-[#CCCCCC] transition-all cursor-pointer shadow-none"
                onClick={() => setSelectedHotelForPassbook(party.name)}
              >
                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-xs font-bold text-[#1A1A1A] truncate">
                      {party.name}
                    </h3>
                    <span className={`text-xs font-black shrink-0 ${rupeeBal > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      ₹{rupeeBal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                    {/* Category Wise Cylinder Badges */}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 text-[10px] font-bold border border-teal-200">
                      🟢 19.2k: {out192}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 text-[10px] font-bold border border-sky-200">
                      🔵 21k: {out21}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                      Total: {totOut}
                    </span>
                  </div>
                </div>

                {/* Right Actions: WhatsApp & Edit Button */}
                <div className="flex items-center gap-2 pl-2">
                  <button
                    id={`btn-whatsapp-${party.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendReminder(party, rupeeBal);
                    }}
                    title="Send WhatsApp Ledger Reminder"
                    className="w-8 h-8 rounded-lg bg-[#F5F5F5] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#EEEEEE]"
                  >
                    <MessageCircle className="w-4 h-4 stroke-[1.8]" />
                  </button>
                  <button
                    id={`btn-edit-${party.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingRestaurant(party.name);
                    }}
                    title="Edit Profile"
                    className="w-7 h-7 rounded-lg bg-[#F5F5F5] text-[#737373] hover:text-[#1A1A1A] flex items-center justify-center text-xs border border-[#EEEEEE] cursor-pointer"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP DETAILED TABLE VIEW (Screens >= 1024px) */}
      <div className="hidden lg:block px-4">
        <div className="bg-white border border-[#EEEEEE] rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EEEEEE] bg-[#F9FAFB]">
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">#</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">Restaurant</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">🧯 Cyl. Outstanding</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">💰 Balance (₹)</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">21 KG Del</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">19.2 KG Del</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">21 KG Khali</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">19.2 KG Khali</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">Total Khali</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3">Grand Total</th>
                <th className="text-[11px] font-bold uppercase tracking-wider text-[#737373] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE]">
              {displayedRestaurants.map((r, i) => {
                const rupeeBal = partyFinancialMap[norm(r.name)] || 0;

                return (
                  <tr key={r.name} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-[#737373]">{i + 1}</td>
                    <td className="px-4 py-3 text-xs font-bold text-[#1A1A1A]">
                      <button
                        onClick={() => setSelectedHotelForPassbook(r.name)}
                        className="hover:underline hover:text-sky-600 text-left cursor-pointer"
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        r.outstanding > 0 
                          ? 'bg-amber-50 text-amber-900 border-amber-200' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {r.outstanding} PCS
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        rupeeBal > 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        ₹{rupeeBal.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#1A1A1A] font-medium">{r.kg21}</td>
                    <td className="px-4 py-3 text-xs text-[#1A1A1A] font-medium">{r.kg192}</td>
                    <td className="px-4 py-3 text-xs text-[#737373]">{r.empty21}</td>
                    <td className="px-4 py-3 text-xs text-[#737373]">{r.empty192}</td>
                    <td className="px-4 py-3 text-xs text-[#737373]">{r.empty}</td>
                    <td className="px-4 py-3 text-xs font-bold text-[#1A1A1A]">{r.total}</td>
                    <td className="px-4 py-3 text-xs text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleSendReminder(r, rupeeBal)}
                          className="px-2.5 py-1 rounded-lg bg-[#F5F5F5] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] text-xs font-medium transition-colors border border-[#EEEEEE] flex items-center gap-1 cursor-pointer"
                          title="WhatsApp Reminder"
                        >
                          <MessageCircle size={13} />
                          <span>Remind</span>
                        </button>
                        <button
                          onClick={() => setSelectedHotelForPassbook(r.name)}
                          className="px-2.5 py-1 rounded-lg bg-[#F5F5F5] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] text-xs font-medium transition-colors border border-[#EEEEEE] cursor-pointer"
                        >
                          Passbook
                        </button>
                        <button
                          onClick={() => setEditingRestaurant(r.name)}
                          className="px-2 py-1 rounded-lg bg-[#F5F5F5] hover:bg-[#1A1A1A] hover:text-white text-[#737373] text-xs transition-colors border border-[#EEEEEE] cursor-pointer"
                          title="Edit Profile"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#EEEEEE] bg-[#F9FAFB] font-bold">
                <td colSpan={2} className="px-4 py-3 text-xs text-[#1A1A1A]">GRAND TOTAL</td>
                <td className="px-4 py-3 text-xs text-amber-900">{totOutstanding} PCS</td>
                <td className="px-4 py-3 text-xs text-rose-600">₹{totalRupeeOutstandingAll.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-xs text-[#1A1A1A]">{tot21}</td>
                <td className="px-4 py-3 text-xs text-[#1A1A1A]">{tot192}</td>
                <td className="px-4 py-3 text-xs text-[#737373]">{totEmpty21}</td>
                <td className="px-4 py-3 text-xs text-[#737373]">{totEmpty192}</td>
                <td className="px-4 py-3 text-xs text-[#737373]">{totEmpty}</td>
                <td className="px-4 py-3 text-xs text-[#1A1A1A]">{totAll}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
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
          onEditBill={onEditBill ? (bill) => { setSelectedHotelForPassbook(null); onEditBill(bill); } : undefined}
        />
      )}

      {/* Render Profile Edit Modal when a restaurant profile is being edited */}
      {editingRestaurant && (
        <RestaurantProfileModal
          restaurantName={editingRestaurant}
          existingProfile={
            restaurantProfiles[editingRestaurant] ||
            restaurantProfiles[norm(editingRestaurant)] ||
            Object.values(restaurantProfiles || {}).find(p => norm(p.name) === norm(editingRestaurant)) ||
            {}
          }
          onClose={() => setEditingRestaurant(null)}
          onSave={onSaveRestaurantProfile}
        />
      )}

      {/* Render Add Restaurant Modal */}
      {showAddModal && (
        <RestaurantProfileModal
          onClose={() => setShowAddModal(false)}
          onSave={onSaveRestaurantProfile}
        />
      )}
    </div>
  );
}

export default memo(RestaurantsList);
