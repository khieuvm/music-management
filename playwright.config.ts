import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    // A production build avoids flaky first-request compiles of the dev server.
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: !process.env.CI,
    env: { APP_URL: "http://127.0.0.1:3100", TRUST_PROXY: "true" },
    timeout: 300000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 360, height: 800 } } },
  ],
});
