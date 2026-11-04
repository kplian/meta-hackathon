import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@meta-hackathon/database-types';
import 'react-native-url-polyfill/auto';

export type { Database };

// Fallback public credentials for hosted cloud instance if not provided at build-time.
// Public anon key is safe for web client exposure and protected by PostgreSQL RLS.
const CLOUD_FALLBACK_URL = 'https://ywibmualqaipmygmrojz.supabase.co';
const CLOUD_FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3aWJtdWFscWFpcG15Z21yb2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MTEwOTMsImV4cCI6MjA5MTM4NzA5M30.DZrl3KT5Db6Iw0bs_UwzOb3qdot15THhinISrBbh86U';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || CLOUD_FALLBACK_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || CLOUD_FALLBACK_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env in apps/mobile and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const isLocalBackend =
  supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');
export const currentSupabaseUrl = supabaseUrl;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Email and OAuth callbacks are handled centrally by useSession/completeAuthCallback.
    detectSessionInUrl: false,
  },
});
