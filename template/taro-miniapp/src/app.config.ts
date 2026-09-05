export default defineAppConfig({
  pages: ['pages/index/index', 'pages/goods/index', 'pages/detail/index', 'pages/search/index', 'pages/cart/index', 'pages/user/index', 'pages/address/index', 'pages/store/index', 'pages/integral/index', 'pages/integral/detail', 'pages/integral/confirm', 'pages/integral/orders', 'pages/integral/order-detail', 'pages/integral/logistics', 'pages/integral/records', 'pages/order/confirm', 'pages/order/pay', 'pages/order/list', 'pages/order/detail', 'pages/order/logistics', 'pages/order/verify', 'pages/marketing/index', 'pages/marketing/detail', 'pages/news/index', 'pages/news-detail/index', 'pages/messages/index', 'pages/customer/index'],
  window: { navigationBarTitleText: 'CRMEB商城', navigationBarBackgroundColor: '#ffffff', navigationBarTextStyle: 'black' },
  tabBar: {
    color: '#666666', selectedColor: '#e93323', backgroundColor: '#ffffff', borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/goods/index', text: '商品' },
      { pagePath: 'pages/cart/index', text: '购物车' },
      { pagePath: 'pages/user/index', text: '我的' },
    ],
  },
});
