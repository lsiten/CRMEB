import { ensureTenant, tenantSession, isTenantInvalid, TenantError } from './tenant';
import store from '../store';
import { TOKENNAME } from '../config/app';

export async function uploadWithTenant(options) {
  try {
    const tenant = await ensureTenant();
    const userToken = store.state.app.token;
    const userRevision = store.state.app.sessionRevision;
    uni.uploadFile({ ...options,
      header: { ...options.header, [TOKENNAME]: 'Bearer ' + store.state.app.token,
        ...(tenant.token ? { 'X-Tenant-Token': tenant.token } : {}) },
      success: async response => {
        try {
          tenantSession.assertCurrent(tenant);
          if (userToken !== store.state.app.token || userRevision !== store.state.app.sessionRevision) throw new TenantError('TENANT_CHANGED');
          let body;
          try { body = JSON.parse(response.data); } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
          }
          if (isTenantInvalid(body)) {
            await tenantSession.renew(tenant);
            throw new TenantError('TENANT_UNAVAILABLE');
          }
          options.success && options.success(response);
        } catch (error) { options.fail && options.fail(error); }
      }
    });
  } catch (error) { options.fail && options.fail(error); }
}
