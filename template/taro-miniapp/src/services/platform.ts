/** Cross-platform boundary helpers. Keep platform APIs behind these pure contracts. */

const MAX_VALUE_LENGTH = 64;
const MAX_ID = 1_000_000_000;
const REFERRAL_KEYS = ['spread', 'spid', 'agent_id'] as const;
const SHARE_KEYS = ['kind', 'id', 'activity', 'activityId', 'productId', 'orderId'] as const;

type ReferralKey = (typeof REFERRAL_KEYS)[number];
type ShareKey = (typeof SHARE_KEYS)[number];
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
  const query = new URLSearchParams();
  if (typeof input.query === 'string') {
    for (const [key, value] of new URLSearchParams(valueFromInput(input.query))) query.set(key, value);
  }
  if (isRecord(input.query)) {
    for (const key of REFERRAL_KEYS) {
      const value = input.query[key];
      if (typeof value === 'string') query.set(key, value);
    }
  }
  if (typeof input.scene === 'string') {
    const scene = new URLSearchParams(valueFromInput(input.scene));
    for (const key of REFERRAL_KEYS) {
      const value = scene.get(key);
      if (value !== null && !query.has(key)) query.set(key, value);
    }
  }
  for (const key of REFERRAL_KEYS) {
    const value = query.get(key);
    if (value !== null && value.length <= MAX_VALUE_LENGTH && isSafeIdentifier(value)) output[key] = value;
  }
  return output;
}

/** Build a share route with encoded business identifiers only. */
function isSafeShareValue(key: ShareKey, value: string): boolean {
  if (value.length === 0 || value.length > MAX_VALUE_LENGTH) return false;
  if (key === 'kind' || key === 'activity') return /^[a-z][a-z-]{0,31}$/.test(value);
  return isSafeIdentifier(value);
}

/** Build a route from the fixed set of non-sensitive business parameters. */
export function buildSharePath(path: string, params: Readonly<Partial<Record<ShareKey, string>>>): string {
  const query = Object.entries(params)
    .filter(([key, value]) => SHARE_KEYS.includes(key as ShareKey) && typeof value === 'string' && isSafeShareValue(key as ShareKey, value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}

export type ClientPaymentResult = 'ok' | 'cancel' | 'fail';
export type ServerPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export type PaymentPresentation = Readonly<{ label: string; canRetry: boolean; isTerminal: boolean }>;

export function getPaymentPresentation(status: ServerPaymentStatus): PaymentPresentation {
  switch (status) {
    case 'pending': return { label: '等待支付', canRetry: true, isTerminal: false };
    case 'paid': return { label: '支付成功', canRetry: false, isTerminal: true };
    case 'failed': return { label: '支付失败', canRetry: true, isTerminal: true };
    case 'cancelled': return { label: '支付已取消', canRetry: true, isTerminal: true };
  }
}

/** Client callbacks never establish payment; the server status is authoritative. */
export function resolvePaymentStatus(_clientResult: ClientPaymentResult, serverStatus: ServerPaymentStatus): ServerPaymentStatus {
  return serverStatus;
}

export type ClipboardResult = Readonly<{ copied: boolean; text: string }>;

/** Preserve a manual-copy fallback when a browser/container has no clipboard API. */
export function getClipboardFallback(text: string, copied: boolean): ClipboardResult {
  return { copied, text };
}
