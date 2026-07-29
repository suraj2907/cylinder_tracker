import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_DATA, computeAll } from './utils/dataUtils';
import Dashboard from './components/Dashboard';
import RestaurantsList from './components/RestaurantsList';
import BatchesList from './components/BatchesList';
import CalendarView from './components/CalendarView';
import AddEntry from './components/AddEntry';
import GasPredictor from './components/GasPredictor';
import { PaymentLedger } from './components/PaymentLedger';
import { PartnerActivityFeed } from './components/PartnerActivityFeed';
import { supabase } from './utils/supabaseClient';
import { useUser } from './context/UserContext';

export default function App() {
  const { currentUser, setCurrentUser } = useUser();
  const [tab, setTab] = useState("dashboard");

  // Local & Supabase state
  const [batches, setBatches] = useState(() => {
    try {
      const migrated = localStorage.getItem('cylinder_data_restore_v12');
      if (!migrated) {
        localStorage.removeItem('cylinder_data');
        localStorage.setItem('cylinder_data_restore_v12', 'true');
        return INITIAL_DATA;
      }
      const saved = localStorage.getItem('cylinder_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading data', e);
    }
    return INITIAL_DATA;
  });

  const [payments, setPayments] = useState(() => {
    try {
      const saved = localStorage.getItem('cylinder_payments');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading payments', e);
    }
    return [];
  });

  const [activities, setActivities] = useState([]);
  const [showActivityFeed, setShowActivityFeed] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total");
  const [batchSearch, setBatchSearch] = useState("");
  const [newEntry, setNewEntry] = useState({ name: "", qty: 1, type: "19.2kg-delivery", date: "", batchNum: "", isNewBatch: false, khaliDate: "" });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const isSupabaseConfigured = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(url && key && url !== 'your_supabase_project_url' && url.trim() !== '');
  }, []);

  const { restMap, dateMap, batchStats } = useMemo(() => computeAll(batches), [batches]);

  // Toast helper
  function showToast(msg, ok = true) { 
    setToast({ msg, ok }); 
    setTimeout(() => setToast(null), 3500); 
  }

  // Activity logger helper
  function addActivity(actionType, details, user = currentUser) {
    const newAct = {
      id: Date.now() + Math.random(),
      user,
      actionType,
      details,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setActivities(prev => [newAct, ...prev].slice(0, 50));
  }

  // Load from Supabase on start & initial sync
  useEffect(() => {
    if (isSupabaseConfigured) {
      setSyncing(true);
      const fetchData = async () => {
        try {
          // Fetch batches
          const fetchBatchesChain = async () => {
            let dbBatches = [];
            let batchFrom = 0;
            let batchTo = 999;
            let keepFetching = true;
            while (keepFetching) {
              const { data, error } = await supabase
                .from('batches')
                .select('*')
                .order('batch_num', { ascending: true })
                .range(batchFrom, batchTo);
              if (error) throw error;
              if (data && data.length > 0) {
                dbBatches = [...dbBatches, ...data];
                if (data.length < 1000) keepFetching = false;
                else { batchFrom += 1000; batchTo += 1000; }
              } else {
                keepFetching = false;
              }
            }
            return dbBatches;
          };

          // Fetch entries
          const fetchEntriesChain = async () => {
            let dbEntries = [];
            let entryFrom = 0;
            let entryTo = 999;
            let keepFetching = true;
            while (keepFetching) {
              const { data, error } = await supabase
                .from('entries')
                .select('*')
                .order('id', { ascending: true })
                .range(entryFrom, entryTo);
              if (error) throw error;
              if (data && data.length > 0) {
                dbEntries = [...dbEntries, ...data];
                if (data.length < 1000) keepFetching = false;
                else { entryFrom += 1000; entryTo += 1000; }
              } else {
                keepFetching = false;
              }
            }
            return dbEntries;
          };

          // Fetch payments
          const fetchPayments = async () => {
            const { data, error } = await supabase
              .from('payments')
              .select('*')
              .order('created_at', { ascending: false });
            if (error && error.code !== '42P01') {
              console.warn("Payments query error", error);
            }
            return data || [];
          };

          const [dbBatches, dbEntries, dbPayments] = await Promise.all([
            fetchBatchesChain(),
            fetchEntriesChain(),
            fetchPayments()
          ]);

          const batchesMap = {};
          dbBatches.forEach(b => {
            batchesMap[b.batch_num] = {
              batch: b.batch_num,
              khaliDate: b.khali_date || "",
              note: b.note || "",
              entries: []
            };
          });

          dbEntries.forEach(e => {
            const entryObj = {
              id: e.id,
              name: e.name,
              qty: e.qty,
              type: e.type,
              date: e.date || "",
              isReturn: e.is_return,
              user_name: e.user_name || 'Suraj'
            };
            
            if (batchesMap[e.batch_num]) {
              batchesMap[e.batch_num].entries.push(entryObj);
            } else {
              batchesMap[e.batch_num] = {
                batch: e.batch_num,
                khaliDate: e.date || "",
                note: "",
                entries: [entryObj]
              };
            }
          });

          const sortedBatches = Object.values(batchesMap).sort((a, b) => b.batch - a.batch);
          setBatches(sortedBatches);
          if (dbPayments.length > 0) {
            setPayments(dbPayments);
          }

          showToast("⚡ Supabase Connected & Real-time Live!");
        } catch (err) {
          console.error("Failed to load Supabase data:", err);
          showToast("⚠️ Using local mode.", false);
        } finally {
          setSyncing(false);
        }
      };

      fetchData();

      // ==========================================
      // SUPABASE REAL-TIME WEBSOCKET SUBSCRIPTION
      // ==========================================
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'entries' },
          (payload) => {
            console.log('⚡ Realtime Entries Event:', payload);
            if (payload.eventType === 'INSERT') {
              const newRec = payload.new;
              const partner = newRec.user_name || 'Partner';
              
              const entryObj = {
                id: newRec.id,
                name: newRec.name,
                qty: newRec.qty,
                type: newRec.type,
                date: newRec.date || "",
                isReturn: newRec.is_return,
                user_name: partner
              };

              setBatches(prev => {
                const ex = prev.find(b => b.batch === newRec.batch_num);
                if (ex) {
                  return prev.map(b => b.batch === newRec.batch_num ? { ...b, entries: [...b.entries, entryObj] } : b);
                } else {
                  return [...prev, { batch: newRec.batch_num, khaliDate: newRec.date || "", note: "", entries: [entryObj] }].sort((a, b) => b.batch - a.batch);
                }
              });

              if (partner !== currentUser) {
                showToast(`🔔 ${partner} added ${newRec.qty}x ${newRec.type} for ${newRec.name} (Batch #${newRec.batch_num})!`);
              }
              addActivity("Added Entry", `${newRec.qty}x ${newRec.type} for ${newRec.name} (Batch #${newRec.batch_num})`, partner);
            } else if (payload.eventType === 'DELETE') {
              const oldId = payload.old.id;
              setBatches(prev => prev.map(b => ({
                ...b,
                entries: b.entries.filter(e => e.id !== oldId)
              })));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payments' },
          (payload) => {
            console.log('⚡ Realtime Payments Event:', payload);
            if (payload.eventType === 'INSERT') {
              const newPay = payload.new;
              setPayments(prev => [newPay, ...prev.filter(p => p.id !== newPay.id)]);
              const partner = newPay.user_name || 'Partner';
              if (partner !== currentUser) {
                showToast(`💳 ${partner} recorded ₹${newPay.amount} payment for ${newPay.restaurant_name}!`);
              }
              addActivity("Payment Recorded", `₹${newPay.amount} (${newPay.payment_mode}) for ${newPay.restaurant_name}`, partner);
            } else if (payload.eventType === 'DELETE') {
              const oldId = payload.old.id;
              setPayments(prev => prev.filter(p => p.id !== oldId));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isSupabaseConfigured, currentUser]);

  // Guarded LocalStorage sync
  useEffect(() => {
    if (!loading && !syncing) {
      localStorage.setItem('cylinder_data', JSON.stringify(batches));
    }
  }, [batches, loading, syncing]);

  useEffect(() => {
    localStorage.setItem('cylinder_payments', JSON.stringify(payments));
  }, [payments]);

  // PWA Prompt Handler
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User installed the PWA');
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Download Backup Helper
  function handleDownload() {
    const exportObject = {
      batches,
      payments,
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `cylinder_data_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast("✅ Complete Backup Downloaded!");
  }

  // Compute aggregated calculations
  const restaurants = useMemo(() =>
    Object.entries(restMap)
      .map(([name, d]) => {
        const kg21 = d["21kg"] || 0;
        const kg192 = d["19.2kg"] || 0;
        const empty = d["Empty"] || 0;
        const empty21 = d["Empty21kg"] || 0;
        const empty192 = d["Empty19.2kg"] || 0;
        const total = kg21 + kg192;
        const outstanding = total - empty;
        return { name, kg21, kg192, empty, empty21, empty192, total, outstanding };
      })
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "21kg") return b.kg21 - a.kg21;
        if (sortBy === "19.2kg") return b.kg192 - a.kg192;
        if (sortBy === "empty") return b.empty - a.empty;
        if (sortBy === "empty21") return b.empty21 - a.empty21;
        if (sortBy === "empty192") return b.empty192 - a.empty192;
        if (sortBy === "outstanding") return b.outstanding - a.outstanding;
        if (sortBy === "az") return a.name.localeCompare(b.name);
        if (sortBy === "za") return b.name.localeCompare(a.name);
        return b.total - a.total;
      }),
    [restMap, search, sortBy]);

  const tot21 = useMemo(() => Object.values(restMap).reduce((s, v) => s + (v["21kg"] || 0), 0), [restMap]);
  const tot192 = useMemo(() => Object.values(restMap).reduce((s, v) => s + (v["19.2kg"] || 0), 0), [restMap]);
  const totEmpty = useMemo(() => Object.values(restMap).reduce((s, v) => s + (v["Empty"] || 0), 0), [restMap]);
  const totEmpty21 = useMemo(() => Object.values(restMap).reduce((s, v) => s + (v["Empty21kg"] || 0), 0), [restMap]);
  const totEmpty192 = useMemo(() => Object.values(restMap).reduce((s, v) => s + (v["Empty19.2kg"] || 0), 0), [restMap]);
  const totAll = tot21 + tot192;
  const totOutstanding = totAll - totEmpty;

  const filteredBatches = useMemo(() => {
    if (!batchSearch) return batchStats;
    const q = batchSearch.toLowerCase();
    return batchStats.filter(b =>
      String(b.batch).includes(q) ||
      (b.khaliDate && b.khaliDate.includes(q)) ||
      (b.note && b.note.toLowerCase().includes(q))
    );
  }, [batchStats, batchSearch]);

  // Add Entry Handler
  async function handleAdd() {
    const { name, qty, type, date, batchNum, khaliDate } = newEntry;
    if (!name.trim() || !qty || !date) { showToast("Name, qty aur date bharo ❌", false); return; }
    const num = parseInt(batchNum);
    if (!num) { showToast("Batch number bharo ❌", false); return; }
    
    let parsedType = "19.2kg";
    let isReturn = false;
    
    if (type === "19.2kg-delivery") {
      parsedType = "19.2kg"; isReturn = false;
    } else if (type === "21kg-delivery") {
      parsedType = "21kg"; isReturn = false;
    } else if (type === "19.2kg-return") {
      parsedType = "19.2kg"; isReturn = true;
    } else if (type === "21kg-return") {
      parsedType = "21kg"; isReturn = true;
    } else {
      parsedType = type;
    }

    const entry = { 
      name: name.trim(), 
      qty: parseInt(qty) || 1, 
      type: parsedType, 
      date,
      ...(isReturn ? { isReturn: true } : {}),
      user_name: currentUser
    };
    
    if (isSupabaseConfigured) {
      try {
        setLoading(true);
        const ex = batches.find(b => b.batch === num);

        const { error: batchErr } = await supabase.from('batches').upsert({
          batch_num: num,
          khali_date: ex ? (ex.khaliDate || null) : (khaliDate || date || null),
          note: ex ? (ex.note || null) : null
        });
        if (batchErr) throw batchErr;

        const { data: insertedData, error: entryErr } = await supabase.from('entries').insert({
          batch_num: num,
          name: name.trim(),
          qty: parseInt(qty) || 1,
          type: parsedType,
          date: date || null,
          is_return: isReturn,
          user_name: currentUser
        }).select();
        if (entryErr) throw entryErr;

        const insertedId = insertedData?.[0]?.id;
        const entryWithId = { ...entry, id: insertedId };

        setBatches(prev => {
          const ex = prev.find(b => b.batch === num);
          if (ex) {
            return prev.map(b => b.batch === num ? { ...b, entries: [...b.entries, entryWithId] } : b);
          } else {
            return [...prev, { batch: num, khaliDate: khaliDate || date, note: "", entries: [entryWithId] }].sort((a, b) => b.batch - a.batch);
          }
        });

        addActivity("Added Entry", `${qty}x ${parsedType} ${isReturn ? 'Return' : 'Delivery'} for ${name} (Batch #${num})`);
        showToast(`✅ ${name} - ${qty} ${parsedType} ${isReturn ? 'Khali Return' : 'Delivery'} batch #${num} me add ho gaya!`);
        setNewEntry(p => ({ ...p, name: "", qty: 1 }));
      } catch (err) {
        console.error("Supabase write error:", err);
        showToast("Supabase save error ❌", false);
      } finally {
        setLoading(false);
      }
    } else {
      setBatches(prev => {
        const ex = prev.find(b => b.batch === num);
        if (ex) {
          return prev.map(b => b.batch === num ? { ...b, entries: [...b.entries, entry] } : b);
        } else {
          return [...prev, { batch: num, khaliDate: khaliDate || date, note: "", entries: [entry] }].sort((a, b) => b.batch - a.batch);
        }
      });
      addActivity("Added Entry (Local)", `${qty}x ${parsedType} for ${name} (Batch #${num})`);
      showToast(`✅ ${name} - ${qty} ${parsedType} added (Local Mode)!`);
      setNewEntry(p => ({ ...p, name: "", qty: 1 }));
    }
  }

  // Delete Entry Handler
  async function handleDeleteEntry(batchNum, originalEntry) {
    if (window.confirm("Sach me ye entry delete karni hai?")) {
      if (isSupabaseConfigured) {
        try {
          setLoading(true);
          if (originalEntry.id) {
            const { error } = await supabase.from('entries').delete().eq('id', originalEntry.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('entries').delete()
              .eq('batch_num', batchNum)
              .eq('name', originalEntry.name)
              .eq('qty', originalEntry.qty)
              .eq('type', originalEntry.type);
            if (error) throw error;
          }

          setBatches(prev => prev.map(b => {
            if (b.batch === batchNum) {
              return { ...b, entries: b.entries.filter(e => e !== originalEntry) };
            }
            return b;
          }));
          addActivity("Deleted Entry", `Entry for ${originalEntry.name} from Batch #${batchNum}`);
          showToast("🗑️ Entry delete ho gayi!");
        } catch (err) {
          console.error("Supabase delete error:", err);
          showToast("Delete error ❌", false);
        } finally {
          setLoading(false);
        }
      } else {
        setBatches(prev => prev.map(b => {
          if (b.batch === batchNum) {
            return { ...b, entries: b.entries.filter(e => e !== originalEntry) };
          }
          return b;
        }));
        showToast("🗑️ Delete local mode!");
      }
    }
  }

  // Add Payment Handler
  async function handleAddPayment(paymentData) {
    if (isSupabaseConfigured) {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('payments').insert({
          restaurant_name: paymentData.restaurantName,
          batch_num: paymentData.batchNum,
          amount: paymentData.amount,
          payment_mode: paymentData.paymentMode,
          user_name: currentUser,
          date: paymentData.date,
          note: paymentData.note
        }).select();

        if (error && error.code !== '42P01') {
          console.warn("Payments table error", error);
        }

        const inserted = data?.[0] || { ...paymentData, id: Date.now() };
        setPayments(prev => [inserted, ...prev]);
        addActivity("Payment Recorded", `₹${paymentData.amount} (${paymentData.paymentMode}) for ${paymentData.restaurantName}`);
        showToast(`💳 Payment ₹${paymentData.amount} for ${paymentData.restaurantName} saved!`);
      } catch (err) {
        console.error("Payment save error:", err);
        setPayments(prev => [{ ...paymentData, id: Date.now() }, ...prev]);
        showToast("💳 Payment saved in local mode!");
      } finally {
        setLoading(false);
      }
    } else {
      setPayments(prev => [{ ...paymentData, id: Date.now() }, ...prev]);
      showToast("💳 Payment saved (Local Mode)!");
    }
  }

  // Delete Payment Handler
  async function handleDeletePayment(paymentObj) {
    if (window.confirm(`Delete payment ₹${paymentObj.amount} for ${paymentObj.restaurant_name || paymentObj.restaurantName}?`)) {
      if (isSupabaseConfigured && paymentObj.id) {
        try {
          await supabase.from('payments').delete().eq('id', paymentObj.id);
        } catch (e) {
          console.error(e);
        }
      }
      setPayments(prev => prev.filter(p => p !== paymentObj));
      showToast("🗑️ Payment deleted!");
    }
  }

  // Update Batch Booking Cost Handler
  async function handleUpdateBatchCost(batchNum, cost) {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('batches').upsert({
          batch_num: batchNum,
          booking_cost: cost
        });
      } catch (e) {
        console.error("Batch cost save error", e);
      }
    }
    setBatches(prev => prev.map(b => b.batch === batchNum ? { ...b, bookingCost: cost, booking_cost: cost } : b));
    addActivity("Batch Cost Updated", `Batch #${batchNum} booking cost set to ₹${cost.toLocaleString()}`);
    showToast(`💰 Batch #${batchNum} booking cost set to ₹${cost.toLocaleString()}!`);
  }

  const TABS = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "restaurants", label: "🏪 Restaurants" },
    { id: "payments", label: "💰 Batch Cashflow & Wallet" },
    { id: "calendar", label: "📅 Calendar" },
    { id: "batches", label: "📦 Batches & Cashflow" },
    { id: "gasPredictor", label: "🔮 Gas Predictor" },
    { id: "add", label: "➕ Add Entry" },
  ];
  
  // Calculate global booking cash balance
  const totalBatchCosts = useMemo(() => batches.reduce((s, b) => s + (parseFloat(b.bookingCost || b.booking_cost) || 0), 0), [batches]);
  const totalCollectionsAll = useMemo(() => payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), [payments]);
  const netBookingWallet = totalCollectionsAll - totalBatchCosts;

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
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulseGlow"></span>
              <span className="text-base font-black text-textSlate tracking-tight">Cylinder Tracker</span>
            </div>

            {/* Active User Switcher Pill (Suraj vs Shivam) */}
            <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
              <button
                onClick={() => setCurrentUser('Suraj')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentUser === 'Suraj'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                👨‍💼 Suraj
              </button>
              <button
                onClick={() => setCurrentUser('Shivam')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentUser === 'Shivam'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                👨‍💻 Shivam
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

            {isInstallable && (
              <button 
                className="px-3 py-2 rounded-xl text-xs font-bold border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 transition-all"
                onClick={handleInstallClick}>
                📲 Install App
              </button>
            )}
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
            <option value="restaurants">🏪 Restaurants</option>
            <option value="payments">💰 Batch Cashflow & Wallet</option>
            <option value="calendar">📅 Calendar</option>
            <option value="batches">📦 Batches & Cashflow</option>
            <option value="gasPredictor">🔮 Gas Predictor</option>
          </select>

          <button 
            onClick={() => setTab("add")}
            className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 text-white shadow-soft flex items-center gap-1">
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
          {tab === "restaurants" && <RestaurantsList restaurants={restaurants} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totEmpty21={totEmpty21} totEmpty192={totEmpty192} totAll={totAll} totOutstanding={totOutstanding} search={search} setSearch={setSearch} sortBy={sortBy} setSortBy={setSortBy} />}
          {tab === "payments" && <PaymentLedger payments={payments} onAddPayment={handleAddPayment} onDeletePayment={handleDeletePayment} batches={batches} onUpdateBatchCost={handleUpdateBatchCost} restMap={restMap} />}
          {tab === "calendar" && <CalendarView dateMap={dateMap} selectedDate={selectedDate} setSelectedDate={setSelectedDate} handleDeleteEntry={handleDeleteEntry} />}
          {tab === "batches" && <BatchesList filteredBatches={filteredBatches} batchSearch={batchSearch} setBatchSearch={setBatchSearch} payments={payments} onUpdateBatchCost={handleUpdateBatchCost} onAddPayment={handleAddPayment} onDeletePayment={handleDeletePayment} restMap={restMap} />}
          {tab === "add" && <AddEntry newEntry={newEntry} setNewEntry={setNewEntry} handleAdd={handleAdd} restMap={restMap} isInstallable={isInstallable} handleInstallClick={handleInstallClick} />}
          {tab === "gasPredictor" && <GasPredictor restaurants={restaurants} batches={batches} />}
        </div>
      </div>
    </div>
  );
}
