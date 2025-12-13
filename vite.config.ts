import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3021,
      strictPort: true,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      allowedHosts: [
        'localhost',
        'alethea.network',
      ],
      cors: {
        origin: [
          'http://localhost:3021',
          'http://localhost:3001',
          'https://alethea.network',
          'https://clinical-critics-assessed-dependence.trycloudflare.com',
        ],
      },
      proxy: {
        // Proxy all linera service requests
        '/chains': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
    ],
    define: {
      'import.meta.env.VITE_LINERA_RPC_ENDPOINT': JSON.stringify(env.VITE_LINERA_RPC_ENDPOINT),
      'import.meta.env.VITE_LINERA_APP_ID': JSON.stringify(env.VITE_LINERA_APP_ID),
      'import.meta.env.VITE_LINERA_CHAIN_ID': JSON.stringify(env.VITE_LINERA_CHAIN_ID)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    optimizeDeps: {
      exclude: ['@linera/client', '@linera/signer'],
    },
    build: {
      target: 'esnext',
    },
  };
});
