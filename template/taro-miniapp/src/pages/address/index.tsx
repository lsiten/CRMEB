import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { ApiError, getToken } from '../../services/api';
import { deleteAddress, getAddresses, setDefaultAddress, type Address } from '../../services/account';
import './index.scss';

const AddressPage = () => {
  const [addresses, setAddresses] = useState<readonly Address[]>([]);
  const load = async (): Promise<void> => {
    if (!getToken()) { await Taro.showToast({ title: '请先登录', icon: 'none' }); return; }
    try { setAddresses(await getAddresses()); }
    catch (error) { if (error instanceof ApiError) await Taro.showToast({ title: error.message, icon: 'none' }); }
  };
  useDidShow(() => { void load(); });
  const setDefault = async (id: number): Promise<void> => { await setDefaultAddress(id); await load(); };
  const remove = async (id: number): Promise<void> => { await deleteAddress(id); await load(); };
  return <View className='page addressPage'><View className='addressList'>{addresses.map((address) => <View className='card addressCard' key={address.id}><View className='addressHead'><Text className='name'>{address.real_name}</Text><Text>{address.phone}</Text>{address.is_default && <Text className='tag'>默认</Text>}</View><Text className='detail'>{address.province}{address.city}{address.district}{address.detail}</Text><View className='addressActions'>{!address.is_default && <Button onClick={() => void setDefault(address.id)}>设为默认</Button>}<Button onClick={() => void remove(address.id)}>删除</Button></View></View>)}</View>{addresses.length === 0 && <View className='empty'><Text>暂无收货地址</Text></View>}<Button className='primary addButton' onClick={() => void Taro.showToast({ title: '地址编辑即将上线', icon: 'none' })}>新增收货地址</Button></View>;
};

export default AddressPage;
