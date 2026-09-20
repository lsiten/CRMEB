import { guestSnapshot, onGuestCredentialsChange } from '@/libs/kefu-guest-session';
import { uploadGuestFile, prepareGuestUpload } from '@/libs/kefu-guest-request';

const unavailable = '实时聊天暂不可用，您仍可提交反馈';
const arrays = ['recordList', 'chatList'];
const objects = ['serviceData', 'orderInfo', 'productInfo', 'cartInfo', 'uploadData'];
const strings = [
  'notice',
  'feedback',
  'chatCont',
  'con',
  'name',
  'phone',
  'toUid',
  'tourist_uid',
  'tourist_avatar',
  'kufuToken',
  'userToken',
  'nickname',
  'orderId',
  'productId',
  'selector',
];

export default {
  data() {
    return { guestAccessMessage: unavailable };
  },
  created() {
    this.updateGuestAccess();
    this.stopGuestObserver = onGuestCredentialsChange(() => {
      document.title = '客服';
      arrays.forEach((key) => {
        if (key in this.$data) this[key] = [];
      });
      objects.forEach((key) => {
        if (key in this.$data) this[key] = {};
      });
      strings.forEach((key) => {
        if (key in this.$data) this[key] = '';
      });
      if ('formItem' in this.$data)
        Object.keys(this.formItem).forEach((key) => {
          this.formItem[key] = '';
        });
      if ('loading' in this.$data) this.loading = false;
      if ('finished' in this.$data) this.finished = false;
      if ('upperId' in this.$data) this.upperId = 0;
      if ('page' in this.$data) this.page = 1;
      if ('isDisabled' in this.$data) this.isDisabled = false;
      if ('isShow' in this.$data) this.isShow = false;
      if ('change' in this.$data) this.change = false;
      this.updateGuestAccess();
    });
  },
  beforeDestroy() {
    this.stopGuestObserver();
  },
  methods: {
    updateGuestAccess() {
      try {
        guestSnapshot();
        this.guestAccessMessage = unavailable;
      } catch (error) {
        this.guestAccessMessage = error.msg;
      }
    },
    guestUpload: uploadGuestFile,
    prepareGuestUpload,
    blockedGuestChat() {
      this.$message.warning(unavailable);
    },
    guestRequestError(error) {
      if (error.data && error.data.code === 'guest_session_changed') return;
      this.$message.error(error.msg || '客服请求失败，请稍后重试');
    },
  },
};
