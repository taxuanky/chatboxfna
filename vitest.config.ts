import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Mọi test chạy OFFLINE: không cần mạng, không cần API key.
    env: {
      LLM_PROVIDER: 'mock',
      EMBEDDING_PROVIDER: 'mock',
    },
  },
});
