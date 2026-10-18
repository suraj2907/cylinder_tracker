import test from 'node:test';
import assert from 'node:assert/strict';

import * as dataUtils from '../src/utils/dataUtils.js';

function createInMemorySupabase(tables) {
  return {
    from(tableName) {
      let rows = [...(tables[tableName] || [])];

      const query = {
        select() {
          return query;
        },
        ilike(column, value) {
          const pattern = value
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/%/g, '.*')
            .replace(/_/g, '.');
          const matcher = new RegExp(`^${pattern}$`, 'i');
          rows = rows.filter((row) => matcher.test(String(row[column] || '')));
          return query;
        },
        not(column, operator) {
          if (operator === 'is') rows = rows.filter((row) => row[column] !== null && row[column] !== undefined);
          return query;
        },
        order(column, { ascending }) {
          rows.sort((a, b) => String(a[column] || '').localeCompare(String(b[column] || '')) * (ascending ? 1 : -1));
          return query;
        },
        limit(count) {
          rows = rows.slice(0, count);
          return query;
        },
        then(resolve) {
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };

      return query;
    },
  };
}

test('party variants include known aliases but never unrelated shared-word parties', () => {
  const variants = dataUtils.getPartyNameVariants('SHRI GURUDEV AGRO INDIA PRIVATE LIMITED');

  assert.deepEqual(variants, [
    'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED',
    'Gurudev Rice Mill',
  ]);
  assert.equal(variants.includes('Gaspoint petroleum (india) limited'), false);
});

test('official ledger balance replaces arithmetic balance before newer rows continue it', () => {
  const rows = dataUtils.applyLedgerRunningBalances([
    { debit: 500, credit: 0, balance: 8500, isOfficial: true },
    { debit: 1000, credit: 0, balance: null, isOfficial: false },
    { debit: 0, credit: 2500, balance: null, isOfficial: false },
  ], 18000);

  assert.deepEqual(rows.map((row) => row.runningBalance), [8500, 9500, 7000]);
});

test('public ledger fetch excludes another party that only shares the word India', async () => {
  const client = createInMemorySupabase({
    restaurants: [
      { name: 'Gaspoint petroleum (india) limited', previous_balance: 0 },
      { name: 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED', previous_balance: 18000 },
    ],
    legacy_ledger_entries: [
      { id: 1, restaurant_name: 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED', entry_date: '2026-01-01' },
      { id: 2, restaurant_name: 'Gaspoint petroleum (india) limited', entry_date: '2026-01-02' },
    ],
    bills: [
      { id: 3, restaurant_name: 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED', bill_date: '2026-01-03' },
    ],
    payments: [
      { id: 4, restaurant_name: 'Gurudev Rice Mill', date: '2026-01-04' },
      { id: 5, restaurant_name: 'Gaspoint petroleum (india) limited', date: '2026-01-05' },
    ],
  });

  const payload = await dataUtils.fetchPublicLedgerPayload(
    client,
    'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED',
  );

  assert.equal(payload.restaurant.name, 'SHRI GURUDEV AGRO INDIA PRIVATE LIMITED');
  assert.deepEqual(payload.legacyRows.map((row) => row.id), [1]);
  assert.deepEqual(payload.bills.map((row) => row.id), [3]);
  assert.deepEqual(payload.payments.map((row) => row.id), [4]);
});

test('public ledger treats percent and underscore in a saved party name as literal characters', async () => {
  const client = createInMemorySupabase({
    restaurants: [
      { name: 'Cafe_A', previous_balance: 100 },
      { name: 'CafeXA', previous_balance: 200 },
    ],
    legacy_ledger_entries: [
      { id: 1, restaurant_name: 'Cafe_A', entry_date: '2026-01-01' },
      { id: 2, restaurant_name: 'CafeXA', entry_date: '2026-01-02' },
    ],
    bills: [],
    payments: [],
  });

  const payload = await dataUtils.fetchPublicLedgerPayload(client, 'Cafe_A');

  assert.equal(payload.restaurant.name, 'Cafe_A');
  assert.deepEqual(payload.legacyRows.map((row) => row.id), [1]);
});

test('same-day official rows retain ledger sequence before applying authoritative balances', () => {
  const rows = dataUtils.sortLedgerTimeline([
    { voucher: 'Payment-in', date: '2026-01-01', srNo: 8000, sourceOrder: 0, debit: 0, credit: 100, isOfficial: true },
    { voucher: 'Sales Invoice', date: '2026-01-01', srNo: 3500, sourceOrder: 1, debit: 100, credit: 0, isOfficial: true },
  ]);

  assert.deepEqual(rows.map((row) => row.voucher), ['Payment-in', 'Sales Invoice']);
});
