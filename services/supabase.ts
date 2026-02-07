
import { createClient } from '@supabase/supabase-js';

// NOTE: These should ideally come from environment variables in a real build environment (e.g. import.meta.env.VITE_SUPABASE_URL)
// For this demo, the user must input them or we can provide a UI to set them.
const SUPABASE_URL = localStorage.getItem('MZN_SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = localStorage.getItem('MZN_SUPABASE_KEY') || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

export const isSupabaseConfigured = () => !!supabase;

// Helper to configure credentials from UI if needed
export const configureSupabase = (url: string, key: string) => {
    localStorage.setItem('MZN_SUPABASE_URL', url);
    localStorage.setItem('MZN_SUPABASE_KEY', key);
    window.location.reload();
};
