export type TenantSnapshot = Readonly<{ revision: number; token: string; expiresAt: number }>;
export class TenantError extends Error { readonly code: 'TENANT_CHANGED' | 'TENANT_UNAVAILABLE'; }
export function isTenantInvalid(body: unknown): boolean;
export function createTenantSession(options: Readonly<{
  entry?: string;
  bootstrap: (entry: string) => Promise<unknown>;
  clear?: () => void;
  now?: () => number;
}>): Readonly<{
  enabled: () => boolean;
  ensure: () => Promise<TenantSnapshot>;
  renew: (snapshot: TenantSnapshot) => Promise<TenantSnapshot>;
  select: (entry: string) => void;
  assertCurrent: (snapshot: Pick<TenantSnapshot, 'revision'>) => void;
  revision: () => number;
}>;

export function canReplayTenantRead(path: string, method?: string): boolean;
