import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are loaded
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Please check your .env.local file.');
  throw new Error('Supabase URL or Anon Key is missing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Example of how to use it:
// async function getCountries() {
//   const { data, error } = await supabase.from('countries').select();
//   if (error) console.error('Error fetching countries:', error);
//   else console.log('Countries:', data);
// }
// getCountries();
