import { describe, expect, it } from 'vitest';

import {
  buildSharePath,
  getClipboardFallback,
  getPaymentPresentation,
  parseDeepLink,
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
