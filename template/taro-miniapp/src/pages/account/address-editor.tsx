import { Button, Input, Picker, Switch, Text, Textarea, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { Loading } from '../../components';
import { ApiError } from '../../services/api';
import { validateAddressDraft } from '../../services/account-contracts';
import { getAddress, saveAddress } from '../../services/account';
import type { AddressDraft } from '../../services/account';
import { requireLogin } from '../../services/auth-flow';
import './account.scss';

const emptyDraft: AddressDraft = { real_name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false };

export default function AddressEditorPage() {
  const value = Number(useRouter().params['id'] ?? 0);
  const id = Number.isSafeInteger(value) && value > 0 ? value : undefined;
  const [draft, setDraft] = useState<AddressDraft>(emptyDraft);
  const [loading, setLoading] = useState(id !== undefined);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!requireLogin(id ? `/pages/account/address-editor?id=${id}` : '/pages/account/address-editor')) return undefined;
    if (!id) { setDraft(emptyDraft); setLoading(false); setFailed(false); return undefined; }
    let active = true;
    setLoading(true); setFailed(false);
    void getAddress(id).then((address) => { if (active) setDraft(address); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);
  const update = (change: Partial<AddressDraft>) => setDraft((current) => ({ ...current, ...change }));
  const importAddress = async (): Promise<void> => {
    try {
      const picked = await Taro.chooseAddress();
      update({ real_name: picked.userName, phone: picked.telNumber, province: picked.provinceName, city: picked.cityName, district: picked.countyName, detail: picked.detailInfo });
    } catch { await Taro.showToast({ title: '未能导入地址，请继续手工填写', icon: 'none' }); }
  };
  const submit = async (): Promise<void> => {
    const validation = validateAddressDraft(draft);
    if (validation) { await Taro.showToast({ title: validation, icon: 'none' }); return; }
    setBusy(true);
    try { await saveAddress(draft); await Taro.showToast({ title: id ? '地址已更新' : '地址已保存', icon: 'success' }); await Taro.navigateBack(); }
    catch (caught) { await Taro.showToast({ title: caught instanceof ApiError ? caught.message : '保存失败，请重试', icon: 'none' }); }
    finally { setBusy(false); }
  };
  if (loading) return <View className='account-flow'><View className='account-flow__card'><Loading label='正在加载地址' /></View></View>;
  if (failed) return <View className='account-flow'><View className='account-flow__card'><Text className='account-flow__error'>地址加载失败</Text><Button className='account-flow__button' onClick={() => setRetry((current) => current + 1)}>重试</Button></View></View>;
  return <View className='account-flow'>
    <Text className='account-flow__title'>{id ? '编辑收货地址' : '新增收货地址'}</Text><Text className='account-flow__intro'>请填写真实有效的收货信息</Text>
    <View className='account-flow__card'>
      {process.env.TARO_ENV !== 'h5' && <Button className='account-flow__button account-flow__button--secondary' onClick={() => void importAddress()}>导入平台地址</Button>}
      <View className='account-field'><Text className='account-field__label'>收货人</Text><Input maxlength={20} value={draft.real_name} onInput={(event) => update({ real_name: event.detail.value })} placeholder='请输入姓名' /></View>
      <View className='account-field'><Text className='account-field__label'>联系电话</Text><Input type='number' maxlength={11} value={draft.phone} onInput={(event) => update({ phone: event.detail.value })} placeholder='请输入手机号' /></View>
      <View className='account-field'><Text className='account-field__label'>所在地区</Text>{process.env.TARO_ENV === 'h5'
        ? <View className='account-region-fields'><Input aria-label='省份' maxlength={12} value={draft.province} onInput={(event) => update({ province: event.detail.value })} placeholder='省份' /><Input aria-label='城市' maxlength={12} value={draft.city} onInput={(event) => update({ city: event.detail.value })} placeholder='城市' /><Input aria-label='区县' maxlength={12} value={draft.district} onInput={(event) => update({ district: event.detail.value })} placeholder='区县' /></View>
        : <Picker mode='region' value={[draft.province, draft.city, draft.district]} onChange={(event) => { const region = event.detail.value; update({ province: region[0] ?? '', city: region[1] ?? '', district: region[2] ?? '' }); }}><View className='account-field__picker'>{draft.province ? `${draft.province} ${draft.city} ${draft.district}` : '请选择省 / 市 / 区'}</View></Picker>}</View>
      <View className='account-field'><Text className='account-field__label'>详细地址</Text><Textarea maxlength={120} value={draft.detail} onInput={(event) => update({ detail: event.detail.value })} placeholder='街道、楼栋、门牌号' /></View>
      <View className='account-field account-field__switch'><Text className='account-field__label'>设为默认地址</Text><Switch color='var(--color-brand)' checked={draft.is_default} onChange={(event) => update({ is_default: event.detail.value })} /></View>
      <Button className='account-flow__button' loading={busy} disabled={busy} onClick={() => void submit()}>立即保存</Button>
    </View>
  </View>;
}
