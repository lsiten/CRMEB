export default defineAppConfig({
  pages: ['pages/index/index', 'pages/goods/index', 'pages/detail/index', 'pages/search/index', 'pages/cart/index', 'pages/user/index'],
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
