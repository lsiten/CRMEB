import type { PropsWithChildren } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import './app.scss';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startPerformanceTracking } from './services/telemetry';
import { parseDeepLink } from './services/platform';
import { syncPendingReferral } from './services/referral-sync';
import { rememberWechatEntry } from './services/wechat-share';

startPerformanceTracking();
rememberWechatEntry();

const App = ({ children }: PropsWithChildren) => {
  useDidShow((options) => {
    const referral = parseDeepLink({ scene: options?.scene, query: options?.query });
    if (Object.keys(referral).length > 0) Taro.setStorageSync('crmeb_referral', referral);
    void syncPendingReferral();
  });
  return <ErrorBoundary>{children}</ErrorBoundary>;
};

export default App;
