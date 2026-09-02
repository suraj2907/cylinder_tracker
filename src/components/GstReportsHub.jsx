import React, { useState } from 'react';
import Gstr1Report from './Gstr1Report';
import GstPurchaseReport from './GstPurchaseReport';
import Gstr3bReport from './Gstr3bReport';

const SUB_TABS = [
  { id: 'sales', label: '🧾 GSTR-1 (Sales)' },
  { id: 'purchase', label: '🚚 GST Purchase' },
  { id: 'gstr3b', label: '📋 GSTR-3B' }
];

export default function GstReportsHub({ bills = [], restaurantProfiles = {}, purchaseBills = [], items = [] }) {
  const [subTab, setSubTab] = useState('sales');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex p-1.5 bg-white border border-customBorder shadow-soft rounded-2xl overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 min-w-fit px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              subTab === t.id
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-mutedSlate hover:text-textSlate hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'sales' && <Gstr1Report bills={bills} restaurantProfiles={restaurantProfiles} />}
      {subTab === 'purchase' && <GstPurchaseReport purchaseBills={purchaseBills} items={items} />}
      {subTab === 'gstr3b' && <Gstr3bReport items={items} purchaseBills={purchaseBills} bills={bills} />}
    </div>
  );
}
