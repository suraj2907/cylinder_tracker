import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { INITIAL_DATA, computeAll } from '../utils/dataUtils';
import { supabase } from '../utils/supabaseClient';

export function useCylinderData(currentUser) {
  const isSupabaseConfigured = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return !!(url && key && url !== 'your_supabase_project_url' && url.trim() !== '');
  }, []);

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
  const [loading] = useState(false);
  const [syncing, setSyncing] = useState(isSupabaseConfigured);

  const { restMap, dateMap, batchStats } = useMemo(() => computeAll(batches), [batches]);

  // Toast helper
  function showToast(msg, ok = true) { 
    setToast({ msg, ok }); 
    setTimeout(() => setToast(null), 4000); 
  }

  // Activity logger helper
  const addActivity = useCallback((actionType, details, user = currentUser) => {
    const newAct = {
      id: Date.now() + Math.random(),
      user,
      actionType,
      details,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setActivities(prev => [newAct, ...prev].slice(0, 50));
  }, [currentUser]);

  // Refs to avoid websocket subscription teardown loops
  const batchesRef = useRef(batches);
  const paymentsRef = useRef(payments);
  const addActivityRef = useRef(addActivity);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  useEffect(() => {
    paymentsRef.current = payments;
  }, [payments]);

  useEffect(() => {
    addActivityRef.current = addActivity;
  }, [addActivity]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Load from Supabase on start & initial sync
  useEffect(() => {
    if (isSupabaseConfigured) {
      const fetchData = async () => {
        try {
          // Fast parallel fetching for batches, entries, and payments
          const fetchBatchesChain = async () => {
            const { data } = await supabase.from('batches').select('*').order('batch_num', { ascending: true }).range(0, 999);
            return data || [];
          };

          const fetchEntriesChain = async () => {
            const ranges = [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999], [5000, 5999], [6000, 6999]];
            const res = await Promise.all(ranges.map(([f, t]) => supabase.from('entries').select('*').range(f, t)));
            return res.flatMap(r => r.data || []);
          };

          const fetchPaymentsChain = async () => {
            const ranges = [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999]];
            const res = await Promise.all(ranges.map(([f, t]) => supabase.from('payments').select('*').order('id', { ascending: true }).range(f, t)));
            return res.flatMap(r => r.data || []);
          };

          const [dbBatches, dbEntries, dbPayments] = await Promise.all([
            fetchBatchesChain(),
            fetchEntriesChain(),
            fetchPaymentsChain()
          ]);

          // Capture any unsynced local entries BEFORE they get overwritten below
          const localUnsyncedEntries = [];
          (batchesRef.current || []).forEach(b => {
            (b.entries || []).forEach(e => {
              if (e.unsynced || (typeof e.id === 'string' && e.id.startsWith('entry_'))) {
                localUnsyncedEntries.push({ batchNum: b.batch, entry: e });
              }
            });
          });

          // Capture any unsynced local payments
          const localUnsyncedPayments = [];
          (paymentsRef.current || []).forEach(p => {
            if (p.unsynced || (typeof p.id === 'string' && p.id.startsWith('pay_'))) {
              localUnsyncedPayments.push(p);
            }
          });

          const batchesMap = {};

          // 1. Load historical base batches (#1 to #120) from INITIAL_DATA
          (INITIAL_DATA || []).forEach(b => {
            batchesMap[b.batch] = {
              batch: b.batch,
              khaliDate: b.khaliDate || "",
              note: b.note || "",
              bookingCost: b.bookingCost || b.booking_cost || 0,
              booking_cost: b.bookingCost || b.booking_cost || 0,
              entries: (b.entries || []).map(e => ({ ...e }))
            };
          });

          // 2. Load DB batches (#117 to #128) - INCLUDING booking_cost mapping!
          dbBatches.forEach(b => {
            const bCost = parseFloat(b.booking_cost || b.bookingCost) || 0;
            if (!batchesMap[b.batch_num]) {
              batchesMap[b.batch_num] = {
                batch: b.batch_num,
                khaliDate: b.khali_date || "",
                note: b.note || "",
                bookingCost: bCost,
                booking_cost: bCost,
                entries: []
              };
            } else {
              if (b.khali_date) batchesMap[b.batch_num].khaliDate = b.khali_date;
              if (b.note) batchesMap[b.batch_num].note = b.note;
              if (bCost > 0 || b.booking_cost !== undefined) {
                batchesMap[b.batch_num].bookingCost = bCost;
                batchesMap[b.batch_num].booking_cost = bCost;
              }
            }
          });

          // 3. Clear entries for active DB batches so DB entries are authoritative
          const dbBatchNums = new Set(dbBatches.map(b => b.batch_num));
          dbBatchNums.forEach(bNum => {
            if (batchesMap[bNum]) {
              batchesMap[bNum].entries = [];
            }
          });

          // 4. Populate DB entries cleanly
          dbEntries.forEach(e => {
            const bNum = e.batch_num;
            if (!batchesMap[bNum]) {
              batchesMap[bNum] = {
                batch: bNum,
                khaliDate: e.date || "",
                note: "",
                bookingCost: 0,
                booking_cost: 0,
                entries: []
              };
            }
            batchesMap[bNum].entries.push({
              id: e.id,
              name: e.name,
              qty: e.qty,
              type: e.type,
              date: e.date || "",
              isReturn: !!e.is_return,
              user_name: e.user_name || 'Suraj'
            });
          });

          // Re-inject any unsynced local entries that never made it into Supabase
          localUnsyncedEntries.forEach(({ batchNum, entry }) => {
            if (!batchesMap[batchNum]) {
              batchesMap[batchNum] = { batch: batchNum, khaliDate: entry.date || "", note: "", entries: [] };
            }
            const alreadyExists = batchesMap[batchNum].entries.some(e =>
              e.name === entry.name && e.qty === entry.qty && e.type === entry.type && e.date === entry.date
            );
            if (!alreadyExists) {
              batchesMap[batchNum].entries.push(entry);
            }
          });

          const finalBatches = Object.values(batchesMap).sort((a, b) => b.batch - a.batch);
          setBatches(finalBatches);
          try {
            localStorage.setItem('cylinder_data', JSON.stringify(finalBatches));
          } catch (err) {
            console.warn("Storage sync failed", err);
          }

          // Auto-retry pushing any recovered unsynced entries to Supabase sequentially
          if (localUnsyncedEntries.length > 0) {
            showToast(`🔄 ${localUnsyncedEntries.length} unsynced entries mile, sync dobara try ho raha hai...`, false);
            for (const { batchNum, entry } of localUnsyncedEntries) {
              try {
                const validKhaliDate = entry.date && entry.date.trim() ? entry.date.trim() : new Date().toISOString().split('T')[0];
                await supabase.from('batches').upsert({ batch_num: batchNum, khali_date: validKhaliDate });
                
                const entryPayload = {
                  batch_num: batchNum,
                  name: entry.name,
                  qty: entry.qty,
                  type: entry.type,
                  date: validKhaliDate,
                  is_return: !!entry.isReturn,
                  user_name: entry.user_name || currentUserRef.current
                };

                let { data: retryData, error: retryErr } = await supabase.from('entries').insert(entryPayload).select();

                if (retryErr) {
                  console.error("Retry sync failed for entry:", entry, retryErr);
                } else if (retryData && retryData[0]) {
                  setBatches(prev => prev.map(b => b.batch === batchNum ? {
                    ...b,
                    entries: b.entries.map(e => e.id === entry.id ? { ...e, id: retryData[0].id, unsynced: false } : e)
                  } : b));
                  showToast(`✅ ${entry.name} ka entry ab database me sync ho gaya!`);
                }
              } catch (err) {
                console.error("Retry sync exception:", err);
              }
            }
          }
          
          // Merge DB payments with any unsynced local payments so payments never disappear
          setPayments(prev => {
            const mergedMap = new Map();
            (dbPayments || []).forEach(p => {
              const key = p.id || `${p.batch_num || p.batchNum}_${p.restaurant_name || p.restaurantName}_${p.amount}_${p.date}`;
              mergedMap.set(key, p);
            });
            (prev || []).forEach(p => {
              if (p.unsynced || (typeof p.id === 'string' && p.id.startsWith('pay_'))) {
                const key = p.id || `${p.batch_num || p.batchNum}_${p.restaurant_name || p.restaurantName}_${p.amount}_${p.date}`;
                if (!mergedMap.has(key)) {
                  mergedMap.set(key, p);
                }
              }
            });
            return Array.from(mergedMap.values());
          });

          // Retry pushing unsynced payments to Supabase sequentially
          if (localUnsyncedPayments.length > 0) {
            for (const p of localUnsyncedPayments) {
              try {
                const { data: retryPay, error: retryPayErr } = await supabase.from('payments').insert({
                  batch_num: p.batch_num || p.batchNum,
                  restaurant_name: p.restaurant_name || p.restaurantName,
                  amount: parseFloat(p.amount) || 0,
                  payment_mode: p.payment_mode || p.paymentMode,
                  user_name: p.user_name || currentUserRef.current,
                  date: p.date,
                  note: p.note
                }).select();

                if (!retryPayErr && retryPay && retryPay[0]) {
                  setPayments(prev => prev.map(pay => pay.id === p.id ? { ...retryPay[0], unsynced: false } : pay));
                }
              } catch (e) {
                console.error("Retry payment sync exception:", e);
              }
            }
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
                  const exists = ex.entries.some(e => e.id === newRec.id);
                  if (exists) return prev;
                  return prev.map(b => b.batch === newRec.batch_num ? { ...b, entries: [...b.entries, entryObj] } : b);
                } else {
                  return [...prev, { batch: newRec.batch_num, khaliDate: newRec.date || "", note: "", entries: [entryObj] }].sort((a, b) => b.batch - a.batch);
                }
              });

              if (partner !== currentUserRef.current) {
                showToast(`🔔 ${partner} added ${newRec.qty}x ${newRec.type} for ${newRec.name} (Batch #${newRec.batch_num})!`);
              }
              addActivityRef.current("Added Entry", `${newRec.qty}x ${newRec.type} for ${newRec.name} (Batch #${newRec.batch_num})`, partner);
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
              if (partner !== currentUserRef.current) {
                showToast(`💳 ${partner} recorded ₹${newPay.amount} payment for ${newPay.restaurant_name}!`);
              }
              addActivityRef.current("Payment Recorded", `₹${newPay.amount} (${newPay.payment_mode}) for ${newPay.restaurant_name}`, partner);
            } else if (payload.eventType === 'DELETE') {
              const oldId = payload.old.id;
              setPayments(prev => prev.filter(p => p.id !== oldId));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'batches' },
          (payload) => {
            console.log('⚡ Realtime Batches Event:', payload);
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedBatch = payload.new;
              const bNum = updatedBatch.batch_num;
              const bCost = parseFloat(updatedBatch.booking_cost) || 0;
              setBatches(prev => prev.map(b => b.batch === bNum ? {
                ...b,
                khaliDate: updatedBatch.khali_date || b.khaliDate,
                note: updatedBatch.note || b.note,
                bookingCost: bCost,
                booking_cost: bCost
              } : b));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isSupabaseConfigured]);

  // Guarded LocalStorage sync
  useEffect(() => {
    if (!syncing) {
      localStorage.setItem('cylinder_data', JSON.stringify(batches));
    }
  }, [batches, syncing]);

  useEffect(() => {
    localStorage.setItem('cylinder_payments', JSON.stringify(payments));
  }, [payments]);

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
    
    let parsedType;
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

    const localId = 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const effectiveDate = (date && date.trim()) ? date.trim() : new Date().toISOString().split('T')[0];
    const entry = { 
      id: localId,
      name: name.trim(), 
      qty: parseInt(qty) || 1, 
      type: parsedType, 
      date: effectiveDate,
      ...(isReturn ? { isReturn: true } : {}),
      user_name: currentUser,
      unsynced: true
    };
    
    // Always update local state & LocalStorage immediately so entry is never rejected
    setBatches(prev => {
      const ex = prev.find(b => b.batch === num);
      if (ex) {
        return prev.map(b => b.batch === num ? { ...b, entries: [...b.entries, entry] } : b);
      } else {
        return [...prev, { batch: num, khaliDate: khaliDate || effectiveDate, note: "", entries: [entry] }].sort((a, b) => b.batch - a.batch);
      }
    });

    addActivity("Added Entry", `${qty}x ${parsedType} ${isReturn ? 'Return' : 'Delivery'} for ${name} (Batch #${num})`, currentUser);
    setNewEntry(p => ({ ...p, name: "", qty: 1 }));

    // Sync to Supabase in background
    if (isSupabaseConfigured) {
      try {
        const ex = batches.find(b => b.batch === num);
        const validKhaliDate = (ex && ex.khaliDate && ex.khaliDate.trim()) ? ex.khaliDate.trim() : (khaliDate && khaliDate.trim() ? khaliDate.trim() : effectiveDate);
        await supabase.from('batches').upsert({
          batch_num: num,
          khali_date: validKhaliDate,
          note: ex ? (ex.note || null) : null
        });

        const { data: insertedData, error: entryErr } = await supabase.from('entries').insert({
          batch_num: num,
          name: name.trim(),
          qty: parseInt(qty) || 1,
          type: parsedType,
          date: effectiveDate,
          is_return: !!isReturn,
          user_name: currentUser
        }).select();

        if (entryErr) {
          console.warn("Supabase entry insert warning:", entryErr);
          showToast(`⚠️ DB Sync Fail: ${entryErr.message || 'Error'}. Entry local me safe hai, reload na karein!`, false);
        } else if (insertedData && insertedData[0]) {
          const dbId = insertedData[0].id;
          setBatches(prev => prev.map(b => b.batch === num ? {
            ...b,
            entries: b.entries.map(e => e.id === localId ? { ...e, id: dbId, unsynced: false } : e)
          } : b));
          showToast(`✅ ${name} - ${qty} ${parsedType} ${isReturn ? 'Khali Return' : 'Delivery'} DB me save ho gaya!`);
        }
      } catch (err) {
        console.warn("Supabase sync background exception:", err);
        showToast(`⚠️ Sync Error: ${err.message || 'Network issue'}. Entry local me safe hai.`, false);
      }
    } else {
      showToast(`✅ ${name} - ${qty} ${parsedType} ${isReturn ? 'Khali Return' : 'Delivery'} batch #${num} me add ho gaya!`);
    }
  }

  // Delete Entry Handler
  async function handleDeleteEntry(batchNum, originalEntry) {
    if (window.confirm("Sach me ye entry delete karni hai?")) {
      if (isSupabaseConfigured) {
        try {
          let error;
          if (originalEntry.id && typeof originalEntry.id !== 'string') {
            ({ error } = await supabase.from('entries').delete().eq('id', originalEntry.id));
          } else {
            ({ error } = await supabase.from('entries').delete()
              .eq('batch_num', batchNum)
              .eq('name', originalEntry.name)
              .eq('qty', originalEntry.qty)
              .eq('type', originalEntry.type));
          }
          if (error) {
            throw error;
          }
        } catch (err) {
          console.warn("Supabase delete background exception:", err);
          showToast(`Delete nahi hua: ${err.message || 'database error'}`, false);
          return;
        }
      }
      setBatches(prev => prev.map(b => b.batch === batchNum
        ? { ...b, entries: b.entries.filter(e => e !== originalEntry) }
        : b));
      addActivity("Deleted Entry", `Entry for ${originalEntry.name} from Batch #${batchNum}`, currentUser);
      showToast("🗑️ Entry delete ho gayi!");
    }
  }

  // Add Payment Handler
  async function handleAddPayment(paymentData) {
    const activeUser = paymentData.user_name || currentUser;
    const localPayment = {
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      batch_num: paymentData.batchNum,
      batchNum: paymentData.batchNum,
      restaurant_name: paymentData.restaurantName,
      restaurantName: paymentData.restaurantName,
      amount: parseFloat(paymentData.amount) || 0,
      payment_mode: paymentData.paymentMode,
      paymentMode: paymentData.paymentMode,
      user_name: activeUser,
      date: paymentData.date || new Date().toISOString().split('T')[0],
      note: paymentData.note || "",
      unsynced: true
    };

    // Immediately update state and LocalStorage so it never vanishes
    setPayments(prev => [localPayment, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('payments').insert({
          batch_num: paymentData.batchNum,
          restaurant_name: paymentData.restaurantName,
          amount: parseFloat(paymentData.amount) || 0,
          payment_mode: paymentData.paymentMode,
          user_name: activeUser,
          date: paymentData.date,
          note: paymentData.note
        }).select();

        if (error) {
          console.warn("Supabase payments insert warning/error:", error);
          showToast(`⚠️ Payment DB Sync Fail: ${error.message || 'Error'}. Local me safe hai!`, false);
        } else if (data && data[0]) {
          // Update temp local payment with DB inserted object
          setPayments(prev => prev.map(p => p.id === localPayment.id ? { ...data[0], unsynced: false } : p));
          showToast(`💳 Payment ₹${paymentData.amount} for ${paymentData.restaurantName} DB me save ho gaya!`);
        }
      } catch (err) {
        console.warn("Supabase payments exception:", err);
        showToast(`⚠️ Payment Sync Error: ${err.message}. Local me safe hai.`, false);
      }
    } else {
      showToast(`💳 Payment ₹${paymentData.amount} for ${paymentData.restaurantName} saved!`);
    }

    addActivity("Payment Recorded", `₹${paymentData.amount} (${paymentData.paymentMode}) for ${paymentData.restaurantName} (Batch #${paymentData.batchNum})`, activeUser);
  }

  // Delete Payment Handler
  async function handleDeletePayment(paymentObj) {
    if (window.confirm(`Delete payment ₹${paymentObj.amount} for ${paymentObj.restaurant_name || paymentObj.restaurantName}?`)) {
      if (isSupabaseConfigured && paymentObj.id) {
        try {
          const { error } = await supabase.from('payments').delete().eq('id', paymentObj.id);
          if (error) throw error;
        } catch (e) {
          console.error(e);
          showToast(`Payment delete nahi hua: ${e.message || 'database error'}`, false);
          return;
        }
      }
      setPayments(prev => prev.filter(p => p !== paymentObj));
      showToast("🗑️ Payment deleted!");
    }
  }

  // Update Batch Booking Cost Handler
  async function handleUpdateBatchCost(batchNum, cost) {
    setBatches(prev => prev.map(b => b.batch === batchNum ? { ...b, bookingCost: cost, booking_cost: cost } : b));
    addActivity("Batch Cost Updated", `Batch #${batchNum} booking cost set to ₹${cost.toLocaleString()}`);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('batches').upsert({
          batch_num: batchNum,
          booking_cost: cost
        });
        if (error) {
          console.warn("Batch cost save error:", error);
          showToast(`⚠️ Booking cost DB Sync Fail: ${error.message}`, false);
        } else {
          showToast(`💰 Batch #${batchNum} booking cost set to ₹${cost.toLocaleString()}!`);
        }
      } catch (e) {
        console.error("Batch cost save error", e);
        showToast(`⚠️ Sync Error: ${e.message}`, false);
      }
    } else {
      showToast(`💰 Batch #${batchNum} booking cost set to ₹${cost.toLocaleString()}!`);
    }
  }

  // Calculate global booking cash balance (Field collections minus batch booking costs)
  const totalBatchCosts = useMemo(() => batches.reduce((s, b) => s + (parseFloat(b.bookingCost || b.booking_cost) || 0), 0), [batches]);
  const totalCollectionsAll = useMemo(() => {
    return payments
      .filter(p => (p.batch_num && p.batch_num > 0) || (p.note && !p.note.includes('Legacy Import')) || (!p.note && p.batch_num))
      .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  }, [payments]);
  const netBookingWallet = totalCollectionsAll - totalBatchCosts;

  return {
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
    isSupabaseConfigured,
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
    totalBatchCosts,
    totalCollectionsAll,
    netBookingWallet,
    showToast,
    addActivity,
    handleDownload,
    handleAdd,
    handleDeleteEntry,
    handleAddPayment,
    handleDeletePayment,
    handleUpdateBatchCost
  };
}
