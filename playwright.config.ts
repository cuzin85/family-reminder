import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.WEB_DEV_BASE_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./web-tests",
  outputDir: "./tmp/playwright-results",
  reporter: [["html", { outputFolder: "./tmp/playwright-report", open: "never" }], ["list"]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: "tablet",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 }
      }
    },
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1366, height: 768 }
      }
    }
  ]
});
