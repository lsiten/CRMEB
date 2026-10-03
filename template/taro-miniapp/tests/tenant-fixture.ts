import { vi } from 'vitest';

// Existing business tests run behind an already provisioned tenant boundary.
// The adapter suite explicitly unmocks this module and tests real injection/cleanup.
vi.mock('../src/services/tenant', async () => {
  const core = await import('../src/services/tenant-session.mjs');
  const tenantSession = core.createTenantSession();
  tenantSession.inject({ appid: 'isolated-fixture', screct_id: 'isolated-fake-secret' });
  return {
    ...core, tenantSession,
    initializeTenantState: () => undefined,
    subscribeTenant: () => () => undefined,
  };
});
