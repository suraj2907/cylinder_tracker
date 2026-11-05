import test from 'node:test';
import assert from 'node:assert/strict';
import { getPartyCurrentBalance, getPartyBalanceAroundBill, getFifoInvoiceStatuses } from '../src/utils/dataUtils.js';

const party = 'Advance Test Party';
const profiles = { [party]: { name: party, previous_balance: 0 } };
const firstBill = { id: 1, restaurant_name: party, invoice_no: '4001', bill_date: '2026-11-01', total_amount: 100 };
const nextBill = { id: 2, restaurant_name: party, invoice_no: '4002', bill_date: '2026-11-03', total_amount: 100 };
const advance = { id: 9000, restaurant_name: party, date: '2026-11-02', amount: 150, note: 'Payment Received' };

test('overpayment remains a negative party balance and offsets the next bill', () => {
  assert.equal(getPartyCurrentBalance(party, profiles, [firstBill], [advance]), -50);
  assert.deepEqual(getPartyBalanceAroundBill(firstBill, profiles, [firstBill], [advance]), {
    prevBal: 0, currentBal: -50, receivedForThisBill: 150
  });
  assert.equal(getPartyCurrentBalance(party, profiles, [firstBill, nextBill], [advance]), 50);
  assert.deepEqual(getPartyBalanceAroundBill(nextBill, profiles, [firstBill, nextBill], [advance]), {
    prevBal: -50, currentBal: 50, receivedForThisBill: 0
  });
  assert.equal(getFifoInvoiceStatuses([firstBill, nextBill], [advance], profiles).get(nextBill.id).balance, 50);
});

test('payment before the first bill is shown as previous advance', () => {
  const earlyPayment = { ...advance, date: '2026-10-31' };
  assert.deepEqual(getPartyBalanceAroundBill(firstBill, profiles, [firstBill], [earlyPayment]), {
    prevBal: -150, currentBal: -50, receivedForThisBill: 0
  });
});

test('existing unpaid balances still stay positive', () => {
  const withOpeningDebt = { [party]: { name: party, previous_balance: 200 } };
  assert.equal(getPartyCurrentBalance(party, withOpeningDebt, [firstBill], [advance]), 150);
  assert.deepEqual(getPartyBalanceAroundBill(firstBill, withOpeningDebt, [firstBill], [advance]), {
    prevBal: 50, currentBal: 150, receivedForThisBill: 0
  });
});
