// Returns the stock QUANTITY of an item type as of a given date, straight from
// myBillBook's own authoritative running balance — no reconstruction needed.
export function getStockQtyAsOf(itemType, targetDate, ledgerRows) {
  const relevant = (ledgerRows || [])
    .filter(r => r.item_type === itemType && r.entry_date <= targetDate)
    .sort((a, b) => {
      if (a.entry_date !== b.entry_date) return a.entry_date.localeCompare(b.entry_date);
      return a.import_seq - b.import_seq; // later import_seq = later in the day
    });

  if (relevant.length === 0) return 0;
  return relevant[relevant.length - 1].closing_stock;
}

// Finds the item's current purchase price from the items catalog, matching by
// substring in the item name (e.g. "19.2kg Filled Cylinder" matches "19.2kg").
function findItemRate(itemType, items) {
  const match = (items || []).find(i => (i.name || '').includes(itemType));
  return match ? parseFloat(match.purchase_price) || 0 : (itemType === '19.2kg' ? 2194.81 : 2400.58);
}

// Base inventory assets from MyBillBook Stock Summary:
// 117 Empty Cylinders (@ ₹ 2,100 = ₹ 2,45,700) + Regulators & Convertors (₹ 4,520) = ₹ 2,50,220.00
const BASE_INVENTORY_ASSETS = 250220.00;

// Total stock VALUE (₹) across base assets + dynamic filled cylinders, as of a given date.
export function getTotalStockValueAsOf(targetDate, ledgerRows, items) {
  const qty192 = getStockQtyAsOf('19.2kg', targetDate, ledgerRows);
  const qty21 = getStockQtyAsOf('21kg', targetDate, ledgerRows);
  const rate192 = findItemRate('19.2kg', items);
  const rate21 = findItemRate('21kg', items);
  const filledCylindersValue = Math.max(0, qty192 * rate192) + Math.max(0, qty21 * rate21);
  return Math.round((BASE_INVENTORY_ASSETS + filledCylindersValue) * 100) / 100;
}
