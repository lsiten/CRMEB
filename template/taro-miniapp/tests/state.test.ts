import { describe, expect, it } from 'vitest';
import { FLOW_STATUS, canRequestRefund, canRetryPayment, canSubmitOrder, initialFlowState, reduceFlow } from '../src/state/flow';

describe('critical-flow state contracts', () => {
  it('transitions loading to ready and preserves the response', () => {
    const initial = initialFlowState<readonly string[]>();
    const loading = reduceFlow(initial, { type: 'start' });
    const ready = reduceFlow(loading, { type: 'success', data: ['ok'] });

    expect(loading.status).toBe(FLOW_STATUS.loading);
    expect(ready).toEqual({ status: FLOW_STATUS.ready, data: ['ok'] });
  });

  it('retains failure code for token expiry and API errors', () => {
    const failed = reduceFlow(initialFlowState<null>(), { type: 'failure', errorCode: 'UNAUTHORIZED' });
    expect(failed).toEqual({ status: FLOW_STATUS.error, errorCode: 'UNAUTHORIZED' });
  });

  it('guards order, payment retry, and after-sale entry points', () => {
    expect(canSubmitOrder(true, 1)).toBe(true);
    expect(canSubmitOrder(false, 1)).toBe(false);
    expect(canSubmitOrder(true, 0)).toBe(false);
    expect(canRetryPayment('failed')).toBe(true);
    expect(canRetryPayment('paid')).toBe(false);
    expect(canRequestRefund('paid')).toBe(true);
    expect(canRequestRefund('cancelled')).toBe(false);
  });
});
