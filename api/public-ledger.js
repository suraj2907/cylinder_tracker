import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const partyName = req.query.party || req.query.ledger || '';
  if (!partyName) return res.status(400).json({ error: 'Party name required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: restData } = await supabase
      .from('restaurants')
      .select('name, mobile, previous_balance, address, gst_num')
      .ilike('name', partyName)
      .single();

    const canonicalName = restData?.name || partyName;

    const { data: legacyRows } = await supabase
      .from('legacy_ledger_entries')
      .select('*')
      .ilike('restaurant_name', canonicalName)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true });

    const { data: billsData } = await supabase
      .from('bills')
      .select('*')
      .ilike('restaurant_name', canonicalName)
      .order('bill_date', { ascending: true });

    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .ilike('restaurant_name', canonicalName)
      .order('date', { ascending: true });

    return res.status(200).json({
      restaurant: restData || { name: canonicalName, previous_balance: 0 },
      legacyRows: legacyRows || [],
      bills: billsData || [],
      payments: paymentsData || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
