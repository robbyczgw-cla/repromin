import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures");

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15_000,
  expect: { timeout: 2_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:7878",
    headless: true,
    actionTimeout: 3_000,
    navigationTimeout: 5_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npx tsx apps/server.ts",
    cwd: fixtures,
    url: "http://127.0.0.1:7878/health",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
