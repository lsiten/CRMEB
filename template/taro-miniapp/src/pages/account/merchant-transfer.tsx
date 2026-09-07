import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useMerchantTransfer } from '../../state/merchant-transfer';
import { transferLabels } from '../../services/merchant-transfer';
import '../order/management.scss';

export default function MerchantTransferPage() {
  const params = useRouter().params;
  const kind = params['type'] === '1' ? 1 : 2;
  const state = useMerchantTransfer(params['id'] ?? '', kind);
  const info = state.data;
  const back = () => Taro.redirectTo({ url: kind === 2 ? '/pages/marketing/lottery-records' : '/pages-extra/distribution/index' });
  return <View className='order-management'>
    <Text className='order-heading'>微信收款</Text>
    {state.error && <View className='order-alert'><Text>{state.error}</Text></View>}
    {state.loading && <View className='order-panel'>正在核对转账状态…</View>}
    {info && <View className='order-panel'>
      <View className='order-between'><Text>收款方式</Text><Text>收款至微信</Text></View>
      <Text className='order-muted'>收款金额</Text><Text className='order-heading'>¥{info.amount.toFixed(2)}</Text>
      <Text className='order-section-title'>{transferLabels[info.state]}</Text>
      {info.failReason && <Text>{info.failReason}</Text>}
      {info.state === 'SUCCESS' && <Text>可在“微信支付－服务－钱包－账单”查看明细。</Text>}
      {info.state === 'WAIT_USER_CONFIRM' && <Text>请在微信收款界面确认领取。返回后将重新核对到账状态。</Text>}
      {info.state !== 'SUCCESS' && state.notice && <Text>{state.notice}</Text>}
      {info.state === 'WAIT_USER_CONFIRM' && <Button className='order-primary' loading={state.launching} disabled={state.loading || state.launching || !!state.error} onClick={() => void state.confirm()}>{state.launching ? '正在确认收款' : '立即收款'}</Button>}
    </View>}
    <View className='order-actions'><Button disabled={state.loading || state.launching} onClick={() => void state.refresh()}>刷新收款状态</Button><Button onClick={back}>返回列表</Button></View>
  </View>;
}
