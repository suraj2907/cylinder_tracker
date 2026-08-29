import React, { useMemo, useState } from 'react';
import { FileText, TrendingUp, Package, Percent, Receipt } from 'lucide-react';
import { getAllPartiesCurrentBalances, getFifoInvoiceStatuses } from '../utils/dataUtils';
import DateRangePicker, { PRESETS } from './DateRangePicker';

function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Dashboard({ restaurants = [], restaurantProfiles = {}, bills = [], payments = [], purchaseBills = [], legacyLedgerEntries = [], setTab }) {

  // Single-pass accurate party balance calculation
  const partyBalanceMap = useMemo(() => {
    return getAllPartiesCurrentBalances(restaurantProfiles, bills, payments, legacyLedgerEntries);
  }, [restaurantProfiles, bills, payments, legacyLedgerEntries]);

  // Total money pending to collect across customer accounts
  const totalToCollect = useMemo(() => {
    return Object.entries(partyBalanceMap).reduce((sum, [p, v]) => {
      if (p.toLowerCase().includes('gaspoint')) return sum;
      return sum + (v > 0 ? v : 0);
    }, 0);
  }, [partyBalanceMap]);

  // Recent Activity: unified feed of sales, payments & purchases, defaulting to last 7 days
  const [activityRange, setActivityRange] = useState(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6);
    return { startDate: formatLocalYMD(start), endDate: formatLocalYMD(today) };
  });

  // FIFO-allocated paid/unpaid status per invoice, scoped consistently with the official party
  // balance - see getFifoInvoiceStatuses for why this is needed: a generic "Receive Payment"
  // doesn't update the specific bill's own amount_paid.
  const fifoStatuses = useMemo(() => {
    return getFifoInvoiceStatuses(bills, payments, restaurantProfiles);
  }, [bills, payments, restaurantProfiles]);

  const activityFeed = useMemo(() => {
    const { startDate, endDate } = activityRange;
    const inRange = (d) => d && d >= startDate && d <= endDate;
    const events = [];

    (bills || []).forEach(b => {
      const date = (b.bill_date || '').slice(0, 10);
      if (!inRange(date)) return;
      const fifo = fifoStatuses.get(b.id);
      const balance = fifo ? fifo.balance : (parseFloat(b.total_amount || 0) - parseFloat(b.amount_paid || 0));
      events.push({
        key: `bill-${b.id}`,
        date,
        txn: b.invoice_no || b.id,
        type: 'Sales Invoice',
        party: b.restaurant_name || '-',
        amount: parseFloat(b.total_amount) || 0,
        sub: balance > 0.5 ? `Rs ${balance.toLocaleString('en-IN')} unpaid` : null,
        tone: 'sky',
        typeRank: 3
      });
    });

    (payments || []).forEach(p => {
      const date = (p.date || p.created_at || '').slice(0, 10);
      if (!inRange(date)) return;
      events.push({
        key: `pay-${p.id}`,
        date,
        txn: p.id,
        type: 'Payment In',
        party: p.restaurant_name || '-',
        amount: parseFloat(p.amount) || 0,
        sub: p.payment_mode || null,
        tone: 'emerald',
        typeRank: 1
      });
    });

    (purchaseBills || []).forEach(pb => {
      const date = (pb.purchase_date || '').slice(0, 10);
      if (!inRange(date)) return;
      events.push({
        key: `pb-${pb.id}`,
        date,
        txn: pb.invoice_no || pb.id,
        type: 'Purchase',
        party: pb.supplier_name || '-',
        amount: parseFloat(pb.total_amount) || 0,
        sub: null,
        tone: 'amber',
        typeRank: 2
      });
    });

    // Newest date first; within the same date, match the Passbook's own convention
    // (Payment -> Supply/Purchase -> Invoice).
    return events.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return a.typeRank - b.typeRank;
    });
  }, [bills, payments, purchaseBills, activityRange, fifoStatuses]);

  const toneClasses = {
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200'
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-fadeIn pb-16 px-3 sm:px-6">

      {/* Main Pending Balance Hero Card */}
      <div className="bg-white border border-[#EEEEEE] rounded-3xl p-6 sm:p-8 text-center shadow-xs">
        <h1 className="text-xs font-bold text-[#737373] uppercase tracking-widest mb-1.5">
          AGENCY DASHBOARD • TOTAL MONEY PENDING
        </h1>
        <div className="text-3xl sm:text-5xl font-light text-[#1A1A1A] tracking-tight my-2">
          ₹ {totalToCollect.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-[11px] text-[#999999] font-medium">
          Live aggregate outstanding from {restaurants.length} active customer accounts
        </p>
      </div>

      {/* 4 Action Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Generate Bill */}
        <button
          id="btn-action-generate-bill"
          onClick={() => setTab('billing')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <FileText className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Generate Bill
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">GST & Plain Invoices</span>
        </button>

        {/* Cashflow */}
        <button
          id="btn-action-cashflow"
          onClick={() => setTab('payments')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <TrendingUp className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Cashflow
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">Daily Ledger & Collections</span>
        </button>

        {/* Inventory */}
        <button
          id="btn-action-inventory"
          onClick={() => setTab('inventory')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <Package className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Inventory
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">Live Stock & Purchases</span>
        </button>

        {/* Profit & Loss */}
        <button
          id="btn-action-reports"
          onClick={() => setTab('profitLoss')}
          className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#1A1A1A] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
            <Percent className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="mt-2.5 text-xs sm:text-sm font-semibold text-[#1A1A1A]">
            Profit & Loss
          </span>
          <span className="text-[10px] text-[#999999] hidden sm:block mt-0.5">Financial Margins</span>
        </button>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white border border-[#EEEEEE] rounded-3xl p-5 sm:p-6 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#EEEEEE]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#1A1A1A] tracking-tight flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#737373]" />
              Recent Activity
            </h2>
            <p className="text-xs text-[#737373]">Sales, payments & purchases in the selected period</p>
          </div>
          <div className="w-full sm:w-56 shrink-0">
            <DateRangePicker value={activityRange} onChange={setActivityRange} defaultPreset={PRESETS.LAST_7_DAYS} />
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {activityFeed.length === 0 && (
            <div className="text-center text-xs text-[#999999] py-6">No activity in this date range.</div>
          )}
          {activityFeed.map((ev) => (
            <div
              key={ev.key}
              className="w-full flex items-center justify-between p-3.5 bg-[#FDFDFD] rounded-xl border border-[#EEEEEE]"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${toneClasses[ev.tone]}`}>
                    {ev.type}
                  </span>
                  <span className="text-[10px] text-[#999999] font-semibold">#{ev.txn}</span>
                  <span className="text-[10px] text-[#999999]">{ev.date}</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[#1A1A1A] truncate mt-1">
                  {ev.party}
                </div>
                {ev.sub && (
                  <div className="text-[11px] text-rose-500 font-medium mt-0.5">{ev.sub}</div>
                )}
              </div>

              <div className="text-xs sm:text-sm font-bold text-[#1A1A1A] shrink-0">
                ₹ {ev.amount.toLocaleString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
