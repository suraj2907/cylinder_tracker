import React, { useState, useEffect } from 'react';

export default function AddEntry({ newEntry, setNewEntry, handleAdd, restMap }) {
  const [activeForm, setActiveForm] = useState('delivery'); // 'delivery' | 'return'
  const [weight, setWeight] = useState('19.2kg'); // '19.2kg' | '21kg'

  // Automatically update the parent type state whenever form or weight changes
  useEffect(() => {
    setNewEntry(p => ({
      ...p,
      type: `${weight}-${activeForm}`
    }));
  }, [activeForm, weight, setNewEntry]);

  return (
    <div className="space-y-6">
      {/* Premium Tab Switcher */}
      <div className="flex p-1 bg-cardBg border border-customBorder rounded-xl max-w-md mx-auto">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeForm === 'delivery'
              ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/5'
              : 'text-mutedSlate hover:text-textSlate'
          }`}
          onClick={() => setActiveForm('delivery')}
        >
          🚚 Tanki Delivery (Dena)
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeForm === 'return'
              ? 'bg-gradient-to-r from-emerald-600/20 to-green-600/20 border border-green-500/30 text-green-400 shadow-md shadow-green-500/5'
              : 'text-mutedSlate hover:text-textSlate'
          }`}
          onClick={() => setActiveForm('return')}
        >
          ♻️ Khali Tanki (Lena)
        </button>
      </div>

      {/* Main Glassmorphic Form Card */}
      <div
        className={`bg-cardBg border rounded-2xl overflow-hidden transition-all duration-500 ${
          activeForm === 'delivery'
            ? 'border-cyan-500/20 shadow-xl shadow-cyan-950/10'
            : 'border-green-500/20 shadow-xl shadow-green-950/10'
        }`}
      >
        {/* Glowing Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            activeForm === 'delivery'
              ? 'bg-gradient-to-r from-[#0c2033] to-[#0e1724] border-cyan-500/10'
              : 'bg-gradient-to-r from-[#0d2b1d] to-[#0e1724] border-green-500/10'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                activeForm === 'delivery' ? 'bg-cyan-400' : 'bg-green-400'
              }`}
            ></span>
            <span
              className={`text-sm font-black uppercase tracking-wider ${
                activeForm === 'delivery' ? 'text-cyan-400' : 'text-green-400'
              }`}
            >
              {activeForm === 'delivery' ? 'Cylinder Delivery Entry Form' : 'Empty Return Collection Form'}
            </span>
          </div>
          <span className="text-[10px] text-mutedSlate font-bold uppercase tracking-widest bg-darkBg px-2.5 py-1 rounded-md border border-customBorder">
            Live Database Sync
          </span>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* Batch Number */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-mutedSlate uppercase tracking-wider">
                Batch Number <span className="text-accentOrange">*</span>
              </label>
              <input
                type="number"
                placeholder="jaise 118"
                className="w-full bg-darkBg border border-customBorder hover:border-mutedSlate focus:border-accentOrange text-textSlate placeholder-mutedSlate/60 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 outline-none"
                value={newEntry.batchNum}
                onChange={e => setNewEntry(p => ({ ...p, batchNum: e.target.value }))}
              />
            </div>

            {/* Restaurant Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-mutedSlate uppercase tracking-wider">
                Restaurant Name <span className="text-accentOrange">*</span>
              </label>
              <input
                list="restaurant-list"
                placeholder="jaise Sabor Cafe"
                className="w-full bg-darkBg border border-customBorder hover:border-mutedSlate focus:border-accentOrange text-textSlate placeholder-mutedSlate/60 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 outline-none"
                value={newEntry.name}
                onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))}
              />
              <datalist id="restaurant-list">
                {Object.keys(restMap || {}).sort().map(r => <option key={r} value={r} />)}
              </datalist>
            </div>

            {/* Cylinder Weight Toggle (19.2 KG vs 21 KG) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-mutedSlate uppercase tracking-wider">
                Cylinder Type <span className="text-accentOrange">*</span>
              </label>
              <div className="flex p-1 bg-darkBg border border-customBorder rounded-xl">
                <button
                  type="button"
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                    weight === '19.2kg'
                      ? 'bg-customBorder text-textSlate border border-mutedSlate/20'
                      : 'text-mutedSlate hover:text-textSlate'
                  }`}
                  onClick={() => setWeight('19.2kg')}
                >
                  19.2 KG (Orange)
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                    weight === '21kg'
                      ? 'bg-customBorder text-textSlate border border-mutedSlate/20'
                      : 'text-mutedSlate hover:text-textSlate'
                  }`}
                  onClick={() => setWeight('21kg')}
                >
                  21 KG (Blue)
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-mutedSlate uppercase tracking-wider">
                {activeForm === 'delivery' ? 'Delivery Qty' : 'Collection Qty'} <span className="text-accentOrange">*</span>
              </label>
              <input
                type="number"
                min={1}
                className="w-full bg-darkBg border border-customBorder hover:border-mutedSlate focus:border-accentOrange text-textSlate placeholder-mutedSlate/60 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 outline-none"
                value={newEntry.qty}
                onChange={e => setNewEntry(p => ({ ...p, qty: e.target.value }))}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-mutedSlate uppercase tracking-wider">
                {activeForm === 'delivery' ? 'Delivery Date' : 'Collection Date'} <span className="text-accentOrange">*</span>
              </label>
              <input
                type="date"
                className="w-full bg-darkBg border border-customBorder hover:border-mutedSlate focus:border-accentOrange text-textSlate rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 outline-none"
                value={newEntry.date}
                onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            {/* Optional Khali Date */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-mutedSlate uppercase tracking-wider">
                Batch Khali Date (Optional)
              </label>
              <input
                type="date"
                className="w-full bg-darkBg border border-customBorder hover:border-mutedSlate focus:border-accentOrange text-textSlate rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 outline-none"
                value={newEntry.khaliDate}
                onChange={e => setNewEntry(p => ({ ...p, khaliDate: e.target.value }))}
              />
            </div>

          </div>

          {/* Glowing Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 active:scale-95 border ${
                activeForm === 'delivery'
                  ? 'bg-cyan-500/10 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/5'
                  : 'bg-green-500/10 hover:bg-green-500/25 border-green-500/30 text-green-400 shadow-lg shadow-green-500/5'
              }`}
              onClick={handleAdd}
            >
              {activeForm === 'delivery' ? '🚚 Add Delivery Entry' : '♻️ Add Empty Collection'}
            </button>
          </div>

        </div>
      </div>

      {/* Modern High-Density Information Grid */}
      <div className="bg-cardBg border border-customBorder rounded-2xl overflow-hidden">
        <div className="bg-[#0b1017] px-6 py-4 border-b border-customBorder flex items-center gap-2">
          <span className="text-yellow-500">💡</span>
          <span className="text-xs font-black uppercase tracking-wider text-textSlate">
            Pro Tips & Data Guidelines
          </span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { color: 'border-cyan-500/20 text-cyan-400 bg-cyan-950/10', title: "Delivery Data", desc: "Delivery data automatic 'isReturn: false' ke sath save hota hai aur outstanding me judta hai." },
            { color: 'border-green-500/20 text-green-400 bg-green-950/10', title: "Empty Returns", desc: "Khali tanki return entries automatically outstanding cylinders ko minus/kam kar deti hain." },
            { color: 'border-yellow-500/20 text-yellow-400 bg-yellow-950/10', title: "Fuzzy Matching", desc: "Ashwini, Moti, Rajwada, Bawarchi jaise names automatically standard spellings me clean ho jate hain." },
            { color: 'border-purple-500/20 text-purple-400 bg-purple-950/10', title: "Auto Batch Create", desc: "Naya batch number enter karne par database me naya batch auto-create aur sort ho jata hai." },
          ].map(({ color, title, desc }) => (
            <div key={title} className={`border rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] ${color}`}>
              <div className="font-bold text-xs mb-1.5 uppercase tracking-wide">{title}</div>
              <div className="text-mutedSlate text-[11px] leading-relaxed font-medium">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
