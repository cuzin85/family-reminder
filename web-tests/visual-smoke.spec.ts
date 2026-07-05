import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, loginAs } from "./helpers";

async function checkCommonLayout(page: Page) {
  await expect(page.getByRole("tab", { name: "Задачи", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "История", exact: true })).toBeVisible();
  await expect(page.getByLabel("Текущий пользователь")).toBeVisible();
  await expectNoHorizontalScroll(page);
}

test.describe("admin web UI", () => {
  test("shows main sections and sticky toolbars", async ({ page }) => {
    await loginAs(page, "admin");
    await checkCommonLayout(page);

    await expect(page.getByRole("tab", { name: "Пользователи", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Мои задачи", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Все семейные", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "История", exact: true }).click();
    await expect(page.getByLabel("Фильтр статуса истории")).toBeVisible();
    await page.getByRole("tab", { name: "Пользователи", exact: true }).click();
    await expect(page.getByLabel("Текущий пользователь")).toBeVisible();
    await expect(page.getByText("Telegram ID нового пользователя")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("opens create task modal with assignee bulk toggle", async ({ page }) => {
    await loginAs(page, "admin");
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Создать задачу" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Выбрать всех|Снять всех/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("regular user web UI", () => {
  test("does not show user administration", async ({ page }) => {
    await loginAs(page, "user");
    await checkCommonLayout(page);

    await expect(page.getByRole("tab", { name: "Пользователи", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "История", exact: true }).click();
    await expect(page.getByRole("button", { name: "Обновить историю" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
