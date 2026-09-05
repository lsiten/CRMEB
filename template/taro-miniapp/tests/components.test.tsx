import React from 'react';
import TestRenderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({
  Button: 'button', Text: 'span', View: 'div',
}));

import { Empty } from '../src/components/empty';
import { Loading } from '../src/components/loading';
import { Modal } from '../src/components/modal';

describe('shared component contracts', () => {
  it('renders accessible loading and empty states', () => {
    const loading = TestRenderer.create(<Loading label='正在加载商品' />).root;
    const empty = TestRenderer.create(<Empty title='暂无商品' actionLabel='刷新' onAction={() => undefined} />).root;

    expect(loading.findByProps({ role: 'status' }).props['aria-label']).toBe('正在加载商品');
    expect(empty.findByProps({ className: 'ui-empty__title' }).children).toEqual(['暂无商品']);
    expect(empty.findByType('button').children).toEqual(['刷新']);
  });

  it('does not mount a hidden modal and exposes its close action when visible', () => {
    const onClose = vi.fn();
    expect(TestRenderer.create(<Modal visible={false} title='提示' onClose={onClose}>内容</Modal>).toJSON()).toBeNull();
    const visible = TestRenderer.create(<Modal visible title='提示' onClose={onClose}>内容</Modal>).root;
    visible.findByProps({ 'aria-label': '关闭弹窗' }).props.onClick();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
