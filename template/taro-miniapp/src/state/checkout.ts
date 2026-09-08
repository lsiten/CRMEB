import { useEffect, useMemo, useRef, useState } from 'react';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { ApiError, captureAuthSession, isCurrentAuthSession } from '../services/api';
import { getAddresses } from '../services/account';
import type { Address } from '../services/account';
import { CHECKOUT_ADDRESS_ID_KEY, isMobilePhone } from '../services/account-contracts';
import { requireLogin } from '../services/auth-flow';
import { readCheckoutItems } from '../services/cart';
import { addServerCart } from '../services/server-cart';
import { commerceError } from '../services/commerce-contracts';
import { computeCheckout, confirmCheckout, createOrder } from '../services/checkout';
import type { CheckoutPreferences, CheckoutPrice, CheckoutSession } from '../services/checkout';

export function useCheckout(input: Readonly<{ cartIds?: string; direct?: boolean; selection?: string; returnUrl: string; pinkId?: string }>) {
  const [preferences, setPreferences] = useState<CheckoutPreferences>({ addressId: 0, shippingType: 1, couponId: 0, useIntegral: false, mark: '' });
  const [address, setAddress] = useState<Address>();
  const [session, setSession] = useState<CheckoutSession>();
  const [calculation, setCalculation] = useState<Readonly<{ key: string; preferences: CheckoutPreferences; price: CheckoutPrice }>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  const source = useRef<Readonly<{ cartIds: string; direct: boolean }> | undefined>(undefined);
  const busy = useRef(false);
  const loadGeneration = useRef(0);
  const pageGeneration = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadGeneration.current += 1; pageGeneration.current += 1; }; }, []);
  useDidHide(() => { pageGeneration.current += 1; });
  const submission = useMemo(() => session ? { key: session.key, direct: session.direct, preferences, activity: session.activity, ...(session.pinkId ? { pinkId: session.pinkId } : {}) } : undefined, [session, preferences]);
  const price = calculation?.preferences === preferences && calculation.key === session?.key ? calculation.price : undefined;

  const load = async (): Promise<void> => {
    if (!requireLogin(input.returnUrl)) { setLoading(false); return; }
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError('');
    try {
      const pinkId = input.pinkId === undefined ? undefined : /^[1-9]\d*$/.test(input.pinkId) ? Number(input.pinkId) : NaN;
      if (pinkId !== undefined && (!Number.isSafeInteger(pinkId) || !input.direct)) throw new ApiError('BUSINESS', '参团信息无效，请返回活动重新选择');
      const addresses = await getAddresses();
      const selectedId = Number(Taro.getStorageSync<number | string>(CHECKOUT_ADDRESS_ID_KEY));
      const selected = addresses.find((item) => item.id === selectedId) ?? addresses.find((item) => item.id === preferences.addressId) ?? addresses.find((item) => item.is_default) ?? addresses[0];
      if (!source.current) {
        if (input.cartIds) source.current = { cartIds: input.cartIds, direct: input.direct === true };
        else {
          const items = readCheckoutItems(input.selection);
          if (!items.length) throw new ApiError('BUSINESS', '暂无待结算商品，请重新选择');
          const ids: string[] = [];
          for (const item of items) ids.push(await addServerCart({ product: item, quantity: item.quantity, direct: true }));
          source.current = { cartIds: ids.join(','), direct: true };
        }
      }
      const next = await confirmCheckout({ ...source.current, addressId: selected?.id ?? 0, shippingType: preferences.shippingType });
      if (pinkId !== undefined && !next.activity.combinationId) throw new ApiError('BUSINESS', '参团商品不匹配，请返回活动重新选择');
      if (!mounted.current || generation !== loadGeneration.current) return;
      setAddress(selected);
      setPreferences((current) => ({ ...current, addressId: selected?.id ?? 0 }));
      setSession({ ...next, ...(pinkId !== undefined ? { pinkId } : {}) });
    } catch (cause) { if (mounted.current && generation === loadGeneration.current) setError(commerceError(cause)); }
    finally { if (mounted.current && generation === loadGeneration.current) setLoading(false); }
  };
  useDidShow(() => { void load(); });

  useEffect(() => {
    if (!submission) return;
    let active = true;
    const authSession = captureAuthSession();
    const generation = pageGeneration.current;
    setError('');
    void computeCheckout(submission).then(async (next) => {
      if (!active || !mounted.current || generation !== pageGeneration.current || !isCurrentAuthSession(authSession)) return;
      if ('existingOrderId' in next) {
        setCalculation(undefined);
        await Taro.redirectTo({ url: `/pages/order/pay?orderId=${encodeURIComponent(next.existingOrderId)}` });
      } else setCalculation({ key: submission.key, preferences: submission.preferences, price: next });
    }).catch((cause: unknown) => {
      if (active && mounted.current && generation === pageGeneration.current && isCurrentAuthSession(authSession, cause)) setError(commerceError(cause));
    });
    return () => { active = false; };
  }, [submission, revision]);

  const submit = async (): Promise<void> => {
    if (!submission || !price || busy.current || loading || error) return;
    if (preferences.shippingType === 1 && !preferences.addressId) { setError('请选择收货地址'); return; }
    if (preferences.shippingType === 2 && (!preferences.storeId || !preferences.recipient?.trim() || !isMobilePhone(preferences.phone ?? ''))) { setError('请选择自提门店，并填写联系人和正确的手机号'); return; }
    const authSession = captureAuthSession();
    const generation = pageGeneration.current;
    busy.current = true;
    setSubmitting(true);
    try {
      const order = await createOrder(submission);
      if (!mounted.current || generation !== pageGeneration.current || !isCurrentAuthSession(authSession)) return;
      await Taro.redirectTo({ url: `/pages/order/pay?orderId=${encodeURIComponent(order.id)}` });
    } catch (cause) {
      if (mounted.current && generation === pageGeneration.current && isCurrentAuthSession(authSession, cause)) setError(commerceError(cause));
    }
    finally { busy.current = false; if (mounted.current) setSubmitting(false); }
  };
  const retry = (): void => { if (!session) void load(); else { setCalculation(undefined); setRevision((value) => value + 1); } };
  return { preferences, setPreferences, session, address, price, error, loading, submitting, submit, retry };
}
