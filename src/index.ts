import type { Env } from "./env";
import { handleDevAiTaskDraft } from "./ai/task-draft";
import { recalculateAnnualEventNotificationSchedule } from "./annual-events";
import { apiErrorResponse, jsonResponse, methodNotAllowedResponse, notFoundResponse, withApiErrorHandling } from "./http";
import { normalizeAppLocale } from "./i18n";
import { sendDueAnnualEventNotifications, sendDueTaskNotifications } from "./notifications";
import { generateMonthlyTaskInstances, generateWeeklyTaskInstances, markOverdueTasks } from "./tasks";
import { handleTelegramWebhook } from "./telegram/webhook";
import { getAuthenticatedWebUser, handleDevLogin, handleLogout, handleTelegramLoginCallback, type AuthenticatedWebUser } from "./web/auth";
import { handleCreateAnnualEvent, handleDeleteAnnualEvent, handleGetAnnualEvents, handleGetUpcomingAnnualEvents, handleUpdateAnnualEvent } from "./web/annual-events";
import { handleExportData } from "./web/export";
import { handleGetMaintenanceCleanupPreview, handleRunMaintenanceCleanup } from "./web/maintenance";
import {
  handleCompleteTask,
  handleCreateMonthlyTask,
  handleCreateOneTimeTask,
  handleCreateWeeklyTask,
  handleDeleteTask,
  handleGetFamilyTasks,
  handleGetMyTasks,
  handleGetTaskAudit,
  handleGetTaskHistory,
  handleGetTaskDeletePreview,
  handleMissTask,
  handleUpdateMonthlyTask,
  handleUpdateOneTimeTask,
  handleUpdateWeeklyTask
} from "./web/tasks";
import { handleAddUser, handleDeactivateUser, handleGetAssignees, handleGetUsers, handleUpdateCurrentUserTimezone } from "./web/users";

async function getRequiredWebUser(request: Request, env: Env): Promise<AuthenticatedWebUser | Response> {
  const user = await getAuthenticatedWebUser(request, env);

  return user ?? apiErrorResponse("unauthorized", 401);
}

function isResponse(value: AuthenticatedWebUser | Response): value is Response {
  return value instanceof Response;
}

async function runScheduledTasks(env: Env, now: string): Promise<void> {
  await recalculateAnnualEventNotificationSchedule(env, now);
  await markOverdueTasks(env, now);
  await sendDueTaskNotifications(env, now);
  await sendDueAnnualEventNotifications(env, now);
  await generateWeeklyTaskInstances(env, now);
  await generateMonthlyTaskInstances(env, now);
}

function isValidDevToken(request: Request, env: Env): boolean {
  const expectedToken = env.WEB_DEV_AUTH_TOKEN;

  if (!expectedToken) {
    return false;
  }

  return request.headers.get("x-dev-auth-token") === expectedToken;
}

