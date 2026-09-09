// +---------------------------------------------------------------------
// | CRMEB [ CRMEB赋能开发者，助力企业发展 ]
// +---------------------------------------------------------------------
// | Copyright (c) 2016~2023 https://www.crmeb.com All rights reserved.
// +---------------------------------------------------------------------
// | Licensed CRMEB并不是自由软件，未经许可不能去掉CRMEB相关版权
// +---------------------------------------------------------------------
// | Author: CRMEB Team <admin@crmeb.com>
// +---------------------------------------------------------------------

import axios from 'axios';
import { Message } from 'element-ui';
import { captureSession, isCurrentSession, clearSession, sessionChangedError } from '@/libs/auth-session';
import Setting from '@/setting';
import router from '@/router';
import store from '@/store';
const service = axios.create({
  baseURL: Setting.apiBaseURL,
  timeout: 100000, // 请求超时时间
});

axios.defaults.withCredentials = true; // 携带cookie

function expireSession(session) {
  if (!clearSession(session)) return;
  if (session.key === 'kefu_token') store.commit('kefu/setInfo', null);
  Promise.resolve(router.replace(session.key === 'kefu_token' ? { path: '/kefu' } : { name: 'login' })).catch(() => {});
}

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    if (config.kefu) {
      let baseUrl = Setting.apiBaseURL.replace(/adminapi/, 'kefuapi');
      config.baseURL = baseUrl;
    } else {
      config.baseURL = Setting.apiBaseURL;
    }
    if (config.file) {
      config.headers['Content-Type'] = 'multipart/form-data';
    }
    config.authSession = captureSession(!!config.kefu);
    Object.keys(config.headers).forEach((key) => {
      if (key.toLowerCase() === 'authori-zation') delete config.headers[key];
    });
    if (config.authSession.token) config.headers['Authori-zation'] = 'Bearer ' + config.authSession.token;
    return config;
  },
  (error) => {
    // do something with request error
    return Promise.reject(error);
  },
);

// response interceptor
service.interceptors.response.use(
  (response) => {
    const session = response.config.authSession;
    if (!isCurrentSession(session)) return Promise.reject(sessionChangedError());
    let obj = {};
    if (!!response.data) {
      if (typeof response.data == 'string') {
        obj = JSON.parse(response.data);
      } else {
        obj = response.data;
      }
    }
    let status = response.data ? obj.status : 0;
    // let status = response.data ? response.data.status : 0;
    const code = status;
    const tenantInvalid =
      obj.tenant_invalid === true ||
      ['TENANT_INVALID', 'TENANT_EXPIRED', 'TENANT_NOT_FOUND'].includes(obj.code) ||
      code === 419;
    if (tenantInvalid || [401, 402, 419].includes(code)) {
      expireSession(session);
      return Promise.reject({ msg: tenantInvalid ? '租户已失效，请重新登录' : '未登录' });
    }
    if (code === 200) return obj;
    if (code === 403 && session.key === 'token') {
      Promise.resolve(router.replace({ name: 'system_opendir_login' })).catch(() => {});
    }
    return Promise.reject(obj || { msg: '未知错误' });
  },
  (error) => {
    const session = error.config && error.config.authSession;
    if (session && !isCurrentSession(session)) return Promise.reject(sessionChangedError());
    if (session && error.response && error.response.status === 401) {
      expireSession(session);
    }
    Message.error(error.msg);
    return Promise.reject(error);
  },
);

export default service;
