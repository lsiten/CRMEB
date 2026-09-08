import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getOrder } from '../src/services/orders';

const order = { order_id: 'wx1', paid: 1, pay_price: '10.00', _status: { _type: 2 }, cartInfo: [] };
beforeEach(() => vi.clearAllMocks());

it.each([
  [0, 0, false, true, true, false, false],
  [9, 0, false, false, true, false, false],
  [1, 1, false, false, false, false, false],
  [2, 1, false, false, false, true, false],
  [3, 1, false, false, false, false, false],
  [4, 1, false, false, false, false, true],
  [-1, 1, false, false, false, false, false],
  [-2, 1, false, false, false, false, true],
  [4, 0, true, false, false, false, true],
])('exposes verified actions for type %s, paid %s, cancelled %s', async (type, paid, cancelled, canPay, canCancel, canReceive, canDelete) => {
  // Given the server computed state and payment facts.
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { ...order, paid, is_cancel: Number(cancelled), _status: { _type: type, _msg: '服务端进度' } } } });
  // When the detail is adapted.
  const result = await getOrder('wx1');
  // Then operations follow the source contract, including offline payment.
  expect(result).toMatchObject({ canPay, canCancel, canReceive, canDelete, statusMessage: '服务端进度' });
});

it('routes split orders to child details without parent receipt or deletion', async () => {
  // Given a split parent with server supplied child identities.
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { ...order, delivery_type: 'split', split: [{ order_id: 'child1' }] } } });
  // When the parent is adapted.
  const result = await getOrder('wx1');
  // Then only the children can be opened to resolve their own current actions.
  expect(result).toMatchObject({ splitOrderIds: ['child1'], canReceive: false, canDelete: false });
});

it('does not expose online pay when an offline state omits its payment fields', async () => {
  // Given an offline state with no paid field.
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { order_id: 'wx1', pay_price: 10, cartInfo: [], _status: { _type: 9 } } } });
  // When the detail is adapted.
  const result = await getOrder('wx1');
  // Then the state cannot accidentally become an online payment capability.
  expect(result).toMatchObject({ canPay: false, canCancel: false });
});
