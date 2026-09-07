import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { ApiError } from '../../services/api';
import { getChatMessages, sendChatMessage, type ChatMessage } from '../../services/content';
import './index.scss';

const CustomerPage = () => {
  const { params } = useRouter();
  const toUid = Number(params['to_uid']) || 0;
  const [rows, setRows] = useState<readonly ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const load = () => {
    setLoading(true);
    setNotice('');
    void getChatMessages({ toUid }).then((items) => { setRows(items); setConnected(true); }).catch((error: unknown) => {
      setConnected(false);
      void Taro.showToast({ title: error instanceof ApiError ? error.message : '客服连接失败，可稍后重试', icon: 'none' });
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const send = async (): Promise<void> => {
    const content = text.trim();
    if (!content || sending || !connected) return;
    setSending(true);
    setNotice('');
    try {
      await sendChatMessage(content, toUid);
      setRows((current) => [...current, { id: Math.max(0, ...current.map((row) => row.id)) + 1, text: content, type: 'text', mine: true }]);
      setText('');
      setNotice('留言已提交，客服会尽快回复');
    } catch (error: unknown) {
      setNotice(error instanceof ApiError ? error.message : '消息发送失败，请重试');
    } finally { setSending(false); }
  };
  return <View className='page customer'>
    <View className='status'>{connected ? '客服记录已连接' : '客服暂不可用'}{!connected && <Button size='mini' onClick={load}>重试</Button>}</View>
    <View className='chat'>{loading && <Text>正在连接客服…</Text>}{!loading && !connected && <Text>客服记录暂不可用，请稍后重试</Text>}{rows.map((row) => <View className={`bubble ${row.mine ? 'mine' : ''}`} key={row.id}>{row.type === 'image' && row.image ? <ImageFallback src={row.image} /> : <Text>{row.text}</Text>}</View>)}</View>
    {notice && <Text className='notice'>{notice}</Text>}
    <View className='composer'><Input value={text} onInput={(event) => setText(event.detail.value)} onConfirm={() => void send()} placeholder='请输入要咨询的内容' confirmType='send' disabled={!connected || sending} /><Button size='mini' loading={sending} onClick={() => void send()} disabled={!connected || sending || !text.trim()}>发送</Button></View>
  </View>;
};
const ImageFallback = ({ src }: Readonly<{ src: string }>) => <Text className='imageFallback'>[图片] {src}</Text>;
export default CustomerPage;
