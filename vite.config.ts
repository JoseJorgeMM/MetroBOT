import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'logo_chat.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'offline.html'],
        manifest: {
          name: 'MetroBot Medellin - Asistente SITVA',
          short_name: 'MetroBot',
          description: 'Asistente del SITVA para moverte por Medellin en Metro, Metrocable, Tranvia, Metroplus, EnCicla y buses integrados.',
          lang: 'es-CO',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait',
          background_color: '#F8FAFC',
          theme_color: '#00994C',
          categories: ['travel', 'navigation', 'utilities'],
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: '/offline.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/sw\.js$/, /^\/workbox-/],
          globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,ico}'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'metrobot-html',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: ({ request }) => ['script', 'style', 'font', 'image'].includes(request.destination),
              handler: 'CacheFirst',
              options: {
                cacheName: 'metrobot-static',
                expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\/rutas_integradas\.json$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'metrobot-routes',
                expiration: { maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\/Estaciones_.*\.csv$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'metrobot-stations',
                expiration: { maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\/tarifas_.*\.csv$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'metrobot-tariffs',
                expiration: { maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\/tiempos_.*\.csv$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'metrobot-times',
                expiration: { maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\/manifest_integradas\/manifest\.json$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'metrobot-route-manifest',
                expiration: { maxEntries: 2, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: ({ url }) => /tiles\.openstreetmap\.org|tiles\.basemaps\.cartocdn\.com|router\.project-osrm\.org|routing\.openstreetmap\.de/.test(url.hostname),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) => /generativelanguage\.googleapis\.com|googleapis\.com\/v1beta/.test(url.hostname),
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: '/offline.html',
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEYS': JSON.stringify(env.GEMINI_API_KEYS),
      'process.env.VITE_MAPBOX_ACCESS_TOKEN': JSON.stringify(env.VITE_MAPBOX_ACCESS_TOKEN || env.MAPBOX_ACCESS_TOKEN),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
