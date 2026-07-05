import type { Env } from "../env";
import type { InlineKeyboardMarkup } from "./types";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface SendMessageResult {
  message_id: number;
}

interface TelegramMessageOptions {
  parseMode?: "HTML";
}

async function callTelegramApi<T>(
  env: Env,
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !data.ok || !data.result) {
    throw new Error(data.description ?? `Telegram ${method} failed`);
  }

  return data.result;
}

export async function sendTelegramMessage(
  env: Env,
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
  options?: TelegramMessageOptions
): Promise<SendMessageResult> {
  return callTelegramApi<SendMessageResult>(env, "sendMessage", {
    chat_id: chatId,
    text,
    ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export async function editTelegramMessageText(
  env: Env,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
  options?: TelegramMessageOptions
): Promise<SendMessageResult | boolean> {
  return callTelegramApi<SendMessageResult | boolean>(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export async function deleteTelegramMessage(env: Env, chatId: number, messageId: number): Promise<boolean> {
  return callTelegramApi<boolean>(env, "deleteMessage", {
    chat_id: chatId,
    message_id: messageId
  });
}

export async function answerCallbackQuery(env: Env, callbackQueryId: string, text?: string): Promise<boolean> {
  return callTelegramApi<boolean>(env, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {})
  });
}
