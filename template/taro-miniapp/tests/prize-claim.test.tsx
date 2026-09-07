import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ receiveLotteryPrize: vi.fn(), getAddresses: vi.fn() }));
vi.mock('../src/services/lottery', () => ({ receiveLotteryPrize: api.receiveLotteryPrize }));
vi.mock('../src/services/account', () => ({ getAddresses: api.getAddresses }));
vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span', Input: 'input', Textarea: 'textarea', Picker: 'div', Button: 'button' }));
vi.mock('@tarojs/taro', () => ({ default: {} }));
import { PrizeClaim } from '../src/components/prize-claim';
let page: TestRenderer.ReactTestRenderer | undefined;
const submit = () => page?.root.findAllByType('button').find((button) => button.children.includes('提交领奖地址'))?.props.onClick();
async function fill() {
  await act(async () => { page = TestRenderer.create(<PrizeClaim recordId='321' />); });
  act(() => {
    page?.root.findAllByType('input')[0]?.props.onInput({ detail: { value: '收件人' } });
    page?.root.findAllByType('input')[1]?.props.onInput({ detail: { value: '13800000000' } });
    page?.root.findByType('textarea').props.onInput({ detail: { value: '浙江省嘉兴市测试地址' } });
  });
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => act(() => page?.unmount()));
it('preserves typed address when claiming fails', async () => {
  api.receiveLotteryPrize.mockRejectedValue(new Error('offline'));
  await fill();
  await act(async () => { await submit(); });
  expect(page?.root.findByType('textarea').props.value).toBe('浙江省嘉兴市测试地址');
  expect(api.receiveLotteryPrize).toHaveBeenCalledWith('321', { name: '收件人', phone: '13800000000', address: '浙江省嘉兴市测试地址', detail: '浙江省嘉兴市测试地址', mark: '' });
});
it('locks duplicate clicks until the claim request finishes', async () => {
  let resolve: (() => void) | undefined;
  api.receiveLotteryPrize.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
  await fill();
  await act(async () => { void submit(); void submit(); });
  expect(api.receiveLotteryPrize).toHaveBeenCalledTimes(1);
  await act(async () => { resolve?.(); });
});
it('removes the submit action only after server acknowledgement', async () => {
  api.receiveLotteryPrize.mockResolvedValue(undefined);
  await fill();
  await act(async () => { await submit(); });
  expect(page?.root.findAllByType('input')).toHaveLength(0);
});
it('copies a saved address into the delivery fields when selected', async () => {
  api.getAddresses.mockResolvedValue([{ id: 1, real_name: '保存姓名', phone: '13900000000', province: '浙江省', city: '嘉兴市', district: '南湖区', detail: '测试门牌' }]);
  await fill();
  await act(async () => { await page?.root.findAllByType('button').find((button) => button.children.includes('使用已存地址'))?.props.onClick(); });
  act(() => { page?.root.findAllByType('button').find((button) => button.children.includes('保存姓名'))?.props.onClick(); });
  expect(page?.root.findByType('textarea').props.value).toBe('测试门牌');
});
