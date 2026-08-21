import React, { useState } from 'react';

export default function RestaurantProfileModal({ restaurantName = '', existingProfile, onClose, onSave }) {
  const isNew = !restaurantName;
  const [name, setName] = useState(restaurantName || '');
  const [mobile, setMobile] = useState(existingProfile?.mobile || '');
  const [gstNum, setGstNum] = useState(existingProfile?.gst_num || '');
  const [address, setAddress] = useState(existingProfile?.address || '');
  const [prevBal, setPrevBal] = useState(existingProfile?.previous_balance !== undefined ? existingProfile.previous_balance : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const finalName = name.trim();
    if (!finalName) {
      alert('Kripya Restaurant / Customer ka naam enter kijiye.');
      return;
    }

    setSaving(true);
    try {
      await onSave(finalName, {
        name: finalName,
        mobile: mobile.trim(),
        gst_num: gstNum.trim().toUpperCase(),
        address: address.trim(),
        previous_balance: prevBal !== '' ? parseFloat(prevBal) : undefined
      });
      alert(`✅ ${finalName} database me successfully save ho gaya!`);
      onClose();
    } catch (e) {
      alert('Save nahi hua: ' + (e.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fadeIn overflow-y-auto">
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto animate-scaleUp">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center text-base font-black">
              🏪
            </span>
            <div>
              <span className="text-[10px] font-black text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                {isNew ? 'New Customer / Party' : 'Edit Party Profile'}
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                {isNew ? 'Add New Restaurant' : restaurantName}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer transition-all"
          >
            ✕
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5 pt-1">
          
          {/* Restaurant / Customer Name */}
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              🏪 Customer / Restaurant Name <span className="text-rose-500">*</span>
            </label>
            {isNew ? (
              <input
                required
                autoFocus
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Hotel Radhika, Suraj Dhaba, etc."
              />
            ) : (
              <div className="mt-1 w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-700">
                {restaurantName}
              </div>
            )}
          </div>

          {/* Phone / Mobile */}
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              📱 Phone / WhatsApp Number
            </label>
            <input
              type="tel"
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </div>

          {/* GSTIN */}
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              🏢 GSTIN (GST Number - Optional)
            </label>
            <input
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 uppercase focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all tracking-wider"
              value={gstNum}
              onChange={e => setGstNum(e.target.value.toUpperCase())}
              placeholder="e.g. 22AAAAA0000A1Z5"
            />
            <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">Agar GST registered nahi hai to khali chhod dein.</span>
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              📍 Address / Location
            </label>
            <textarea
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. G.E. Road, Near Bus Stand, Raipur"
              rows={2}
            />
          </div>

          {/* Opening Balance / Old Dues */}
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              💰 Opening Balance / Old Dues (₹ Optional)
            </label>
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-black text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all"
              value={prevBal}
              onChange={e => setPrevBal(e.target.value)}
              placeholder="0.00"
            />
            <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">Pichla purana baaki amount (agar koi ho).</span>
          </div>

        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 active:scale-95 text-white disabled:opacity-50 shadow-soft cursor-pointer transition-all flex items-center gap-1.5"
          >
            {saving ? 'Saving...' : '💾 Save to Database'}
          </button>
        </div>
      </form>
    </div>
  );
}
