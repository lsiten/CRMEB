import axios from 'axios';
import Setting from '@/setting';
import {
  guestSnapshot,
  assertGuestSnapshot,
  guestHeaders,
  invalidateGuestSnapshot,
  guestError,
} from './kefu-guest-session';

const service = axios.create({ timeout: 100000, withCredentials: false });
const uploadSnapshots = new WeakMap();
const tenantMessages = {
  tenant_auth_required: '客服访问尚未就绪，请联系接入方',
  tenant_credentials_invalid: '客服访问凭据已失效，请联系接入方',
  tenant_auth_unavailable: '客服认证服务暂不可用，请稍后重试',
  tenant_mismatch: '客服访问租户不匹配',
  tenant_bootstrap_unavailable: '客服访问入口不可用',
};

service.interceptors.request.use((config) => {
  config.headers = guestHeaders(config.guestRevision);
  return config;
});

function allowed(url, method) {
  if (method === 'post') return /^tourist\/(feedback|upload)$/.test(url);
  return method === 'get' && /^tourist\/(user|adv|chat|feedback|order\/[\w-]+|product\/[\w-]+)$/.test(url);
}

function unwrap(body, snapshot, httpStatus = 0) {
  assertGuestSnapshot(snapshot);
  const code = body && body.data && body.data.code;
  if (Object.prototype.hasOwnProperty.call(tenantMessages, code)) {
    if (code === 'tenant_credentials_invalid') invalidateGuestSnapshot(snapshot);
    throw guestError(code, tenantMessages[code], body.status || httpStatus);
  }
  if (body && body.status === 200 && httpStatus < 400) return body;
  // Never forward Axios errors/configuration (which contain credential headers) to page handlers.
  throw guestError('guest_request_failed', '客服请求失败，请稍后重试', (body && body.status) || httpStatus || 0);
}

export default function guestRequest({ url, method = 'get', params, data }) {
  let snapshot;
  try {
    if (!allowed(url, method)) throw guestError('guest_endpoint_invalid', '不支持的客服请求', 400);
    snapshot = guestSnapshot();
  } catch (error) {
    return Promise.reject(error);
  }
  return service({
    baseURL: Setting.apiBaseURL.replace(/adminapi/, 'kefuapi'),
    url,
    method,
    params,
    data,
    guestRevision: snapshot,
  }).then(
    (response) => unwrap(response.data, snapshot, response.status || 200),
    (error) => {
      assertGuestSnapshot(snapshot);
      return unwrap(error.response && error.response.data, snapshot, error.response && error.response.status);
    },
  );
}

export function uploadGuestFile({ file, data = {} }) {
  try {
    if (uploadSnapshots.has(file)) {
      assertGuestSnapshot(uploadSnapshots.get(file));
      uploadSnapshots.delete(file);
    }
    guestSnapshot();
    const form = new FormData();
    form.append('file', file, file.name);
    if (data.token) form.append('token', data.token);
    return guestRequest({ url: 'tourist/upload', method: 'post', data: form });
  } catch (error) {
    return Promise.reject(error);
  }
}

export function prepareGuestUpload(file) {
  uploadSnapshots.set(file, guestSnapshot());
}
