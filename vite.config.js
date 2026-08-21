import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function publicLedgerApiPlugin() {
  return {
    name: 'public-ledger-api',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '');
      const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/public-ledger')) {
          const parsedUrl = new URL(req.url, 'http://localhost:5173');
          const partyName = parsedUrl.searchParams.get('party') || parsedUrl.searchParams.get('ledger') || '';

          if (!partyName) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Party name required' }));
          }

          try {
            const { createClient } = await import('@supabase/supabase-js');
            const client = createClient(supabaseUrl, serviceKey);

            const { data: restData } = await client
              .from('restaurants')
              .select('name, mobile, previous_balance, address, gst_num')
              .ilike('name', partyName)
              .single();

            const canonicalName = restData?.name || partyName;

            const { data: legacyRows } = await client
              .from('legacy_ledger_entries')
              .select('*')
              .ilike('restaurant_name', canonicalName)
              .not('entry_date', 'is', null)
              .order('entry_date', { ascending: true });

            const { data: billsData } = await client
              .from('bills')
              .select('*')
              .ilike('restaurant_name', canonicalName)
              .order('bill_date', { ascending: true });

            const { data: paymentsData } = await client
              .from('payments')
              .select('*')
              .ilike('restaurant_name', canonicalName)
              .order('date', { ascending: true });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              restaurant: restData || { name: canonicalName, previous_balance: 0 },
              legacyRows: legacyRows || [],
              bills: billsData || [],
              payments: paymentsData || []
            }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }
        if (req.url && req.url.startsWith('/api/db')) {
          const parsedUrl = new URL(req.url, 'http://localhost:5173');
          const table = parsedUrl.searchParams.get('table') || '';

          if (!table) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Table parameter required' }));
          }

          try {
            const { createClient } = await import('@supabase/supabase-js');
            const client = createClient(supabaseUrl, serviceKey);

            if (req.method === 'GET') {
              let query = client.from(table).select('*');
              const orderCol = parsedUrl.searchParams.get('order');
              if (orderCol) {
                query = query.order(orderCol, { ascending: parsedUrl.searchParams.get('asc') === 'true' });
              }
              const ilikeCol = parsedUrl.searchParams.get('ilike');
              const ilikeVal = parsedUrl.searchParams.get('value');
              if (ilikeCol && ilikeVal) {
                query = query.ilike(ilikeCol, ilikeVal);
              }
              const limitVal = parsedUrl.searchParams.get('limit');
              if (limitVal) {
                query = query.limit(parseInt(limitVal, 10));
              } else {
                query = query.limit(10000);
              }

              const { data, error } = await query;
              if (error) throw error;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(data || []));
            } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', async () => {
                try {
                  const payload = JSON.parse(body || '{}');
                  const { data, error } = await client.from(table).upsert(payload).select();
                  if (error) throw error;
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify(data || []));
                } catch (postErr) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: postErr.message }));
                }
              });
              return;
            }
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), publicLedgerApiPlugin()],
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    watch: {
      ignored: ['**/scratch/**', '**/scripts/**', '**/.git/**']
    }
  }
})
