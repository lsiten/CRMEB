import request from '@/libs/request';

export function tenantListApi(params) {
  return request({ url: '/tenant/list', method: 'get', params });
}

export function switchTenantApi(data) {
  return request({ url: '/tenant/switch', method: 'post', data });
}

export function tenantAdminListApi(params) {
  return request({ url: '/setting/tenant', method: 'get', params });
}
