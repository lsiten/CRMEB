import { expect, it } from 'vitest';
import { platform, response, render, rendered, textOf } from './refund-page-fixture';
import Detail from '../src/pages/order/refund-detail';

const refund = { id: 9, order_id: 'refund9', refund_type: 6, refund_price: '100.00', pay_price: '100.00', cart_info: [] };
async function show(fields: Readonly<Record<string, unknown>>) {
  Object.assign(platform.params, { id: 'refund9' });
  platform.request.mockResolvedValue(response({ ...refund, ...fields }));
  await render(Detail);
  return rendered?.root.findAllByType('text').map((node) => node.children.join('')) ?? [];
}

it.each(['60.00', 60])('shows actual refund separately when 100 is requested and %s is refunded', async (refunded_price) => {
  const texts = await show({ refunded_price });
  expect(texts.slice(texts.indexOf('已退金额'), texts.indexOf('已退金额') + 2)).toEqual(['已退金额', '¥60.00']);
  expect(texts.slice(texts.indexOf('申请退款金额'), texts.indexOf('申请退款金额') + 2)).toEqual(['申请退款金额', '¥100.00']);
});

it.each([undefined, null, '', '   '])('does not invent actual refund when refunded_price is %s', async (refunded_price) => {
  const texts = await show({ refunded_price });
  expect(texts.slice(texts.indexOf('已退金额'), texts.indexOf('已退金额') + 2)).toEqual(['已退金额', '暂未提供']);
  expect(texts).toContain('¥100.00');
});

it.each([0, '0.00'])('preserves explicit zero actual refund (%s)', async (refunded_price) => {
  const texts = await show({ refunded_price });
  expect(texts.slice(texts.indexOf('已退金额'), texts.indexOf('已退金额') + 2)).toEqual(['已退金额', '¥0.00']);
});

it.each([1, 2, 3, 4, 5])('keeps the requested amount label in state %s', async (refund_type) => {
  const texts = await show({ refund_type, refunded_price: '60.00' });
  expect(texts).not.toContain('已退金额');
  expect(texts).toContain('申请退款金额');
  expect(texts).toContain('¥100.00');
});

it('does not label cancelled refunds as paid', async () => {
  const texts = await show({ is_cancel: 1, refunded_price: '60.00' });
  expect(texts).not.toContain('已退金额');
  expect(texts).toContain('申请退款金额');
});

it('keeps pay_price compatibility limited to the application amount', async () => {
  const texts = await show({ refund_price: null, refunded_price: null });
  expect(texts.slice(texts.indexOf('已退金额'), texts.indexOf('已退金额') + 2)).toEqual(['已退金额', '暂未提供']);
  expect(texts.slice(texts.indexOf('申请退款金额'), texts.indexOf('申请退款金额') + 2)).toEqual(['申请退款金额', '¥100.00']);
});

it.each(['invalid', -1])('offers recovery for invalid actual refund %s', async (refunded_price) => {
  await show({ refunded_price });
  expect(textOf()).toContain('金额数据不完整，请重试');
  expect(textOf()).toContain('重新加载');
  expect(textOf()).not.toContain('¥100.00');
});
