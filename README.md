# `@venkatesulu-settybalija/analytics-demo-app`

A **versioned, local-first analytics lab** (Express + static multi-page UI) shared by E2E portfolio projects. **No database, no Docker** — in-memory state, optional test reset.

## Features

- **Auth** with roles: `admin` (`demo` / `demo123`) and `viewer` (`viewer` / `viewer123`)
- **Feed editor**, **dashboard** (KPIs, trend, grain, CSV export, saved views in `localStorage`)
- **Explore** + **SQL Lab lite** (read-only `SELECT` on `feeds`)
- **APIs**: `POST /api/auth/login`, `GET /api/auth/me`, feed CRUD, `GET /api/dashboard/summary`, `GET /api/datasets`, `POST /api/sqllab/run`
- **`POST /api/__reset`** when `APP_ENABLE_RESET=true` (for automated tests)

## Install

```bash
npm install @venkatesulu-settybalija/analytics-demo-app
```

Or from GitHub (pin a **tag** or **`main`**):

```json
"dependencies": {
  "@venkatesulu-settybalija/analytics-demo-app": "github:venkatesulu-settybalija/analytics-demo-app#main"
}
```

Built **`dist/`** is committed so `npm install` from GitHub works without relying on `prepare` in every environment. After changing `src/`, run **`npm run build`** and commit `dist/` again.

## Run (CLI)

```bash
export APP_ENABLE_RESET=true
npx analytics-demo-app
# http://127.0.0.1:3100
```

## Run (programmatic)

```typescript
import { startServer } from "@venkatesulu-settybalija/analytics-demo-app";
startServer();
```

`app` is also exported for advanced use (e.g. `supertest`).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `3100` | HTTP port |
| `APP_USER` / `APP_PASS` | `demo` / `demo123` | Admin account |
| `APP_VIEWER_USER` / `APP_VIEWER_PASS` | `viewer` / `viewer123` | Viewer account |
| `APP_ENABLE_RESET` | unset | Set `true` to enable `POST /api/__reset` |

## Versioning

Bump **`version`** in `package.json` and tag (`v1.0.1`) so Playwright / Puppeteer labs can pin the **same** demo revision.

## License

MIT
