# Next.js App Router — production image for Cloud Run (`gcloud run deploy --source .`).
# Spring backend image: Dockerfile.backend
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 8080
# Align with Cloud Run’s default listener; standalone uses PORT (see `.next/standalone/server.js`).
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Cloud Run/Kubernetes often sets HOSTNAME to the pod/instance name after image env is applied.
# Next standalone binds `hostname` from process.env.HOSTNAME (`server.js`) — a pod name breaks listen + TCP probes.
# Force bind-all in the shell right before exec so it wins over platform injection.
CMD ["sh", "-c", "export HOSTNAME=0.0.0.0; exec node server.js"]
