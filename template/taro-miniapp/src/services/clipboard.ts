import Taro from '@tarojs/taro';
import { ApiError } from './api';

export async function copyText(text: string): Promise<void> {
  if (process.env.TARO_ENV !== 'h5') { await Taro.setClipboardData({ data: text }); return; }
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.style.position = 'fixed';
  input.style.left = '-10000px';
  document.body.appendChild(input);
  try {
    input.select(); input.setSelectionRange(0, text.length);
    if (!document.execCommand('copy')) throw new ApiError('BUSINESS', '复制失败，请长按下方链接复制');
  } finally { input.remove(); }
}
