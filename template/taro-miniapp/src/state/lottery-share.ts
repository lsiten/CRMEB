import { useEffect, useRef, useState } from 'react';
import { getLotteryShare, type LotteryShare, type ShareActivity } from '../services/lottery-share';
import { ApiError, getToken } from '../services/api';
import { copyText } from '../services/clipboard';
import { configureWechatShare, isWechatBrowser } from '../services/wechat-share';

export function useLotteryShare(activity: ShareActivity) {
  const [share, setShare] = useState<LotteryShare>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState<'idle' | 'configuring' | 'ready' | 'failed'>('idle');
  const menuRevision = useRef(0);
  const menuBusy = useRef(false);
  const preparedToken = useRef<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; menuRevision.current++; }; }, []);
  const configureMenu = async (next: LotteryShare) => {
    if (!isWechatBrowser() || menuBusy.current) return;
    menuBusy.current = true; setMenu('configuring');
    const revision = menuRevision.current;
    const token = getToken();
    const isCurrent = () => mounted.current && menuRevision.current === revision && getToken() === token;
    try { await configureWechatShare(next, isCurrent); if (isCurrent()) setMenu('ready'); }
    catch (cause) { if (cause instanceof Error && isCurrent()) setMenu('failed'); }
    finally { if (mounted.current && menuRevision.current === revision) menuBusy.current = false; }
  };
  const prepare = async () => {
    if (locked.current) return;
    if (menuBusy.current && share && getToken() === preparedToken.current) return;
    menuRevision.current++; menuBusy.current = false; setMenu('idle');
    locked.current = true; setBusy(true); setError(''); setCopied(false); setShare(undefined);
    try {
      const next = await getLotteryShare(activity, process.env.TARO_ENV === 'h5' ? window.location.href : undefined);
      if (mounted.current) { preparedToken.current = process.env.TARO_ENV === 'weapp' || isWechatBrowser() ? getToken() : null; setShare(next); void configureMenu(next); }
    } catch (cause) { if (mounted.current) setError(cause instanceof ApiError ? cause.message : '分享信息获取失败，请重试'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const copy = async () => {
    if (!share?.url || locked.current) return;
    locked.current = true; setBusy(true); setError(''); setCopied(false);
    try { await copyText(share.url); if (mounted.current) setCopied(true); }
    catch (cause) { if (mounted.current) setError(cause instanceof ApiError ? cause.message : '复制失败，请长按下方链接复制'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => { if (isWechatBrowser() && getToken()) void prepare(); }, [activity.id, activity.factor]);
  const retryMenu = () => { if (share) void configureMenu(share); };
  const isShareCurrent = () => !!share && !!preparedToken.current && getToken() === preparedToken.current;
  return { share, busy, error, copied, menu, prepare, copy, retryMenu, isShareCurrent };
}
