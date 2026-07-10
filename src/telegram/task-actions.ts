import type { AppLabels } from "../i18n";
import { buildAdminMainMenuKeyboard, buildMainMenuKeyboard } from "./menu";
import type { InlineKeyboardMarkup } from "./types";

export type TaskCloseAction = "done" | "miss";
export type TaskCloseSource = "card" | "notification";

export function buildTaskCloseConfirmKeyboard(
  taskId: number,
  action: TaskCloseAction,
  source: TaskCloseSource,
  labels: AppLabels
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: action === "done"
            ? labels.taskCloseConfirm.confirmComplete
            : labels.taskCloseConfirm.confirmMissed,
          callback_data: `task:close:confirm:${action}:${source}:${taskId}`
        }
      ],
      [
        {
          text: labels.telegram.buttons.cancel,
          callback_data: `task:close:cancel:${action}:${source}:${taskId}`
        }
      ]
    ]
  };
}

export function buildTaskNotificationKeyboard(
  taskId: number,
  status: "pending" | "overdue",
  isAdmin: boolean,
  labels: AppLabels
): InlineKeyboardMarkup {
  const closeButtons = [
    {
      text: labels.telegram.buttons.done,
      callback_data: `task:done:${taskId}`
    },
    ...(status === "overdue"
      ? [
          {
            text: labels.telegram.buttons.missed,
            callback_data: `task:miss:${taskId}`
          }
        ]
      : [])
  ];

  return {
    inline_keyboard: [
      closeButtons,
      [
        {
          text: labels.telegram.buttons.snoozeOneHour,
          callback_data: `task:snooze:${taskId}`
        }
      ],
      ...(isAdmin
        ? buildAdminMainMenuKeyboard(labels).inline_keyboard
        : buildMainMenuKeyboard(labels).inline_keyboard)
    ]
  };
}
