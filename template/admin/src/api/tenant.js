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

export function tenantCreateApi(data) {
  return request({ url: '/setting/tenant', method: 'post', data });
}

export function tenantUpdateApi(id, data) {
  return request({ url: `/setting/tenant/${id}`, method: 'put', data });
}

export function tenantDeleteApi(id) {
  return request({ url: `/setting/tenant/${id}`, method: 'delete' });
}

export function tenantStatusApi(id, status) {
  return request({ url: `/setting/tenant/status/${id}/${status}`, method: 'put' });
}
