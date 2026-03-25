---
name: cursor-cloud-agents
description: Configure and validate Cursor cloud agents for atxfinance with a secure secrets model, smoke tasks, and stable operational defaults. Use when setting up cloud agents, deciding key placement, or freezing agent runtime configuration before GCP deployment.
---

# atxfinance Cursor Cloud Agents

## Goal

Set up Cursor cloud agents with deterministic behavior for atxfinance:

- stable runtime assumptions
- clear secret ownership (cloud runtime vs local)
- repeatable smoke validation
- frozen config before infra deployment

## Standard Decisions (Default)

- Repo target: `atxfinance`
- Agents reference: `https://vscode.dev/github/devsecopstx/xfinance/blob/main/.cursor/agents`
- Production host: `https://atx.fintech-advisor.ai`
- Staging host: `https://staging.atx.fintech-advisor.ai`
- GCP model: separate projects for staging and production
- OAuth model: single X OAuth app with both callback URLs

## Secret Ownership Model

Keep secrets by execution boundary:

### Cloud agent runtime only

- `XAI_API_KEY`
- `XAI_MANAGEMENT_API_KEY` (required for KB/management operations)
- `MONGODB_URI_B64`
- `X_OAUTH_CLIENT_ID`
- `X_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`

### CI/deploy runtime only

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- Project/repository identifiers (non-secret, but controlled in CI config)

### Local developer only

- local `.env` values for local run/debug
- never required for cloud-agent-only smoke tasks

## Agent Setup Workflow

1. Confirm global skills folder is mounted in workspace.
2. Confirm cloud-agent skill files exist and are discoverable.
3. Confirm Atlas mode (`MONGODB_URI_B64`) and do not start local Mongo (`docker compose up` not used).
4. Validate one read-only agent task.
5. Validate one command agent task.
6. Freeze settings and document accepted defaults.

## Smoke Tasks (Required)

Run both:

1. Read-only smoke:
   - find required env validator file and list required keys
2. Command smoke:
   - report `git branch`, `node -v`, `npm -v`

Mark setup complete only if both tasks succeed.

## Freeze Checklist

- [ ] Cloud agent can run read-only task
- [ ] Cloud agent can run shell command task
- [ ] Atlas mode confirmed (no local Mongo startup in cloud agent)
- [ ] Secret ownership model agreed
- [ ] Required management key configured (`XAI_MANAGEMENT_API_KEY`)
- [ ] GCP hostnames agreed (`atx.fintech-advisor.ai`, `staging.atx.fintech-advisor.ai`)
- [ ] OAuth callback URLs documented
- [ ] Next action queued: GCP DNS/LB/Cloud Run deployment

## Output Requirements

When using this skill, return:

- smoke task evidence
- secret ownership matrix
- unresolved decisions (if any)
- next 3 execution actions in order
