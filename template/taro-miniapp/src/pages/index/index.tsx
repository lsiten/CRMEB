import { View, Text, Swiper, SwiperItem, Image, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

const IndexPage = () => (
  <View className='page'>
    <Swiper className='banner' indicatorDots autoplay circular>
      <SwiperItem><View className='bannerItem'><Text>CRMEB · 好物精选</Text></View></SwiperItem>
      <SwiperItem><View className='bannerItem'><Text>新人专享优惠</Text></View></SwiperItem>
    </Swiper>
    <View className='card shortcuts'>
      {['全部商品', '限时秒杀', '积分商城', '优惠券'].map((item) => <Button key={item} onClick={() => Taro.navigateTo({ url: '/pages/goods/index' })}>{item}</Button>)}
    </View>
    <View className='card'><Text className='sectionTitle'>为你推荐</Text><Image mode='aspectFill' src='https://dummyimage.com/680x240/ffe9e5/e93323&text=CRMEB' /></View>
  </View>
);

export default IndexPage;
