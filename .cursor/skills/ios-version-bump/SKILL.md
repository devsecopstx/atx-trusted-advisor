---
id: ios-version-bump
name: ios-version-bump
description: Bump Capacitor iOS marketing version (CFBundleShortVersionString) and build (CFBundleVersion) in the Xcode project; optional cap sync.
---

# iOS version bump (Capacitor)

## Goal

Ship a new **App Store / TestFlight** build with correct **Version** (marketing semver users see) and **Build** (monotonic integer Apple Connect requires per upload). Keep this separate from **`package.json`** / **`src/lib/app-version.ts`** — those track the **Next.js** app, not the native shell.

## Where versions live

| Concept | Xcode UI | `project.pbxproj` | `Info.plist` |
|--------|----------|---------------------|----------------|
| Version (e.g. 1.1.0) | **General → Identity → Version** | **`MARKETING_VERSION`** | **`CFBundleShortVersionString`** → `$(MARKETING_VERSION)` |
| Build (e.g. 42) | **General → Identity → Build** | **`CURRENT_PROJECT_VERSION`** | **`CFBundleVersion`** → `$(CURRENT_PROJECT_VERSION)` |

Source of truth for this repo: **`ios/App/App.xcodeproj/project.pbxproj`** — both **Debug** and **Release** configurations must stay in sync for **`MARKETING_VERSION`** and **`CURRENT_PROJECT_VERSION`**.

`ios/App/App/Info.plist` already maps bundle keys to those build settings; do not duplicate literal version strings in `Info.plist`.

## When to bump what

- **`MARKETING_VERSION`** — User-visible release line (e.g. **1.0 → 1.1**). Bump when marketing/store listing describes a new minor/major release.
- **`CURRENT_PROJECT_VERSION`** — Must **increase for every binary** uploaded to App Store Connect (even if `MARKETING_VERSION` is unchanged). Bump by **+1** (or your team’s CI rule) on each archive.

## Workflow

1. Edit **`ios/App/App.xcodeproj/project.pbxproj`** in both **`504EC317… /* Debug */`** and **`504EC318… /* Release */`** blocks:
   - Set **`MARKETING_VERSION = X.Y`** (or `X.Y.Z`) to the desired store version.
   - Set **`CURRENT_PROJECT_VERSION`** to the next integer build number.
2. Optional sanity check in Xcode: open **`ios/App/App.xcodeproj`** → target **App** → **General** — Version / Build should match.
3. Sync web assets and Capacitor config into the iOS tree: **`npm run cap:sync:ios`** (or **`npx cap sync ios`**).
4. Archive in Xcode (**Product → Archive**) and upload via Organizer.

## Related repo wiring

- **`capacitor.config.ts`** — `appId`, `appName`, `server.url` for the WebView; not iOS build numbers.
- **`npm run cap:sync:ios`** — Copies `public/` and regenerates **`ios/App/App/capacitor.config.json`**; run after changing Capacitor config or static assets before shipping.

## Release notes

If the bump ships with meaningful native or shell changes, add a **one-line** bullet to **`atx-docs/sre-ops/release-notes.md`** (newest first) with **`Deploy:`** guidance — native iOS is outside Cloud Run; note **TestFlight / App Store** as appropriate.

## Output

After edits: confirm **`MARKETING_VERSION`** / **`CURRENT_PROJECT_VERSION`** appear twice (Debug + Release), run **`npm run cap:sync:ios`**, then Xcode archive.
