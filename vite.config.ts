import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    /* @react-pdf/renderer usa dependências CJS profundas (base64-js via
       unicode-properties/linebreak) que precisam ser pré-empacotadas
       explicitamente para o interop CJS→ESM funcionar no dev server. */
    include: ['@react-pdf/renderer', 'base64-js', 'unicode-properties', 'linebreak'],
  },
})
