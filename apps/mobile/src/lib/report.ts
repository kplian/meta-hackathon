import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface ReportCategory {
  category_key: string;
  name: string;
  spent: number;
  budget: number | null;
}

export interface ReportTransaction {
  date: string;
  concept: string | null;
  type: 'income' | 'expense';
  amount: number;
}

export interface ReportData {
  status: 'ok';
  household: { name: string; currency: string };
  period_month: string;
  expires_at: string;
  totals: { income: number; expense: number; budget: number };
  categories: ReportCategory[];
  transactions: ReportTransaction[];
}

export type ReportResult = ReportData | { status: 'invalid' } | { status: 'expired' };

export const REPORT_PATH = '/reporte';

/** Token of a WhatsApp report link (`/reporte?t=<token>`), web only. */
export function getReportTokenFromUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (window.location.pathname.replace(/\/+$/, '') !== REPORT_PATH) return null;
  return new URLSearchParams(window.location.search).get('t');
}

/** Report language from `?lang=`, so the bot can send the user's language. */
export function getReportLanguageFromUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('lang');
}

const REPORT_TIMEOUT_MS = 15000;

export async function fetchReport(token: string): Promise<ReportResult> {
  // Mobile data inside WhatsApp can stall: fail visibly instead of spinning forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  try {
    const { data, error } = await supabase
      .rpc('f_get_report', { p_token: token })
      .abortSignal(controller.signal);
    if (error) throw new Error(error.message);
    return data as unknown as ReportResult;
  } finally {
    clearTimeout(timer);
  }
}
