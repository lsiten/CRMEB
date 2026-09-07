import { expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getInvoices } from '../src/services/invoices';
it('reads invoice rows from the backend array payload', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: [{ id: 12, name: '测试企业', type: 1, header_type: 2, duty_number: '913000000000000001' }] } });
  await expect(getInvoices()).resolves.toMatchObject([{ id: '12', name: '测试企业', headerType: 2 }]);
});
