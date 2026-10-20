import { defineConfig } from 'vite';
export default defineConfig({
  base: '/carrying-capacity/',
  build: { chunkSizeWarningLimit: 900, rollupOptions: { input: { main: 'index.html', teacher: 'teacher.html', stylelab: 'stylelab.html' } } },
});
