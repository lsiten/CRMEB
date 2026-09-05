/** Cross-platform boundary helpers. Keep platform APIs behind these pure contracts. */

const MAX_VALUE_LENGTH = 64;
const MAX_ID = 1_000_000_000;
const REFERRAL_KEYS = ['spread', 'spid', 'agent_id'] as const;

type ReferralKey = (typeof REFERRAL_KEYS)[number];
export type DeepLinkParams = Readonly<Partial<Record<ReferralKey, string>>>;
export type DeepLinkInput = Readonly<{ scene?: unknown; query?: unknown }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function valueFromInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  if (input.length > MAX_VALUE_LENGTH * 4) return '';
  try {
    return decodeURIComponent(input);
  } catch {
    return '';
  }
}

function isSafeIdentifier(value: string): boolean {
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0 && number <= MAX_ID;
}

/** Parse only referral identifiers from untrusted scene/query values. */
export function parseDeepLink(input: DeepLinkInput): DeepLinkParams {
  const output: Partial<Record<ReferralKey, string>> = {};
  const source = isRecord(input.query) ? input.query : input.query ?? input.scene;
  const query = new URLSearchParams(typeof source === 'string' ? valueFromInput(source) : '');
  if (isRecord(source)) {
    for (const key of REFERRAL_KEYS) {
      const value = source[key];
      if (typeof value === 'string') query.set(key, value);
    }
  }
  if (typeof input.scene === 'string' && source !== input.query) {
    const scene = new URLSearchParams(valueFromInput(input.scene));
    for (const key of REFERRAL_KEYS) if (!query.has(key)) {
      const value = scene.get(key);
      if (value !== null) query.set(key, value);
    }
  }
  for (const key of REFERRAL_KEYS) {
    const value = query.get(key);
    if (value !== null && value.length <= MAX_VALUE_LENGTH && isSafeIdentifier(value)) output[key] = value;
  }
  return output;
}

/** Build a share route with encoded business identifiers only. */
export function buildSharePath(path: string, params: Readonly<Record<string, string>>): string {
  const query = Object.entries(params)
    .filter(([key, value]) => /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key) && value.length <= MAX_VALUE_LENGTH)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}

export type ClientPaymentResult = 'ok' | 'cancel' | 'fail';
export type ServerPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

/** Client callbacks never establish payment; the server status is authoritative. */
export function resolvePaymentStatus(_clientResult: ClientPaymentResult, serverStatus: ServerPaymentStatus): ServerPaymentStatus {
  return serverStatus;
}

export type ClipboardResult = Readonly<{ copied: boolean; text: string }>;

/** Preserve a manual-copy fallback when a browser/container has no clipboard API. */
export function getClipboardFallback(text: string, copied: boolean): ClipboardResult {
  return { copied, text };
}
