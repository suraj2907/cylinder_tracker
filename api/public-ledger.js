import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const partyName = req.query.party || req.query.ledger || '';
  if (!partyName) return res.status(400).json({ error: 'Party name required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ymsdstmzikykuqryxvza.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X3c2dUdLNWdaQ3QxQlh3SE0tRl9MWndfTHUxM2ZPMUQ=', 'base64').toString('utf-8');
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const rawTarget = partyName.trim();
    // Case-insensitive search with limit to avoid single() multi-row crash
    const { data: restList } = await supabase
      .from('restaurants')
      .select('name, mobile, previous_balance, address, gst_num')
      .or(`name.ilike.%${rawTarget}%,name.ilike.${rawTarget}`)
      .limit(5);

    const restData = restList?.[0] || null;
    const canonicalName = restData?.name || rawTarget;

    const searchTerms = [rawTarget, canonicalName];
    if (restData?.name) searchTerms.push(restData.name);
    // Add significant keywords like 'gurudev', 'railies', 'magnaura', 'panchmukhi'
    const stopWords = ['hotel', 'cafe', 'dhaba', 'dhabha', 'restaurant', 'restuarant', 'private', 'limited', 'project', 'and', 'the'];
    rawTarget.split(/\s+/).forEach(w => {
      const cleanW = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanW.length >= 4 && !stopWords.includes(cleanW)) {
        searchTerms.push(cleanW);
      }
    });

    const orFilter = [...new Set(searchTerms)].map(t => `restaurant_name.ilike.%${t}%`).join(',');

    const [
      { data: legacyRows, error: err1 },
      { data: billsData, error: err2 },
      { data: paymentsData, error: err3 }
    ] = await Promise.all([
      supabase
        .from('legacy_ledger_entries')
        .select('*')
        .or(orFilter)
        .not('entry_date', 'is', null)
        .order('entry_date', { ascending: true }),
      supabase
        .from('bills')
        .select('*')
        .or(orFilter)
        .order('bill_date', { ascending: true }),
      supabase
        .from('payments')
        .select('*')
        .or(orFilter)
        .order('date', { ascending: true })
    ]);

    return res.status(200).json({
      restaurant: restData || { name: canonicalName, previous_balance: 0 },
      legacyRows: legacyRows || [],
      bills: billsData || [],
      payments: paymentsData || []
    });
  } catch (err) {
    console.error('Public ledger error:', err);
    return res.status(500).json({ error: err.message });
  }
}
