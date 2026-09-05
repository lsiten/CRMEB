import { View, Text, Input, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { ApiError } from '../../services/api';
import { getStores, locateStore, type Store } from '../../services/store';
import './index.scss';

export default function StorePage() {
  const [stores, setStores] = useState<readonly Store[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async (search = keyword): Promise<void> => {
    setLoading(true);
    try {
      let location: { latitude: number; longitude: number } | undefined;
      try { const result = await Taro.getLocation({ type: 'gcj02' }); location = { latitude: result.latitude, longitude: result.longitude }; } catch { await Taro.showToast({ title: '定位未授权，已显示全部门店', icon: 'none' }); }
      setStores(await getStores({ ...(location ?? {}), ...(search.trim() ? { keyword: search.trim() } : {}) }));
    } catch (error) { await Taro.showToast({ title: error instanceof ApiError ? error.message : '门店加载失败', icon: 'none' }); }
    finally { setLoading(false); }
  };
  useDidShow(() => { void load(); });
  return <View className='page storePage'><View className='searchBar'><Input value={keyword} onInput={(event) => setKeyword(event.detail.value)} onConfirm={() => void load()} placeholder='搜索门店名称或地址' /><Button loading={loading} onClick={() => void load()}>搜索</Button></View><View className='storeList'>{stores.map((store) => <View className='card storeCard' key={store.id}><View className='storeMain'><Text className='storeName'>{store.name}</Text><Text className='storeAddress'>{store.address}{store.detailedAddress ? ` ${store.detailedAddress}` : ''}</Text>{store.distance !== undefined && <Text className='hint'>{store.distance.toFixed(1)} km</Text>}</View><View className='storeActions'>{store.phone && <Button onClick={() => Taro.makePhoneCall({ phoneNumber: store.phone as string })}>电话</Button>}<Button onClick={() => void locateStore(store)}>地图</Button></View></View>)}</View>{!loading && stores.length === 0 && <View className='empty'><Text>暂无匹配门店</Text></View>}</View>;
}