async function handleApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/health") {
    return request.method === "GET"
      ? jsonResponse({
        ok: true,
        service: "family-reminder",
        scope: "api",
        timezone: env.APP_TIMEZONE
      })
      : methodNotAllowedResponse();
  }

  if (url.pathname === "/api/config") {
    return request.method === "GET"
      ? jsonResponse({
        ok: true,
        config: {
          appLocale: normalizeAppLocale(env.APP_LOCALE),
          telegramBotUsername: env.TELEGRAM_BOT_USERNAME
        }
      })
      : methodNotAllowedResponse();
  }

  if (url.pathname === "/api/dev/ai/task-draft") {
    return handleDevAiTaskDraft(request, env);
  }

  if (url.pathname === "/api/me") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : jsonResponse({ ok: true, user });
  }

  if (url.pathname === "/api/me/timezone") {
    if (request.method !== "PATCH") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleUpdateCurrentUserTimezone(request, env, user);
  }

  if (url.pathname === "/api/tasks/my") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleGetMyTasks(env, user);
  }

  if (url.pathname === "/api/tasks/family") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleGetFamilyTasks(env, user);
  }

  if (url.pathname === "/api/tasks/history") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const scope = url.searchParams.get("scope") === "my" ? "my" : "family";
    const limit = Number(url.searchParams.get("limit"));
    const offset = Number(url.searchParams.get("offset"));

    return handleGetTaskHistory(env, user, scope, { limit, offset });
  }

  if (url.pathname === "/api/users") {
    if (request.method !== "GET" && request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    return request.method === "GET"
      ? handleGetUsers(env, user)
      : handleAddUser(request, env, user);
  }

  const userDeactivateMatch = url.pathname.match(/^\/api\/users\/(\d+)\/deactivate$/);

  if (userDeactivateMatch) {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const userId = Number(userDeactivateMatch[1]);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return apiErrorResponse("invalid_user_id", 400);
    }

    return handleDeactivateUser(env, user, userId);
  }

  if (url.pathname === "/api/assignees") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleGetAssignees(env);
  }

  if (url.pathname === "/api/annual-events") {
    if (request.method !== "GET" && request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    return request.method === "GET"
      ? handleGetAnnualEvents(request, env, user)
      : handleCreateAnnualEvent(request, env, user);
  }

  if (url.pathname === "/api/annual-events/upcoming/my" || url.pathname === "/api/annual-events/upcoming/family") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    return handleGetUpcomingAnnualEvents(
      env,
      user,
      url.pathname.endsWith("/family") ? "family" : "my"
    );
  }

  const annualEventDeleteMatch = url.pathname.match(/^\/api\/annual-events\/(\d+)$/);

  if (annualEventDeleteMatch) {
    if (request.method !== "DELETE" && request.method !== "PATCH") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const annualEventId = Number(annualEventDeleteMatch[1]);

    if (!Number.isSafeInteger(annualEventId) || annualEventId <= 0) {
      return apiErrorResponse("invalid_annual_event", 400);
    }

    return request.method === "DELETE"
      ? handleDeleteAnnualEvent(env, user, annualEventId)
      : handleUpdateAnnualEvent(request, env, user, annualEventId);
  }

  if (url.pathname === "/api/admin/export") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleExportData(env, user);
  }

  if (url.pathname === "/api/admin/maintenance/cleanup-preview") {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleGetMaintenanceCleanupPreview(env, user);
  }

  if (url.pathname === "/api/admin/maintenance/cleanup") {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleRunMaintenanceCleanup(env, user);
  }

  if (url.pathname === "/api/tasks/one-time") {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleCreateOneTimeTask(request, env, user);
  }

  if (url.pathname === "/api/tasks/weekly") {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleCreateWeeklyTask(request, env, user);
  }

  if (url.pathname === "/api/tasks/monthly") {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    return isResponse(user) ? user : handleCreateMonthlyTask(request, env, user);
  }

  const oneTimeTaskUpdateMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/one-time$/);

  if (oneTimeTaskUpdateMatch) {
    if (request.method !== "PATCH") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const taskId = Number(oneTimeTaskUpdateMatch[1]);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return apiErrorResponse("invalid_task_id", 400);
    }

    return handleUpdateOneTimeTask(request, env, user, taskId);
  }

  const weeklyTaskUpdateMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/weekly$/);

  if (weeklyTaskUpdateMatch) {
    if (request.method !== "PATCH") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const taskId = Number(weeklyTaskUpdateMatch[1]);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return apiErrorResponse("invalid_task_id", 400);
    }

    return handleUpdateWeeklyTask(request, env, user, taskId);
  }

  const monthlyTaskUpdateMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/monthly$/);

  if (monthlyTaskUpdateMatch) {
    if (request.method !== "PATCH") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const taskId = Number(monthlyTaskUpdateMatch[1]);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return apiErrorResponse("invalid_task_id", 400);
    }

    return handleUpdateMonthlyTask(request, env, user, taskId);
  }

  const taskActionMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/(complete|miss)$/);

  if (taskActionMatch) {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const taskId = Number(taskActionMatch[1]);
    const action = taskActionMatch[2];

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return apiErrorResponse("invalid_task_id", 400);
    }

    return action === "complete"
      ? handleCompleteTask(env, user, taskId)
      : handleMissTask(env, user, taskId);
  }

  const taskAuditMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/audit$/);

  if (taskAuditMatch) {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const taskId = Number(taskAuditMatch[1]);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return apiErrorResponse("invalid_task_id", 400);
    }

    return handleGetTaskAudit(env, user, taskId);
  }

  const taskDeletePreviewMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/delete-preview$/);

  if (taskDeletePreviewMatch) {
    if (request.method !== "GET") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const taskId = Number(taskDeletePreviewMatch[1]);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return apiErrorResponse("invalid_task_id", 400);
    }

    return handleGetTaskDeletePreview(env, user, taskId);
  }

  const taskDeleteMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);

  if (taskDeleteMatch) {
    if (request.method !== "DELETE") {
      return methodNotAllowedResponse();
    }

    const user = await getRequiredWebUser(request, env);

    if (isResponse(user)) {
      return user;
    }

    const taskId = Number(taskDeleteMatch[1]);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return apiErrorResponse("invalid_task_id", 400);
    }

    return handleDeleteTask(env, user, taskId);
  }

  return notFoundResponse();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "family-reminder",
        timezone: env.APP_TIMEZONE
      });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleTelegramWebhook(request, env);
    }

    if (request.method === "GET" && url.pathname === "/auth/telegram/callback") {
      return handleTelegramLoginCallback(request, env);
    }

    if (request.method === "GET" && url.pathname === "/auth/dev") {
      return handleDevLogin(request, env);
    }

    if (request.method === "GET" && url.pathname === "/logout") {
      return handleLogout();
    }

    if (request.method === "POST" && url.pathname === "/__scheduled") {
      if (!isValidDevToken(request, env)) {
        return apiErrorResponse("forbidden", 403);
      }

      const now = new Date().toISOString();

      await runScheduledTasks(env, now);

      return jsonResponse({ ok: true, now });
    }

    if (url.pathname.startsWith("/api/")) {
      return withApiErrorHandling(() => handleApiRequest(request, env, url));
    }

    return notFoundResponse();
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runScheduledTasks(env, new Date().toISOString());
  }
};
