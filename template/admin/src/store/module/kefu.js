// +----------------------------------------------------------------------
// | CRMEB [ CRMEB赋能开发者，助力企业发展 ]
// +----------------------------------------------------------------------
// | Copyright (c) 2016~2023 https://www.crmeb.com All rights reserved.
// +----------------------------------------------------------------------
// | Licensed CRMEB并不是自由软件，未经许可不能去掉CRMEB相关版权
// +----------------------------------------------------------------------
// | Author: CRMEB Team <admin@crmeb.com>
// +----------------------------------------------------------------------

import { AccountLogoutKefu } from '@/api/kefu';
import { getCookies } from '@/libs/util';
import { captureSession, isCurrentSession, clearSession } from '@/libs/auth-session';
import router from '@/router';
import { Socket } from '@/libs/socket';
export default {
  namespaced: true,
  state: {
    kefuInfo: null,
  },
  mutations: {
    setInfo(state, val) {
      state.kefuInfo = val;
    },
  },
  actions: {
    /**
     * @description 退出登录
     * */
    async logoutKefu({ commit }, { vm } = {}) {
      const session = captureSession(true);
      const uid = getCookies('kefu_uuid');
      try {
        await AccountLogoutKefu();
        if (!clearSession(session)) return;
        const cleared = captureSession(true);
        commit('setInfo', null);
        Socket.then((ws) => {
          if (isCurrentSession(cleared)) return ws.send({ type: 'logout', data: { uid } });
        }).catch(() => {});
        await router.push({ path: '/kefu' });
      } catch (error) {
        if (error.code !== 'SESSION_CHANGED' && isCurrentSession(session) && vm) {
          vm.$message.error(error.msg || '退出失败，请重试');
        }
      }
    },
  },
};
