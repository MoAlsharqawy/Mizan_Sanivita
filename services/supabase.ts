
import { createClient } from '@supabase/supabase-js';

// Helper to safely get environment variables across different bundlers (Vite, CRA, etc.)
const getEnv = (key: string) => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            // @ts-ignore
            return import.meta.env[key];
        }
    } catch (e) {}

    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) {}

    return '';
};

// Check for common variable names
const envUrl = getEnv('VITE_SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL') || getEnv('SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

// Priority: LocalStorage (Manual Override) > Environment Variables
const SUPABASE_URL = localStorage.getItem('MZN_SUPABASE_URL') || envUrl || '';
const SUPABASE_ANON_KEY = localStorage.getItem('MZN_SUPABASE_KEY') || envKey || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

export const isSupabaseConfigured = () => !!supabase;

// Helper to access config in other components (e.g. UsersManager)
export const getSupabaseConfig = () => ({
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
});

// Helper to configure credentials from UI manually
export const configureSupabase = (url: string, key: string) => {
    if (!url || !key) return;
    localStorage.setItem('MZN_SUPABASE_URL', url);
    localStorage.setItem('MZN_SUPABASE_KEY', key);
    window.location.reload(); // Reload to re-initialize the client
};

export const clearSupabaseConfig = () => {
    localStorage.removeItem('MZN_SUPABASE_URL');
    localStorage.removeItem('MZN_SUPABASE_KEY');
    window.location.reload();
};
