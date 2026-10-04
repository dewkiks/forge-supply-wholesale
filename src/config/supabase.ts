/**
 * Supabase Client Configuration
 *
 * This file provides a pre-configured Supabase client using environment variables.
 * The credentials are injected during project creation if a Supabase project is connected.
 *
 * Usage:
 *   import { supabase } from './config/supabase';
 *
 *   // Authentication
 *   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 *
 *   // Database queries
 *   const { data, error } = await supabase.from('table_name').select('*');
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables (set via .env file)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create Supabase client
// Note: If credentials are not set, the client will be created but operations will fail
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Export configuration info (without sensitive data)
export const supabaseConfig = {
  url: supabaseUrl,
  isConfigured: isSupabaseConfigured,
};
