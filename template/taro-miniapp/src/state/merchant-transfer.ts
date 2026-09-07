import { useEffect, useRef, useState } from 'react';
import { getMerchantTransfer, type TransferKind } from '../services/merchant-transfer';
import { launchMerchantTransfer, TransferLaunchError } from '../services/transfer-launch';
import { commerceError } from '../services/commerce-contracts';
import { useRemoteResource } from './remote-resource';

export function useMerchantTransfer(orderId: string, kind: TransferKind) {
  const resource = useRemoteResource(() => getMerchantTransfer(orderId, kind));
  const [launching, setLaunching] = useState(false);
  const [notice, setNotice] = useState('');
  const busy = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = async () => { if (busy.current) return; setNotice(''); await resource.reload(); };
  const confirm = async () => {
    if (busy.current || resource.loading || resource.error || resource.data?.state !== 'WAIT_USER_CONFIRM') return;
    busy.current = true; setLaunching(true); setNotice('');
    try {
      await launchMerchantTransfer(resource.data);
      if (mounted.current) setNotice('微信操作已返回；若尚未到账，可刷新收款状态');
    } catch (cause) { if (mounted.current) setNotice(cause instanceof TransferLaunchError ? cause.message : commerceError(cause)); }
    finally {
      if (mounted.current) await resource.reload();
      busy.current = false;
      if (mounted.current) setLaunching(false);
    }
  };
  return { ...resource, launching, notice, refresh, confirm };
}
