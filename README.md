# Cinevault

Cinevault is a full-stack web streaming platform for movies and series. It combines a React subscriber experience, a protected administration area, a Node.js Backend-for-Frontend (BFF), PostgreSQL persistence, adaptive HLS video processing, private object storage support, email-based registration, community features, and Stripe subscriptions.

The project is currently suitable for local development and controlled demonstrations. Before serving paying customers, complete the items in [Production readiness](#production-readiness).

## Contents

- [Product capabilities](#product-capabilities)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [PostgreSQL setup](#postgresql-setup)
- [Environment variables](#environment-variables)
- [Development workflow](#development-workflow)
- [Authentication and registration](#authentication-and-registration)
- [Catalog administration](#catalog-administration)
- [Media pipeline](#media-pipeline)
- [Subscriptions and payments](#subscriptions-and-payments)
- [Testing and quality](#testing-and-quality)
- [Production build](#production-build)
- [API overview](#api-overview)
- [Security model](#security-model)
- [CI](#ci)
- [Production readiness](#production-readiness)
- [Troubleshooting](#troubleshooting)
- [Additional documentation](#additional-documentation)

## Product capabilities

### Subscriber experience

- Responsive catalog for movies and series.
- Editorial hero content, catalog rows, search, filters, and personal watchlist.
- Movie, season, and episode details.
- Custom responsive player with native MP4/WebM and HLS support through `hls.js`.
- Playback, seek, volume, buffering, speed, quality selection, captions control, Picture-in-Picture, and fullscreen controls.
- Keyboard shortcuts and double-click interaction.
- User profile with avatar upload or predefined emoji, biography, preferences, and subscription information.
- Notifications, reviews, likes, and replies.
- Portuguese, Spanish, and English interface support.

### Administration

- Role-protected administration area at `/admin`.
- Create and edit movies and series.
- Manage genres, seasons, and episodes.
- Upload thumbnail, hero, and episode artwork.
- Publish and archive titles.
- Upload separate trailer and main-content video files.
- Inspect transcoding status and delete completed media jobs.

### Platform services

- Access and rotating refresh-token authentication.
- Email invitation registration flow.
- PostgreSQL repositories with an in-memory development fallback.
- FFmpeg-based adaptive HLS transcoding.
- Local or S3-compatible private object storage.
- Time-limited signed streaming URLs.
- Stripe Checkout, signed webhooks, and Customer Portal integration.
- Shared TypeScript contracts between the frontend and backend.

## Technology stack

| Area | Technologies |
| --- | --- |
| Web client | React, TypeScript, Vite, CSS |
| Video playback | HTML5 Media APIs, `hls.js` |
| BFF/API | Node.js 20+, Express 5, TypeScript |
| Database | PostgreSQL |
| Media processing | FFmpeg, HLS |
| Object storage | Local filesystem or S3-compatible storage through AWS SDK |
| Authentication | JWT access tokens, opaque rotating refresh tokens, HttpOnly cookies |
| Email | Nodemailer and SMTP |
| Billing | Stripe Checkout, Stripe Webhooks, Stripe Customer Portal |
| Unit/integration tests | Jest, Testing Library, Vitest, Supertest |
| Browser tests | Playwright |
| CI | GitHub Actions |

## Architecture

```text
Browser
   |
   |  React UI and custom video player
   v
Vite development proxy / production reverse proxy
   |
   v
Express BFF (REST API)
   |-- Authentication and registration
   |-- Catalog and administration
   |-- Profiles, watchlist, reviews, and notifications
   |-- Stripe checkout and webhook handling
   |-- Signed media authorization and delivery
   |
   +--> PostgreSQL
   +--> SMTP provider
   +--> Stripe
   +--> FFmpeg transcoding
   +--> Local storage or private S3-compatible bucket
                              |
                              +--> Optional CDN
```

The browser communicates only with the BFF. Shared request and response contracts live in `packages/shared-types`. In development, Vite proxies `/api`, `/artwork`, `/media`, and `/stream` to the BFF on port `3000`.

## Repository structure

```text
.
|-- backend/                  Express BFF, domain services, repositories, and migrations
|   |-- migrations/           Ordered PostgreSQL migrations
|   |-- src/                  Backend source code
|   `-- storage/              Local uploads and generated media; ignored by Git
|-- frontend/                 React/Vite web application
|   |-- e2e/                  Playwright journeys
|   |-- public/               Static public assets
|   `-- src/                  Components, contexts, API calls, and styles
|-- packages/
|   `-- shared-types/         TypeScript API and domain contracts
|-- docs/                     Architecture, plans, and design baselines
|-- .github/workflows/        Continuous integration workflow
|-- package.json              npm workspaces and root commands
`-- tsconfig.base.json        Shared TypeScript configuration
```

## Prerequisites

Install the following tools before running the complete project:

- [Node.js](https://nodejs.org/) 20 or later.
- npm, included with Node.js.
- PostgreSQL for persistent local development.
- FFmpeg for video upload and HLS transcoding.
- Git Bash, PowerShell, or another supported terminal.
- Playwright browser binaries for end-to-end testing.
- Optional: Stripe CLI for local payment-webhook testing.

Verify the main dependencies:

```bash
node --version
npm --version
psql --version
ffmpeg -version
```

## Quick start

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Create the backend environment file

```bash
cp backend/.env.example backend/.env
```

For a quick in-memory demonstration, remove or comment out `DATABASE_URL` in `backend/.env`. The BFF will create volatile data and the following development account every time it starts:

```text
Email:    demo@cinevault.local
Password: cinevault123
```

Data created in memory is lost when the BFF restarts. Do not use this account or mode in production.

### 3. Start the BFF

```bash
npm run dev:bff
```

The API starts at `http://localhost:3000`.

### 4. Start the frontend

Open a second terminal in the repository root:

```bash
npm run dev:frontend
```

Open `http://localhost:5173` in the browser.

### Local URLs

| URL | Purpose |
| --- | --- |
| `http://localhost:5173` | Subscriber web application |
| `http://localhost:5173/admin` | Administration area; requires an `ADMIN` user |
| `http://localhost:3000` | BFF information endpoint |
| `http://localhost:3000/health` | Basic process health check |

## PostgreSQL setup

PostgreSQL provides persistent users, catalog data, media jobs, profiles, reviews, notifications, watchlists, subscriptions, and processed webhook records.

Create a local role and database using `psql` as a PostgreSQL administrator:

```sql
CREATE ROLE cinevault WITH LOGIN PASSWORD 'replace-with-a-local-password';
CREATE DATABASE cinevault OWNER cinevault ENCODING 'UTF8';
```

Set the connection string in `backend/.env`:

```env
DATABASE_URL=postgresql://cinevault:replace-with-a-local-password@localhost:5432/cinevault
```

Generate a strong JWT secret. One option in Git Bash is:

```bash
openssl rand -hex 32
```

Add the generated value to `backend/.env`, then prepare the database:

```bash
npm run db:migrate
npm run db:seed
```

The seed creates example catalog data and an administrator account. Its default credentials are:

```text
Email:    demo@cinevault.local
Password: cinevault123
```

Override them before running the seed:

```env
SEED_EMAIL=admin@example.com
SEED_PASSWORD=replace-with-a-strong-password
```

Never run the default seed credentials in production.

## Environment variables

The backend loads `backend/.env` through `dotenv`. Start from `backend/.env.example` and never commit real credentials.

### Application and database

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | BFF HTTP port. |
| `NODE_ENV` | No | `development` | Runtime mode. Use `production` in production. |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin and registration-link base URL. |
| `DATABASE_URL` | Production | None | PostgreSQL connection string. Without it, repositories use volatile memory. |
| `JWT_SECRET` | Production | Development fallback | Secret used to sign access tokens. Use at least 32 random characters. |
| `BROWSE_CACHE_TTL_SECONDS` | No | `30` | In-memory browse-cache lifetime from `0` to `300` seconds. Set `0` to disable it. |

### Media

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FFMPEG_PATH` | For uploads | Auto-detected/`ffmpeg` | FFmpeg executable or full path to `ffmpeg.exe`. |
| `MEDIA_SIGNING_SECRET` | Production | Falls back to `JWT_SECRET` | Independent secret used to sign temporary media URLs. |
| `MEDIA_URL_TTL_SECONDS` | No | `900` | Signed URL validity between 60 and 86,400 seconds. |
| `MEDIA_CDN_BASE_URL` | No | Empty | Public CDN base URL configured to forward `/stream/*` to the BFF. |
| `MEDIA_S3_BUCKET` | Production | Empty | Private S3-compatible bucket name. Empty uses local object storage. |
| `MEDIA_S3_REGION` | No | `us-east-1` | Bucket region. |
| `MEDIA_S3_ENDPOINT` | Provider-specific | AWS default | Custom endpoint for Cloudflare R2, MinIO, or another S3-compatible provider. |
| `MEDIA_S3_FORCE_PATH_STYLE` | No | `false` | Enables path-style bucket URLs when required by the provider. |
| `AWS_ACCESS_KEY_ID` | With S3 | None | Object-storage access key. |
| `AWS_SECRET_ACCESS_KEY` | With S3 | None | Object-storage secret key. |

### Email

| Variable | Required | Description |
| --- | --- | --- |
| `SMTP_HOST` | For real email | SMTP server hostname. |
| `SMTP_PORT` | No | Defaults to `587`. |
| `SMTP_SECURE` | No | Use `true` for implicit TLS, normally on port `465`. |
| `SMTP_USER` | For real email | SMTP account or API username. |
| `SMTP_PASSWORD` | For real email | SMTP credential or application password. |
| `SMTP_FROM` | No | Sender identity; defaults to `SMTP_USER`. |

When SMTP is absent in development, registration links are logged by the BFF and returned to the development interface. Production should use a transactional provider with SPF, DKIM, and DMARC configured for the sending domain.

### Stripe

| Variable | Required for billing | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key. Use `sk_test_...` locally and a secret manager in production. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret for the configured Stripe webhook endpoint. |

Both Stripe variables must be present to enable billing routes.

## Development workflow

Root workspace commands:

```bash
npm run dev:bff
npm run dev:frontend
npm run typecheck
npm test
npm run test:frontend
npm run test:e2e
npm run build
npm run quality
```

The backend and frontend should normally run in separate terminals during development. `npm run quality` runs TypeScript checks, all workspace tests, Playwright, and the production build.

## Authentication and registration

### Login session

1. The client sends credentials to the BFF.
2. The BFF returns a short-lived JWT access token.
3. The access token remains in frontend memory.
4. A rotating opaque refresh token is stored in an `HttpOnly`, `SameSite=Strict` cookie.
5. Only the refresh-token hash is persisted by the backend.
6. Logout revokes the refresh session and clears the cookie.

### Email registration

1. A visitor enters an email address under **Create account**.
2. The BFF creates a single-use random token and stores only its hash.
3. The user receives a link valid for 30 minutes.
4. The link opens the name-and-password form.
5. After successful registration, the interface waits five seconds and returns to login.

New registrations receive the `USER` role. Administration endpoints require `ADMIN`.

## Catalog administration

Open `http://localhost:5173/admin` with an administrator account. The administration workflow supports movies, series, genres, draft/published/archived states, artwork, seasons, episodes, separate trailers and main content, and media-job inspection and deletion.

A series must contain at least one episode before publication. Only `PUBLISHED` titles are returned by the subscriber browse endpoint.

## Media pipeline

### Supported uploads

- Containers: MP4, WebM, MOV, and MKV.
- Maximum upload size: 5 GB.
- Purposes: `TRAILER` and `MAIN_CONTENT`.

Trailers and main content are stored separately and never overwrite each other. Movies receive main media directly; series receive a title trailer and episode-level main media.

### Processing flow

1. An administrator uploads a source file.
2. The BFF records a media job.
3. FFmpeg probes and transcodes the source.
4. The pipeline creates HLS playlists and six-second segments.
5. It generates 360p, 720p, and 1080p renditions when the source supports them, without artificial upscaling.
6. Output files are written to local object storage or uploaded to the configured private bucket.
7. The catalog link is updated when the job becomes ready.
8. Playback authorization returns a temporary signed manifest URL.

Local generated files live under `backend/storage`, which is ignored by Git.

### Private bucket and CDN

For production, configure `MEDIA_S3_BUCKET` and the provider credentials. The bucket must remain private. Configure a CDN to route `/stream/*` to the BFF and forward the `expires` and `signature` query parameters. Set its public hostname in `MEDIA_CDN_BASE_URL`.

Use an independent `MEDIA_SIGNING_SECRET`; do not reuse the JWT secret in production.

## Subscriptions and payments

Cinevault delegates card collection and Strong Customer Authentication to Stripe Checkout, so raw card numbers never pass through the application database.

| Plan | Price | Billing interval | Included profiles |
| --- | ---: | --- | ---: |
| Standard | EUR 4.99 | Monthly | 1 |
| Pro | EUR 14.99 | Monthly | 1 |
| Family | EUR 120.00 | Yearly | Up to 6 |

The application integrates Stripe Customer Portal for payment-method updates, invoices, and cancellation. Subscription changes are accepted only after a signed webhook updates local billing state.

### Local Stripe webhook testing

Set test credentials in `backend/.env`, authenticate the Stripe CLI, and start forwarding events:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/v1/billing/webhook
```

Copy the displayed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, restart the BFF, and keep the Stripe CLI running while testing.

Expected production events include `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`.

Before enabling live payments, configure the business address, tax behavior, Customer Portal, invoice settings, cancellation policy, and live webhook endpoint in Stripe.

## Testing and quality

### Frontend component tests

```bash
npm run test:frontend
```

Jest, Testing Library, and `user-event` validate components from the user's perspective.

### Backend tests

```bash
npm run test --workspace @netflix/web-bff
```

Vitest and Supertest validate services, HTTP contracts, signed media delivery, and backend behavior.

### End-to-end tests

Install Playwright's Chromium binary once and run the suite:

```bash
npx playwright install chromium
npm run test:e2e
```

The suite starts an isolated Vite server and exercises desktop Chromium and a Pixel 7 viewport. API responses are mocked for deterministic frontend journeys. Failed runs retain screenshots, videos, and traces in `frontend/test-results`; the HTML report is generated under `frontend/playwright-report`.

Interactive mode:

```bash
npm run test:e2e:ui --workspace @netflix/frontend
```

Full quality gate:

```bash
npm run quality
```

## Production build

Build every workspace:

```bash
npm run build
```

Generated output:

- Backend: `backend/dist`
- Frontend: `frontend/dist`

Start the compiled BFF and preview the frontend:

```bash
npm run start --workspace @netflix/web-bff
npm run preview --workspace @netflix/frontend
```

In production, serve `frontend/dist` through a static host or reverse proxy and route API and media paths to the BFF. Set `NODE_ENV=production`, use HTTPS, set the exact public `FRONTEND_ORIGIN`, and inject secrets through the hosting platform's secret manager.

Database migrations must run as a controlled release step before starting a new backend version:

```bash
npm run db:migrate
```

## API overview

All application endpoints use the `/api/v1` prefix.

| Area | Main endpoints |
| --- | --- |
| Authentication | `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Registration | `/auth/registration/request`, `/auth/registration/verify`, `/auth/registration/complete` |
| Subscriber catalog | `/web/browse`, `/web/titles/:id`, `/web/playback/auth` |
| Profile and billing | `/web/profile`, `/web/profile/avatar`, `/web/billing/checkout`, `/web/billing/portal` |
| Social features | `/web/titles/:id/reviews`, `/web/reviews/:id/like`, `/web/reviews/:id/replies` |
| Watchlist and notifications | `/web/watchlist`, `/web/notifications` |
| Administration | `/admin/titles`, `/admin/genres`, `/admin/seasons`, `/admin/episodes`, `/admin/artwork`, `/admin/media/jobs` |
| Stripe | `/billing/webhook` |

Protected routes require `Authorization: Bearer <access-token>`. Administrative routes additionally require the `ADMIN` role. Errors use a shared envelope containing a stable error code, a user-safe message, and a request ID.

## Security model

Implemented controls include:

- Short-lived signed access tokens.
- Opaque rotating refresh tokens.
- `HttpOnly`, `SameSite=Strict`, and production `Secure` refresh cookies.
- Password hashing before persistence.
- Role-based administration middleware.
- Single-use registration tokens stored only as hashes.
- Signed Stripe webhook verification and idempotent event persistence.
- Private-media delivery through expiring HMAC-signed URLs.
- Upload size and supported-type checks.
- Generic internal-error responses with request IDs.
- Environment-file and local-media exclusions in `.gitignore`.

These controls do not replace the remaining production hardening tasks listed below.

## CI

`.github/workflows/quality.yml` installs dependencies and runs the project's automated quality checks on GitHub Actions. Keep the workflow green before merging or deploying changes.

## Production readiness

The application is a functional MVP, not yet a hardened public streaming service. Complete at least the following before accepting paying users:

- Enforce active subscription entitlement during playback authorization.
- Add frontend-wide access-token renewal and safe request retry behavior.
- Add security headers, a restrictive Content Security Policy, rate limiting, centralized schema validation, and a reviewed CSRF strategy.
- Use managed PostgreSQL with encrypted backups, point-in-time recovery, tested restores, and connection-pool limits.
- Store videos, artwork, and avatars in durable private object storage.
- Move FFmpeg processing to a separate worker backed by a durable queue with retry and stuck-job recovery.
- Configure a CDN, TLS certificate, production domain, WAF/DDoS protection, and independent media-signing secrets.
- Configure live Stripe keys, webhooks, taxes, refunds, invoices, failed-payment handling, and reconciliation.
- Configure transactional SMTP with SPF, DKIM, DMARC, bounce handling, and delivery monitoring.
- Add structured logs, exception tracking, metrics, readiness checks, player telemetry, dashboards, and alerts.
- Add staging, automated deployment, a migration policy, rollback procedures, and production smoke tests.
- Add real backend/database integration, payment/email sandbox, load, security, and broader browser tests.
- Complete Family profile management, password recovery, account deletion/export, parental controls, and playback progress.
- Review content licenses, geographic rights, privacy, terms, cookies, GDPR, age ratings, and payment regulations with qualified professionals.

Depending on content-licensing contracts, DRM and license-server integration may also be mandatory.

## Troubleshooting

### `Cannot GET /` on port 3000

Port `3000` is the BFF, not the React application. Open `http://localhost:5173` after starting `npm run dev:frontend`. The BFF root returns service information and `/health` is its basic health endpoint.

### `ERR_CONNECTION_REFUSED` on port 5173

Start the frontend in a second terminal:

```bash
npm run dev:frontend
```

### PostgreSQL connection failure

Confirm the PostgreSQL service is running and `DATABASE_URL` contains the correct host, port, database, role, and password:

```bash
psql "$DATABASE_URL" -c "SELECT current_database(), current_user;"
```

### FFmpeg is not found

Verify `ffmpeg -version`. If it is not in `PATH`, set the complete executable path in `backend/.env` and restart the BFF:

```env
FFMPEG_PATH=C:/path/to/ffmpeg/bin/ffmpeg.exe
```

### A browser cannot play an uploaded file

Wait until its media job reaches `READY`. Use the generated HLS output rather than linking an original MKV or MOV file directly.

### Quality options do not appear

Quality choices require multiple HLS renditions. A low-resolution source will not generate 720p or 1080p because the pipeline avoids upscaling.

### Registration email does not arrive

Check SMTP credentials and BFF logs. Without SMTP in development, use the registration link printed by the BFF. In production, verify SPF, DKIM, and DMARC.

### Stripe billing is disabled

Set both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, restart the BFF, and keep `stripe listen` running during local tests.

## Additional documentation

- [Web architecture](docs/web-architecture.md)
- [Implementation plan](docs/implementation-plan.md)
- [Frontend baseline: proposal 1](docs/frontend-baseline-proposta-1-2026-08-25.md)
- [Frontend baseline: proposal 3](docs/frontend-baseline-proposta-3-2026-08-25.md)

## License

No open-source license is currently included. Unless a license is added, the source code remains under its copyright holder's default rights.
