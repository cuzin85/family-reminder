import type { TelegramChat, TelegramUpdate, TelegramUpdateContext, TelegramUser } from "./types";

function isTelegramUser(value: unknown): value is TelegramUser {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TelegramUser).id === "number"
  );
}

function isTelegramChat(value: unknown): value is TelegramChat {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TelegramChat).id === "number"
  );
}

export function getTelegramUpdateContext(update: TelegramUpdate): TelegramUpdateContext | null {
  if (update.message?.from && isTelegramUser(update.message.from) && isTelegramChat(update.message.chat)) {
    return {
      update,
      user: update.message.from,
      chat: update.message.chat
    };
  }

  if (
    update.edited_message?.from &&
    isTelegramUser(update.edited_message.from) &&
    isTelegramChat(update.edited_message.chat)
  ) {
    return {
      update,
      user: update.edited_message.from,
      chat: update.edited_message.chat
    };
  }

  if (update.callback_query?.from && isTelegramUser(update.callback_query.from)) {
    const messageChat = update.callback_query.message?.chat;

    if (isTelegramChat(messageChat)) {
      return {
        update,
        user: update.callback_query.from,
        chat: messageChat
      };
    }
  }

  return null;
}

export function getTelegramUpdateText(update: TelegramUpdate): string | null {
  return update.message?.text ?? null;
}

export function getTelegramCallbackData(update: TelegramUpdate): string | null {
  return update.callback_query?.data ?? null;
}
