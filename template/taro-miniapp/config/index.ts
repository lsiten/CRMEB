import type { UserConfigExport } from '@tarojs/cli';

const config: UserConfigExport = {
  projectName: 'crmeb-taro-miniapp',
  date: '2026-09-05',
  designWidth: 750,
  deviceRatio: { 640: 2.34, 750: 1, 828: 1.81 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  mini: { postcss: { pxtransform: { enable: true }, url: { enable: true } } },
  plugins: ['@tarojs/plugin-framework-react', '@tarojs/plugin-platform-weapp', '@tarojs/plugin-platform-h5'],
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    devServer: { port: 10086 },
  },
};

export default config;
