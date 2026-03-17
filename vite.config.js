import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/z': {
        target: 'https://api.z.ai/api/paas/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/z/, ''),
        headers: {
          'Authorization': 'Bearer 9b78f6cf4691429a9bbbecdc835e8701.3PKM3gb7SxlTOvVw'
        }
      }
    }
  }
});
