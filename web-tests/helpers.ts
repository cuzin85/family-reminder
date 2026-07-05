import { expect, type Page } from "@playwright/test";

const authToken = process.env.WEB_DEV_AUTH_TOKEN;

export async function loginAs(page: Page, role: "admin" | "user") {
  if (!authToken) {
    throw new Error("WEB_DEV_AUTH_TOKEN is required for web UI checks.");
  }

  const response = await page.request.get(`/auth/dev?role=${role}`, {
    headers: {
      "x-dev-auth-token": authToken
    },
    maxRedirects: 0
  });

  expect(response.status()).toBe(302);
  await page.goto("/app");
  await expect(page.getByText("Family Reminder")).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page) {
  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

  expect(hasHorizontalScroll).toBe(false);
}
