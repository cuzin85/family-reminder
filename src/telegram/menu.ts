import { getAppLabels, type AppLabels } from "../i18n";
import type { InlineKeyboardMarkup } from "./types";

export function buildMainMenuKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.menu.myTasks, callback_data: "tasks:mine" }],
      [{ text: labels.telegram.menu.familyTasks, callback_data: "tasks:family" }],
      [{ text: labels.telegram.menu.createTask, callback_data: "task:create" }]
    ]
  };
}

export function buildAdminMainMenuKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.menu.myTasks, callback_data: "tasks:mine" }],
      [{ text: labels.telegram.menu.familyTasks, callback_data: "tasks:family" }],
      [{ text: labels.telegram.menu.users, callback_data: "admin:users" }],
      [{ text: labels.telegram.menu.createTask, callback_data: "task:create" }]
    ]
  };
}

const DEFAULT_LABELS = getAppLabels("ru");

export const MAIN_MENU_KEYBOARD: InlineKeyboardMarkup = buildMainMenuKeyboard(DEFAULT_LABELS);
export const ADMIN_MAIN_MENU_KEYBOARD: InlineKeyboardMarkup = buildAdminMainMenuKeyboard(DEFAULT_LABELS);
