import { request } from './api';
import { normalizeDiyPage, type DiyPage } from '../diy/normalize';

export async function getDiyPage(name = 'home'): Promise<DiyPage> {
  const payload = await request<unknown>(`/theme_info/${encodeURIComponent(name)}`);
  return normalizeDiyPage(payload);
}
export async function getDiyVersion(name = 'index'): Promise<unknown> { return request(`/v2/diy/get_version/${encodeURIComponent(name)}`); }
export async function getTheme(name = 'index'): Promise<unknown> { return request(`/v2/diy/color_change/${encodeURIComponent(name)}`); }
