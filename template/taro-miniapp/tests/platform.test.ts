import { describe, expect, it } from 'vitest';

import {
  buildSharePath,
  getClipboardFallback,
  getPaymentPresentation,
  parseDeepLink,
  parseStoredReferral,
  resolvePaymentStatus,
} from '../src/services/platform';

describe('platform capability safety', () => {
  it('accepts only bounded referral fields from encoded scene input', () => {
    const params = parseDeepLink({ scene: encodeURIComponent('spid=42&agent_id=7&token=leak') });

    expect(params).toEqual({ spid: '42', agent_id: '7' });
  });

  it('drops malformed or oversized deep-link values', () => {
    const params = parseDeepLink({ query: 'spid=not-a-number&spread=1'.repeat(80) });

    expect(params).toEqual({});
  });

  it('merges object query with encoded scene while query values take precedence', () => {
    const params = parseDeepLink({
      query: { spread: '12' },
      scene: encodeURIComponent('spid=42&spread=99&agent_id=7'),
    });

    expect(params).toEqual({ spread: '12', spid: '42', agent_id: '7' });
  });

  it('encodes business identifiers in share paths', () => {
    expect(buildSharePath('/pages/goods/detail', { id: '42' })).toBe('/pages/goods/detail?id=42');
    expect(buildSharePath('/pages/goods/detail', { id: 'A/B' })).toBe('/pages/goods/detail');
    expect(buildSharePath('/pages/goods/detail', { id: '42', token: 'leak' })).toBe('/pages/goods/detail?id=42');
  });

  it('preserves lottery selection and referrer in the shared route', () => {
    // Given / When
    const path = buildSharePath('/pages/marketing/lottery', { type: '5', lottery_id: '72', spread: '42' });
    // Then
    expect(path).toBe('/pages/marketing/lottery?type=5&lottery_id=72&spread=42');
  });

  it('drops unsupported lottery types and invalid referral values from share parameters', () => {
    // Given / When
    const path = buildSharePath('/pages/marketing/lottery', { type: '6', lottery_id: '../72', spread: '-1' });
    // Then
    expect(path).toBe('/pages/marketing/lottery');
  });

  it('uses server payment state instead of client callback state', () => {
    expect(resolvePaymentStatus('ok', 'pending')).toBe('pending');
    expect(resolvePaymentStatus('cancel', 'paid')).toBe('paid');
  });

  it('models cancelled payment as terminal and retryable', () => {
    expect(getPaymentPresentation('cancelled')).toEqual({
      label: '支付已取消',
      canRetry: true,
      isTerminal: true,
    });
  });

  it('returns copyable text when clipboard capability is unavailable', () => {
    expect(getClipboardFallback('ORDER-42', false)).toEqual({ copied: false, text: 'ORDER-42' });
    expect(getClipboardFallback('ORDER-42', true)).toEqual({ copied: true, text: 'ORDER-42' });
  });
});

describe('mini program referral scenes', () => {
  it('rejects an oversized stored QR record even when its numeric value is bounded', () => {
    // Given / When
    const result = parseStoredReferral({ code: '0'.repeat(1000) + '321' });
    // Then
    expect(result).toEqual({});
  });

  it('rejects oversized pid text inside an encoded scene', () => {
    // Given / When
    const result = parseDeepLink({ scene: 1047, query: { scene: encodeURIComponent('pid=' + '0'.repeat(70) + '42') } });
    // Then
    expect(result).toEqual({});
  });

  it('ignores raw ids in unrelated platform scenes', () => {
    // Given / When
    const result = parseDeepLink({ scene: 1011, query: { scene: '321' } });
    // Then
    expect(result).toEqual({});
  });

  it.each([1047, 1048, 1049])('keeps QR record 321 separate from user ids for scene %i', (scene) => {
    // Given / When
    const result = parseDeepLink({ scene, query: { scene: '321' } });
    // Then
    expect(result).toEqual({ code: '321' });
  });

  it('reads the encoded pid user id before the QR record fallback', () => {
    // Given / When
    const result = parseDeepLink({ scene: 1047, query: { spread: '12', spid: '18', scene: encodeURIComponent('pid=42&token=ignored') } });
    // Then
    expect(result).toEqual({ spread: '42' });
  });

  it('treats the direct-entry scene value as a user id', () => {
    // Given / When
    const result = parseDeepLink({ scene: 1001, query: { scene: '73' } });
    // Then
    expect(result).toEqual({ spid: '73' });
  });

  it.each(['../321', '1000000001', '%E0%A4%A', 'pid=bad', '-3'])('ignores an invalid QR payload %s', (scene) => {
    // Given / When
    const result = parseDeepLink({ scene: 1047, query: { scene } });
    // Then
    expect(result).toEqual({});
  });

  it('does not interpret an ordinary URL code as a QR record', () => {
    // Given / When
    const result = parseDeepLink({ query: { code: '321', scene: '321' } });
    // Then
    expect(result).toEqual({});
  });

  it.each([{ code: '321', spread: '42', token: 'ignored' }, { code: 'bad', spread: '42' }])('revalidates persisted QR records when storage is %j', (stored) => {
    // Given / When
    const result = parseStoredReferral(stored);
    // Then
    expect(result).toEqual(stored.code === '321' ? { spread: '42', code: '321' } : { spread: '42' });
  });
});
