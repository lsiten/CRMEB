import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { ApiError } from '../../services/api';
import { getMessages, markAllMessagesRead, markMessageRead, type Message } from '../../services/content';
import './index.scss';

const MessagesPage = () => { const [rows, setRows] = useState<readonly Message[]>([]); const [loading, setLoading] = useState(true); const load = () => { setLoading(true); void getMessages().then(setRows).catch((error: unknown) => { if (error instanceof ApiError) void Taro.showToast({ title: error.message, icon: 'none' }); }).finally(() => setLoading(false)); }; useEffect(load, []); const readAll = async (): Promise<void> => { await markAllMessagesRead(); setRows(rows.map((row) => ({ ...row, read: true }))); }; const read = async (row: Message): Promise<void> => { if (!row.read) { await markMessageRead(row.id); setRows(rows.map((item) => item.id === row.id ? { ...item, read: true } : item)); } }; return <View className='page messages'><View className='toolbar'><Text>消息中心</Text><Button size='mini' onClick={() => void readAll()}>全部已读</Button></View>{loading && <Text className='empty'>加载中…</Text>}{!loading && rows.length === 0 && <Text className='empty'>暂无消息</Text>}{rows.map((row) => <View className={`message card ${row.read ? '' : 'unread'}`} key={row.id} onClick={() => void read(row)}><View><Text className='messageTitle'>{row.title}</Text><Text className='messageContent'>{row.content}</Text></View><Text className='meta'>{row.createdAt ?? ''}</Text></View>)}<Button className='retry' size='mini' onClick={load}>刷新</Button></View>; };
export default MessagesPage;
