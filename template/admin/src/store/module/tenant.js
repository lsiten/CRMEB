import { clearTenantContext, getTenantContext, saveTenantContext } from '@/utils/tenant';

const initial = getTenantContext();

export default {
  namespaced: true,
  state: {
    current: initial.current,
    list: initial.list,
  },
  mutations: {
    setContext(state, { current, list = [] }) {
      state.current = current || null;
      state.list = Array.isArray(list) ? list : [];
      saveTenantContext(state.current, state.list);
    },
    clear(state) {
      state.current = null;
      state.list = [];
      clearTenantContext();
    },
  },
};
