import assert from 'node:assert/strict';
import test from 'node:test';
import { getItemQtyAsOf, getTotalStockValueAsOf } from '../src/utils/stockLedgerUtils.js';

const ledger = [{ item_type: '19.2kg', entry_date: '2026-08-25', import_seq: 1, closing_stock: 4 }];
const regulator = { id: 'regulator', name: 'Regulator nut wala', current_stock: 5, purchase_price: 250 };
const cylinder = { id: 'cylinder', name: '19.2kg Cylinder', current_stock: 4, purchase_price: 2863.9, price_includes_tax: true };
const sales = [{ bill_date: '2026-10-23', items: [{ item_id: 'regulator', qty: 2 }] }];

test('historical accessory stock reverses later sales without changing current stock', () => {
  assert.equal(getItemQtyAsOf(regulator, '2026-09-30', ledger, { bills: sales }), 7);
  assert.equal(getItemQtyAsOf(regulator, '2026-10-31', ledger, { bills: sales }), 5);
});

test('stock valuation rounds after multiplying the tax-exclusive unit cost', () => {
  assert.equal(getTotalStockValueAsOf('2026-09-30', [regulator, cylinder], ledger, { bills: sales }), 11458.14);
});
