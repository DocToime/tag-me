import { defineConfig } from "@playwright/test";
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
const port = new URL(origin).port || "5173";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  testIgnore: "pwa.spec.ts",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: origin,
    viewport: { width: 1366, height: 768 },
    screenshot: "only-on-failure",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: { args: ["--no-sandbox"] },
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: origin,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
