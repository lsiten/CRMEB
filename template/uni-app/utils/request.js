import { canReplayTenantRead } from './tenant-session.mjs';
// +----------------------------------------------------------------------
// | CRMEB [ CRMEB赋能开发者，助力企业发展 ]
// +----------------------------------------------------------------------
// | Copyright (c) 2016~2024 https://www.crmeb.com All rights reserved.
// +----------------------------------------------------------------------
// | Licensed CRMEB并不是自由软件，未经许可不能去掉CRMEB相关版权
// +----------------------------------------------------------------------
// | Author: CRMEB Team <admin@crmeb.com>
// +----------------------------------------------------------------------

import {
	HTTP_REQUEST_URL,
	HEADER,
	TOKENNAME,
	TIMEOUT
} from '@/config/app';
import {
	toLogin,
	checkLogin
} from '../libs/login';
import store from '../store';
import i18n from './lang.js';
import { ensureTenant, initializeTenantState, tenantSession, isTenantInvalid, TenantError } from './tenant';

/**
 * 发送请求
 */
async function baseRequest(url, method, data, {
	noAuth = false,
	noVerify = false,
	tenantRetry = false
}) {
	initializeTenantState();
	if (!noAuth) {
		//登录过期自动登录
		if (!store.state.app.token && !checkLogin()) {
			toLogin();
			return Promise.reject({
				msg: i18n.t(`未登录`)
			});
		}
	}
	const userToken = store.state.app.token;
	const userRevision = store.state.app.sessionRevision;
	const operation = { revision: tenantSession.revision() };
	const assertOperation = () => {
		tenantSession.assertCurrent(operation);
		if (store.state.app.sessionRevision !== userRevision || store.state.app.token !== userToken) throw new TenantError('TENANT_CHANGED');
	};
	const tenant = await ensureTenant();
	assertOperation();
	let Url = HTTP_REQUEST_URL,
		header = { ...HEADER };
	if (tenant.token) header['X-Tenant-Token'] = tenant.token;
	if (userToken) header[TOKENNAME] = 'Bearer ' + userToken;

	return new Promise((reslove, reject) => {
		if (uni.getStorageSync('locale')) {
			header['Cb-lang'] = uni.getStorageSync('locale')
		}
		assertOperation();
		uni.request({
			url: Url + '/api/' + url,
			method: method || 'GET',
			header: header,
			data: data || {},
			timeout: TIMEOUT,
			success: async (res) => {
        try {
          assertOperation();
        } catch (error) { reject(error); return; }
        if (isTenantInvalid(res.data)) {
          if (tenantRetry) { reject(new TenantError('TENANT_UNAVAILABLE')); return; }
          try {
            await tenantSession.renew(tenant);
            assertOperation();
            if (!canReplayTenantRead(url, method)) throw new TenantError('TENANT_UNAVAILABLE');
            reslove(await baseRequest(url, method, data, { noAuth, noVerify, tenantRetry: true }));
          } catch (error) { reject(error); }
          return;
        }
				if (noVerify)
					reslove(res.data, res);
				else if (res.data.status == 200)
					reslove(res.data, res);
				else if (res.data.status == 401) {
					toLogin();
					reject(res.data);
				} else if (res.data.status == 402) {
					uni.showModal({
						title: i18n.t(`提示`),
						content: res.data.msg,
						showCancel: false,
						confirmText: i18n.t(`我知道了`)
					});
				} else
					reject(res.data.msg || i18n.t(`系统错误`));
			},
			fail: (msg) => {
				let data = {
					mag: i18n.t(`请求失败`),
					status: 1 //1没网
				}
				// #ifdef APP-PLUS
				reject(data);
				// #endif
				// #ifndef APP-PLUS
				reject(i18n.t(`请求失败`));
				// #endif
			}
		})
	});
}

const request = {};

['options', 'get', 'post', 'put', 'head', 'delete', 'trace', 'connect'].forEach((method) => {
	request[method] = (api, data, opt) => baseRequest(api, method, data, opt || {})
});



export default request;
