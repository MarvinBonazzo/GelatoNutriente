import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative assets + HashRouter work at /GelatoNutriente/ and on custom domains.
  base: './',
  test: { environment: 'node', setupFiles: ['src/test-setup.ts'] },
})
