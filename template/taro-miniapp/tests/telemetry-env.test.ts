import { describe, expect, it } from 'vitest';

import config from '../config';

describe('H5 telemetry environment', () => {
  it('injects the optional telemetry endpoint without requiring a browser process global', () => {
    expect(config.env?.TARO_TELEMETRY_URL).toBe(JSON.stringify(process.env['TARO_TELEMETRY_URL'] ?? ''));
  });
});
