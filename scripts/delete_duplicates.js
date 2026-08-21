import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ymsdstmzikykuqryxvza.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const sb = createClient(supabaseUrl, supabaseKey);

async function removeDuplicates() {
  let allRows = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from('legacy_ledger_entries').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Total entries:', allRows.length);

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

  console.log('Deleting duplicate IDs count:', duplicateIds.length);

  // Batch delete
  for (let i = 0; i < duplicateIds.length; i += 50) {
    const batch = duplicateIds.slice(i, i + 50);
    const { error } = await sb.from('legacy_ledger_entries').delete().in('id', batch);
    if (error) console.error('Error deleting batch:', error);
  }

  console.log('Duplicates deleted successfully!');
}

removeDuplicates().catch(console.error);
