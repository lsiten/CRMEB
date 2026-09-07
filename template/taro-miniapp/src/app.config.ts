export default defineAppConfig({
  embeddedAppIdList: ['wxef277996acc166c3'],
  pages: ['pages/guide/index', 'pages/index/index', 'pages/goods/index', 'pages/detail/index', 'pages/search/index', 'pages/cart/index', 'pages/user/index'],
  // Keep the tab-bar and landing pages in the main package; infrequently used
  // business flows are downloaded on first navigation.
  subPackages: [
    { root: 'pages/order', pages: ['confirm', 'pay', 'list', 'detail', 'logistics', 'verify', 'refund-apply', 'refunds', 'refund-detail', 'review'] },
    { root: 'pages/integral', pages: ['index', 'detail', 'confirm', 'orders', 'order-detail', 'logistics', 'records'] },
    { root: 'pages/marketing', pages: ['index', 'detail', 'review-lottery', 'lottery-records', 'lottery'] },
    { root: 'pages/news', pages: ['index'] },
    { root: 'pages/account', pages: ['login', 'reset', 'profile', 'phone', 'agreement', 'cancellation', 'address-editor', 'merchant-transfer'] },
    { root: 'pages-extra', pages: ['invoice/index', 'visits/index', 'gift/index', 'news-detail/index', 'assets/index', 'distribution/index', 'coupon/index', 'favorites/index', 'reviews/index', 'store/index', 'address/index', 'login/index', 'messages/index', 'customer/index', 'receive-gift/index', 'payment-on-behalf/index', 'payment-on-behalf/pay-status/index', 'alipay-invoke/index', 'promoter-list/index', 'promoter-order/index', 'promoter-rank/index', 'commission-rank/index', 'staff-list/index', 'user-spread-user/index', 'user-spread-code/index', 'user-spread-money/index', 'user-cash/index', 'user-distribution-level/index', 'user-address/index', 'user-address-list/index', 'user-coupon/index', 'user-money/index', 'user-integral/index', 'user-info/index', 'user-phone/index', 'user-return-list/index', 'visit-list/index', 'bargain/index', 'goods-bargain/index', 'goods-bargain-details/index', 'goods-combination/index', 'goods-combination-details/index', 'goods-combination-status/index', 'goods-seckill/index', 'goods-seckill-details/index', 'presell/index', 'poster-poster/index', 'goods-search/index', 'goods-list/index', 'goods-cate/index', 'goods-logistics/index', 'vip-active/index', 'vip-clause/index', 'vip-coupon/index', 'vip-paid/index', 'user-vip/index', 'user-vip-areer/index'] },
  ],
  window: { navigationBarTitleText: 'CRMEB商城', navigationBarBackgroundColor: '#ffffff', navigationBarTextStyle: 'black' },
  tabBar: {
    color: '#666666', selectedColor: '#e93323', backgroundColor: '#ffffff', borderStyle: 'black',
    list: [
      { iconPath: 'assets/tabbar/1-001.png', selectedIconPath: 'assets/tabbar/1-002.png', pagePath: 'pages/index/index', text: '首页' },
      { iconPath: 'assets/tabbar/2-001.png', selectedIconPath: 'assets/tabbar/2-002.png', pagePath: 'pages/goods/index', text: '分类' },
      { iconPath: 'assets/tabbar/3-001.png', selectedIconPath: 'assets/tabbar/3-002.png', pagePath: 'pages/cart/index', text: '购物车' },
      { iconPath: 'assets/tabbar/4-001.png', selectedIconPath: 'assets/tabbar/4-002.png', pagePath: 'pages/user/index', text: '我的' },
    ],
  },
});
