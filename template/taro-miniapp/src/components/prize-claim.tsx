import { useEffect, useRef, useState } from 'react';
import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components';
import { getAddresses } from '../services/account';
import type { Address } from '../services/account';
import { receiveLotteryPrize } from '../services/lottery';
import { commerceError } from '../services/commerce-contracts';

export function PrizeClaim({ recordId, onReceived }: Readonly<{ recordId: string; onReceived?: () => void }>) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [province, setProvince] = useState(''); const [city, setCity] = useState(''); const [district, setDistrict] = useState(''); const [address, setAddress] = useState('');
  const [addresses, setAddresses] = useState<readonly Address[]>([]);
  const [addressLoading, setAddressLoading] = useState(false); const [addressLoaded, setAddressLoaded] = useState(false);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [received, setReceived] = useState(false);
  const busy = useRef(false); const addressBusy = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const chooseAddress = async (): Promise<void> => {
    if (addressBusy.current || busy.current) return;
    addressBusy.current = true; setAddressLoading(true); setError('');
    try { const list = await getAddresses(); if (mounted.current) { setAddresses(list); setAddressLoaded(true); } }
    catch (cause) { if (mounted.current) setError(commerceError(cause)); }
    finally { addressBusy.current = false; if (mounted.current) setAddressLoading(false); }
  };
  const submit = async (): Promise<void> => {
    if (busy.current || received) return;
    busy.current = true; setSaving(true); setError('');
    if (!address.trim()) { if (mounted.current) setError('请填写详细地址'); busy.current = false; setSaving(false); return; }
    try {
      await receiveLotteryPrize(recordId, { name, phone, address: province || city || district ? `${province}${city}${district}` : address, detail: address, mark: '' });
      if (mounted.current) { setReceived(true); onReceived?.(); }
    } catch (cause) { if (mounted.current) setError(commerceError(cause)); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  if (received) return <View className='order-panel order-empty'><Text>领取成功，等待商家发货。</Text></View>;
  return <View className='prize-claim'>
    <Text className='order-section-title'>填写领奖地址</Text>
    <Button disabled={addressLoading || saving} loading={addressLoading} onClick={() => void chooseAddress()}>使用已存地址</Button>
    {addressLoaded && !addresses.length && <Text className='order-muted'>暂无已存地址，请直接填写。</Text>}
    {addresses.map((item) => <Button disabled={saving} key={item.id} onClick={() => { setName(item.real_name); setPhone(item.phone); setProvince(item.province); setCity(item.city); setDistrict(item.district); setAddress(item.detail); setAddresses([]); setAddressLoaded(false); }}>{item.real_name} {item.phone} {item.province}{item.city}{item.district}{item.detail}</Button>)}
    <Text className='order-muted'>收货人</Text><Input className='order-field' value={name} disabled={saving} maxlength={50} placeholder='收货人姓名' onInput={(event) => setName(event.detail.value)} />
    <Text className='order-muted'>手机号</Text><Input className='order-field' value={phone} disabled={saving} type='number' maxlength={11} placeholder='收货人手机号' onInput={(event) => setPhone(event.detail.value)} />
    <Text className='order-muted'>所在地区</Text><Picker mode='region' value={[province, city, district]} onChange={(event) => { const value = event.detail.value; setProvince(value[0] ?? ''); setCity(value[1] ?? ''); setDistrict(value[2] ?? ''); }}><View className='order-field'>{province ? `${province} ${city} ${district}` : '请选择省 / 市 / 区'}</View></Picker><Text className='order-muted'>详细地址</Text><Textarea className='order-textarea' value={address} disabled={saving} maxlength={200} placeholder='省市区、街道和门牌号' onInput={(event) => setAddress(event.detail.value)} />
    {error && <View className='order-alert'>{error}</View>}
    <Button className='order-primary' disabled={saving} loading={saving} onClick={() => void submit()}>提交领奖地址</Button>
  </View>;
}
