import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const table = req.query.table || '';
  if (!table) {
    return res.status(400).json({ error: 'Table parameter required' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  const client = createClient(supabaseUrl, serviceKey);

  try {
    if (req.method === 'GET') {
      let query = client.from(table).select('*');
      if (req.query.order) {
        query = query.order(req.query.order, { ascending: req.query.asc === 'true' });
      }
      if (req.query.ilike && req.query.value) {
        query = query.ilike(req.query.ilike, req.query.value);
      }
      if (req.query.limit) {
        query = query.limit(parseInt(req.query.limit, 10));
      } else {
        // Automatically fetch up to 10000 rows
        query = query.limit(10000);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    } else if (req.method === 'POST') {
      const payload = req.body;
      const { data, error } = await client.from(table).upsert(payload).select();
      if (error) throw error;
      return res.status(200).json(data || []);
    } else if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID required' });
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
