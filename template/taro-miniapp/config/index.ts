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
  env: {
    TARO_API_BASE_URL: JSON.stringify(process.env['TARO_API_BASE_URL'] ?? 'http://127.0.0.1:8080/api'),
    TARO_TELEMETRY_URL: JSON.stringify(process.env['TARO_TELEMETRY_URL'] ?? ''),
    TARO_IMAGE_CDN: JSON.stringify(process.env['TARO_IMAGE_CDN'] ?? ''),
    TARO_IMAGE_HOST: JSON.stringify(process.env['TARO_IMAGE_HOST'] ?? ''),
    TARO_IMAGE_HOSTS: JSON.stringify(process.env['TARO_IMAGE_HOSTS'] ?? ''),
  },
  mini: {
    postcss: { pxtransform: { enable: true }, url: { enable: true } },
    webpackChain(chain) {
      chain.optimization.splitChunks({ chunks: 'all', minSize: 20_000, maxSize: 250_000, cacheGroups: {
        taro: { name: 'taro-vendor', test: /[\\/]node_modules[\\/]@tarojs[\\/]/, priority: 20, reuseExistingChunk: true },
        common: { name: 'common', minChunks: 2, priority: 10, reuseExistingChunk: true },
    } });
    },
  },
  plugins: ['@tarojs/plugin-framework-react', '@tarojs/plugin-platform-weapp', '@tarojs/plugin-platform-h5'],
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    devServer: { port: 10086 },
  },
};

export default config;
