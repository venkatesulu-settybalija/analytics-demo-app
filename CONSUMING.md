# Consuming this package from a test framework repo

## 1. Remove duplicate app code

Delete the in-repo `app/` folder (or stop tracking it) once the package is wired in.

## 2. Add the dependency

**From npm** (after publish):

```json
"dependencies": {
  "@venkatesulu-settybalija/analytics-demo-app": "^1.0.0"
}
```

**From GitHub** (before or instead of npm):

```json
"dependencies": {
  "@venkatesulu-settybalija/analytics-demo-app": "github:venkatesulu-settybalija/analytics-demo-app#v1.0.1"
}
```

Pin the **git tag** so all framework repos stay on the same demo revision.

## 3. Start script

Replace `app:start` with something that enables reset for tests:

```json
"scripts": {
  "app:start": "cross-env APP_ENABLE_RESET=true APP_PORT=3100 analytics-demo-app"
}
```

On Unix you can use `env` instead of `cross-env`:

```json
"app:start": "env APP_ENABLE_RESET=true APP_PORT=3100 analytics-demo-app"
```

## 4. Playwright `webServer`

Keep `command: "npm run app:start"` — it now resolves the binary from `node_modules/.bin`.

## 5. Verify

```bash
npm install
npm run app:start
# open http://127.0.0.1:3100
```

## Local development (two repos side by side)

From your **framework** repo:

```bash
npm link ../analytics-demo-app
```

Then `npm ls @venkatesulu-settybalija/analytics-demo-app` should show the link.
