/**
 * Frontend configuration.
 *
 * Only NEXT_PUBLIC_* values are available in the browser. Service-role keys
 * and other backend secrets must never be referenced from this application.
 */

const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const explicitMockFlag = process.env.NEXT_PUBLIC_USE_MOCK_API?.trim().toLowerCase();

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

function looksConfigured(value: string): boolean {
  return value.length > 0 && !value.toLowerCase().includes("your-");
}

export const isSupabaseConfigured =
  looksConfigured(supabaseUrl) &&
  looksConfigured(supabaseAnonKey) &&
  /^https?:\/\//.test(supabaseUrl);

/**
 * Mock mode rules:
 * - NEXT_PUBLIC_USE_MOCK_API=true  -> always use the isolated mock adapter.
 * - NEXT_PUBLIC_USE_MOCK_API=false -> always call the real Core API.
 * - unset                          -> mock when no API base URL is configured,
 *                                     live when a base URL is configured.
 *
 * The default keeps the frontend demoable before the Core API is deployed.
 */
export const isMockApiEnabled =
  explicitMockFlag === "true" ||
  (explicitMockFlag !== "false" && rawBaseUrl.length === 0);

export const apiConfig = {
  baseUrl: (rawBaseUrl || "/api/v1").replace(/\/+$/, ""),
  isMockApiEnabled,
  isSupabaseConfigured,
  requestTimeoutMs: 30_000,
  uploadTimeoutMs: 90_000,
} as const;

export const DEMO_MODE = !isSupabaseConfigured;
