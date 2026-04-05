import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import { createClient } from "redis";

const COMPOSE_FILE = "docker-compose.live-tests.yml";
const PROJECT_NAME = "atxfinance-live-tests";
const backendOrigin = process.env.LIVE_BACKEND_ORIGIN?.trim() || "http://127.0.0.1:18080";
const redisUrl = process.env.LIVE_REDIS_URL?.trim() || "redis://127.0.0.1:6380";
const keepStack = process.env.KEEP_LIVE_STACK === "1";

function run(command, args, description) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${description} failed (${command} ${args.join(" ")})`);
  }
}

async function waitForBackendHealth(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  const healthUrl = `${backendOrigin}/api/health`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(3_000)
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await sleep(1_500);
  }
  throw new Error(`Timed out waiting for backend health at ${healthUrl}`);
}

async function waitForRedis(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 2_000
      }
    });
    try {
      await client.connect();
      const pong = await client.ping();
      if (pong === "PONG") {
        await client.quit();
        return;
      }
      await client.quit();
    } catch {
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
    }
    await sleep(1_000);
  }
  throw new Error(`Timed out waiting for Redis at ${redisUrl}`);
}

async function main() {
  const composeBase = ["compose", "-p", PROJECT_NAME, "-f", COMPOSE_FILE];
  run("docker", [...composeBase, "up", "-d", "--build"], "Starting live integration stack");

  try {
    await waitForBackendHealth();
    await waitForRedis();

    run(
      "npm",
      ["run", "test", "--", "tests/live"],
      "Running live integration test suite"
    );
  } finally {
    if (!keepStack) {
      run("docker", [...composeBase, "down", "-v"], "Stopping live integration stack");
    }
  }
}

main().catch((error) => {
  console.error("[test:integration:live]", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
