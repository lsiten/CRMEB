import { describe, expect, it } from 'vitest';
import {
  normalizeReturnUrl,
  validateAddressDraft,
  validateLoginInput,
  validatePasswordReset,
} from '../src/services/account-contracts';

describe('account flow contracts', () => {
  it('keeps an internal purchase return URL when login is required', () => {
    // Given an encoded internal route from a protected purchase action
    // When the login page normalizes the route
    const result = normalizeReturnUrl(encodeURIComponent('/pages/order/confirm?selection=%5B%221%22%5D'));

    // Then the original in-app destination remains available
    expect(result).toBe('/pages/order/confirm?selection=%5B%221%22%5D');
  });

  it.each(['https://evil.example', '//evil.example', '/pages-extra/login/index'])('rejects an unsafe or recursive return URL: %s', (url) => {
    // Given an external or recursive destination
    // When it is normalized
    const result = normalizeReturnUrl(encodeURIComponent(url));

    // Then login falls back to the account tab
    expect(result).toBe('/pages/user/index');
  });

  it('validates password and SMS login without accepting malformed accounts', () => {
    // Given representative login inputs
    // When each mode is validated
    const passwordError = validateLoginInput({ mode: 'password', account: 'ab', password: 'secret12' });
    const smsError = validateLoginInput({ mode: 'sms', phone: '123', captcha: '123456' });

    // Then each reports its boundary failure
    expect(passwordError).toBe('请输入 5-16 位账号');
    expect(smsError).toBe('请输入正确的手机号码');
  });

  it('requires a strong password when a phone account is registered', () => {
    // Given a valid phone and verification code with a weak password
    // When registration input is validated
    const result = validateLoginInput({ mode: 'register', phone: '13800138000', captcha: '123456', password: '123' });

    // Then weak credentials are rejected before reaching the API
    expect(result).toBe('密码至少需要 7 位字母或数字');
  });

  it('requires a complete manual address before save', () => {
    // Given a draft without a district or detail
    // When the form is validated
    const result = validateAddressDraft({
      real_name: '张三', phone: '13800138000', province: '广东省', city: '深圳市', district: '', detail: '', is_default: false,
    });

    // Then the first missing address field is reported
    expect(result).toBe('请选择所在地区');
  });

  it('requires matching, non-trivial passwords during reset', () => {
    // Given a valid phone and code but weak passwords
    // When the reset form is validated
    const weak = validatePasswordReset({ phone: '13800138000', captcha: '123456', password: '123', confirmation: '123' });
    const mismatch = validatePasswordReset({ phone: '13800138000', captcha: '123456', password: 'secret12', confirmation: 'secret13' });

    // Then weak and mismatched credentials remain distinct
    expect(weak).toBe('密码至少需要 7 位字母或数字');
    expect(mismatch).toBe('两次输入的密码不一致');
  });
});
