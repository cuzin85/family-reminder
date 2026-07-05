import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, loginAs } from "./helpers";

async function waitForVisibleLoadingToFinish(page: Page) {
  await expect(page.getByText(/^Загрузка/)).toHaveCount(0, { timeout: 10000 });
}

async function saveScreenshot(page: Page, projectName: string, name: string, options: { fullPage?: boolean } = {}) {
  const path = join("tmp", "playwright-screenshots", projectName, `${name}.png`);

  mkdirSync(dirname(path), { recursive: true });
  await waitForVisibleLoadingToFinish(page);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ fullPage: options.fullPage ?? true, path });
}

test.describe("web UI screenshots", () => {
  test("captures admin screens", async ({ page }, testInfo) => {
    await loginAs(page, "admin");
    await saveScreenshot(page, testInfo.project.name, "admin-01-my-tasks");

    await page.getByRole("tab", { name: "Все семейные", exact: true }).click();
    await saveScreenshot(page, testInfo.project.name, "admin-02-family-tasks");

    await page.getByRole("tab", { name: "История", exact: true }).click();
    await expect(page.getByLabel("Фильтр статуса истории")).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "admin-03-history");

    await page.getByRole("tab", { name: "Пользователи", exact: true }).click();
    await expect(page.getByText("Telegram ID нового пользователя")).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "admin-04-users");

    await page.getByRole("tab", { name: "Задачи", exact: true }).click();
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Создать задачу" })).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "admin-05-create-task-modal", { fullPage: false });
  });

  test("captures regular user screens", async ({ page }, testInfo) => {
    await loginAs(page, "user");
    await saveScreenshot(page, testInfo.project.name, "user-01-my-tasks");

    await page.getByRole("tab", { name: "Все семейные", exact: true }).click();
    await saveScreenshot(page, testInfo.project.name, "user-02-family-tasks");

    await page.getByRole("tab", { name: "История", exact: true }).click();
    await expect(page.getByRole("button", { name: "Обновить историю" })).toBeVisible();
    await saveScreenshot(page, testInfo.project.name, "user-03-history");
  });
});
