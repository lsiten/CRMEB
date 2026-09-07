import { ApiError, request } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type Shipment = Readonly<{
  company: string;
  number: string;
  products: readonly Readonly<{ name: string; image: string; quantity: number; price: number }>[];
  events: readonly Readonly<{ time: string; description: string }>[];
}>;

export async function getShipment(id: string, refund = false): Promise<Shipment> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/order/express/${encodeURIComponent(apiId(id))}${refund ? '/refund' : ''}`, { method: 'GET' });
  const data = apiRecord(payload.data);
  const order = apiRecord(data['order']);
  const number = apiText(order['delivery_id']);
  if (!number) throw new ApiError('BUSINESS', '快递单号不存在，请返回订单核对');
  const result = apiRecord(apiRecord(data['express'])['result']);
  const entries = result['list'];
  if (entries !== undefined && !Array.isArray(entries)) throw new ApiError('BUSINESS', '物流数据不完整，请重试');
  return {
    company: apiText(order['delivery_name']), number,
    products: apiItems(order['cartInfo']).map((value) => {
      const item = apiRecord(value);
      const product = apiRecord(item['productInfo']);
      const quantity = Number(item['cart_num']);
      const name = apiText(product['store_name']);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || !name) throw new ApiError('BUSINESS', '包裹商品数据不完整，请重试');
      return { name, image: apiText(product['image']), quantity, price: apiAmount(item['truePrice']) + apiAmount(item['postage_price'] ?? 0) / quantity };
    }),
    events: (entries ?? []).map((value: unknown) => {
      const item = apiRecord(value);
      const description = apiText(item['status'] ?? item['context']);
      const time = apiText(item['time']);
      if (!description || !time) throw new ApiError('BUSINESS', '物流轨迹不完整，请重试');
      return { time, description };
    }),
  };
}
