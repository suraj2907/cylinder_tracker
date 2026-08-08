import React, { useState } from 'react';

export default function RestaurantProfileModal({ restaurantName, existingProfile, onClose, onSave }) {
  const [mobile, setMobile] = useState(existingProfile?.mobile || '');
  const [gstNum, setGstNum] = useState(existingProfile?.gst_num || '');
  const [address, setAddress] = useState(existingProfile?.address || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(restaurantName, { mobile, gst_num: gstNum, address });
      onClose();
    } catch (e) {
      alert('Save nahi hua: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-extrabold text-slate-900">✏️ Edit Profile — {restaurantName}</h3>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Mobile Number</label>
          <input
            className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accentCyan"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            placeholder="9876543210"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">GST Number (optional)</label>
          <input
            className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accentCyan"
            value={gstNum}
            onChange={e => setGstNum(e.target.value)}
            placeholder="22AAAAA0000A1Z5"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
          <textarea
            className="mt-1 w-full border border-customBorder rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accentCyan"
            value={address}
            onChange={e => setAddress(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
