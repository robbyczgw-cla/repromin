import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15_000,
  expect: { timeout: 1_500 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:7878",
    headless: true,
    actionTimeout: 2_000,
    navigationTimeout: 5_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npx tsx apps/server.ts",
    url: "http://127.0.0.1:7878/health",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
