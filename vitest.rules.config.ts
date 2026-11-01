import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/firestore.rules.ts'], fileParallelism: false, testTimeout: 20000, hookTimeout: 30000 } });
