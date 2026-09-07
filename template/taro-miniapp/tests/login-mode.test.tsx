import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({ Button: 'button', Input: 'input', Text: 'text', View: 'view' }));
vi.mock('@tarojs/taro', () => ({ default: {}, useRouter: () => ({ params: {} }) }));
import LoginPage from '../src/pages/account/login';

it.each(['短信登录', '手机注册'])('gives account and phone fields separate platform identities when returning from %s', (mode) => {
  // Given
  const page = TestRenderer.create(<LoginPage />);
  act(() => page.root.findAllByType('button').find(button => button.children.includes(mode))?.props.onClick());
  const phone = page.root.findByProps({ placeholder: '请输入手机号' });
  act(() => phone.props.onInput({ detail: { value: '13800000000' } }));
  // When
  act(() => page.root.findAllByType('button').find(button => button.children.includes('账号密码'))?.props.onClick());
  // Then: Taro's native input must not inherit the phone element's initial attributes.
  const account = page.root.findByProps({ placeholder: '请输入账号' });
  expect(account === phone).toBe(false);
  expect(account.props.value).toBe('');
  expect(page.root.findByProps({ placeholder: '请输入密码' }).props.password).toBe(true);
  act(() => page.unmount());
});
