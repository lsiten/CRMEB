import type { PropsWithChildren } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import './app.scss';
import { parseDeepLink } from './services/platform';

const App = ({ children }: PropsWithChildren) => {
  useDidShow((options) => {
    const referral = parseDeepLink({ scene: options?.scene, query: options?.query });
    if (Object.keys(referral).length > 0) Taro.setStorageSync('crmeb_referral', referral);
  });
  return children;
};

export default App;
