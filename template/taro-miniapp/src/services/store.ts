import Taro from '@tarojs/taro';
import { request } from './api';

export type Store = Readonly<{ id: number; name: string; image?: string; address: string; detailedAddress?: string; phone?: string; latitude?: number; longitude?: number; distance?: number; isOpen?: boolean }>;
export type StoreQuery = Readonly<{ latitude?: number; longitude?: number; keyword?: string }>;

const numberValue = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function parseStore(value: unknown): Store | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const id = numberValue(record['id']);
  const name = typeof record['name'] === 'string' ? record['name'] : record['store_name'];
  if (!id || !name || typeof name !== 'string') return null;
  const latitude = numberValue(record['latitude']); const longitude = numberValue(record['longitude']); const distance = numberValue(record['range'] ?? record['distance']);
  return { id, name, address: typeof record['address'] === 'string' ? record['address'] : '', isOpen: record['is_open'] !== false, ...(typeof record['image'] === 'string' ? { image: record['image'] } : {}), ...(typeof record['detailed_address'] === 'string' ? { detailedAddress: record['detailed_address'] } : {}), ...(typeof record['phone'] === 'string' ? { phone: record['phone'] } : {}), ...(latitude !== undefined ? { latitude } : {}), ...(longitude !== undefined ? { longitude } : {}), ...(distance !== undefined ? { distance } : {}) };
}

export async function getStores(query: StoreQuery = {}): Promise<readonly Store[]> {
  const params = new URLSearchParams();
  if (query.latitude !== undefined) params.set('latitude', String(query.latitude));
  if (query.longitude !== undefined) params.set('longitude', String(query.longitude));
  if (query.keyword) params.set('keyword', query.keyword);
  const payload = await request<Readonly<{ data?: unknown; list?: unknown }>>(`/v1/store/list?${params.toString()}`, { method: 'GET' });
  const raw = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.list) ? payload.list : payload.data && typeof payload.data === 'object' && Array.isArray((payload.data as { list?: unknown }).list) ? (payload.data as { list: unknown[] }).list : [];
  return raw.flatMap((item) => { const store = parseStore(item); return store ? [store] : []; });
}

export async function verifyOrder(code: string, confirm = false): Promise<Readonly<{ orderId: string; status: string; image?: string }>> {
  const payload = await request<Readonly<{ data?: Readonly<{ orderId?: string; order_id?: string; status?: string; image?: string }> }>>('/v1/order/verification', { method: 'POST', data: { verify_code: code, confirm: confirm ? 1 : 0 } });
  const data = payload.data;
  return { orderId: data?.orderId ?? data?.order_id ?? '', status: data?.status ?? 'pending', ...(data?.image ? { image: data.image } : {}) };
}

export async function locateStore(store: Store): Promise<void> {
  if (store.latitude === undefined || store.longitude === undefined) {
    await Taro.showToast({ title: '该门店暂不支持地图定位', icon: 'none' });
    return;
  }
  await Taro.openLocation({ latitude: store.latitude, longitude: store.longitude, name: store.name, address: `${store.address}${store.detailedAddress ? ` ${store.detailedAddress}` : ''}` });
}
