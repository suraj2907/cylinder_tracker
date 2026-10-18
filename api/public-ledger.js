import { createClient } from '@supabase/supabase-js';
import { fetchPublicLedgerPayload } from '../src/utils/dataUtils.js';

export default async function handler(req, res) {
  const partyName = req.query.party || req.query.ledger || '';
  if (!partyName) return res.status(400).json({ error: 'Party name required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ymsdstmzikykuqryxvza.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X3c2dUdLNWdaQ3QxQlh3SE0tRl9MWndfTHUxM2ZPMUQ=', 'base64').toString('utf-8');
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const payload = await fetchPublicLedgerPayload(supabase, partyName);
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Public ledger error:', err);
    return res.status(500).json({ error: err.message });
  }
}
