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
              const explicitLimit = parsedUrl.searchParams.get('limit') ? parseInt(parsedUrl.searchParams.get('limit'), 10) : null;
              const orderCol = parsedUrl.searchParams.get('order');
              const isAsc = parsedUrl.searchParams.get('asc') === 'true';
              const ilikeCol = parsedUrl.searchParams.get('ilike');
              const ilikeVal = parsedUrl.searchParams.get('value');

              if (explicitLimit && explicitLimit <= 1000) {
                let query = client.from(table).select('*');
                if (orderCol) query = query.order(orderCol, { ascending: isAsc });
                if (ilikeCol && ilikeVal) query = query.ilike(ilikeCol, ilikeVal);
                query = query.limit(explicitLimit);
                const { data, error } = await query;
                if (error) throw error;
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(data || []));
              } else {
                const targetLimit = explicitLimit || 50000;
                let allData = [];
                let from = 0;
                const pageSize = 1000;
                while (from < targetLimit) {
                  let chunkQuery = client.from(table).select('*');
                  if (orderCol) chunkQuery = chunkQuery.order(orderCol, { ascending: isAsc });
                  if (ilikeCol && ilikeVal) chunkQuery = chunkQuery.ilike(ilikeCol, ilikeVal);
                  const { data, error } = await chunkQuery.range(from, Math.min(from + pageSize - 1, targetLimit - 1));
                  if (error) throw error;
                  if (!data || data.length === 0) break;
                  allData = allData.concat(data);
                  if (data.length < pageSize) break;
                  from += pageSize;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(allData));
              }
            } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', async () => {
                try {
                  const payload = JSON.parse(body || '{}');
                  let query;
                  if (Array.isArray(payload)) {
                    query = client.from(table).insert(payload);
                  } else if (payload.id) {
                    const { id, ...updateFields } = payload;
                    query = client.from(table).update(updateFields).eq('id', id);
                  } else {
                    query = client.from(table).insert([payload]);
                  }
                  const { data, error } = await query.select();
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
            } else if (req.method === 'DELETE') {
              const id = parsedUrl.searchParams.get('id');
              const batchNum = parsedUrl.searchParams.get('batch_num');
              if (!id && !batchNum) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'ID or batch_num required' }));
              }
              let query = client.from(table).delete();
              if (batchNum) {
                query = query.eq('batch_num', parseInt(batchNum, 10));
              } else {
                query = query.eq('id', id);
              }
              const { error } = await query;
              if (error) throw error;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
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
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react') || id.includes('react-dom') || id.includes('lucide-react')) return 'vendor-react';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    watch: {
      ignored: ['**/scratch/**', '**/scripts/**', '**/.git/**']
    }
  }
})
