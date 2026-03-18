# Secret Rotation Runbook

Controlled credential rotation for xFinance with minimal downtime and no secret leakage.

## MONGODB_URI_B64

### 1. Create new credentials (Atlas)

1. MongoDB Atlas → **Database Access** → **Add New Database User**
2. Create user with strong password (or use existing user and **Edit** → **Edit Password**)
3. **Database** → **Connect** → **Drivers** → copy URI (`mongodb+srv://...` or `mongodb://...`)

### 2. Base64 encode

```bash
echo -n "mongodb+srv://user:password@cluster.mongodb.net/xfinancedb?retryWrites=true&w=majority&appName=xFinance" | base64
```

Copy the output (no newline).

### 3. Update local .env

```bash
# In .env
MONGODB_URI_B64=<new-base64-value>
```

Validate locally:

```bash
npm run dev
curl -sSf http://localhost:3000/api/health
```

### 4. Update GCP Secret Manager

Dry-run first:

```bash
bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target staging --keys MONGODB_URI_B64
```

Execute (staging):

```bash
bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target staging --keys MONGODB_URI_B64 --execute --trigger-deploy
```

For production (after staging verification):

```bash
bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target production --keys MONGODB_URI_B64 --execute --trigger-deploy --approve-production
```

### 5. Update Cursor Cloud (if using cloud agents)

Cursor Cloud → **Secrets** → set `MONGODB_URI_B64` to the new base64 value.

### 6. Verify

- Staging: `curl -sSf https://staging.atx.fintech-advisor.ai/api/health`
- Production: `curl -sSf https://atx.fintech-advisor.ai/api/health`

Expected: `{"status":"ok","service":"xfinance-core-app","db":"xfinancedb"}`

### 7. Revoke old credentials (after 24–48h stable)

Atlas → **Database Access** → delete or disable old user.

---

## X OAuth (X_OAUTH_CLIENT_ID, X_OAUTH_CLIENT_SECRET)

### 1. Create new credentials (X Developer Portal)

1. [developer.x.com](https://developer.x.com) → **Projects & Apps** → your app (e.g. `xfinance-advisory`)
2. **Keys and Tokens** → **OAuth 2.0**
3. **Regenerate** Client Secret (or create a new app if rotating Client ID too)
4. Copy Client ID and Client Secret immediately (secret is shown only once)

### 2. Callback URLs (must match exactly)

Ensure these are in **User authentication settings** → **Callback URI / Redirect URL**:

- Local: `http://127.0.0.1:3000/api/auth/x/callback`
- Staging: `https://staging.atx.fintech-advisor.ai/api/auth/x/callback`
- Production: `https://atx.fintech-advisor.ai/api/auth/x/callback`

### 3. Update local .env

```bash
# In .env
X_OAUTH_CLIENT_ID=<new-client-id>
X_OAUTH_CLIENT_SECRET=<new-client-secret>
```

Validate locally:

```bash
npm run dev
# Visit http://localhost:3000/login and click "Sign in with X"
```

### 4. Update GCP Secret Manager

Dry-run:

```bash
bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target staging --keys X_OAUTH_CLIENT_ID,X_OAUTH_CLIENT_SECRET
```

Execute (staging):

```bash
bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target staging --keys X_OAUTH_CLIENT_ID,X_OAUTH_CLIENT_SECRET --execute --trigger-deploy
```

Production (after staging verification):

```bash
bash scripts/ops/rotate-gcp-secrets-and-deploy.sh --target production --keys X_OAUTH_CLIENT_ID,X_OAUTH_CLIENT_SECRET --execute --trigger-deploy --approve-production
```

### 5. Update Cursor Cloud (if using cloud agents)

Cursor Cloud → **Secrets** → set `X_OAUTH_CLIENT_ID` and `X_OAUTH_CLIENT_SECRET`.

### 6. Verify

- Staging: sign in with X at `https://staging.atx.fintech-advisor.ai/login`
- Production: sign in with X at `https://atx.fintech-advisor.ai/login`

### 7. Revoke old credentials (after 24–48h stable)

X Developer Portal → **Keys and Tokens** → revoke old OAuth 2.0 secret if you created a new one.

---

## Other secrets

See `.cursor/skills/xrotate-keys/SKILL.md` and `CHECKLIST.md` for xAI, AUTH_SECRET, etc.
