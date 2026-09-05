declare module '*.scss';
declare namespace NodeJS {
  interface ProcessEnv {
    TARO_API_BASE_URL?: string;
    TARO_IMAGE_HOSTS?: string;
    TARO_ENV?: string;
  }
}

declare const process: {
  env: {
    TARO_API_BASE_URL?: string;
    TARO_IMAGE_HOSTS?: string;
    TARO_ENV?: string;
  };
};
