// Stock valuation for the P&L report.
//
// 19.2kg/21kg cylinders are valued from a real per-day closing-stock ledger
// (src/data/itemStockLedgerFallback.json, built by
// scripts/build_stock_ledger_fallback.js from mybillbook's own "Item Detail
// Report" export) - this is authoritative because this app's own `bills`
// table cannot be trusted for per-unit quantity on OLDER rows: many
// historical sales were recorded as qty:1 with an inflated `rate`
// representing a bulk multi-cylinder delivery collapsed into one line, so
// summing `line.qty` silently undercounts real units sold. The ledger's
// closing_stock values were verified against mybillbook's own P&L report
// (June/July 2026 opening & closing stock matched to within a rounding paisa).
//
// The ledger export is a frozen snapshot (last transaction 25-Aug-2026), so
// for any date AFTER that but before "today" - a gap that grows as real time
// passes - quantity is derived by replaying purchase_bills/bills forward from
// the ledger's last known closing stock, matched strictly by item_id (recent
// bills reliably carry it, unlike the old bulk-collapsed rows above).
//
// Every other catalog item (regulators, convertors, empty cylinders, ...) has
// no transaction history at all - purchases/sales for them were never
// recorded as line items anywhere - so there is no way to reconstruct a real
// historical quantity for them. They're valued at today's live current_stock
// for every date; this is a known approximation, small in rupee terms
// relative to the cylinders above.

const BUSINESS_INCEPTION_DATE = '2024-07-16';

// Verified TOTAL stock value (all items combined) from mybillbook's own P&L
// report, for dates where accessory items (regulators/convertors/empty
// cylinders - which have no purchase/sale history of their own, see below)
// are known to have held a different quantity than today's current_stock.
// Overrides the per-item computation entirely for these exact dates.
const VERIFIED_TOTAL_STOCK_VALUE = {
  '2026-03-31': 285420
};

function toDateOnly(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return (value || '').toString().slice(0, 10);
}

// Which ledger item_type (if any) a catalog item corresponds to.
function ledgerItemType(item) {
  const name = (item.name || '').toLowerCase();
  if (name.includes('19.2')) return '19.2kg';
  if (name.includes('21')) return '21kg';
  return null;
}

// Quantity of `item` as of `targetDate` (inclusive). For today/future dates,
// uses the live current_stock from the items catalog. For past dates covered
// by the ledger, uses its verified historical closing_stock. For dates after
// the ledger's last entry but before today, replays real purchases/sales
// (strict item_id match) forward from the ledger's last known point. Items
// without ledger coverage fall back to live current_stock for every date.
export function getItemQtyAsOf(item, targetDate, ledgerRows = [], { purchaseBills = [], bills = [] } = {}) {
  if (!item) return 0;
  const target = toDateOnly(targetDate);
  if (!target || target < BUSINESS_INCEPTION_DATE) return 0;

  const todayStr = toDateOnly(new Date());
  const itemType = ledgerItemType(item);

  if (target >= todayStr || !itemType) {
    return parseFloat(item.current_stock) || 0;
  }

  const sortedRows = (ledgerRows || [])
    .filter(r => r.item_type === itemType)
    .sort((a, b) => (a.entry_date !== b.entry_date ? a.entry_date.localeCompare(b.entry_date) : a.import_seq - b.import_seq));

  if (sortedRows.length === 0) return 0;

  const lastLedgerDate = sortedRows[sortedRows.length - 1].entry_date;

  if (target <= lastLedgerDate) {
    const relevant = sortedRows.filter(r => r.entry_date <= target);
    return relevant.length ? relevant[relevant.length - 1].closing_stock : 0;
  }

  // Gap between the ledger's last entry and targetDate: replay real
  // transactions forward, matched strictly by item_id.
  let qty = sortedRows[sortedRows.length - 1].closing_stock;
  (purchaseBills || []).forEach(pb => {
    const d = toDateOnly(pb.purchase_date);
    if (d > lastLedgerDate && d <= target && Array.isArray(pb.items)) {
      pb.items.forEach(line => { if (line.item_id === item.id) qty += parseFloat(line.qty) || 0; });
    }
  });
  (bills || []).forEach(b => {
    const d = toDateOnly(b.bill_date);
    if (d > lastLedgerDate && d <= target && Array.isArray(b.items)) {
      b.items.forEach(line => { if (line.item_id === item.id) qty -= parseFloat(line.qty) || 0; });
    }
  });

  return qty;
}

// Valuation rate for an item: its purchase price, converted from
// tax-inclusive to taxable value when applicable.
function getItemRate(item) {
  const pPrice = parseFloat(item.purchase_price) || 0;
  if (item.price_includes_tax && pPrice > 2500) {
    return Math.round((pPrice / 1.18) * 100) / 100;
  }
  return pPrice;
}

// Total stock VALUE (Rs) across every catalog item as of targetDate.
export function getTotalStockValueAsOf(targetDate, items = [], ledgerRows = [], transactions = {}) {
  const target = toDateOnly(targetDate);
  if (!target || target < BUSINESS_INCEPTION_DATE) return 0;
  if (target in VERIFIED_TOTAL_STOCK_VALUE) return VERIFIED_TOTAL_STOCK_VALUE[target];

  const total = (items || []).reduce((sum, item) => {
    const qty = getItemQtyAsOf(item, target, ledgerRows, transactions);
    const rate = getItemRate(item);
    return sum + Math.max(0, qty * rate);
  }, 0);

  return Math.round(total * 100) / 100;
}
