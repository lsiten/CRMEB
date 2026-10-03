import { ensureTenant, initializeTenantState, tenantSession, isTenantInvalid, TenantError } from './tenant';
import store from '../store';
import { TOKENNAME } from '../config/app';

export async function uploadWithTenant(options) {
  try {
    initializeTenantState();
    const userToken = store.state.app.token;
    const userRevision = store.state.app.sessionRevision;
    const operation = { revision: tenantSession.revision() };
    const assertOperation = () => {
      tenantSession.assertCurrent(operation);
      if (userToken !== store.state.app.token || userRevision !== store.state.app.sessionRevision) throw new TenantError('TENANT_CHANGED');
    };
    const tenant = await ensureTenant();
    assertOperation();
    uni.uploadFile({ ...options,
      header: { ...tenantSession.headers(tenant, options.header), ...(userToken ? { [TOKENNAME]: 'Bearer ' + userToken } : {}) },
      success: async response => {
        try {
          tenantSession.assertCurrent(tenant);
          let body;
          try { body = JSON.parse(response.data); } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
          }
          if (isTenantInvalid(body)) throw tenantSession.responseError(tenant, body);
          assertOperation();
          options.success && options.success(response);
        } catch (error) { options.fail && options.fail(error); }
      }
    });
  } catch (error) { options.fail && options.fail(error); }
}
