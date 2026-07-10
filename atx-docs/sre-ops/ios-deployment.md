# iOS deployment (Capacitor)

Native iOS is a **Capacitor 8 WebView shell** that loads the live Next.js app from **`server.url`** — not a bundled standalone export. Cloud Run web deploys and App Store binaries are **separate** release paths.

## Architecture

| Piece | Location |
|-------|----------|
| Capacitor config | `capacitor.config.ts` → generated `ios/App/App/capacitor.config.json` (gitignored) |
| Native project | `ios/App/App.xcodeproj` |
| Bundle ID | `com.atxfinance.ai` |
| Display name | **aTx Advisor** |
| Web app | `PROD_BASE_URL` / `PUBLIC_APP_BASE_URL` on Cloud Run |

**URL resolution** at `cap sync` time: `CAPACITOR_SERVER_URL` → `PUBLIC_APP_BASE_URL` → default `http://127.0.0.1:3000`.

## Prerequisites

- macOS + Xcode (signed Apple Developer account)
- Local **`.env.prod`** (not committed) with HTTPS origin, e.g. `PROD_BASE_URL` or `CAPACITOR_SERVER_URL`
- Node deps installed (`npm install`)

## Production sync (required before archive)

```bash
npm run cap:sync:ios:prod
```

Reads **`.env.prod`** in this order: `CAPACITOR_SERVER_URL` → `PUBLIC_APP_BASE_URL` → `PROD_BASE_URL`. **HTTPS only.**

Verify generated config:

```bash
grep server.url ios/App/App/capacitor.config.json
```

Must show your production HTTPS origin, not `127.0.0.1`.

Local simulator against `npm run dev`:

```bash
npm run cap:sync:ios
```

## Version numbers

iOS **Version** / **Build** live in `ios/App/App.xcodeproj/project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`) — **not** `package.json`. See **`.cursor/skills/ios-version-bump/SKILL.md`**.

- Bump **Build** (+1) for every binary uploaded to App Store Connect.
- Bump **Version** when store-facing release line changes.

## Xcode archive

1. `npm run cap:sync:ios:prod` (if shell/config/static assets changed)
2. Open `ios/App/App.xcodeproj`
3. Target **App** → **Signing & Capabilities** → select your **Team** (not committed in repo)
4. Confirm **Version** / **Build** on **General**
5. **Product → Archive** → **Distribute App** → App Store Connect / TestFlight

Icons: `npm run icons:ios` (from `assets/icon-only.png`) when brand mark changes.

## TestFlight smoke checklist

On a **physical device** (simulator is fine for layout; test auth on device):

- [ ] App loads prod HTTPS (not blank / localhost)
- [ ] Sign in with **X** (OAuth redirect returns to app, session persists)
- [ ] Sign in with **Google** if enabled in prod (Google may block embedded WebViews — see gaps below)
- [ ] `/xchat` — send a prompt, streaming/JSON response
- [ ] xChat **voice** — microphone permission prompt, record/transcribe
- [ ] `/portfolios`, `/watchlist` — workspace loads with session
- [ ] Background → foreground — session still valid
- [ ] Account rail — no **Add to Home Screen** / PWA install nudge (native shell)

## App Store Connect

- Privacy policy URL (in-app `/legal` or marketing site)
- Finance disclaimer — educational software, not personalized investment advice
- Screenshots — see `atx-docs/branding/atxfinance-brand-prompts.md` (App Store screenshot style)
- **Guideline 4.2** — thin WebView wrappers can be rejected; emphasize approved-access workflow, portfolio + xChat + options desk as shipped product value

## Native plist / capabilities

| Key | Purpose |
|-----|---------|
| `NSMicrophoneUsageDescription` | xChat voice (`getUserMedia`) |
| `UIRequiredDeviceCapabilities` → `arm64` | 64-bit devices only |

## Web app behavior in native shell

- **PWA install UI** hidden when `Capacitor.isNativePlatform()` (`src/lib/capacitor-native.ts`)
- **Service worker** not registered in Capacitor native — avoids stale UI after web deploys (`PwaBootstrapClient`)
- **OAuth (X + Google)** — native shell intercepts `/api/auth/x/login` and `/api/auth/google/login` links and opens **`@capacitor/browser`** (SFSafariViewController). Flow:
  1. Login URL includes `cap_native=1` → server sets `xf_cap_native_oauth` cookie
  2. On success, redirect to `/auth/capacitor-oauth-done?next=…` inside the browser sheet
  3. Bridge page deep-links `com.atxfinance.ai://oauth-complete?next=…` → main WKWebView (`@capacitor/app` `appUrlOpen`) closes browser and navigates
  4. Session cookie is set on the HTTPS origin before the bridge (shared Safari cookie store)

After adding `@capacitor/browser` / `@capacitor/app`, run **`npm run cap:sync:ios:prod`** so Xcode picks up native plugin wiring.

**TestFlight OAuth smoke:** X login, Google login (if prod-enabled), session persists after return, no PWA install nudge.

## Release coordination

1. Deploy **Next.js** to Cloud Run (normal prod deploy)
2. Run **`npm run cap:sync:ios:prod`** only when Capacitor config, `public/` assets, or native project changed
3. Bump iOS build number + archive when uploading a new binary

Web-only changes do **not** require a new App Store build (remote `server.url`). Native plist / icon / Capacitor version changes **do**.

## Known gaps

| Gap | Mitigation |
|-----|------------|
| No `DEVELOPMENT_TEAM` in repo | Set Team in Xcode per machine |
| Google OAuth in WKWebView | **Mitigated** — `@capacitor/browser` + `com.atxfinance.ai://oauth-complete` bridge; device-test both providers |
| No iOS CI | Manual archive today |
| Network required | No offline mode — document in App Store description |

## Related

- `capacitor.config.ts`
- `scripts/cap-sync-ios-prod.sh`
- `.env.example` — `CAPACITOR_SERVER_URL` / `PUBLIC_APP_BASE_URL`
- `tests/unit/pwa-service-worker-policy.test.ts` — SW policy for Capacitor dev
