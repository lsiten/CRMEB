import { cloneDeep } from 'lodash';
import { Local, Session } from '@/utils/storage';

export function createAdminSessionReset(modules) {
  // Capture defaults before Vuex mutates modules or restores persisted state.
  const defaults = {};
  Object.keys(modules).forEach((key) => {
    defaults[key] = cloneDeep(modules[key].state);
  });
  defaults.tenant = { current: null, list: [] };
  defaults.menus.menusName = [];

  return (state) => {
    const locale = state.app.local;
    Object.keys(defaults).forEach((key) => {
      state[key] = cloneDeep(defaults[key]);
    });
    state.app.local = locale;
    ['TENANT_CURRENT', 'TENANT_LIST', 'PERMISSIONS'].forEach((key) => Local.remove(key));
    ['menuList', 'tagNaveList', 'DELIVERY_DATA', 'ADMIN_TITLE'].forEach((key) => window.localStorage.removeItem(key));
    Session.remove('userInfo');
  };
}
