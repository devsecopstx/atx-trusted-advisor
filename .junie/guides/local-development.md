# Local development (Next + Spring + Mongo)

This guide gets you from clone to a working stack.

Prereqs:
- Node 20+, Docker, Java 17+, Mongo in Docker (via scripts).
- `.env` populated; see `atx-docs/guides/local-development.md` and `scripts/ops/verify-gcp-runtime-secrets.sh`.

Quick start:
- Start Mongo: `npm run mongo:up`
- Seed admin user/tenant: `npm run seed:admin`
- Start Next (frontend+BFF): `npm run dev`
- Start Spring backend (optional): `npm run dev:spring`
- All-in-one dev stack (Next + Docker services): `npm run dev:stack`

Useful scripts:
- Reset Mongo and reseed: `npm run mongo:reset`
- Live integration tests (spawns ephemeral services): `npm run test:integration:live`
- Typecheck + lint + tests: `npm run ci:gate`

References:
- Next app entry: `src/app/page.tsx`, landing UI: `src/app/ui/public-marketing-landing.tsx`
- Backend services: `services/atxfinance-backend/**`
- Auth and access: `atx-docs/guides/auth-and-access.md`
