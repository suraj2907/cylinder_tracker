import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Prevent crash if variables are not set yet (e.g. in Vercel build/deploy without env values configured)
const safeUrl = supabaseUrl && supabaseUrl.trim() !== '' ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey && supabaseAnonKey.trim() !== '' ? supabaseAnonKey : 'placeholder_anon_key';

export const supabase = createClient(safeUrl, safeKey);

