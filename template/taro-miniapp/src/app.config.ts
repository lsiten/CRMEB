export default defineAppConfig({
  pages: ['pages/index/index', 'pages/goods/index', 'pages/detail/index', 'pages/search/index', 'pages/cart/index', 'pages/user/index'],
  // Keep the tab-bar and landing pages in the main package; infrequently used
  // business flows are downloaded on first navigation.
  subPackages: [
    { root: 'pages/order', pages: ['confirm', 'pay', 'list', 'detail', 'logistics', 'verify'] },
    { root: 'pages/integral', pages: ['index', 'detail', 'confirm', 'orders', 'order-detail', 'logistics', 'records'] },
    { root: 'pages/marketing', pages: ['index', 'detail'] },
    { root: 'pages/news', pages: ['index'] },
    { root: 'pages', pages: ['news-detail/index', 'assets/index', 'distribution/index', 'coupon/index', 'favorites/index', 'reviews/index', 'store/index', 'address/index', 'messages/index', 'customer/index'] },
  ],
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
