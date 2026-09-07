import React from 'react';

// Shared building block - a pulsing gray bar/box matching the app's rounded-2xl card language.
export function SkeletonBar({ className = '' }) {
  return <div className={`bg-slate-200/80 rounded-lg animate-pulse ${className}`} />;
}

function SkeletonStatCard() {
  return (
    <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft space-y-2.5">
      <SkeletonBar className="h-3 w-20" />
      <SkeletonBar className="h-6 w-28" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-slate-100 last:border-0">
      <SkeletonBar className="h-3.5 w-1/4" />
      <SkeletonBar className="h-3.5 w-1/6" />
      <SkeletonBar className="h-3.5 w-1/6 ml-auto" />
      <SkeletonBar className="h-3.5 w-16" />
    </div>
  );
}

// Generic report/table page: filter bar, stat cards row, table body. Fits Sales/GST/Inventory/
// Expense/Profit&Loss/Outstanding Bills reasonably well since they all share this shape.
function TablePageSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft flex flex-wrap items-center gap-2.5">
        <SkeletonBar className="h-9 w-40 rounded-xl" />
        <SkeletonBar className="h-9 w-32 rounded-xl" />
        <SkeletonBar className="h-9 w-24 rounded-xl ml-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft">
        <SkeletonBar className="h-4 w-40 mb-4" />
        {Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} />)}
      </div>
    </div>
  );
}

// Invoice / form page: header, two-column field grid, big primary action bar. Fits Generate Bill.
function FormPageSkeleton() {
  return (
    <div className="bg-white border border-customBorder rounded-2xl p-5 shadow-soft space-y-5">
      <SkeletonBar className="h-5 w-44" />
      <SkeletonBar className="h-11 w-full rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBar key={i} className="h-11 rounded-xl" />)}
      </div>
      <SkeletonBar className="h-12 w-full rounded-xl" />
    </div>
  );
}

// Month-grid page: header controls + calendar cell grid. Fits the Operations Calendar.
function CalendarPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft flex items-center gap-2.5">
        <SkeletonBar className="h-9 w-28 rounded-xl" />
        <SkeletonBar className="h-9 w-40 rounded-xl" />
      </div>
      <div className="bg-white border border-customBorder rounded-2xl p-4 shadow-soft grid grid-cols-7 gap-2">
        {Array.from({ length: 28 }).map((_, i) => <SkeletonBar key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  );
}

const VARIANTS = {
  form: FormPageSkeleton,
  calendar: CalendarPageSkeleton,
  table: TablePageSkeleton
};

// Suspense fallback used while a lazily-loaded tab's code chunk is still downloading/parsing -
// shaped per-tab so the placeholder roughly matches what's about to render instead of a blank spinner.
export default function TabLoadingSkeleton({ variant = 'table' }) {
  const Variant = VARIANTS[variant] || TablePageSkeleton;
  return (
    <div role="status" aria-label="Loading">
      <Variant />
    </div>
  );
}
