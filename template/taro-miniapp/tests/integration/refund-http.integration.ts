import { beforeEach, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => {
  const headers: Readonly<Record<string, string>>[] = [];
  return { storage: new Map<string, string>(), headers };
});

vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: (key: string) => transport.storage.get(key),
  setStorageSync: (key: string, value: string) => { transport.storage.set(key, value); },
  removeStorageSync: (key: string) => { transport.storage.delete(key); },
  request: async (options: Readonly<{ url: string; method: string; header: Readonly<Record<string, string>>; timeout: number }>) => {
    const url = new URL(options.url);
    if (url.hostname !== '127.0.0.1' || options.method !== 'GET') throw new Error('Integration transport permits loopback GET only');
    transport.headers.push(options.header);
    // Test-only adapter replaces the native transport, preserving real HTTP and service parsing.
    const response = await fetch(url, { method: options.method, headers: options.header, signal: AbortSignal.timeout(options.timeout) });
    const data: unknown = await response.json();
    return { statusCode: response.status, data };
  },
} }));

import { getToken, setToken } from '../../src/services/api';
import { getRefund } from '../../src/services/refunds';

function token(actor: 'A' | 'B' | 'C'): string {
  const value = process.env[`REFUND_TOKEN_${actor}`];
  if (!value) throw new Error('Run through tests/integration/refund-http.php');
  return value;
}

beforeEach(() => {
  transport.headers.length = 0;
  setToken(token('A'));
});

it('reads the complete product snapshot and distinguishes requested and refunded amounts', async () => {
  const refund = await getRefund('refund1');
  expect(refund).toMatchObject({ id: 'refund1', type: 6, title: '已退款', amount: 100, refundedAmount: 60, cancelled: false });
  expect(refund.products).toEqual([expect.objectContaining({ cartId: 'cart81', name: '售后联调咖啡', spec: '250g', quantity: 2 })]);
  const header = transport.headers[0];
  expect(header?.['Form-type']).toBe(process.env['TARO_ENV'] === 'h5' ? 'h5' : 'routine');
  expect(Boolean(header?.['Authori-zation']?.startsWith('Bearer '))).toBe(true);
});

it.each([
  ['B', 'refund1'], ['C', 'refund1'], ['A', 'refund4'], ['A', 'refund5'],
  ['A', 'refund6'], ['A', 'refund7'], ['A', 'refund999'],
] as const)('rejects forbidden or missing details for actor %s / %s', async (actor, id) => {
  setToken(token(actor));
  await expect(getRefund(id)).rejects.toMatchObject({ code: 'BUSINESS', status: 400, message: '订单不存在' });
  expect(getToken() === token(actor)).toBe(true);
});

it('reads the second tenant own refund', async () => {
  setToken(token('C'));
  expect(await getRefund('refund3')).toMatchObject({ id: 'refund3', amount: 100, refundedAmount: 60 });
});

it.each([null, 'invalid-token'])('recovers after rejected authentication %s', async (credential) => {
  setToken(credential);
  await expect(getRefund('refund1')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  expect(getToken()).toBeNull();
  setToken(token('A'));
  expect(await getRefund('refund1')).toMatchObject({ id: 'refund1', amount: 100, refundedAmount: 60 });
});

it('can retry as the owner after cross-account rejection', async () => {
  setToken(token('B'));
  await expect(getRefund('refund1')).rejects.toMatchObject({ code: 'BUSINESS' });
  setToken(token('A'));
  expect((await getRefund('refund1')).products[0]?.name).toBe('售后联调咖啡');
});
