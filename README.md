# vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter with the explicit `--execution-profile portable` or `--execution-profile managed-linux` argument from the plugin's setup instructions. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Whenever reopening or moving a checkout, follow the plugin's instructions to run `configure-execution-profile.mjs --execution-profile <portable|managed-linux>` before project commands. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

On managed Linux, use `sites-preview start` only for requested browser QA. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## StudySync account configuration

StudySync uses Supabase Auth for email/password accounts. Passwords are handled by Supabase's password-auth service; StudySync does not store passwords or email addresses in D1. The assignments table stores only the authenticated Supabase user ID, so each planner is private to its account.

Set these runtime environment variables before publishing the account-enabled version:

- `SUPABASE_URL`: the project URL from Supabase Project Settings > API
- `SUPABASE_PUBLISHABLE_KEY`: the public `sb_publishable_...` key from the same page

The legacy `anon` key is also accepted as `SUPABASE_ANON_KEY`. Never use a Supabase service-role key in the browser or in these settings.

In Supabase Authentication > URL Configuration, add the StudySync site URL as an allowed redirect URL. Password reset links return to `/?reset=1`, and email confirmation links return to the site root.

## Canvas assignment import

StudySync can connect each user to their own Canvas account, load active classes, and import assignments from all classes or only the classes the user selects. Imported assignments are matched by their Canvas assignment ID, so syncing them again updates the existing planner item instead of creating a duplicate.

Canvas access tokens are sent to the Worker over HTTPS and encrypted with AES-GCM before they are stored in D1. The browser never receives the saved token. Set one separate 32-byte, base64-encoded encryption key as a Cloudflare secret before using the Canvas connection:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npx wrangler secret put CANVAS_TOKEN_ENCRYPTION_KEY --config dist/server/wrangler.json
```

Do not commit the generated key or a Canvas access token. Each user should connect their own Canvas account from the StudySync interface.

## Deploying to your own Cloudflare account

After downloading this project, open a terminal in the project folder and run:

```sh
npm install
npx wrangler login
npx wrangler d1 create studysync-db
```

Copy the `database_id` printed by the D1 command, then build with that ID:

```sh
npm run build:cloudflare -- studysync-db YOUR_DATABASE_ID
```

Apply the migrations to the new remote database:

```sh
npx wrangler d1 execute studysync-db --remote --file=drizzle/0000_past_magus.sql
npx wrangler d1 execute studysync-db --remote --file=drizzle/0001_dry_moira_mactaggert.sql
npx wrangler d1 execute studysync-db --remote --file=drizzle/0002_redundant_drax.sql
npx wrangler d1 execute studysync-db --remote --file=drizzle/0003_adorable_fenris.sql
npx wrangler d1 execute studysync-db --remote --file=drizzle/0004_flashy_korvac.sql
```

Store the Supabase settings in Cloudflare, entering each value when Wrangler prompts:

```sh
npx wrangler secret put SUPABASE_URL --config dist/server/wrangler.json
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config dist/server/wrangler.json
npx wrangler secret put CANVAS_TOKEN_ENCRYPTION_KEY --config dist/server/wrangler.json
npx wrangler secret put RESEND_API_KEY --config dist/server/wrangler.json
npx wrangler secret put REMINDER_CRON_SECRET --config dist/server/wrangler.json
```

Finally, deploy the Worker:

```sh
npx wrangler deploy --config dist/server/wrangler.json
```

Wrangler will print the public Worker URL. Add that URL as the Supabase Site URL and redirect URL before testing email confirmation or password reset.

## Email reminders

The Reminders tab stores each user's email preference, timing, and time zone in D1. The Cloudflare Worker runs the scheduled reminder job hourly and sends one Resend digest for matching assignments. The generated Cloudflare config includes the hourly Cron Trigger and the Worker wrapper that handles the scheduled event.

After deployment, use the Reminders tab's `Send test email` button to verify Resend delivery immediately. This test sends only to the signed-in account email and does not require an assignment or a scheduled reminder window.

Create the internal scheduler secret once and store it as a Worker secret. Keep it different from the Resend API key:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
npx wrangler secret put REMINDER_CRON_SECRET --config dist/server/wrangler.json
```

For beta testing, the default `onboarding@resend.dev` sender can deliver only to the email address associated with the Resend account. Verify a sending domain in Resend and set `RESEND_FROM_EMAIL` in the Worker environment before sending reminders to other users.

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
