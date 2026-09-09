import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ command, mode }) => ({
  base: command === "build" || mode === "production" ? "/tag-me/" : "./",
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifestFilename: "manifest.json",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
      ],
      manifest: {
        name: "Recall Garden",
        short_name: "Recall Garden",
        description:
          "Play Recall Garden: match numbers from one, two, or three turns ago. Your practice stays in this browser.",
        display: "standalone",
        background_color: "#fafbf7",
        theme_color: "#244d3c",
        lang: "en",
        orientation: "any",
        categories: ["games", "education"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: { include: ["tests/**/*.test.ts"] },
}));
