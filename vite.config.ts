import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
        name: 'Run Tracker & Territory Capture',
        short_name: 'RunTracker',
        description: 'A PWA to track your runs and capture territory on the map.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any' // 'any' is a good default for SVGs that can scale.
          },
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ],
})
