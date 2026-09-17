import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The TensorFlow.js / body-pix chunks (lazy-loaded only when the Try-On
  // camera preview is opened, see bodySegmentation.ts) are inherently large;
  // raise the warning threshold rather than chase an unfixable warning.
  build: {
    chunkSizeWarningLimit: 800,
  },
})
