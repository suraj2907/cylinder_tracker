import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

export default function AddEntry({ newEntry, setNewEntry, handleAdd, restMap }) {
  const { currentUser } = useUser();
  const [activeForm, setActiveForm] = useState('delivery'); // 'delivery' | 'return'
  const [weight, setWeight] = useState('19.2kg'); // '19.2kg' | '21kg'

  useEffect(() => {
    setNewEntry(p => ({
      ...p,
      type: `${weight}-${activeForm}`
    }));
  }, [activeForm, weight, setNewEntry]);

  return (
    <div className="space-y-6 fade">
      {/* Light Theme Tab Switcher */}
      <div className="flex p-1.5 bg-white border border-customBorder shadow-soft rounded-2xl max-w-md mx-auto">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeForm === 'delivery'
              ? 'bg-sky-50 border border-sky-200 text-sky-700 shadow-sm'
              : 'text-mutedSlate hover:text-textSlate'
          }`}
          onClick={() => setActiveForm('delivery')}
        >
          🚚 Tanki Delivery (Dena)
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeForm === 'return'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm'
              : 'text-mutedSlate hover:text-textSlate'
          }`}
          onClick={() => setActiveForm('return')}
        >
          ♻️ Khali Tanki (Lena)
        </button>
      </div>

      {/* Main Light Form Card */}
      <div className="bg-white border border-customBorder rounded-2xl shadow-soft overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-customBorder flex items-center justify-between flex-wrap gap-2 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${activeForm === 'delivery' ? 'bg-sky-600' : 'bg-emerald-600'}`}></span>
            <span className="text-sm font-black uppercase tracking-wider text-textSlate">
              {activeForm === 'delivery' ? 'Cylinder Delivery Entry Form' : 'Empty Return Collection Form'}
            </span>
          </div>
          <span className="text-xs text-slate-700 font-bold uppercase tracking-wider bg-white px-3 py-1 rounded-lg border border-customBorder shadow-sm flex items-center gap-1.5">
            <span>👤 Recorded by:</span>
            <span className="text-accentCyan font-extrabold">{currentUser}</span>
          </span>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* Batch Number */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-mutedSlate uppercase tracking-wider">
                Batch Number <span className="text-accentOrange">*</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 118"
                className="w-full bg-slate-50 border border-customBorder hover:border-slate-300 focus:border-accentCyan text-textSlate placeholder-slate-400 rounded-xl px-4 py-3 text-sm font-semibold transition-all outline-none"
                value={newEntry.batchNum}
                onChange={e => setNewEntry(p => ({ ...p, batchNum: e.target.value }))}
              />
            </div>

            {/* Restaurant Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-mutedSlate uppercase tracking-wider">
                Restaurant Name <span className="text-accentOrange">*</span>
              </label>
              <input
                list="restaurant-list"
                placeholder="e.g. Simran Restaurant"
                className="w-full bg-slate-50 border border-customBorder hover:border-slate-300 focus:border-accentCyan text-textSlate placeholder-slate-400 rounded-xl px-4 py-3 text-sm font-semibold transition-all outline-none"
                value={newEntry.name}
                onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))}
              />
              <datalist id="restaurant-list">
                {Object.keys(restMap || {}).sort().map(r => <option key={r} value={r} />)}
              </datalist>
            </div>

            {/* Cylinder Weight Toggle */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-mutedSlate uppercase tracking-wider">
                Cylinder Type <span className="text-accentOrange">*</span>
              </label>
              <div className="flex p-1 bg-slate-100 border border-customBorder rounded-xl">
                <button
                  type="button"
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    weight === '19.2kg'
                      ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => setWeight('19.2kg')}
                >
                  19.2 KG (Standard)
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    weight === '21kg'
                      ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => setWeight('21kg')}
                >
                  21 KG (Commercial)
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-mutedSlate uppercase tracking-wider">
                {activeForm === 'delivery' ? 'Delivery Qty' : 'Collection Qty'} <span className="text-accentOrange">*</span>
              </label>
              <input
                type="number"
                min={1}
                className="w-full bg-slate-50 border border-customBorder hover:border-slate-300 focus:border-accentCyan text-textSlate placeholder-slate-400 rounded-xl px-4 py-3 text-sm font-semibold transition-all outline-none"
                value={newEntry.qty}
                onChange={e => setNewEntry(p => ({ ...p, qty: e.target.value }))}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-mutedSlate uppercase tracking-wider">
                {activeForm === 'delivery' ? 'Delivery Date' : 'Collection Date'} <span className="text-accentOrange">*</span>
              </label>
              <input
                type="date"
                className="w-full bg-slate-50 border border-customBorder hover:border-slate-300 focus:border-accentCyan text-textSlate rounded-xl px-4 py-3 text-sm font-semibold transition-all outline-none"
                value={newEntry.date}
                onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            {/* Optional Khali Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-mutedSlate uppercase tracking-wider">
                Batch Khali Date (Optional)
              </label>
              <input
                type="date"
                className="w-full bg-slate-50 border border-customBorder hover:border-slate-300 focus:border-accentCyan text-textSlate rounded-xl px-4 py-3 text-sm font-semibold transition-all outline-none"
                value={newEntry.khaliDate}
                onChange={e => setNewEntry(p => ({ ...p, khaliDate: e.target.value }))}
              />
            </div>

          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 text-white ${
                activeForm === 'delivery'
                  ? 'bg-sky-600 hover:bg-sky-700 shadow-soft'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-soft'
              }`}
              onClick={handleAdd}
            >
              {activeForm === 'delivery' ? '🚚 Save Delivery Entry' : '♻️ Save Empty Collection'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
