import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
const controls = vi.hoisted(() => ({ navigateTo: vi.fn(), redirectTo: vi.fn(), switchTab: vi.fn(), draw: vi.fn(), dismiss: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: controls, useRouter: () => ({ params: { order_id: 'order-31' } }) }));
vi.mock('@tarojs/components', () => ({ Image: 'image', Text: 'text', View: 'view', Button: 'button', Input: 'input', Textarea: 'textarea' }));
vi.mock('../src/state/lottery', () => ({ useReviewLottery: () => ({ activity: { data: { id: '72', name: 'Activity', chances: 1, prizes: Array.from({ length: 8 }, (_, index) => ({ id: String(index), type: 1, name: 'Prize', image: '/prize.png', prompt: '' })) }, loading: false, error: '', reload: vi.fn() }, phase: 'idle', result: undefined, error: '', draw: controls.draw, dismiss: controls.dismiss }) }));
import ReviewLotteryPage from '../src/pages/marketing/review-lottery';
beforeEach(() => vi.clearAllMocks());
it('places the sixth prize on the bottom middle square of the clockwise board', () => {
  // Given / When
  const page = TestRenderer.create(<ReviewLotteryPage />);
  // Then
  expect(page.root.findAllByProps({ className: 'lottery-prize' })[5]?.props.style).toEqual({ gridArea: '3 / 2' });
  act(() => page.unmount());
});
it('returns to the original order from the review lottery', () => {
  // Given
  const page = TestRenderer.create(<ReviewLotteryPage />);
  // When
  page.root.findAllByType('button').find(button => button.children.includes('返回订单'))?.props.onClick();
  // Then
  expect(controls.redirectTo).toHaveBeenCalledWith({ url: '/pages/order/detail?orderId=order-31' });
  act(() => page.unmount());
});
it('returns home from the completed review flow', () => {
  // Given
  const page = TestRenderer.create(<ReviewLotteryPage />);
  // When
  page.root.findAllByType('button').find(button => button.children.includes('返回首页'))?.props.onClick();
  // Then
  expect(controls.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
  act(() => page.unmount());
});
