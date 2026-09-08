import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { clearVisits, getVisits } from '../src/services/visits';
beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
it('rejects confirmation from a different account before reading or deleting', async () => {
  vi.stubEnv('TARO_VISIT_DELETE_ENABLED', 'true');
  await expect(clearVisits('previous-account')).rejects.toThrow('登录状态已变化');
  expect(platform.request).not.toHaveBeenCalled();
});
it('reads visitList data.list and preserves server product fields', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: {
    list: [{ id: 99, product_id: 8, add_time: '2026-09-08 08:00:00', product: { id: 8, store_name: '咖啡', image: '/8.png', price: '12.50' } }], count: 1, time: ['09-08'],
  } } });
  await expect(getVisits(1)).resolves.toEqual([{ id: '99', productId: 8, name: '咖啡', image: '/8.png', price: 12.5, visitedAt: '2026-09-08 08:00:00' }]);
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', data: { page: 1, limit: 20 } }));
});
it('does not delete when the verified-server build switch is disabled', async () => {
  vi.stubEnv('TARO_VISIT_DELETE_ENABLED', 'false');
  await expect(clearVisits()).rejects.toThrow('暂未开放');
  expect(platform.request).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});

it('collects all pages before deleting product IDs rather than log IDs', async () => {
  // Given 21 products across pages, when clearing, then send one complete ID snapshot.
  vi.stubEnv('TARO_VISIT_DELETE_ENABLED', 'true');
  const first = Array.from({ length: 20 }, (_, i) => ({ id: i + 100, product_id: i + 1 }));
  platform.request.mockResolvedValueOnce({ statusCode: 200, data: { status: 200, data: { list: first } } })
    .mockResolvedValueOnce({ statusCode: 200, data: { status: 200, data: { list: [{ id: 999, product_id: 21 }] } } })
    .mockResolvedValueOnce({ statusCode: 200, data: { status: 200, msg: '删除成功' } });
  await clearVisits();
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'DELETE', data: { ids: Array.from({ length: 21 }, (_, i) => i + 1) } }));
  vi.unstubAllEnvs();
});

it('does not send a partial deletion when collecting the snapshot fails', async () => {
  vi.stubEnv('TARO_VISIT_DELETE_ENABLED', 'true');
  platform.request.mockRejectedValueOnce(new Error('offline'));
  await expect(clearVisits()).rejects.toThrow();
  expect(platform.request.mock.calls.every(([options]) => options.method === 'GET')).toBe(true);
  vi.unstubAllEnvs();
});
it('retains all records when the second page fails and retries the full snapshot', async () => {
  // Given a full first page, when page two fails, then no deletion happens until a new successful attempt.
  vi.stubEnv('TARO_VISIT_DELETE_ENABLED', 'true');
  const list = Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, product_id: i + 1 }));
  platform.request.mockResolvedValueOnce({ statusCode: 200, data: { status: 200, data: { list } } })
    .mockRejectedValueOnce(new Error('offline'));
  await expect(clearVisits()).rejects.toThrow();
  expect(platform.request.mock.calls.every(([options]) => options.method === 'GET')).toBe(true);
  platform.request.mockResolvedValueOnce({ statusCode: 200, data: { status: 200, data: { list } } })
    .mockResolvedValueOnce({ statusCode: 200, data: { status: 200, data: { list: [] } } })
    .mockResolvedValueOnce({ statusCode: 200, data: { status: 200 } });
  await clearVisits();
  expect(platform.request.mock.calls.filter(([options]) => options.method === 'DELETE')).toHaveLength(1);
});

it('rejects repeated full pages without sending a deletion', async () => {
  vi.stubEnv('TARO_VISIT_DELETE_ENABLED', 'true');
  const list = Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, product_id: i + 1 }));
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { list } } });
  await expect(clearVisits()).rejects.toThrow('分页异常');
  expect(platform.request).toHaveBeenCalledTimes(2);
});

it('propagates deletion failure and allows an explicit retry', async () => {
  vi.stubEnv('TARO_VISIT_DELETE_ENABLED', 'true');
  const page = { statusCode: 200, data: { status: 200, data: { list: [{ id: 99, product_id: 8 }] } } };
  platform.request.mockResolvedValueOnce(page).mockResolvedValueOnce({ statusCode: 200, data: { status: 400, msg: '清空失败' } });
  await expect(clearVisits()).rejects.toThrow('清空失败');
  platform.request.mockResolvedValueOnce(page).mockResolvedValueOnce({ statusCode: 200, data: { status: 200 } });
  await clearVisits();
  expect(platform.request.mock.calls.filter(([options]) => options.method === 'DELETE')).toHaveLength(2);
});
it('reads the flat product_price field bound by StoreProductLog.storeName', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: {
    list: [{ id: 100, product_id: 9, store_name: '茶', image: '/9.png', product_price: '28.80', add_time: '2026-09-08' }], count: 1,
  } } });
  await expect(getVisits(1)).resolves.toMatchObject([{ name: '茶', price: 28.8 }]);
});
