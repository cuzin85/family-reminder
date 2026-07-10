# Web Architecture

This document describes the web interface architecture for Family Reminder.

## Purpose

Telegram remains the main notification channel. The web app exists for workflows that are awkward in Telegram:

- creating and editing complex tasks;
- creating and managing annual events;
- reviewing task history;
- filtering and paginating history;
- managing users;
- reviewing audit logs;
- exporting data;
- running maintenance actions.

## Runtime Architecture

The web app is served by a dedicated Cloudflare Worker environment.

```text
Browser
  |
React SPA
  |
fetch('/api/...')
  |
Cloudflare Worker: web Worker
  |
Cloudflare D1
```

The web Worker serves:

- static frontend assets;
- Telegram Login routes;
- logout;
- JSON API;
- health endpoint.

The web Worker should not run reminder Cron jobs.

## Frontend Stack

- React
- Vite
- TypeScript
- plain CSS
- small local component set
- `lucide-react` icons

The project intentionally does not require a CSS framework.

The UI is utilitarian and optimized for repeated household task management rather than marketing pages.

## Build

Build command:

```bash
npm run web:build
```

Vite outputs files into `dist/`.

Cloudflare Workers Static Assets serves `dist/`.

## Routing

The Worker should handle API/auth routes before static assets.

Routes that must run through Worker code:

- `/api/*`
- `/auth/*`
- `/logout`
- `/health`
- `/telegram/*`

All other web app routes can fall back to the SPA index.

## Authentication

The web app uses Telegram Login.

Flow:

1. User opens the web app.
2. User signs in through Telegram Login.
3. Worker verifies Telegram login signature.
4. Worker looks up the Telegram user ID in D1.
5. Worker allows access only for active users.
6. Worker creates a signed web session cookie.

Session cookie requirements:

- `HttpOnly`;
- `Secure`;
- `SameSite=Lax`;
- signed with `WEB_SESSION_SECRET`.

Admin permissions come from D1, not from the client.

## Authorization

The web API must enforce permissions server-side.

General rules:

- inactive users cannot use the app;
- ordinary users can manage tasks assigned to them;
- admins can manage users;
- admins can act on more tasks than ordinary users;
- admin-only endpoints must check `users.is_admin`.
- ordinary users can manage annual events when they are a recipient or the creator;
- admins can manage every active annual event;
- other active household users can view family events without modifying them.

The frontend can hide unavailable actions, but backend checks are authoritative.

## Shared Domain Logic

Telegram handlers and web API should call shared task/domain functions whenever possible.

The web layer should not reimplement separate task rules.

This keeps behavior consistent for:

- completing tasks;
- marking tasks missed;
- deleting tasks;
- editing recurrence;
- updating assignees;
- creating new task instances.

## Main Screens

### Tasks

The tasks screen contains:

- personal active/overdue tasks;
- family active/overdue tasks;
- task actions;
- create task flow;
- edit task modal.
- upcoming assigned annual events mixed into the personal timeline by date.

The family task list contains tasks only. The complete household event list is available in the Events screen.

### Events

The events screen contains:

- `My events` and `All events` tabs;
- annual event creation and editing modal;
- recipient selection;
- pagination in groups of ten cards;
- event year, next occurrence, and next notification details.

### History

The history screen contains:

- closed tasks;
- status filters;
- scope filters;
- pagination;
- task audit access.

### Settings

The settings screen contains admin-only sections:

- users;
- maintenance.

Users section:

- add or activate user by Telegram ID;
- deactivate ordinary users;
- list active/inactive users.

Maintenance section:

- portable JSON export;
- preview technical log cleanup;
- run confirmed technical log cleanup.

## Task Forms

The web UI supports:

- one-time task with due date and reminder time;
- one-time task with execution window;
- weekly task;
- monthly fixed-day task;
- monthly last-days task;
- monthly end-plus-start window task.

Annual-event forms support:

- title;
- month and day;
- optional original event year;
- notification time;
- one or more recipients.

Native browser date/time inputs are used for one-time task date selection.

## PWA Support

The project includes minimal installability support:

- `manifest.webmanifest`;
- favicon;
- app icons;
- `display: standalone`;
- `start_url: /`;
- `scope: /`.

There is no service worker in the current version. This avoids stale UI caching problems after deploy.

Web push notifications are not implemented.

The `web-dev` environment can use a dev-only `/auth/dev` flow when `WEB_DEV_AUTH_ENABLED=true` and `WEB_DEV_AUTH_TOKEN` is configured.

## Environments

Recommended environments:

- production bot Worker;
- production web Worker;
- optional web-dev Worker;
- production D1 database;
- optional dev D1 database.

The production web Worker and production bot Worker should share production D1.

The optional `web-dev` Worker should use a separate D1 database when testing write actions.

Do not attach production reminder Cron to a dev Worker.

## Deployment

Deploy web:

```bash
npm run deploy:web
```

Deploy optional web-dev:

```bash
npm run deploy:web-dev
```

Use bot deploy only when bot runtime, webhook, Cron, or shared bot code changes:

```bash
npm run deploy
```

## Performance and Limits

The web app is intended for small-household usage.

Use:

- pagination for history;
- limited result sets;
- indexed queries;
- server-side permission checks;
- compact JSON responses.

Avoid heavy reports or unbounded queries in one request.
