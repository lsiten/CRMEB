import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), uploadFile: vi.fn(), chooseImage: vi.fn(), getStorageSync: vi.fn(() => 'isolated-session'), removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { chooseAndUploadImage, uploadImage } from '../src/services/image-upload';
import { getReviewProduct, submitOrderReview } from '../src/services/order-reviews';

beforeEach(() => { vi.clearAllMocks(); platform.getStorageSync.mockReturnValue('isolated-session'); });
function uploadResponse(status: number, data: unknown) { platform.uploadFile.mockResolvedValue({ statusCode: 200, data: JSON.stringify({ status, data }) }); }
it('uploads under the backend multipart field and returns only the acknowledged server URL', async () => {
  uploadResponse(200, { url: 'https://example.test/proof.png' });
  await expect(uploadImage('/tmp/proof.png')).resolves.toBe('https://example.test/proof.png');
  expect(platform.uploadFile).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/api/upload/image'), filePath: '/tmp/proof.png', name: 'pics', formData: { filename: 'pics' }, header: { 'Authori-zation': 'Bearer isolated-session' } }));
});
it('does not upload after the image picker is cancelled', async () => {
  platform.chooseImage.mockRejectedValue({ errMsg: 'chooseImage:fail cancel' });
  await expect(chooseAndUploadImage()).resolves.toBeUndefined();
  expect(platform.uploadFile).not.toHaveBeenCalled();
});
it('reports denied access and upload failures without accepting a local preview as success', async () => {
  platform.chooseImage.mockRejectedValue({ errMsg: 'chooseImage:fail permission denied' });
  await expect(chooseAndUploadImage()).rejects.toThrow('权限');
  platform.uploadFile.mockRejectedValue(new Error('network'));
  await expect(uploadImage('/tmp/proof.png')).rejects.toMatchObject({ code: 'NETWORK' });
});
it('rejects non-image addresses and malformed upload responses', async () => {
  uploadResponse(200, { url: 'javascript:alert(1)' });
  await expect(uploadImage('/tmp/proof.png')).rejects.toMatchObject({ code: 'BUSINESS' });
  platform.uploadFile.mockResolvedValue({ statusCode: 200, data: '<html>error</html>' });
  await expect(uploadImage('/tmp/proof.png')).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('clears expired sessions for HTTP and envelope unauthorized responses', async () => {
  uploadResponse(401, {});
  await expect(uploadImage('/tmp/proof.png')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  platform.uploadFile.mockResolvedValue({ statusCode: 401, data: '' });
  await expect(uploadImage('/tmp/proof.png')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(platform.removeStorageSync).toHaveBeenCalledTimes(2);
});
it('requires login before starting the upload', async () => {
  platform.getStorageSync.mockReturnValue('');
  await expect(uploadImage('/tmp/proof.png')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(platform.uploadFile).not.toHaveBeenCalled();
});
it('loads the order-line unique identity rather than the product SKU identity', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { order_id: 'qa-order81', cart_num: 2, productInfo: { store_name: '咖啡', price: '25', attrInfo: { suk: '深烘焙', image: '/variant.png', price: '21.25' } } } } });
  await expect(getReviewProduct('order-line-unique')).resolves.toMatchObject({ unique: 'order-line-unique', orderId: 'qa-order81', quantity: 2, price: 21.25, image: '/variant.png' });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/product'), data: { unique: 'order-line-unique' } }));
});
it('sends both scores, comment, pictures and unique to the existing review endpoint', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { to_lottery: true } } });
  await expect(submitOrderReview({ unique: 'order-line-unique', comment: ' 包装完整 ', productScore: 4, serviceScore: 5, images: ['https://example.test/proof.png'] })).resolves.toEqual({ lotteryAvailable: true });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/comment'), data: { unique: 'order-line-unique', comment: '包装完整', product_score: 4, service_score: 5, pics: ['https://example.test/proof.png'] } }));
});
it('rejects incomplete ratings and excess images before a request', async () => {
  const input = { unique: 'line', comment: '评价', productScore: 0, serviceScore: 5, images: [] };
  await expect(submitOrderReview(input)).rejects.toMatchObject({ code: 'BUSINESS' });
  await expect(submitOrderReview({ ...input, productScore: 5, images: Array.from({ length: 9 }, () => 'https://example.test/proof.png') })).rejects.toMatchObject({ code: 'BUSINESS' });
  expect(platform.request).not.toHaveBeenCalled();
});
it('propagates already-reviewed rejection instead of claiming a second success', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: '订单商品已评价' } });
  await expect(submitOrderReview({ unique: 'line', comment: '评价', productScore: 5, serviceScore: 5, images: [] })).rejects.toThrow('订单商品已评价');
});
