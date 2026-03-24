---
id: setup-development
name: setup-development
description: Bootstrap atxFinance on a fresh machine with dependency checks, env prompts, and build validation.
---

# Setup Development (atxFinance)

## Goal

Bring a fresh local setup to a working baseline for frontend and optional backend builds.

## Use This Skill When

- New machine or clean clone setup
- Build fails with missing dependencies
- Local environment vars are incomplete
- `next: command not found` or `node_modules missing` appears

## Mandatory Prompt Gate (ask before build/dev)

Always prompt the user to confirm root `.env` values before running build or dev.

Required keys:

- `MONGODB_URI_B64`
- `XAI_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`

If any are missing, stop and ask the user to define them first.

## Step 1: Provision Credentials

Provision credentials by risk boundary. Do not share actual keys in chat. Store them only in local `.env`.

## Credential Provisioning Model

Prefer isolation by risk boundary, not by every environment.

Recommended allocation:

1. `atxfinance-prod` (prod only)
2. `atxfinance-nonprod` (dev + staging)
3. `options-stack-nonprod` (if separate repo/app)
4. `spare-rotation` (or future `options-stack-prod`)

Notes:

- Keep exactly one active key per runtime via `XAI_API_KEY`.
- Rotate by promoting `spare-rotation` and retiring the old key.
- Do not reuse `atxfinance-prod` in local development.

| Requirement | Where to Go | How to Get It |
|---|---|---|
| `MONGODB_URI_B64` | MongoDB Atlas | 1) Go to **Database -> Connect**. 2) Choose **Drivers** and copy URI (`mongodb+srv://...`). 3) Base64 encode it: `echo -n "YOUR_URI" \| base64`. |
| `XAI_API_KEY` | xAI Console | 1) Sign in and open **API Keys**. 2) Click **Create API Key**. 3) Copy immediately (starts with `xai-`). |
| `X_OAUTH_CLIENT_ID` | X Developer Portal | 1) Create a Project and App. 2) Enable OAuth 2.0 in **User authentication settings**. 3) Copy Client ID from **Keys and Tokens**. |
| `X_OAUTH_CLIENT_SECRET` | X Developer Portal | In **Keys and Tokens**, regenerate/copy OAuth 2.0 client secret under Client ID/Secret controls. |
| X App reference name | X Developer Portal -> Project Apps | Use `atxfinance-advisory` as the app reference name for this local setup profile. |
| Website URL | X Developer Portal -> User authentication settings | Set to `http://127.0.0.1:3000` for local development. |
| Callback URI / Redirect URL | X Developer Portal -> User authentication settings | Set to `http://127.0.0.1:3000/api/auth/x/callback`. |
| Terms of Service URL | X Developer Portal -> App details | Set to `https://www.xfin.digital/terms-of-service`. |
| Privacy Policy URL | X Developer Portal -> App details | Set to `https://www.xfin.digital/privacy-policy`. |
| Organization name | X Developer Portal -> App details | Use `atxFinance`. |

## X OAuth App Metadata (Required)

When configuring the X Developer Portal app for atxFinance, use:

- Terms of Service: `https://www.xfin.digital/terms-of-service`
- Privacy Policy: `https://www.xfin.digital/privacy-policy`
- App reference name: `atxfinance-advisory`
- Website URL (required): `http://127.0.0.1:3000`
- Callback URI / Redirect URL (required): `http://127.0.0.1:3000/api/auth/x/callback`
- Organization name: `atxFinance`

## Reference Files (atxFinance repo)

Use these as the source of truth while setting up local env and commands:

- `.env.example`
- `DEVELOPMENT.md`

## Required Env Vars

For core setup, require only:

- `MONGODB_URI_B64`
- `XAI_API_KEY`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`

## Env Validation Command (run before build/dev)

Use this from repo root to print missing required keys:

```bash
node -e "const fs=require('fs');const p='.env';if(!fs.existsSync(p)){console.log('missing:.env');process.exit(1)};const t=fs.readFileSync(p,'utf8');const has=(k)=>new RegExp('^'+k+'=','m').test(t);const req=['MONGODB_URI_B64','XAI_API_KEY','X_OAUTH_CLIENT_ID','X_OAUTH_CLIENT_SECRET'];const miss=req.filter(k=>!has(k));console.log(miss.length?('missing:'+miss.join(', ')):'ok')"
```

## Bootstrap Checklist

### 1) Prerequisites

- Node.js `>=22`
- `pnpm` installed
- Java 21 (if backend build/run is needed)
- MongoDB available (local/docker/Atlas)

### 2) Install dependencies from repo root

```bash
pnpm install
```

### 3) Validate frontend build

```bash
pnpm run build
```

### 4) Validate backend build (optional, recommended)

```bash
cd apps/backend && ./gradlew build -x test --no-daemon
```

### 5) Run services for local development

```bash
pnpm dev
# Optional backend in separate terminal:
cd apps/backend && ./gradlew bootRun
```

Health check:

```bash
curl http://localhost:3000/api/health/live
```

## Common Failure Playbook

### `next: command not found`

Cause: frontend dependencies are not installed.

Fix:

```bash
pnpm install
pnpm run build
```

### `Local package.json exists, but node_modules missing`

Cause: clean setup without dependency install.

Fix:

```bash
pnpm install
```

### Auth issues on local startup

Checks:

- required keys exist in root `.env`: `MONGODB_URI_B64`, `XAI_API_KEY`, `X_OAUTH_CLIENT_ID`, `X_OAUTH_CLIENT_SECRET`
- `MONGODB_URI_B64` decodes to a valid `mongodb://` or `mongodb+srv://` URI
- restart dev server after env changes

## Output

- Missing prerequisites
- Missing required env vars
- Exact commands to recover
- Final status: frontend build pass/fail, backend build pass/fail

## Pre-Commit Sync Gate (Required)

Before any commit in active development branches:

1. `git fetch origin`
2. `git merge origin/main` (or team-approved rebase flow)
3. Resolve merge conflicts immediately if present.
4. Re-run build checks after conflict resolution:
   - `npm run build`
   - `npm run typecheck`
   - `npm run lint`
5. Only then proceed to commit/push.
