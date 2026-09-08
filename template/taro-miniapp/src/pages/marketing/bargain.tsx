import { useCallback, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { getBargain, helpBargain, startBargain } from '../../services/social-transactions';
import type { BargainAction } from '../../services/social-transactions';
import { addServerCart } from '../../services/server-cart';
import { getToken } from '../../services/api';
import { useSocialResource } from './use-social-resource';
import { SocialShell } from './social-shell';

const labels: Readonly<Record<BargainAction, string>> = { start: '发起砍价', invite: '邀请好友助力', help: '帮好友砍一刀', complete: '好友已砍价成功', helped: '已助力过该活动', buy: '立即购买', unavailable: '当前状态暂不可操作，请刷新核对' };
export default function BargainPage() {
  const params = useRouter().params; const id = Number(params['id']);
  const owner = params['bargain'] ?? params['bargainUid']; const ownerId = owner === undefined ? undefined : Number(owner);
  const returnUrl = `/pages/marketing/detail?kind=bargain&id=${id}${ownerId === undefined ? '' : `&bargain=${ownerId}`}`;
  const loader = useCallback(() => getBargain(id, ownerId), [id, ownerId]);
  const resource = useSocialResource(loader, returnUrl); const item = resource.data;
  const [notice, setNotice] = useState('');
  const [noticeToken, setNoticeToken] = useState<string | null>(null);
  const sharePath = `/pages/marketing/detail?kind=bargain&id=${id}&bargain=${item?.ownerId ?? ownerId ?? 0}`;
  if (process.env.TARO_ENV !== 'h5') Taro.useShareAppMessage(() => ({ title: item?.title ?? '邀请好友砍价', path: sharePath }));
  const act = async (): Promise<void> => {
    if (!item || !item.available || resource.busy) return;
    setNotice(''); setNoticeToken(getToken());
    switch (item.action) {
      case 'start': case 'help':
        await resource.run(async () => {
          const cut = item.action === 'start' ? await startBargain(id) : await helpBargain(id, item.ownerId);
          return cut;
        }, (cut) => { setNotice(`本次已砍 ¥${cut.toFixed(2)}`); }, true);
        break;
      case 'buy':
        await resource.run(() => addServerCart({ product: { id: item.productId, name: item.title, image: item.image, price: item.price, unique: '' }, quantity: 1, direct: true, activity: { kind: 'bargain', id } }), async (cartId) => { await Taro.navigateTo({ url: `/pages/order/confirm?cartIds=${encodeURIComponent(cartId)}&new=1` }); });
        break;
      case 'invite': case 'complete': case 'helped': case 'unavailable': break;
    }
  };
  return <SocialShell title='砍价活动' {...resource} returnUrl={returnUrl}>
    {item && <>
      <View className='order-panel'><View className='order-product'><CommerceImage className='order-product-image' src={item.image} mode='aspectFill' /><View className='order-product-body'><Text className='order-section-title'>{item.title}</Text><Text className='order-amount'>当前 ¥{item.price.toFixed(2)}</Text><Text className='order-muted'>底价 ¥{item.minimum.toFixed(2)}</Text></View></View></View>
      <View className='order-panel'><Text className='order-section-title'>{item.ownerId === item.viewerId ? '我的砍价进度' : '好友的砍价进度'}</Text><View>已砍 ¥{item.reduced.toFixed(2)}，还需砍 ¥{item.remaining.toFixed(2)}</View>
        {!item.available && <View>活动未开始、已结束或库存不足，请刷新核对</View>}
        {notice && noticeToken === resource.token && <View role='status'>{notice}</View>}
        <>
          {(['start', 'help', 'buy'].includes(item.action)) ? <Button className='order-primary' disabled={resource.busy || !item.available} onClick={act}>{resource.busy ? '正在提交…' : labels[item.action]}</Button> : <View>{labels[item.action]}</View>}
          {item.action === 'invite' && (process.env.TARO_ENV === 'h5' ? <Button onClick={() => void resource.run(() => Taro.setClipboardData({ data: `${window.location.href.split('#')[0]}#${sharePath}` }), () => { setNoticeToken(getToken()); setNotice('助力链接已复制，可发送给好友'); })}>复制助力链接</Button> : <Button openType='share'>邀请好友助力</Button>)}
        </>
        <Text className='order-muted'>购买数量 1 件，资格及实付金额以服务端结算为准</Text>
      </View>
    </>}
  </SocialShell>;
}
