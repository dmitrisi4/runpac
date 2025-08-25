import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // The official Vite plugin for React projects.
    // It provides features like Fast Refresh (HMR) and automatic JSX transformation.
    react(),

    // Vite plugin to transform the application into a Progressive Web App (PWA).
    VitePWA({
      // 'autoUpdate' will automatically update the service worker whenever a new version is available.
      registerType: 'autoUpdate',

      // Injects the service worker registration script into the HTML.
      injectRegister: 'auto',

      // Configuration for the service worker, powered by Workbox.
      workbox: {
        // Defines the files to be precached by the service worker.
        // This includes all essential static assets like JS, CSS, HTML, and images.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },

      // The Web App Manifest configuration.
      // This metadata is used when the PWA is installed on a user's device.
      manifest: {
        name: 'RunTracker - Track Your Runs',
        short_name: 'RunTracker',
        description: 'A PWA to track your runs and capture territory on the map.',
        theme_color: '#4F46E5',
        background_color: '#4F46E5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'apple-touch-icon.svg',
            sizes: '180x180',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'vite.svg',
            sizes: '32x32',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        categories: ['health', 'fitness', 'sports'],
        lang: 'en',
        dir: 'ltr'
      }
    })
  ],
})
