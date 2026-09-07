import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { request } from '../../services/api';
import './index.scss';

type AdState = Readonly<{ enabled: boolean; image?: string; video?: string }>;
function homeUrl(spid?: string): string { return spid ? `/pages/index/index?spid=${encodeURIComponent(spid)}` : '/pages/index/index'; }
function parseAd(payload: unknown): AdState {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const data = root['data'] && typeof root['data'] === 'object' ? root['data'] as Record<string, unknown> : root;
  const values = Array.isArray(data['value']) ? data['value'] : [];
  const first = values[0] && typeof values[0] === 'object' ? values[0] as Record<string, unknown> : {};
  const image = [first['image'], first['pic'], first['url']].find((value): value is string => typeof value === 'string' && value.length > 0);
  const video = typeof data['video_link'] === 'string' && data['video_link'] ? data['video_link'] : undefined;
  const status = Number(data['status']);
  return { enabled: status !== 0 && (values.length > 0 || !!video) && !!(image || video), ...(image ? { image } : {}), ...(video ? { video } : {}) };
}
export default function GuidePage() {
  const spid = useRouter().params['spid']; const [ad, setAd] = useState<AdState>();
  const goHome = () => Taro.switchTab({ url: homeUrl(spid) });
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    if (Taro.getStorageSync('guideDate') === today) { goHome(); return; }
    void request<unknown>('/get_open_adv', { method: 'GET' }).then((payload) => {
      const next = parseAd(payload); if (!next.enabled) { goHome(); return; }
      Taro.setStorageSync('guideDate', today); setAd(next);
    }).catch(goHome);
  }, []);
  if (!ad) return <View className='guide-page'><Text>正在准备精彩内容…</Text></View>;
  return <View className='guide-page'>{ad.image && <Image className='guide-image' src={ad.image} mode='aspectFill' />} {ad.video && !ad.image && <View className='guide-video'><Text>开屏视频</Text><Text selectable>{ad.video}</Text></View>}<Button className='guide-enter' onClick={goHome}>立即进入</Button></View>;
}
