# Deploy Habvion to Vercel

This project deploys the Vite client and an Express API together. This guide does
not create a Vercel project, deploy the site, or provision a database for you.

## Before using database credentials

Rotate any database password previously shared in chat in Atlas **Database Access**.
Do not paste the new password, connection string, or `.env` contents into chat.
For local normal mode, save the rotated URI privately as `MONGODB_URI` in
`server/.env`, then run `npm run dev`. `npm run dev:mock` deliberately uses local
mock data, not MongoDB.

For Vercel, add the rotated URI directly in the dashboard. Local `.env` files are
excluded from deployment uploads. Use a URI with a database name (for example
`/habvion` before the query string), percent-encode special characters in its
password, and give the database user only the permissions the app needs. Configure
Atlas connectivity for your hosting environment; do not casually expose the
cluster to every IP address.

## 1. Complete the existing production launch requirements

Fill `legalName`, `address`, `email`, and `grievanceOfficer` in
`shared/src/legal/business.ts` with real, reviewed public business details. They
are currently unset. The existing guard intentionally blocks the production API
until these are complete. Do not remove the guard or use invented details.

## 2. Vercel project settings

Import/upload **the whole `homebuilder-ai-fresh` directory**, not just `client`.
Use these settings; `vercel.json` already supplies the framework/build values:

| Setting | Value |
| --- | --- |
| Root directory | Project root (leave blank / `.`) |
| Framework preset | Vite |
| Node.js | 24.x (`package.json` pins the supported major) |
| Install command | `MONGOMS_DISABLE_POSTINSTALL=1 npm ci --legacy-peer-deps --include=dev` |
| Build command | `npm run build:vercel` |
| Output directory | `client/dist` |

The API is `api/index.mjs`, not `server/src/index.ts`. The local entry point calls
`listen()` and starts timers; it must not run inside a serverless function.
`scripts/build-vercel.mjs` resolves the backend's `@shared/*` TypeScript aliases
into `.generated/vercel-handler.mjs`. The `vercel-build` script also builds that
artifact before Vercel traces the function. Do not commit generated outputs.

## 3. Add environment variables privately

Use the root `.env.example` as a template. Enter real values in **Vercel Project
Settings → Environment Variables**, for each intended environment, then redeploy.
Never add private values to `vercel.json` or a `VITE_*` variable (those are public).

| Variable | Required / purpose |
| --- | --- |
| `MONGODB_URI` | Required. MongoDB stores accounts, saved designs and enquiries. The adapter refuses disk-backed fallbacks. Use the newly rotated credential. |
| `SESSION_SECRET` | Required. At least 32 unpredictable characters. Generate privately with `openssl rand -base64 48`. |
| `CORS_ORIGIN` | Required. Exact HTTPS origin(s), comma-separated, no paths/trailing slash. Include your production domain and only trusted preview origins when needed. |
| `NODEJS_HELPERS` | Set to `0` in Production and Preview so Express owns JSON body parsing. |
| `CRON_SECRET` | At least 32 random characters for the daily retention job. Without it, cleanup returns 503 and does not erase anything. Generate a separate secret with `openssl rand -hex 32`. |
| `AI_PROVIDER` | Use `mock` for a keyless planning demo; use `gemini` for real AI and set `GOOGLE_API_KEY`. |
| `GOOGLE_API_KEY` | Required only with `AI_PROVIDER=gemini`. |
| `GOOGLE_CLIENT_ID` | Optional. To enable Google sign-in, also configure the exact HTTPS JavaScript origins in Google Cloud. |
| `CONTACT_FORWARDING_ENABLED` | Leave `false` until the third-party processing/retention arrangements are reviewed. |
| `CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_SECRET` | Required if forwarding is enabled. See `CONTACT-GOOGLE-SHEETS.md`; keep both private. |

A build does not require real database credentials. Missing/invalid runtime
configuration returns a JSON 503 and safe diagnostic instructions in function
logs; it must not expose secrets. A successfully deployed frontend is **not** proof
that the API or production business requirements are ready.

## Supported features and deliberate limitation

- Accounts, saved designs, share links and enquiries use MongoDB. Existing local
  JSON records are **not** automatically migrated or uploaded.
- The API and frontend share `/api`, so no public backend URL or client secret is
  needed. Deep links such as `/privacy`, `/login` and `/demos/garden-bungalow`
  fall back to the SPA; API routes return JSON instead of the SPA.
- Built-in furniture, public static models and 2D/3D previews continue to work.
- **Photo-to-3D generation and private generated model downloads are disabled on
  Vercel.** Current job state is in memory and files/ownership are on local disk.
  `/tmp` cannot make them durable. The adapter returns a clear 503 and the import
  dialog explains the limitation rather than offering a broken generation option.
  Do not advertise this feature until durable object storage, persistent jobs,
  authorisation and deletion have been implemented. Local generated-model links
  will not work in this deployment.
- Contact forwarding uses `waitUntil` so Vercel can finish delivery after the
  response. It is best-effort, not a durable queue; monitor failures and review
  external Google Sheets/email copies separately.
- `/api/retention` is scheduled daily in UTC for **production deployments**. It
  requires Vercel's `Authorization: Bearer <CRON_SECRET>` header, accepts GET only,
  and deletes only explicitly expired enquiries. Legacy records without expiry
  are preserved for operator review. Monitor job success; scheduler timing and
  retries are not a guaranteed deletion deadline. Preview deployments do not run
  this production cron.
- Existing rate limiting is per function instance, not distributed. Configure
  appropriate platform abuse protection/distributed limits before a public launch.
  Review function duration, database connection and usage limits for your plan.

`.vercelignore` excludes environment files, `server/data`, screenshots/artifacts,
private integration files and installed/generated outputs from the upload. Keep
`.gitignore` protections as well; do not upload local databases manually.

## 4. Validate without deploying or using real credentials

```sh
npm run build:vercel
npm run test:vercel
```

The tests use isolated temporary fixtures, disable contact delivery and do not
connect to Atlas. They check routing, production guards, JSON validation, auth
cookies, account export/deletion, disabled mesh endpoints and authenticated
retention. They do not replace an actual Vercel preview smoke test.

After you deliberately deploy, check:

1. `/` and a directly refreshed deep link such as `/privacy` render correctly.
2. `/api/health` responds with JSON, and `/api/auth/config` reports
   `meshProvider: "disabled-vercel"`. A 503 means configuration/business setup is
   still incomplete; check private function logs.
3. A test account can sign in and save a design; it is still present after a new
   deployment. Do not use a real customer account for verification.
4. A built-in demo opens in 2D/3D and `/models/...` files load normally.
5. An unauthorised GET to `/api/retention` returns 401. Confirm successful
   authorised execution in the cron dashboard without sharing its Bearer token.
6. Only send a real contact test deliberately: enabling forwarding can write to
   Google Sheets/email. Never run fixtures against the real integration.
