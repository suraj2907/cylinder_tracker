import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_DATA, computeAll } from './utils/dataUtils';
import Dashboard from './components/Dashboard';
import RestaurantsList from './components/RestaurantsList';
import BatchesList from './components/BatchesList';
import CalendarView from './components/CalendarView';
import AddEntry from './components/AddEntry';
import GasPredictor from './components/GasPredictor';
import AgingTracker from './components/AgingTracker';
import { supabase } from './utils/supabaseClient';export default function App() {
  const [tab, setTab] = useState("dashboard");
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

  // Load from Supabase on start if configured
  useEffect(() => {
    if (isSupabaseConfigured) {
      setSyncing(true);
      const fetchData = async () => {
        try {
          // Fetch batches and entries in parallel sequential chains
          const fetchBatchesChain = async () => {
            let dbBatches = [];
            let batchFrom = 0;
            let batchTo = 999;
            let keepFetchingBatches = true;
            while (keepFetchingBatches) {
              const { data, error } = await supabase
                .from('batches')
                .select('*')
                .order('batch_num', { ascending: true })
                .range(batchFrom, batchTo);
              if (error) throw error;
              if (data && data.length > 0) {
                dbBatches = [...dbBatches, ...data];
                if (data.length < 1000) keepFetchingBatches = false;
                else { batchFrom += 1000; batchTo += 1000; }
              } else {
                keepFetchingBatches = false;
              }
            }
            return dbBatches;
          };

          const fetchEntriesChain = async () => {
            let dbEntries = [];
            let entryFrom = 0;
            let entryTo = 999;
            let keepFetchingEntries = true;
            while (keepFetchingEntries) {
              const { data, error } = await supabase
                .from('entries')
                .select('*')
                .order('id', { ascending: true })
                .range(entryFrom, entryTo);
              if (error) throw error;
              if (data && data.length > 0) {
                dbEntries = [...dbEntries, ...data];
                if (data.length < 1000) keepFetchingEntries = false;
                else { entryFrom += 1000; entryTo += 1000; }
              } else {
                keepFetchingEntries = false;
              }
            }
            return dbEntries;
          };

          // Execute sequential chains in parallel
          const [dbBatches, dbEntries] = await Promise.all([
            fetchBatchesChain(),
            fetchEntriesChain()
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
              isReturn: e.is_return
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

          if (dbBatches.length === 0) {
            showToast("ℹ️ Supabase setup ready! Please run data import script.", true);
          } else {
            showToast("⚡ Supabase Connected!");
          }
        } catch (err) {
          console.error("Failed to load Supabase data:", err);
          showToast("⚠️ Supabase connection failed! Using local cache.", false);
        } finally {
          setSyncing(false);
        }
      };
      fetchData();
    }
  }, [isSupabaseConfigured]);

  // Guarded local storage synchronization
  useEffect(() => {
    if (!loading && !syncing) {
      localStorage.setItem('cylinder_data', JSON.stringify(batches));
    }
  }, [batches, loading, syncing]);
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

  // Toast helper
  function showToast(msg, ok = true) { 
    setToast({ msg, ok }); 
    setTimeout(() => setToast(null), 3000); 
  }

  // Download Data Helper
  function handleDownload() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(batches, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'cylinder_data_backup.json';
    a.click();
    showToast("✅ Data Downloaded Successfully!");
  }

  // Totals
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

  // Add entry logic
  async function handleAdd() {
    const { name, qty, type, date, batchNum, isNewBatch, khaliDate } = newEntry;
    if (!name.trim() || !qty || !date) { showToast("Name, qty aur date sab bharo ❌", false); return; }
    const num = parseInt(batchNum);
    if (!num) { showToast("Batch number bharo ❌", false); return; }
    
    // Parse granular UI type selection into schema structure
    let parsedType = "19.2kg";
    let isReturn = false;
    
    if (type === "19.2kg-delivery") {
      parsedType = "19.2kg";
      isReturn = false;
    } else if (type === "21kg-delivery") {
      parsedType = "21kg";
      isReturn = false;
    } else if (type === "19.2kg-return") {
      parsedType = "19.2kg";
      isReturn = true;
    } else if (type === "21kg-return") {
      parsedType = "21kg";
      isReturn = true;
    } else {
      // Fallback for safety
      parsedType = type;
    }

    const entry = { 
      name: name.trim(), 
      qty: parseInt(qty) || 1, 
      type: parsedType, 
      date,
      ...(isReturn ? { isReturn: true } : {})
    };
    
    if (isSupabaseConfigured) {
      try {
        setLoading(true);
        // Find if batch exists locally so we know its khaliDate and note
        const ex = batches.find(b => b.batch === num);

        // 1. Upsert the batch in Supabase
        const { error: batchErr } = await supabase.from('batches').upsert({
          batch_num: num,
          khali_date: ex ? (ex.khaliDate || null) : (khaliDate || date || null),
          note: ex ? (ex.note || null) : null
        });
        if (batchErr) throw batchErr;

        // 2. Insert entry
        const { data: insertedData, error: entryErr } = await supabase.from('entries').insert({
          batch_num: num,
          name: name.trim(),
          qty: parseInt(qty) || 1,
          type: parsedType,
          date: date || null,
          is_return: isReturn
        }).select();
        if (entryErr) throw entryErr;

        const insertedId = insertedData?.[0]?.id;
        const entryWithId = {
          ...entry,
          id: insertedId
        };

        setBatches(prev => {
          const ex = prev.find(b => b.batch === num);
          if (ex) {
            return prev.map(b => b.batch === num ? { ...b, entries: [...b.entries, entryWithId] } : b);
          } else {
            return [...prev, { batch: num, khaliDate: khaliDate || date, note: "", entries: [entryWithId] }].sort((a, b) => b.batch - a.batch);
          }
        });

        showToast(`✅ ${name} - ${qty} ${parsedType} ${isReturn ? 'Khali Return' : 'Delivery'} batch #${num} mein add ho gaya!`);
        setNewEntry(p => ({ ...p, name: "", qty: 1 }));
      } catch (err) {
        console.error("Supabase write error:", err);
        showToast("Supabase database mein save nahi ho paya ❌", false);
      } finally {
        setLoading(false);
      }
    } else {
      // Local cache mode fallback
      setBatches(prev => {
        const ex = prev.find(b => b.batch === num);
        if (ex) {
          return prev.map(b => b.batch === num ? { ...b, entries: [...b.entries, entry] } : b);
        } else {
          return [...prev, { batch: num, khaliDate: khaliDate || date, note: "", entries: [entry] }].sort((a, b) => b.batch - a.batch);
        }
      });
      showToast(`✅ ${name} - ${qty} ${parsedType} ${isReturn ? 'Khali Return' : 'Delivery'} batch #${num} mein add ho gaya (Local Mode)!`);
      setNewEntry(p => ({ ...p, name: "", qty: 1 }));
    }
  }

  async function handleDeleteEntry(batchNum, originalEntry) {
    if (window.confirm("Sach mein yeh entry delete karni hai?")) {
      if (isSupabaseConfigured) {
        try {
          setLoading(true);
          if (originalEntry.id) {
            // Delete directly by ID
            const { error } = await supabase.from('entries').delete().eq('id', originalEntry.id);
            if (error) throw error;
          } else {
            // Fallback matching fields
            const { error } = await supabase.from('entries').delete()
              .eq('batch_num', batchNum)
              .eq('name', originalEntry.name)
              .eq('qty', originalEntry.qty)
              .eq('type', originalEntry.type)
              .eq('date', originalEntry.date || null)
              .eq('is_return', !!originalEntry.isReturn);
            if (error) throw error;
          }

          setBatches(prev => prev.map(b => {
            if (b.batch === batchNum) {
              return { ...b, entries: b.entries.filter(e => e !== originalEntry) };
            }
            return b;
          }));
          showToast("🗑️ Entry delete ho gayi!");
        } catch (err) {
          console.error("Supabase delete error:", err);
          showToast("Supabase se delete karne mein error aaya ❌", false);
        } finally {
          setLoading(false);
        }
      } else {
        // Local mode fallback
        setBatches(prev => prev.map(b => {
          if (b.batch === batchNum) {
            return { ...b, entries: b.entries.filter(e => e !== originalEntry) };
          }
          return b;
        }));
        showToast("🗑️ Entry delete ho gayi (Local Mode)!");
      }
    }
  }

  const TABS = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "restaurants", label: "🏪 Restaurants" },
    { id: "calendar", label: "📅 Calendar" },
    { id: "batches", label: "📦 Batches" },
    { id: "gasPredictor", label: "🔮 Gas Predictor" },
    { id: "agingTracker", label: "🚨 Aging Tracker" },
    { id: "add", label: "➕ Add Entry" },
  ];

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl font-bold text-xs z-[9999] shadow-lg shadow-black/40 transition-all duration-300 animate-fadeIn ${
          toast.ok ? 'bg-green-500 text-darkBg' : 'bg-accentOrange text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Premium Glassmorphism Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-[#070b12]/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-accentOrange/20 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-accentOrange animate-spin"></div>
          </div>
          <div className="text-sm font-bold text-textSlate tracking-wider animate-pulse">
            Connecting to Supabase Database...
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#0d1520] to-cardBg border-b border-customBorder/50 px-5 py-4 sticky top-0 z-50 flex items-center justify-between flex-wrap gap-4 backdrop-blur-md bg-opacity-95">
        <div>
          <div className="text-lg font-black text-accentOrange tracking-wider flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-accentOrange animate-pulse"></span>
            Cylinder Tracker
            {syncing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-accentCyan/10 text-accentCyan border border-accentCyan/30 animate-pulse ml-2">
                🔄 Syncing Supabase...
              </span>
            )}
          </div>
          <div className="text-[10px] text-mutedSlate font-semibold uppercase tracking-wider mt-0.5">
            LPG Management • {batches.length} batches • {totAll} total cylinders
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <div className="hidden lg:flex items-center gap-2 flex-wrap">
            {TABS.map(t => (
              <button 
                key={t.id} 
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 border ${
                  tab === t.id 
                    ? 'border-accentOrange bg-accentOrange/10 text-accentOrange' 
                    : 'border-customBorder bg-transparent text-mutedSlate hover:text-textSlate'
                }`}
                onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Responsive Mobile Navigation (Hidden on desktop) */}
          <div className="flex lg:hidden items-center justify-between w-full sm:w-auto gap-2">
            {/* View Selector Dropdown */}
            <select
              value={tab}
              onChange={e => setTab(e.target.value)}
              className="bg-cardBg border border-customBorder rounded-lg px-3 py-2 text-textSlate focus:outline-none focus:border-accentCyan text-xs font-bold w-40 transition-colors"
            >
              <option value="dashboard">📊 Dashboard</option>
              <option value="restaurants">🏪 Restaurants</option>
              <option value="calendar">📅 Calendar</option>
              <option value="batches">📦 Batches</option>
              <option value="gasPredictor">🔮 Gas Predictor</option>
              <option value="agingTracker">🚨 Aging Tracker</option>
            </select>

            {/* Prominent Add Button */}
            <button 
              onClick={() => setTab("add")}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 active:scale-95 border shadow-sm flex items-center gap-1 ${
                tab === 'add' 
                  ? 'border-accentOrange bg-accentOrange/20 text-accentOrange' 
                  : 'border-accentOrange bg-accentOrange/10 text-accentOrange'
              }`}>
              ➕ Add Entry
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
            <button 
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 active:scale-95 text-green-400 flex items-center gap-1.5 transition-all duration-200"
              onClick={handleDownload}>
              💾 Download Data
            </button>
            {isInstallable && (
              <button 
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-accentCyan/30 bg-accentCyan/10 hover:bg-accentCyan/20 active:scale-95 text-accentCyan flex items-center gap-1.5 transition-all duration-200"
                onClick={handleInstallClick}>
                📲 Install App
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fadeIn" key={tab}>
        {/* STAT STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-3 mb-6">
          {[
            { label: "Total Delivered", value: totAll, border: "border-t-4 border-accentOrange" },
            { label: "21 KG Del", value: tot21, border: "border-t-4 border-accentCyan" },
            { label: "19.2 KG Del", value: tot192, border: "border-t-4 border-accentBlueGreen" },
            { label: "21 KG Khali", value: totEmpty21, border: "border-t-4 border-accentCyan" },
            { label: "19.2 KG Khali", value: totEmpty192, border: "border-t-4 border-accentBlueGreen" },
            { label: "Total Khali", value: totEmpty, border: "border-t-4 border-mutedSlate" },
            { label: "Outstanding", value: totOutstanding, border: "border-t-4 border-accentYellow" },
            { label: "Restaurants", value: Object.keys(restMap).length, border: "border-t-4 border-accentPurple" },
            { label: "Batches", value: batches.length, border: "border-t-4 border-customBorder" }
          ].map(({ label, value, border }) => (
            <div key={label} className={`bg-cardBg border border-customBorder rounded-xl p-3 text-center transition-all duration-300 hover:scale-[1.03] ${border}`}>
              <div className="text-xl font-black text-textSlate tracking-tight">{value.toLocaleString()}</div>
              <div className="text-[9px] font-bold text-mutedSlate uppercase tracking-wider mt-1.5 truncate" title={label}>{label}</div>
            </div>
          ))}
        </div>

        {tab === "dashboard" && <Dashboard restaurants={restaurants} batchStats={batchStats} restMap={restMap} totAll={totAll} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totOutstanding={totOutstanding} />}
        {tab === "restaurants" && <RestaurantsList restaurants={restaurants} tot21={tot21} tot192={tot192} totEmpty={totEmpty} totEmpty21={totEmpty21} totEmpty192={totEmpty192} totAll={totAll} totOutstanding={totOutstanding} search={search} setSearch={setSearch} sortBy={sortBy} setSortBy={setSortBy} />}
        {tab === "calendar" && <CalendarView dateMap={dateMap} selectedDate={selectedDate} setSelectedDate={setSelectedDate} handleDeleteEntry={handleDeleteEntry} />}
        {tab === "batches" && <BatchesList filteredBatches={filteredBatches} batchSearch={batchSearch} setBatchSearch={setBatchSearch} />}
        {tab === "add" && <AddEntry newEntry={newEntry} setNewEntry={setNewEntry} handleAdd={handleAdd} restMap={restMap} isInstallable={isInstallable} handleInstallClick={handleInstallClick} />}
        {tab === "gasPredictor" && <GasPredictor restaurants={restaurants} batches={batches} />}
        {tab === "agingTracker" && <AgingTracker restaurants={restaurants} batches={batches} />}
      </div>
    </>
  );
}
