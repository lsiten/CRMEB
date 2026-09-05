import { Local } from '@/utils/storage.js';

export const TENANT_CURRENT_KEY = 'TENANT_CURRENT';
export const TENANT_LIST_KEY = 'TENANT_LIST';

export function saveTenantContext(current, tenants = []) {
  if (current) Local.set(TENANT_CURRENT_KEY, current);
  else Local.remove(TENANT_CURRENT_KEY);
  Local.set(TENANT_LIST_KEY, Array.isArray(tenants) ? tenants : []);
}

export function clearTenantContext() {
  Local.remove(TENANT_CURRENT_KEY);
  Local.remove(TENANT_LIST_KEY);
}

export function getTenantContext() {
  return {
    current: Local.get(TENANT_CURRENT_KEY) || null,
    list: Local.get(TENANT_LIST_KEY) || [],
  };
}
