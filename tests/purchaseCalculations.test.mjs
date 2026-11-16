import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePurchase } from '../src/utils/purchaseCalculations.js';

test('BillBook purchase discount reduces taxable value before GST', () => {
  const result = calculatePurchase([{ qty: 33, rate: 2427.0339, gst_rate: 18, discount_type: 'amount', discount_value: 3307.8 }], { rateIncludesTax: false, taxableAdjustment: -0.01 });
  assert.equal(result.subtotal, 76784.31);
  assert.equal(result.cgst, 6910.59);
  assert.equal(result.sgst, 6910.59);
  assert.equal(result.total, 90605.49);
  assert.equal(result.discount, 3307.8);
});

test('percentage discount is calculated from the line value before GST', () => {
  const percent = calculatePurchase([{ qty: 33, rate: 2427.0336, gst_rate: 18, discount_type: 'percent', discount_value: 4.13 }], { rateIncludesTax: false });
  assert.equal(percent.total, 90605.47);
  assert.equal(Math.round(percent.discount * 100) / 100, 3307.8);
});

test('existing GST-inclusive purchase retains its after-tax discount calculation', () => {
  const result = calculatePurchase([{ qty: 2, rate: 118, gst_rate: 18 }], { billDiscount: 10 });
  assert.equal(result.subtotal, 200);
  assert.equal(result.cgst, 18);
  assert.equal(result.sgst, 18);
  assert.equal(result.total, 226);
});
