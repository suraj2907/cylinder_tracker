import React, { useState, useMemo } from 'react';

export const PRESETS = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  THIS_WEEK: 'This Week',
  LAST_WEEK: 'Last Week',
  LAST_7_DAYS: 'Last 7 Days',
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
  THIS_QUARTER: 'This Quarter',
  LAST_QUARTER: 'Last Quarter',
  CURRENT_FISCAL_YEAR: 'Current Fiscal Year (Indian)',
  CUSTOM: 'Custom Range'
};

function formatLocalYMD(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DateRangePicker({ value = { startDate: '', endDate: '' }, onChange }) {
  const [activePreset, setActivePreset] = useState(PRESETS.THIS_MONTH);
  const [showDropdown, setShowDropdown] = useState(false);

  const getDatesForPreset = (preset, customStart = '', customEnd = '') => {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (preset) {
      case PRESETS.TODAY:
        startDate = today;
        endDate = today;
        break;
      case PRESETS.YESTERDAY:
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        startDate = yesterday;
        endDate = yesterday;
        break;
      case PRESETS.THIS_WEEK:
        // Mon - Today
        const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(today.getFullYear(), today.getMonth(), diff);
        endDate = new Date();
        break;
      case PRESETS.LAST_WEEK:
        // Previous week Mon - Sun
        const lastMon = new Date();
        const currentDay = lastMon.getDay();
        const dist = lastMon.getDate() - currentDay + (currentDay === 0 ? -6 : 1) - 7;
        startDate = new Date(lastMon.getFullYear(), lastMon.getMonth(), dist);
        endDate = new Date(lastMon.getFullYear(), lastMon.getMonth(), dist + 6);
        break;
      case PRESETS.LAST_7_DAYS:
        startDate = new Date();
        startDate.setDate(today.getDate() - 6);
        endDate = new Date();
        break;
      case PRESETS.THIS_MONTH:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date();
        break;
      case PRESETS.LAST_MONTH:
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case PRESETS.THIS_QUARTER:
        const currentQuarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date();
        break;
      case PRESETS.LAST_QUARTER:
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const qYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const qIndex = lastQuarter < 0 ? 3 : lastQuarter;
        startDate = new Date(qYear, qIndex * 3, 1);
        endDate = new Date(qYear, (qIndex + 1) * 3, 0);
        break;
      case PRESETS.CURRENT_FISCAL_YEAR:
        // Indian FY: 1 April to 31 March
        const currentMonth = today.getMonth();
        const fyStartYear = currentMonth >= 3 ? today.getFullYear() : today.getFullYear() - 1;
        startDate = new Date(fyStartYear, 3, 1); // April 1st
        endDate = new Date(fyStartYear + 1, 2, 31); // March 31st
        break;
      case PRESETS.CUSTOM:
        return { startDate: customStart, endDate: customEnd };
      default:
        break;
    }

    return {
      startDate: formatLocalYMD(startDate),
      endDate: formatLocalYMD(endDate)
    };
  };

  const handlePresetSelect = (preset) => {
    setActivePreset(preset);
    if (preset !== PRESETS.CUSTOM) {
      const dates = getDatesForPreset(preset);
      onChange(dates);
      setShowDropdown(false);
    }
  };

  const handleCustomDateChange = (field, dateVal) => {
    const dates = {
      ...value,
      [field]: dateVal
    };
    onChange(dates);
  };

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full text-left bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-xs hover:border-slate-400 transition-all cursor-pointer overflow-hidden"
      >
        <span className="truncate pr-1">
          📅 <span className="font-extrabold">{activePreset === PRESETS.CURRENT_FISCAL_YEAR ? 'FY' : activePreset}</span>: <span className="text-sky-700 font-extrabold">{value.startDate}</span> to <span className="text-sky-700 font-extrabold">{value.endDate}</span>
        </span>
        <span className="text-[10px] text-slate-400 shrink-0">▼</span>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute z-[999] left-0 mt-1.5 w-[310px] sm:w-[350px] max-w-[calc(100vw-32px)] bg-white border border-slate-200 rounded-2xl shadow-2xl p-3.5 space-y-3 animate-fadeIn">
          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {Object.values(PRESETS).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetSelect(p)}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-bold text-left transition-all ${
                  activePreset === p ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {activePreset === PRESETS.CUSTOM && (
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                  value={value.startDate}
                  onChange={e => handleCustomDateChange('startDate', e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                  value={value.endDate}
                  onChange={e => handleCustomDateChange('endDate', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Apply close button */}
          <button
            type="button"
            onClick={() => setShowDropdown(false)}
            className="w-full py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 active:scale-95 cursor-pointer shadow-soft"
          >
            Apply Range Filter
          </button>
        </div>
      )}
    </div>
  );
}
