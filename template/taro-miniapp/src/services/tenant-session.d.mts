export type TenantSnapshot = Readonly<{ revision: number }>;
export type TenantCredentials = Readonly<{ appid: string; screct_id: string }>;
export class TenantError extends Error { constructor(code: string); readonly code: string; }
export function isTenantInvalid(body: unknown): boolean;
export function tenantResponseError(body: unknown): TenantError;
export function createTenantSession(options?: Readonly<{ clear?: () => void }>): Readonly<{
  enabled: () => boolean;
  snapshot: () => TenantSnapshot;
  ensure: () => Promise<TenantSnapshot>;
  inject: (credentials: unknown) => void;
  clear: () => void;
  responseError: (snapshot: TenantSnapshot, body: unknown) => TenantError;
  headers: (snapshot: TenantSnapshot, extra?: Readonly<Record<string, unknown>>) => Record<string, string>;
  assertCurrent: (snapshot: TenantSnapshot) => void;
  revision: () => number;
}>;
