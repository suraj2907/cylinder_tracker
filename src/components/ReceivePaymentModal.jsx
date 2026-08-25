import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useUser } from '../context/UserContext';
import { norm, VALID_RESTAURANTS, getAllPartiesCurrentBalances } from '../utils/dataUtils';

export default function ReceivePaymentModal({
  isOpen,
  onClose,
  restaurants = [],
  restaurantProfiles = {},
  bills = [],
  payments = [],
  batches = [],
  onPaymentSuccess
}) {
  const { currentUser } = useUser();
  const activeBatchNum = useMemo(() => {
    if (batches && batches.length > 0) {
      const sorted = [...batches].sort((a, b) => Number(b.batch) - Number(a.batch));
      return Number(sorted[0]?.batch) || 133;
    }
    return 133;
  }, [batches]);

  const [targetBatchNum, setTargetBatchNum] = useState(activeBatchNum);
  useEffect(() => {
    setTargetBatchNum(activeBatchNum);
  }, [activeBatchNum]);

  const [selectedParty, setSelectedParty] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useRef(null);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 100% Unique Canonical Restaurants List with Unique ID (#1..#N) and zero duplicates
  const uniqueCanonicalRestaurants = useMemo(() => {
    const map = {};

    // Collect details from restaurantProfiles
    Object.keys(restaurantProfiles || {}).forEach(rawName => {
      const canonical = norm(rawName);
      if (!map[canonical]) {
        map[canonical] = {
          name: canonical,
          mobile: restaurantProfiles[rawName]?.mobile || '',
          gst_num: restaurantProfiles[rawName]?.gst_num || '',
          previous_balance: parseFloat(restaurantProfiles[rawName]?.previous_balance || 0)
        };
      } else {
        if (!map[canonical].mobile && restaurantProfiles[rawName]?.mobile) {
          map[canonical].mobile = restaurantProfiles[rawName].mobile;
        }
      }
    });

    // Also include VALID_RESTAURANTS
    VALID_RESTAURANTS.forEach(rawName => {
      const canonical = norm(rawName);
      if (canonical && canonical !== 'Unknown' && !map[canonical]) {
        map[canonical] = {
          name: canonical,
          mobile: '',
          gst_num: '',
          previous_balance: 0
        };
      }
    });

    // Compute live balance for each canonical party using single-pass map
    const balanceMap = getAllPartiesCurrentBalances(restaurantProfiles, bills, payments);

    const sortedNames = Object.keys(map).sort((a, b) => a.localeCompare(b));

    return sortedNames.map((name, idx) => {
      return {
        id: idx + 1,
        name: name,
        mobile: map[name].mobile,
        gst_num: map[name].gst_num,
        previous_balance: balanceMap[name] !== undefined ? balanceMap[name] : map[name].previous_balance
      };
    });
  }, [restaurantProfiles, restaurants, bills, payments]);

  // Autocomplete matching suggestions based on search query
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return uniqueCanonicalRestaurants.slice(0, 10);
    const q = searchQuery.toLowerCase().trim();
    return uniqueCanonicalRestaurants.filter(r => 
      String(r.id) === q ||
      String(r.id).includes(q) ||
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.mobile && r.mobile.includes(q))
    ).slice(0, 12);
  }, [uniqueCanonicalRestaurants, searchQuery]);

  if (!isOpen) return null;

  const handleSelectParty = (party) => {
    setSelectedParty(party);
    setSearchQuery(party.name);
    setShowSuggestions(false);
  };

  const handleClearSelection = () => {
    setSelectedParty(null);
    setSearchQuery('');
    setShowSuggestions(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParty) {
      alert('Pehle autocomplete suggestions se Party select kijiye');
      return;
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      alert('Kripya valid payment amount (₹) bhariye');
      return;
    }

    setSubmitting(true);
    try {
      const partyName = selectedParty.name;
      const partyId = selectedParty.id;

      // 1. Calculate new pending balance after payment
      const currentBalance = selectedParty.previous_balance;
      const newPendingBalance = Math.max(0, currentBalance - payAmount);

      // 2. Insert row into `legacy_ledger_entries` in Supabase
      const { error: ledgerErr } = await supabase.from('legacy_ledger_entries').insert([{
        restaurant_name: partyName,
        entry_date: paymentDate,
        voucher_type: 'Payment-in',
        payment_mode: paymentMode,
        credit: payAmount,
        debit: 0,
        balance: newPendingBalance,
        payment_status: 'paid'
      }]);

      if (ledgerErr) {
        console.error('Error inserting payment into legacy_ledger_entries:', ledgerErr.message);
      }

      // 3. Insert row into `payments` table with all alias field names
      const payPayload = {
        batch_num: targetBatchNum || activeBatchNum,
        batchNum: targetBatchNum || activeBatchNum,
        restaurant_name: partyName,
        restaurantName: partyName,
        amount: payAmount,
        mode: paymentMode,
        payment_mode: paymentMode,
        paymentMode: paymentMode,
        date: paymentDate,
        note: notes || `Payment Received (ID #${partyId})`,
        notes: notes || `Payment Received (ID #${partyId})`,
        created_by: currentUser,
        user_name: currentUser
      };

      if (onPaymentSuccess) {
        onPaymentSuccess(payPayload);
      } else {
        const { error: payErr } = await supabase.from('payments').insert([payPayload]);
        if (payErr) {
          console.error('Error inserting payment record:', payErr.message);
        }
      }

      alert(`✅ ₹${payAmount.toLocaleString('en-IN')} payment successfully received for ${partyName} (ID #${partyId})!\n\nNew Pending Balance: ₹${newPendingBalance.toLocaleString('en-IN')}`);

      // Reset form & close
      setSelectedParty(null);
      setSearchQuery('');
      setAmount('');
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Payment processing failed:', err);
      alert(`Payment receive fail hua: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 overflow-y-auto p-2 sm:p-4 flex flex-col justify-start sm:justify-center items-center">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 my-auto flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-scaleUp">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-base sm:text-lg font-black shrink-0">
              💳
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold tracking-wide truncate">Receive Party Payment</h2>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate">Search party with live autocomplete</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all font-bold cursor-pointer text-xs sm:text-sm shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
          
          {/* Autocomplete Party Search Box */}
          <div className="space-y-1.5 relative" ref={containerRef}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">
                Search & Select Party <span className="text-rose-500">*</span>
              </label>
              {selectedParty && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline"
                >
                  🔄 Change / Research
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Type party name (e.g. Bajrang) or ID (#8)..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSelectedParty(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                required
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all"
              />

              {/* Live Autocomplete Suggestions Floating Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
                  {suggestions.map(r => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => handleSelectParty(r)}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50/80 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black group-hover:bg-emerald-100 group-hover:text-emerald-800">
                            ID #{r.id}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-900">{r.name}</span>
                        </div>
                        {r.mobile && <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">📞 {r.mobile}</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-black ${r.previous_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ₹{r.previous_balance.toLocaleString('en-IN')}
                        </span>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Pending</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Party Live Pending Balance Card */}
          {selectedParty && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between animate-fadeIn">
              <div>
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Selected Party (ID #{selectedParty.id})</span>
                <h4 className="text-base font-black text-slate-900">{selectedParty.name}</h4>
                {selectedParty.mobile && <p className="text-xs font-bold text-slate-600">📞 Phone: {selectedParty.mobile}</p>}
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 block">Live Balance</span>
                <span className={`text-lg font-black ${selectedParty.previous_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  ₹{selectedParty.previous_balance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Batch Selector */}
          <div className="space-y-1.5 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200">
            <label className="block text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center justify-between">
              <span>💰 Cashflow Batch Destination</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                Batch #{targetBatchNum}
              </span>
            </label>
            <select
              value={targetBatchNum}
              onChange={e => setTargetBatchNum(Number(e.target.value))}
              className="w-full bg-white border border-emerald-300 focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-800 outline-none transition-all shadow-xs"
            >
              {batches && batches.length > 0 ? (
                [...batches].sort((a, b) => Number(b.batch) - Number(a.batch)).map(b => (
                  <option key={b.batch} value={b.batch}>
                    Batch #{b.batch} {Number(b.batch) === Number(activeBatchNum) ? '(Active Current Batch)' : ''}
                  </option>
                ))
              ) : (
                <>
                  <option value={133}>Batch #133 (Active Current Batch)</option>
                  <option value={132}>Batch #132</option>
                  <option value={131}>Batch #131</option>
                </>
              )}
            </select>
            <p className="text-[10.5px] text-emerald-700 font-medium">
              Ye payment sidha Cashflow & Wallet me isi batch ke wallet me add hoga.
            </p>
          </div>

          {/* Amount & Mode Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">
                Payment Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="e.g. 5000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm font-black text-slate-900 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none transition-all"
              >
                <option value="UPI">📱 UPI (GPay/PhonePe/Paytm)</option>
                <option value="Cash">💵 Cash</option>
                <option value="Cheque">🏦 Cheque</option>
                <option value="Bank Transfer">💳 Bank Transfer / NEFT</option>
              </select>
            </div>
          </div>

          {/* Date & Reference Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">
                Notes / Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Upi Ref #1928"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 outline-none transition-all"
              />
            </div>
          </div>

          </div>

          {/* Form Actions (Always visible at bottom of modal) */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Processing...' : '💳 Receive Payment'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
