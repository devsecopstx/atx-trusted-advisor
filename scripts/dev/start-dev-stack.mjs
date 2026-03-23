#!/usr/bin/env node
/**
 * Start local stack in order: docker compose (mongo + Kotlin backend) detached,
 * wait until backend health is up, then run Next dev in the foreground.
 *
 * Usage: npm run dev:stack
 * Stop Next with Ctrl+C; containers keep running — `docker compose down` when done.
 */
import { execFileSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
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

async function waitForBackend(maxAttempts = 90, intervalMs = 1000) {
  console.log("[dev:stack] waiting for backend on :8080 …");
  for (let i = 0; i < maxAttempts; i++) {
    if (await backendReady()) {
      console.log("[dev:stack] backend health OK");
      return;
    }
    if (i > 0 && (i + 1) % 15 === 0) {
      console.log(`[dev:stack] still waiting (${i + 1}/${maxAttempts}) …`);
    }
    await delay(intervalMs);
  }
  console.error(
    "[dev:stack] timeout: backend did not become healthy. Check `docker compose ps` and logs."
  );
  process.exit(1);
}

function main() {
  console.log("[dev:stack] docker compose up -d (mongo + atxfinance-backend) …");
  execFileSync("docker", ["compose", "--env-file", ".env", "up", "-d"], {
    cwd: root,
    stdio: "inherit",
  });

  waitForBackend()
    .then(() => {
      console.log("[dev:stack] starting Next dev …");
      const child = spawn("npm", ["run", "dev:frontend"], {
        cwd: root,
        stdio: "inherit",
        shell: true,
      });
      child.on("exit", (code, signal) => {
        if (signal) process.kill(process.pid, signal);
        else process.exit(code ?? 0);
      });
    })
    .catch((e) => {
      console.error("[dev:stack]", e);
      process.exit(1);
    });
}

main();
