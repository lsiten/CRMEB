import type { PropsWithChildren } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import './app.scss';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startPerformanceTracking } from './services/telemetry';
import { parseDeepLink } from './services/platform';

startPerformanceTracking();

const App = ({ children }: PropsWithChildren) => {
  useDidShow((options) => {
    const referral = parseDeepLink({ scene: options?.scene, query: options?.query });
    if (Object.keys(referral).length > 0) Taro.setStorageSync('crmeb_referral', referral);
  });
  return <ErrorBoundary>{children}</ErrorBoundary>;
};

export default App;
