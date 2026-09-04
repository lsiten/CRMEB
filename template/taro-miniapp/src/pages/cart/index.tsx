import { View, Text, Button } from '@tarojs/components';
import './index.scss';

const CartPage = () => <View className='page'><Text className='title'>购物车</Text><View className='card empty'><Text>购物车还是空的</Text><Button className='primary'>去逛逛</Button></View></View>;

export default CartPage;
