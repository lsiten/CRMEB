import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { setupFiles: ['./tests/tenant-fixture.ts'] } });
