import { request } from './api';
import { apiId, apiRecord, apiText } from './commerce-contracts';

export async function receiveOrder(orderId: string): Promise<void> {
  await request('/order/take', { method: 'POST', data: { uni: apiId(orderId) } });
}
export async function deleteOrder(orderId: string): Promise<void> {
  await request('/order/del', { method: 'POST', data: { uni: apiId(orderId) } });
}
export async function buyOrderAgain(orderId: string): Promise<string> {
  const envelope = apiRecord(await request<unknown>('/order/again', { method: 'POST', data: { uni: apiId(orderId) } }));
  return apiText(apiRecord(envelope['data'])['cateId']).split(',').map(apiId).join(',');
}
