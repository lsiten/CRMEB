<template>
  <web-view
    class="web-view"
    :webview-styles="webviewStyles"
    :src="url"
    :style="{ width: windowW + 'px', height: windowH + 'px' }"
  ></web-view>
</template>

<script>
export default {
  data() {
    return {
      windowH: 0,
      windowW: 0,
      webviewStyles: {
        progress: {
          color: "transparent",
        },
      },
      url: "",
    };
  },
  onLoad() {
    uni.showToast({ title: '此入口无法携带商城认证，暂不可用', icon: 'none' });
  },
};
</script>
