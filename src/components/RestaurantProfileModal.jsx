import React, { useState } from 'react';

export default function RestaurantProfileModal({ restaurantName, existingProfile, onClose, onSave }) {
  const [mobile, setMobile] = useState(existingProfile?.mobile || '');
  const [gstNum, setGstNum] = useState(existingProfile?.gst_num || '');
  const [address, setAddress] = useState(existingProfile?.address || '');
  const [prevBal, setPrevBal] = useState(existingProfile?.previous_balance !== undefined ? existingProfile.previous_balance : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(restaurantName, {
        mobile: mobile.trim(),
        gst_num: gstNum.trim().toUpperCase(),
        address: address.trim(),
        previous_balance: prevBal !== '' ? parseFloat(prevBal) : undefined
      });
      onClose();
    } catch (e) {
      alert('Save nahi hua: ' + (e.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-black text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Party Profile
            </span>
            <h3 className="text-base font-black text-slate-900 mt-1">{restaurantName}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">📱 Phone / WhatsApp Number</label>
          <input
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            placeholder="e.g. 9876543210"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">🏢 GSTIN (GST Number - Optional)</label>
          <input
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 uppercase focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all tracking-wider"
            value={gstNum}
            onChange={e => setGstNum(e.target.value.toUpperCase())}
            placeholder="e.g. 22AAAAA0000A1Z5"
          />
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">Agar GST number nahi hai to ise blank chhod dein.</span>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">📍 Address / Location</label>
          <textarea
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white shadow-xs transition-all"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="e.g. G.E. Road, Near Bus Stand"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 shadow-md cursor-pointer active:scale-95 transition-all"
          >
            {saving ? 'Saving...' : '💾 Save to Database'}
          </button>
        </div>
      </div>
    </div>
  );
}
