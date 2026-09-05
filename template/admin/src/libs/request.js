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
import { getCookies, removeCookies } from '@/libs/util';
import { clearTenantContext } from '@/utils/tenant';
import Setting from '@/setting';
import router from '@/router';
const service = axios.create({
  baseURL: Setting.apiBaseURL,
  timeout: 100000, // 请求超时时间
});

axios.defaults.withCredentials = true; // 携带cookie

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
    const token = getCookies('token');
    if (token) config.headers['Authori-zation'] = 'Bearer ' + token;
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
    switch (code) {
      case 200:
        if (tenantInvalid) {
          localStorage.clear();
          clearTenantContext();
          removeCookies('token');
          removeCookies('expires_time');
          removeCookies('uuid');
          router.replace({ name: 'login' });
          return Promise.reject({ msg: '租户已失效，请重新登录' });
        }
        return obj;
      case 401:
        localStorage.clear();
        clearTenantContext();
        removeCookies('token');
        removeCookies('expires_time');
        removeCookies('uuid');
        router.replace({ name: 'login' }).catch(() => {});
        return Promise.reject({ msg: '未登录' });
      case 419:
        localStorage.clear();
        clearTenantContext();
        removeCookies('token');
        removeCookies('expires_time');
        removeCookies('uuid');
        router.replace({ name: 'login' });
        return Promise.reject({ msg: '租户已失效，请重新登录' });
      case 402:
        removeCookies('kefuInfo');
        removeCookies('kefu_token');
        removeCookies('kefu_expires_time');
        removeCookies('kefu_uuid');
        router.replace({ path: '/kefu' }).catch(() => {});
        return Promise.reject({ msg: '未登录' });
      case 403:
        router.replace({ name: 'system_opendir_login' }).catch(() => {});
        return Promise.reject({ msg: '没有权限' });
      default:
        if (tenantInvalid) {
          localStorage.clear();
          clearTenantContext();
          removeCookies('token');
          removeCookies('expires_time');
          removeCookies('uuid');
          router.replace({ name: 'login' });
          return Promise.reject({ msg: '租户已失效，请重新登录' });
        }
        return Promise.reject(obj || { msg: '未知错误' });
    }
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.clear();
      clearTenantContext();
      removeCookies('token');
      removeCookies('expires_time');
      removeCookies('uuid');
      router.replace({ name: 'login' });
    }
    Message.error(error.msg);
    return Promise.reject(error);
  },
);

export default service;
