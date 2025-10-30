// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';  // ← 波括弧の外にハイフン不要！

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

