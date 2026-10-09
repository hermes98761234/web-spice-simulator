import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the build works from any sub-path (GitHub Pages).
  base: './',
  // The ngspice WASM runs single-threaded in a plain module worker: no COOP/COEP headers needed.
  worker: { format: 'es' },
  test: {
    // Engine tests boot the real ngspice WASM.
    testTimeout: 120000,
  },
})
