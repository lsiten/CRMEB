import Taro from '@tarojs/taro';

export type Product = Readonly<{ id: number; name: string; price: number; image: string }>;
type ApiResponse<T> = Readonly<{ data: T; status: number }>;

const baseUrl = 'http://localhost/api';

export async function getProducts(): Promise<readonly Product[]> {
  const response = await Taro.request<Readonly<{ data: readonly Product[] }>>({ url: `${baseUrl}/products`, method: 'GET' });
  const payload = response.data;
  return Array.isArray(payload.data) ? payload.data : [];
}

export function unwrap<T>(response: ApiResponse<T>): T {
  if (response.status < 200 || response.status >= 300) throw new Error(`请求失败（${response.status}）`);
  return response.data;
}
