export const FLOW_STATUS = {
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  error: 'error',
} as const;

export type FlowStatus = (typeof FLOW_STATUS)[keyof typeof FLOW_STATUS];
export type FlowState<T> = Readonly<{
  status: FlowStatus;
  data?: T;
  errorCode?: string;
}>;

export type FlowEvent<T> =
  | Readonly<{ type: 'start' }>
  | Readonly<{ type: 'success'; data: T }>
  | Readonly<{ type: 'failure'; errorCode: string }>;

export function initialFlowState<T>(): FlowState<T> {
  return { status: FLOW_STATUS.idle };
}

export function reduceFlow<T>(state: FlowState<T>, event: FlowEvent<T>): FlowState<T> {
  switch (event.type) {
    case 'start':
      return { status: FLOW_STATUS.loading };
    case 'success':
      return { status: FLOW_STATUS.ready, data: event.data };
    case 'failure':
      return { status: FLOW_STATUS.error, errorCode: event.errorCode };
    default:
      return state;
  }
}

export const PAYMENT_STATUS = ['pending', 'paid', 'failed', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export function canRetryPayment(status: PaymentStatus): boolean {
  return status === 'failed' || status === 'cancelled';
}

export function canSubmitOrder(isAuthenticated: boolean, itemCount: number): boolean {
  return isAuthenticated && Number.isInteger(itemCount) && itemCount > 0;
}

export function canRequestRefund(orderStatus: string): boolean {
  return orderStatus === 'paid' || orderStatus === 'shipping' || orderStatus === 'completed';
}
