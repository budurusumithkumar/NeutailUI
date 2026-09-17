import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The TensorFlow.js / pose-detection chunks (lazy-loaded only when the
  // Try-On camera preview is opened, see poseTracking.ts) are inherently
  // large; raise the warning threshold rather than chase an unfixable warning.
  build: {
    chunkSizeWarningLimit: 800,
  },
  resolve: {
    alias: {
      // See src/shims/mediapipe-pose-stub.ts for why this is needed.
      '@mediapipe/pose': path.resolve(import.meta.dirname, 'src/shims/mediapipe-pose-stub.ts'),
    },
  },
})
