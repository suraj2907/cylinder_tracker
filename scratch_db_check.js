import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env manually
const envContent = fs.readFileSync('.env', 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envConfig[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseAnonKey = envConfig.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Checking tables...");
  
  const tables = ['items', 'stock_purchases', 'restaurants', 'bills', 'payments', 'batches', 'entries'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table "${table}": Error ->`, error.message);
      } else {
        console.log(`Table "${table}": SUCCESS ->`, data);
      }
    } catch (e) {
      console.log(`Table "${table}": Exception ->`, e.message);
    }
  }
}

test();
