import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import b8fComponentTagger from './vite-plugins/b8f-component-tagger';

export default defineConfig({
  plugins: [
    b8fComponentTagger(),
    react(),
  ],
  build: {
    target: 'esnext', // Support top-level await
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '5201'),
    open: false,
    strictPort: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.byteflow.bot',
      '.e2b.app',        // E2B production domain
      '.e2b.dev',        // E2B development domain
      '.e2b-staging.com', // E2B staging domain
    ],
    hmr: {
      // E2B serves via HTTPS proxy — HMR WebSocket must use port 443
      // and the host is auto-detected from the browser's page URL
      clientPort: 443,
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});
