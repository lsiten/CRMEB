import { tenantSession, isTenantInvalid, tenantResponseError, TenantError } from './tenant';
import Taro from '@tarojs/taro';
import { ApiError, clearToken, captureAuthSession, isCurrentAuthSession } from './api';
import { apiRecord, apiText } from './commerce-contracts';

export async function uploadImage(filePath: string): Promise<string> {
  if (!filePath) throw new ApiError('BUSINESS', '请选择图片');
  const session = captureAuthSession();
  const operation = { revision: tenantSession.revision() };
  const token = session.token;
  if (!token) throw new ApiError('UNAUTHORIZED', '请先登录再上传图片');
  const tenant = await tenantSession.ensure();
  tenantSession.assertCurrent(operation);
  if (!isCurrentAuthSession(session)) throw new TenantError('TENANT_CHANGED');
  let response: Taro.uploadFile.SuccessCallbackResult;
  try {
    response = await Taro.uploadFile({
      url: `${(process.env.TARO_API_BASE_URL ?? 'http://127.0.0.1:8080/api').replace(/\/$/, '')}/upload/image`,
      filePath, name: 'pics', formData: { filename: 'pics' },
      header: { 'Authori-zation': `Bearer ${token}`, ...tenantSession.headers(tenant) }, timeout: 30000,
    });
  } catch { throw new ApiError('NETWORK', '图片上传失败，请重试'); }
  tenantSession.assertCurrent(tenant);
  if (!isCurrentAuthSession(session)) throw new TenantError('TENANT_CHANGED');
  let body: unknown;
  try { body = JSON.parse(response.data); } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  if (isTenantInvalid(body)) throw tenantResponseError(body);
  if (response.statusCode === 401) { clearToken(); throw new ApiError('UNAUTHORIZED', '登录已过期，请重新登录'); }
  if (response.statusCode < 200 || response.statusCode >= 300) throw new ApiError('HTTP', '图片上传失败，请重试', response.statusCode);
  if (body === undefined) throw new ApiError('BUSINESS', '图片上传结果无效，请重试');
  const envelope = apiRecord(body);
  if (envelope['status'] === 401) { clearToken(); throw new ApiError('UNAUTHORIZED', apiText(envelope['msg']) || '登录已过期'); }
  if (envelope['status'] !== 200) throw new ApiError('BUSINESS', apiText(envelope['msg']) || '图片上传失败，请重试');
  const url = apiText(apiRecord(envelope['data'])['url']);
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new ApiError('BUSINESS', '图片地址无效，请重试');
  return url;
}

export async function chooseAndUploadImage(): Promise<string | undefined> {
  const session = captureAuthSession();
  const operation = { revision: tenantSession.revision() };
  let selection: Taro.chooseImage.SuccessCallbackResult;
  try { selection = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] }); }
  catch (cause) {
    if (/cancel/i.test(apiText(apiRecord(cause)['errMsg']))) return undefined;
    throw new ApiError('BUSINESS', '无法选择图片，请检查相册或相机权限');
  }
  tenantSession.assertCurrent(operation);
  if (!isCurrentAuthSession(session)) throw new TenantError('TENANT_CHANGED');
  const file = selection.tempFilePaths[0];
  return file ? uploadImage(file) : undefined;
}
