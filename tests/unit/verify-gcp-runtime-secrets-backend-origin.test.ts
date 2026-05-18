import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const resolveInc = path.join(repoRoot, "scripts/ops/verify-backend-origin-resolve.inc.sh");

function resolveBackendOrigin(opts: {
  project: string;
  repoRoot: string;
  shellExports?: string;
}): string {
  const script = `
    set -euo pipefail
    PROJECT=${JSON.stringify(opts.project)}
    REPO_ROOT=${JSON.stringify(opts.repoRoot)}
    ${opts.shellExports ?? "unset ATXFINANCE_BACKEND_ORIGIN"}
    # shellcheck disable=SC1091
    source ${JSON.stringify(resolveInc)}
    resolve_backend_origin_for_verify >/dev/null
    printf '%s' "$ATXFINANCE_BACKEND_ORIGIN"
  `;
  return execFileSync("bash", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    },
  }).trim();
}

function expectResolveFails(opts: {
  project: string;
  repoRoot: string;
  shellExports?: string;
}): void {
  const script = `
    set -euo pipefail
    PROJECT=${JSON.stringify(opts.project)}
    REPO_ROOT=${JSON.stringify(opts.repoRoot)}
    ${opts.shellExports ?? "unset ATXFINANCE_BACKEND_ORIGIN"}
    source ${JSON.stringify(resolveInc)}
    resolve_backend_origin_for_verify
  `;
  expect(() =>
    execFileSync("bash", ["-c", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      },
    }),
  ).toThrow();
}

describe("verify-backend-origin-resolve", () => {
  it("keeps ATXFINANCE_BACKEND_ORIGIN when already exported", () => {
    const origin = resolveBackendOrigin({
      project: "fintech-advisor-prod",
      repoRoot,
      shellExports:
        'export ATXFINANCE_BACKEND_ORIGIN="https://backend-preconfigured.run.app"',
    });
    expect(origin).toBe("https://backend-preconfigured.run.app");
  });

  it("sources .env.prod for non-staging projects when unset", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atx-verify-origin-"));
    fs.writeFileSync(
      path.join(tmp, ".env.prod"),
      "ATXFINANCE_BACKEND_ORIGIN=https://from-env-prod.run.app\n",
    );
    const origin = resolveBackendOrigin({
      project: "fintech-advisor-prod",
      repoRoot: tmp,
    });
    expect(origin).toBe("https://from-env-prod.run.app");
  });

  it("sources .env.stage when project id contains staging", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atx-verify-origin-"));
    fs.writeFileSync(
      path.join(tmp, ".env.stage"),
      "ATXFINANCE_BACKEND_ORIGIN=https://from-env-stage.run.app\n",
    );
    const origin = resolveBackendOrigin({
      project: "fintech-advisor-staging",
      repoRoot: tmp,
    });
    expect(origin).toBe("https://from-env-stage.run.app");
  });

  it("fails when origin cannot be resolved", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atx-verify-origin-"));
    expectResolveFails({
      project: "fintech-advisor-prod",
      repoRoot: tmp,
    });
  });
});
