import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { useState } from 'react';
import { Empty, Loading, Modal } from '../../components';
import { ApiError } from '../../services/api';
import { CHECKOUT_ADDRESS_ID_KEY } from '../../services/account-contracts';
import { deleteAddress, getAddresses, saveAddress, setDefaultAddress } from '../../services/account';
import type { Address } from '../../services/account';
import { requireLogin } from '../../services/auth-flow';
import './index.scss';

export default function AddressPage() {
  const selecting = useRouter().params['select'] === '1';
  const [addresses, setAddresses] = useState<readonly Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<number>();
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const load = async (): Promise<void> => {
    const returnUrl = selecting ? '/pages-extra/address/index?select=1' : '/pages-extra/address/index';
    if (!requireLogin(returnUrl)) return;
    setLoading(true); setFailed(false);
    try { setAddresses(await getAddresses()); }
    catch (caught) {
      setFailed(true);
      if (caught instanceof ApiError && caught.code === 'UNAUTHORIZED') requireLogin(returnUrl);
    } finally { setLoading(false); }
  };
  useDidShow(() => { void load(); });
  const makeDefault = async (id: number): Promise<void> => {
    setBusyId(id);
    try { await setDefaultAddress(id); await Taro.showToast({ title: '默认地址已更新', icon: 'success' }); await load(); }
    catch (caught) { await Taro.showToast({ title: caught instanceof ApiError ? caught.message : '设置失败，请重试', icon: 'none' }); }
    finally { setBusyId(undefined); }
  };
  const remove = async (): Promise<void> => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try { await deleteAddress(deleteTarget.id); await Taro.showToast({ title: '地址已删除', icon: 'success' }); setDeleteTarget(null); await load(); }
    catch (caught) { await Taro.showToast({ title: caught instanceof ApiError ? caught.message : '删除失败，请重试', icon: 'none' }); }
    finally { setBusyId(undefined); }
  };
  const importAddress = async (): Promise<void> => {
    try {
      const picked = await Taro.chooseAddress();
      await saveAddress({ real_name: picked.userName, phone: picked.telNumber, province: picked.provinceName, city: picked.cityName, district: picked.countyName, detail: picked.detailInfo, is_default: addresses.length === 0 });
      await Taro.showToast({ title: '地址已导入', icon: 'success' });
      await load();
    } catch { await Taro.showToast({ title: '未能导入地址，仍可手工填写', icon: 'none' }); }
  };
  const select = async (address: Address): Promise<void> => {
    if (!selecting) return;
    Taro.setStorageSync(CHECKOUT_ADDRESS_ID_KEY, address.id);
    await Taro.navigateBack();
  };
  const editUrl = (address?: Address) => `/pages/account/address-editor${address ? `?id=${address.id}` : ''}`;
  return <View className='page address-page'>
    <View className='address-heading'><Text className='address-title'>{selecting ? '选择收货地址' : '地址管理'}</Text><Text className='address-caption'>{selecting ? '点击地址即可返回订单确认' : '维护常用收货信息'}</Text></View>
    {loading && <View className='card address-state'><Loading label='正在加载地址' /></View>}
    {!loading && failed && <View className='card address-state'><Text>地址加载失败，请检查网络</Text><Button onClick={() => void load()}>重试</Button></View>}
    {!loading && !failed && addresses.length === 0 && <View className='card address-state'><Empty title='暂无收货地址' description='新增地址后可在下单时快速选择' actionLabel='手工新增' onAction={() => void Taro.navigateTo({ url: editUrl() })} /></View>}
    {!loading && !failed && <View className='address-list'>{addresses.map((address) => <View className='card address-card' key={address.id} onClick={() => void select(address)}>
      <View className='address-head'><Text className='address-name'>{address.real_name}</Text><Text>{address.phone}</Text>{address.is_default && <Text className='address-tag'>默认</Text>}</View>
      <Text className='address-detail'>{address.province}{address.city}{address.district}{address.detail}</Text>
      <View className='address-actions' onClick={(event) => event.stopPropagation()}>{!address.is_default && <Button loading={busyId === address.id} disabled={busyId === address.id} onClick={() => void makeDefault(address.id)}>设为默认</Button>}<Button onClick={() => void Taro.navigateTo({ url: editUrl(address) })}>编辑</Button><Button onClick={() => setDeleteTarget(address)}>删除</Button></View>
    </View>)}</View>}
    <View className={`address-footer ${process.env.TARO_ENV === 'h5' ? 'is-single' : ''}`}><Button className='address-add' onClick={() => void Taro.navigateTo({ url: editUrl() })}>手工新增地址</Button>{process.env.TARO_ENV !== 'h5' && <Button className='address-import' onClick={() => void importAddress()}>导入平台地址</Button>}</View>
    <Modal visible={deleteTarget !== null} title='确认删除地址' onClose={() => setDeleteTarget(null)}><Text>删除后无法恢复，是否继续？</Text><Button className='address-danger' loading={busyId === deleteTarget?.id} disabled={busyId === deleteTarget?.id} onClick={() => void remove()}>确认删除</Button></Modal>
  </View>;
}
