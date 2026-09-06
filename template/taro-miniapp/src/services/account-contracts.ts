export type LoginInput =
  | Readonly<{ mode: 'password'; account: string; password: string }>
  | Readonly<{ mode: 'sms'; phone: string; captcha: string }>
  | Readonly<{ mode: 'register'; phone: string; captcha: string; password: string }>;

export type PasswordResetInput = Readonly<{
  phone: string;
  captcha: string;
  password: string;
  confirmation: string;
}>;

type AddressInput = Readonly<{
  real_name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
}>;

const phonePattern = /^1[3-9]\d{9}$/;
const loginAccountPattern = /^[A-Za-z0-9_]{5,16}$/;
const passwordPattern = /^[A-Za-z0-9]{7,32}$/;

export const CHECKOUT_ADDRESS_ID_KEY = 'crmeb_checkout_address_id';

export function isMobilePhone(value: string): boolean {
  return phonePattern.test(value.trim());
}

export function normalizeReturnUrl(encodedValue?: string): string {
  if (!encodedValue) return '/pages/user/index';
  let value: string;
  try { value = encodedValue.startsWith('/') ? encodedValue : decodeURIComponent(encodedValue); } catch { return '/pages/user/index'; }
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/pages-extra/login/') || value.startsWith('/pages/account/login')) return '/pages/user/index';
  return value;
}

export function validateLoginInput(input: LoginInput): string | null {
  switch (input.mode) {
    case 'password':
      if (!loginAccountPattern.test(input.account.trim())) return '请输入 5-16 位账号';
      if (!input.password) return '请输入密码';
      return null;
    case 'sms':
      if (!isMobilePhone(input.phone)) return '请输入正确的手机号码';
      if (!/^[A-Za-z0-9]{4,8}$/.test(input.captcha.trim())) return '请输入正确的验证码';
      return null;
    case 'register':
      if (!isMobilePhone(input.phone)) return '请输入正确的手机号码';
      if (!/^[A-Za-z0-9]{4,8}$/.test(input.captcha.trim())) return '请输入正确的验证码';
      if (!passwordPattern.test(input.password)) return '密码至少需要 7 位字母或数字';
      return null;
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}

export function validatePasswordReset(input: PasswordResetInput): string | null {
  if (!isMobilePhone(input.phone)) return '请输入正确的手机号码';
  if (!/^[A-Za-z0-9]{4,8}$/.test(input.captcha.trim())) return '请输入正确的验证码';
  if (!passwordPattern.test(input.password)) return '密码至少需要 7 位字母或数字';
  if (input.password !== input.confirmation) return '两次输入的密码不一致';
  return null;
}

export function validateAddressDraft(address: AddressInput): string | null {
  if (!address.real_name.trim()) return '请填写收货人姓名';
  if (!isMobilePhone(address.phone)) return '请输入正确的手机号码';
  if (!address.province.trim() || !address.city.trim() || !address.district.trim()) return '请选择所在地区';
  if (!address.detail.trim()) return '请填写详细地址';
  return null;
}
