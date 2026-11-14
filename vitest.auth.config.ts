import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/auth.integration.tsx'], fileParallelism: false, testTimeout: 15000, hookTimeout: 20000 } });
