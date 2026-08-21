import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ymsdstmzikykuqryxvza.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const sb = createClient(supabaseUrl, supabaseKey);

async function main() {
  let allRows = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from('legacy_ledger_entries').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Total legacy_ledger_entries in DB:', allRows.length);

  const map = new Map();
  const duplicateIds = [];

  allRows.forEach(r => {
    const key = [r.restaurant_name, r.entry_date, r.voucher_type, r.sr_no, r.credit, r.debit, r.balance, r.payment_mode].join('__');
    if (map.has(key)) {
      duplicateIds.push(r.id);
    } else {
      map.set(key, r.id);
    }
  });

  console.log('Unique entries count:', map.size);
  console.log('Duplicate rows count found:', duplicateIds.length);

  const bajrang = allRows.filter(r => r.restaurant_name && r.restaurant_name.toLowerCase().includes('bajrang'));
  console.log('Total Bajrang rows:', bajrang.length);
  const bajrangDups = bajrang.filter(r => duplicateIds.includes(r.id));
  console.log('Bajrang duplicate rows:', bajrangDups.length);

  return { duplicateIds, allRows };
}

main().catch(console.error);
