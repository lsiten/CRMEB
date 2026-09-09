import Vue from 'vue';
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import '@/theme/index.scss';
import '@/styles/index.scss';
import PC from '@/pages/kefu/appChat/index.vue';
import Mobile from '@/pages/kefu/appChat/mobile/index.vue';
import Feedback from '@/pages/kefu/appChat/mobile/feedback.vue';
import Staff from '@/pages/kefu/index.vue';
import * as session from '@/libs/kefu-guest-session';
import request, { uploadGuestFile, prepareGuestUpload } from '@/libs/kefu-guest-request';
import * as api from '@/api/kefu';
import router from './router';
import Cookies from 'js-cookie';
Vue.use(ElementUI);
Vue.directive('db-click', {});
Vue.directive('lazy', { bind(el, { value }) { if (value) el.src = value; } });
Vue.component('vue-scroll', { methods: { refresh() {}, scrollTo() {} }, render(h) { return h('div', this.$slots.default); } });
Vue.prototype.$wechat = { _isMobile: () => window.innerWidth < 769, isWeixin: () => false };
Vue.prototype.$router = router;
Vue.prototype.$route = { name: 'kefu', query: {} };
Vue.prototype.$store = { state: { media: { isMobile: false } }, commit(type, value) { window.guestTest.commits.push({ type, value }); } };
const errors = [];
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason && (event.reason.msg || event.reason.message) || event.reason)));
Vue.config.errorHandler = (error) => errors.push(error.message);
let root;
window.guestTest = {
  ...session, request, uploadGuestFile, prepareGuestUpload, api, Cookies, errors, commits: [], router,
  async mount(name) {
    if (root) { root.$destroy(); root.$el.remove(); }
    const node = document.createElement('div'); document.body.appendChild(node);
    const component = { pc: PC, mobile: Mobile, feedback: Feedback, staff: Staff }[name];
    root = new Vue({ render: (h) => h(component, { ref: 'page', props: { chatOptions: { show: true, popup: false } } }) }).$mount(node);
    await Vue.nextTick();
    this.page = root.$refs.page;
    return name;
  },
};
