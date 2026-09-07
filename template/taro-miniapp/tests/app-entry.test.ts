import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('selects the lifecycle-enabled application when Taro resolves its entry', () => {
  // Given: use the same installed resolver as the Taro CLI.
  const projectRequire = createRequire(import.meta.url);
  const cliRequire = createRequire(projectRequire.resolve('@tarojs/cli'));
  const { resolveScriptPath }: { readonly resolveScriptPath: (path: string) => string } = cliRequire('@tarojs/helper');
  const entry = fileURLToPath(new URL('../src/app', import.meta.url));
  // When
  const resolved = resolveScriptPath(entry);
  // Then
  expect(resolved).toBe(`${entry}.tsx`);
});
