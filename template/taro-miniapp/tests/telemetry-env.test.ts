import { afterEach, describe, expect, it, vi } from 'vitest';

import config from '../config';

const request = vi.fn(() => Promise.resolve({ statusCode: 204 }));

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: () => null,
    request,
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  request.mockClear();
});

describe('H5 telemetry environment', () => {
  it('injects the optional telemetry endpoint without requiring a browser process global', () => {
    expect(config.env?.TARO_TELEMETRY_URL).toBe(JSON.stringify(process.env['TARO_TELEMETRY_URL'] ?? ''));
  });

  it('does not send telemetry to the API base URL when no telemetry endpoint is configured', async () => {
    vi.useFakeTimers();
    vi.stubEnv('TARO_API_BASE_URL', 'http://127.0.0.1:8080/api');
    vi.stubEnv('TARO_TELEMETRY_URL', '');
    vi.resetModules();

    const { track } = await import('../src/services/telemetry');
    track('app_start');
    await vi.advanceTimersByTimeAsync(0);

    expect(request).not.toHaveBeenCalled();
  });
});
