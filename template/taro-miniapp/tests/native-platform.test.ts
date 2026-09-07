import { afterEach, expect, it, vi } from 'vitest';
vi.hoisted(() => { vi.stubGlobal('ENABLE_CONTAINS', false); vi.stubGlobal('ENABLE_MUTATION_OBSERVER', false); vi.stubGlobal('ENABLE_INNER_HTML', false); vi.stubGlobal('ENABLE_ADJACENT_HTML', false); vi.stubGlobal('ENABLE_CLONE_NODE', false); vi.stubGlobal('ENABLE_SIZE_APIS', false); vi.stubGlobal('ENABLE_TEMPLATE_CONTENT', false); });
import { URLSearchParams as MiniURLSearchParams } from '@tarojs/runtime';
import { parseDeepLink, parseStoredReferral } from '../src/services/platform';

afterEach(() => vi.unstubAllGlobals());
it('parses encoded string queries using the installed non-iterable mini-program URL implementation', () => {
  // Given
  vi.stubGlobal('URLSearchParams', MiniURLSearchParams);
  const query = new MiniURLSearchParams('spread=42');
  expect(Symbol.iterator in query).toBe(false);
  // When
  const result = parseDeepLink({ query: encodeURIComponent('spread=7&spread=42&agent_id=8&token=discard'), scene: 'spid=9' });
  // Then
  expect(result).toEqual({ spread: '42', agent_id: '8', spid: '9' });
});
it('retains object-launch and persisted QR referral semantics with the mini-program implementation', () => {
  // Given
  vi.stubGlobal('URLSearchParams', MiniURLSearchParams);
  // When / Then
  expect(parseDeepLink({ scene: 1047, query: { scene: '321', spread: '42' } })).toEqual({ spread: '42', code: '321' });
  expect(parseStoredReferral({ spread: '42', code: '321', token: 'discard' })).toEqual({ spread: '42', code: '321' });
});
