import { useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import { getToken } from '../services/api';
import type { LotteryShare } from '../services/lottery-share';

type NativeShareState = Readonly<{ share: LotteryShare | undefined; prepare: () => Promise<void>; isShareCurrent: () => boolean }>;
async function setMenu(visible: boolean): Promise<void> {
  try {
    if (visible) await Taro.showShareMenu({ showShareItems: ['shareAppMessage'] });
    else await Taro.hideShareMenu();
  } catch (error) {
    const reason = error instanceof Error ? error.message : '微信分享菜单调用失败';
    console.warn(reason);
  }
}

export function useNativeLotteryShare(state: NativeShareState, fallback: Readonly<{ title: string; path: string }>): void {
  const latest = useRef(state);
  latest.current = state;
  const refresh = () => {
    if (getToken()) void latest.current.prepare();
    else void setMenu(false);
  };
  if (process.env.TARO_ENV === 'weapp') {
    Taro.useShareAppMessage(() => latest.current.isShareCurrent() ? latest.current.share ?? fallback : fallback);
    Taro.useDidShow(refresh);
  }
  useEffect(() => { if (process.env.TARO_ENV === 'weapp') refresh(); }, []);
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') void setMenu(state.isShareCurrent());
  }, [state.share]);
}
