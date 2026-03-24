#!/usr/bin/env node
/**
 * Host-native dev: Spring Boot via Gradle bootRun (no backend container), then Next dev.
 * MongoDB must already be reachable (e.g. `docker compose up -d mongodb`, local mongod, or Atlas).
 *
 * Usage: npm run dev:host  (or npm run dev:host:fresh to wipe Compose Mongo volume + seed:admin first)
 * Ctrl+C stops Next and sends SIGTERM to the Gradle/JVM backend process.
 */
import { execFileSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bootScript = join(root, "scripts/dev/bootrun-atxfinance-backend.sh");
const wipeVolumesScript = join(root, "scripts/dev/wipe-local-compose-volumes.sh");
const mongoUpScript = join(root, "scripts/dev/mongo-up.sh");

function shouldWipeLocalMongo() {
  const v = String(process.env.DEV_WIPE_LOCAL_MONGO ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function wipeMongoVolumeUpAndSeed() {
  execFileSync("bash", [wipeVolumesScript], { cwd: root, stdio: "inherit", env: process.env });
  execFileSync("bash", [mongoUpScript], { cwd: root, stdio: "inherit", env: process.env });
  execFileSync("npm", ["run", "seed:admin"], { cwd: root, stdio: "inherit", env: process.env });
}

const healthUrls = [
  "http://127.0.0.1:8080/actuator/health",
  "http://127.0.0.1:8080/api/backend/health",
  "http://127.0.0.1:8080/api/health",
];

async function backendReady() {
  for (const url of healthUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
  }
  return false;
}

async function waitForBackend(backend, maxAttempts = 120, intervalMs = 1000) {
  console.log("[dev:host] waiting for Gradle bootRun on :8080 …");
  for (let i = 0; i < maxAttempts; i++) {
    if (backend.exitCode !== null) {
      throw new Error(`backend exited before healthy (code ${backend.exitCode})`);
    }
    if (await backendReady()) {
      console.log("[dev:host] backend health OK");
      return;
    }
    if (i > 0 && (i + 1) % 20 === 0) {
      console.log(`[dev:host] still waiting (${i + 1}/${maxAttempts}) …`);
    }
    await delay(intervalMs);
  }
  throw new Error("timeout waiting for backend — is Mongo up? Try: docker compose up -d mongodb");
}

function main() {
  console.log(
    "[dev:host] starting Gradle bootRun (live JVM; rebuild from services/atxfinance-backend with ./gradlew compileKotlin …)"
  );
  console.log(
    "[dev:host] MongoDB must be reachable — e.g. docker compose up -d mongodb (no backend container needed)"
  );

  if (shouldWipeLocalMongo()) {
    console.log(
      "[dev:host] DEV_WIPE_LOCAL_MONGO: wiping compose volumes → mongo:up → seed:admin (destructive) …"
    );
    wipeMongoVolumeUpAndSeed();
  }

  const backend = spawn("bash", [bootScript], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  const stopBackend = () => {
    try {
      backend.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  };

  process.on("SIGINT", () => {
    stopBackend();
    process.exit(130);
  });
  process.on("SIGTERM", stopBackend);

  backend.on("error", (err) => {
    console.error("[dev:host] failed to spawn bootRun:", err);
    process.exit(1);
  });

  waitForBackend(backend)
    .then(() => {
      console.log("[dev:host] starting Next dev …");
      const next = spawn("npm", ["run", "dev:frontend"], {
        cwd: root,
        stdio: "inherit",
        shell: true,
      });

      next.on("exit", (code, signal) => {
        stopBackend();
        if (signal) process.kill(process.pid, signal);
        else process.exit(code ?? 0);
      });
    })
    .catch((e) => {
      console.error("[dev:host]", e.message ?? e);
      stopBackend();
      process.exit(1);
    });
}

main();
