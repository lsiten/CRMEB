import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { ApiError, getToken } from '../../services/api';
import { deleteAddress, getAddresses, saveAddress, setDefaultAddress, type Address } from '../../services/account';
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
  const chooseAndSave = async (address?: Address): Promise<void> => {
    if (!getToken()) { await Taro.showToast({ title: '请先登录', icon: 'none' }); return; }
    try {
      const picked = await Taro.chooseAddress();
      await saveAddress({
        ...(address ? { id: address.id } : {}),
        real_name: picked.userName,
        phone: picked.telNumber,
        province: picked.provinceName,
        city: picked.cityName,
        district: picked.countyName,
        detail: picked.detailInfo,
        is_default: address?.is_default ?? addresses.length === 0,
      });
      await Taro.showToast({ title: address ? '地址已更新' : '地址已保存', icon: 'success' });
      await load();
    } catch (error) {
      if (error instanceof ApiError) await Taro.showToast({ title: error.message, icon: 'none' });
    }
  };
  return <View className='page addressPage'><View className='addressList'>{addresses.map((address) => <View className='card addressCard' key={address.id}><View className='addressHead'><Text className='name'>{address.real_name}</Text><Text>{address.phone}</Text>{address.is_default && <Text className='tag'>默认</Text>}</View><Text className='detail'>{address.province}{address.city}{address.district}{address.detail}</Text><View className='addressActions'>{!address.is_default && <Button onClick={() => void setDefault(address.id)}>设为默认</Button>}<Button onClick={() => void chooseAndSave(address)}>编辑</Button><Button onClick={() => void remove(address.id)}>删除</Button></View></View>)}</View>{addresses.length === 0 && <View className='empty'><Text>暂无收货地址</Text></View>}<Button className='primary addButton' onClick={() => void chooseAndSave()}>新增收货地址</Button></View>;
};

export default AddressPage;
