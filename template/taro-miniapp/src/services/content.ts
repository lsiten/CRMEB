import { ApiError, request } from './api';

export type Article = Readonly<{ id: number; title: string; summary?: string | undefined; content?: string | undefined; images: readonly string[]; video?: string | undefined; category?: string | undefined; createdAt?: string | undefined; views?: number | undefined }>;
export type ArticleCategory = Readonly<{ id: number; title: string; children?: readonly ArticleCategory[] }>;
export type Message = Readonly<{ id: number; title: string; content: string; read: boolean; createdAt?: string | undefined; type?: number | undefined }>;
export type ChatMessage = Readonly<{ id: number; text: string; type: 'text' | 'image' | 'product' | 'order'; mine: boolean; createdAt?: string; image?: string }>;

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number => Number.isSafeInteger(Number(value)) ? Number(value) : 0;
const unwrap = (payload: unknown): unknown => payload && typeof payload === 'object' && 'data' in payload ? (payload as { data: unknown }).data : payload;

const article = (value: unknown): Article | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const images = Array.isArray(row['image_input']) ? row['image_input'].filter((item): item is string => typeof item === 'string') : [text(row['image'])].filter(Boolean);
  const id = number(row['id']); const title = text(row['title']);
  const video = text(row['video']) || text(row['video_url']) || text(row['video_link']);
  return id > 0 && title ? { id, title, summary: text(row['synopsis']) || undefined, content: text(row['content']) || undefined, images, video: video || undefined, category: text(row['catename']) || undefined, createdAt: text(row['add_time']) || undefined, views: number(row['visit']) } : null;
};
const list = (value: unknown): readonly Article[] => { const data = unwrap(value); return (Array.isArray(data) ? data : []).flatMap((item: unknown) => { const parsed = article(item); return parsed ? [parsed] : []; }); };

export async function getArticleCategories(): Promise<readonly ArticleCategory[]> { const payload = await request<{ data?: unknown }>('/article/category/list', { method: 'GET' }); return (Array.isArray(payload.data) ? payload.data : []).flatMap((item) => { if (!item || typeof item !== 'object') return []; const row = item as Record<string, unknown>; return [{ id: number(row['id']), title: text(row['title']), children: [] } satisfies ArticleCategory]; }); }
export async function getArticleBanners(): Promise<readonly Article[]> { return list(await request('/article/banner/list', { method: 'GET' })); }
export async function getArticles(categoryId = 0, page = 1, limit = 8): Promise<readonly Article[]> { return list(await request(`/article/list/${categoryId}?page=${page}&limit=${limit}`, { method: 'GET' })); }
export async function getArticle(id: number): Promise<Article> { const parsed = article(unwrap(await request(`/article/details/${id}`, { method: 'GET' }))); if (!parsed) throw new Error('资讯不存在'); return parsed; }

/** Remove executable markup before passing content to RichText. */
export function sanitizeRichText(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?(script|style|iframe|object|embed|form|base|meta|link)[^>]*>/gi, '')
    .replace(/\s(on\w+|style|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, name: string, double: string | undefined, single: string | undefined, bare: string | undefined) => {
      const value = double ?? single ?? bare ?? '';
      return /^(?:https?:|微信外部链接|\/)/i.test(value) ? ` ${name}="${value.replace(/["<>]/g, '')}"` : '';
    });
}

export function extractVideoUrl(html: string): string | undefined {
  const match = html.match(/<video[^>]+(?:src|data-src)=["']([^"']+)["']/i) ?? html.match(/<source[^>]+src=["']([^"']+)["']/i);
  const value = match?.[1];
  return value && /^(?:https?:|\/)/i.test(value) ? value : undefined;
}

const message = (value: unknown): Message | null => { if (!value || typeof value !== 'object') return null; const row = value as Record<string, unknown>; const id = number(row['id']); const title = text(row['title']) || '系统消息'; return id > 0 ? { id, title, content: text(row['content']), read: Boolean(row['look']), createdAt: text(row['add_time']) || undefined, type: number(row['type']) } : null; };
export async function getMessages(page = 1): Promise<readonly Message[]> { const payload = await request(`/user/message_system/list?page=${page}&limit=20`, { method: 'GET' }); const data = unwrap(payload); return (Array.isArray(data) ? data : []).flatMap((item: unknown) => { const parsed = message(item); return parsed ? [parsed] : []; }); }
export async function markMessageRead(id: number): Promise<void> { await request('/user/message_system/edit_message', { method: 'GET', data: { id, key: 'look', value: 1 } }); }
export async function markAllMessagesRead(): Promise<void> { await request('/user/message_system/edit_message', { method: 'GET', data: { id: 0, key: 'look', value: 1, all: 1 } }); }
export async function getChatMessages(params: Readonly<{ toUid?: number; page?: number; limit?: number }>): Promise<readonly ChatMessage[]> { const payload = await request(`/v2/user/service/record?page=${params.page ?? 1}&limit=${params.limit ?? 20}&toUid=${params.toUid ?? 0}`, { method: 'GET' }); const data = unwrap(payload); const rows = data && typeof data === 'object' && 'serviceList' in data && Array.isArray(data.serviceList) ? data.serviceList : Array.isArray(data) ? data : []; return rows.flatMap((item) => { if (!item || typeof item !== 'object') return []; const row = item as Record<string, unknown>; const kind = number(row['msn_type'] ?? row['message_type']); return [{ id: number(row['id']), text: text(row['msn'] ?? row['message']), type: kind === 3 ? 'image' : kind === 5 ? 'product' : kind === 6 ? 'order' : 'text', mine: Boolean(row['is_send'] ?? (row['uid'] && row['uid'] === row['my_uid'])), createdAt: text(row['add_time']) } satisfies ChatMessage]; }); }
export async function sendChatMessage(_textValue: string, _toUid: number): Promise<void> { throw new ApiError('BUSINESS', '当前客服通道仅支持查看记录，请使用在线客服端发送消息'); }
export type ContentApiError = ApiError;
