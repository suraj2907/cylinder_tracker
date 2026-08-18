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
const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("ERROR: Supabase URL or Service Role Key is missing in your .env file!");
  console.error("Please add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file to continue.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function seed() {
  console.log("Seeding default items...");
  const defaultItems = [
    { name: '19.2kg Cylinder', default_rate: 2900, purchase_price: 2500, gst_applicable: true, gst_rate: 18, hsn_code: '27111900', low_stock_threshold: 5, item_type: 'product', current_stock: 0 },
    { name: '21kg Cylinder', default_rate: 3300, purchase_price: 2900, gst_applicable: true, gst_rate: 18, hsn_code: '27111900', low_stock_threshold: 5, item_type: 'product', current_stock: 0 },
    { name: 'Empty Cylinder', default_rate: 0, purchase_price: 0, gst_applicable: false, gst_rate: 0, hsn_code: null, low_stock_threshold: 0, item_type: 'product', current_stock: 0 }
  ];

  const { error } = await supabase.from('items').upsert(defaultItems, { onConflict: 'name' });
  if (error) {
    console.error("ERROR Seeding items:", error.message);
  } else {
    console.log("SUCCESS: Default items seeded in inventory!");
  }
}

seed();
