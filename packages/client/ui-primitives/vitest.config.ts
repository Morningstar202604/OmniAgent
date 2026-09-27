import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Node-environment unit specs for this package. They render the Markdown tree
 * through `react-dom/server`, so no browser/DOM (jsdom/happy-dom) is needed.
 * Workspace `@deepseek-ai/*` imports resolve through the repo tsconfig paths.
 */
export default defineConfig({
  root,
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.client.spec.{ts,tsx}'],
  },
})
