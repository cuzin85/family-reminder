# Public Release Plan

This branch is intended to become a public, reusable version of the project.

The public repository should contain the application source code, database migrations, safe configuration templates, and setup documentation. It should not contain private project history, personal environment notes, production Cloudflare identifiers, screenshots, or agent workflow notes.

## Goal

Prepare a clean public version that another person can deploy to their own Cloudflare account and Telegram bot:

1. Create a Cloudflare account.
2. Create a Telegram bot with BotFather.
3. Create Cloudflare D1 databases.
4. Configure Worker secrets and environment values.
5. Apply D1 migrations.
6. Deploy the Telegram Worker and web Worker.
7. Set the Telegram webhook and Telegram Login domain.
8. Use the app without access to the original private production setup.

## Publication Strategy

Do not make the original private repository public.

This branch is only a preparation workspace. The final public release should be exported into a new GitHub repository with a clean history.

Recommended final flow:

1. Finish this public release branch.
2. Verify that the working tree contains no private files, IDs, screenshots, secrets, local paths, or original production-only notes.
3. Create a new empty public GitHub repository.
4. Copy or export the prepared branch contents into that repository without the old private Git history.
5. Create the first public commit there, for example `Initial public release`.
6. Publish that new repository.

Reason: deleting private files from this branch does not remove them from the original repository history. A clean public repository avoids exposing old screenshots, personal environment notes, private project history, and production-specific configuration that existed in earlier commits.

## Keep

- Application source code in `src/` and `web/`.
- D1 migrations in `migrations/`.
- Test data that does not contain real user data.
- Package manifests: `package.json`, `package-lock.json`.
- TypeScript, Vite, optional Playwright checks, and devcontainer config if they are generic.
- `.env.example`, after expanding it into a complete safe template.
- `.gitignore`.
- A public `README.md` focused on setup, deploy, usage, troubleshooting, privacy, and limits.
- A public Cloudflare config template, without real production IDs.

## Remove From Public Version

- `TASKS.md`.
- `WEB_TASKS.md`.
- `AGENTS.md`.
- `docs/`.
- `images/`.
- Private project notes and historical decisions that are only useful for this specific development process.
- References to the original owner, local machine, repository paths, private workflow, and screenshots.

## Replace With Templates

- `wrangler.jsonc` must not contain real production `database_id` values or original Worker names.
- Original deployment URLs must be replaced with placeholders.
- Original Telegram bot username must be replaced with a placeholder.
- Original Telegram user IDs must be replaced with examples only.
- Original Cloudflare account details must not appear anywhere.
- Timezone should be documented as configurable; examples can use `Europe/Kyiv`.

## Documentation Split

Public docs should explain how to run a new independent deployment.

Private notes should not be preserved in the public branch. If something is useful only for the original production instance, remove it from this branch instead of trying to generalize it.

Suggested public docs:

- `README.md` - overview, features, setup, deploy, usage.
- `RUNBOOK.md` - generic operations: deploy, migrations, backup, recovery, troubleshooting.
- `ARCHITECTURE.md` - generic architecture and service responsibilities.
- `DATA_MODEL.md` - database model.
- `DOMAIN.md` - task/reminder domain logic.
- `WEB_ARCHITECTURE.md` - web UI architecture if it remains generic.
- `SECURITY.md` - secrets, auth model, Telegram Login, privacy notes.
- `PRIVACY.md` - what data is stored and where.

## Config Plan

Create or keep safe templates:

- `.env.example` for local and CI environment variables.
- `wrangler.example.jsonc` or template sections in `README.md`.

Decide whether public `wrangler.jsonc` should be:

1. A generic template that must be edited before deploy.
2. Replaced by `wrangler.example.jsonc`, with `wrangler.jsonc` ignored.

Preferred direction: keep a generic `wrangler.jsonc` that is deployable after the user fills placeholders or follows documented `wrangler d1 create` output.

## Setup Documentation Must Cover

- Required Node.js version.
- `npm install`.
- Cloudflare login or API token.
- D1 database creation.
- How to put D1 `database_id` into config.
- Remote D1 migrations.
- Telegram bot creation.
- Telegram bot token secret.
- Webhook secret generation.
- Bootstrap admin Telegram ID.
- Web session secret generation.
- Telegram Login domain setup in BotFather.
- Deploy Telegram Worker.
- Deploy web Worker.
- Set Telegram webhook.
- First `/start`.
- Adding family users from the admin UI.

## Safety Checklist

Before making the repository public:

- [ ] No real bot tokens.
- [ ] No real API tokens.
- [ ] No real Cloudflare account IDs.
- [ ] No original D1 database IDs.
- [ ] No personal Telegram user IDs.
- [ ] No private screenshots.
- [ ] No local machine hardware details.
- [ ] No `.local/`, `.tools/`, `.wrangler/`, `.env`, D1 dumps, logs, or auth files.
- [ ] No original production-only URLs in setup examples unless clearly marked as examples.
- [ ] Fresh clone setup path has been reviewed from the public docs.

## Work Plan

- [x] Remove private-only files from this branch.
- [x] Replace production Cloudflare config with public-safe config/template.
- [x] Rewrite `README.md` as public setup documentation.
- [x] Rewrite `RUNBOOK.md` as generic operations documentation.
- [x] Clean domain and data model docs from private references.
- [x] Rewrite architecture docs for public release.
- [x] Expand `.env.example`.
- [x] Add `SECURITY.md`.
- [x] Add `PRIVACY.md`.
- [x] Review `.gitignore`.
- [x] Run source search for private values.
- [x] Run `npm run typecheck`.
- [x] Run `npm run web:build`.
