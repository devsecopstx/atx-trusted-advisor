import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract guard for `scripts/seed-admin-user.mjs` (no Mongo): defaults must stay aligned with
 * product enums and `atx-docs/rag-collection/xpersonas/advisor/advisor.yaml`.
 */
describe("seed-admin-user.mjs contract", () => {
  const scriptPath = join(process.cwd(), "scripts", "seed-admin-user.mjs");
  const src = readFileSync(scriptPath, "utf8");

  it("defaults seeded admin subscription plan to basic and persona slug advisor", () => {
    expect(src).toMatch(/const DEFAULT_SEED_SUBSCRIPTION_PLAN = "basic"/);
    expect(src).toMatch(/const DEFAULT_PERSONA_NAME_NORMALIZED = "advisor"/);
    expect(src).toMatch(/subscriptionPlan: DEFAULT_SEED_SUBSCRIPTION_PLAN/);
    expect(src).toMatch(/requestedPlan: DEFAULT_SEED_SUBSCRIPTION_PLAN/);
  });

  it("re-resolves advisor persona after disk xpersona sync before seed summary", () => {
    expect(src).toContain("personaAfterDisk");
    expect(src).toContain("runPostSeedXpersonasFromDisk()");
    expect(src).toContain("atx-docs/rag-collection/xpersonas");
  });

  it("xAI team RAG upload is opt-in (SEED_ADMIN_XAI_RAG_INGEST), not default seed:admin behavior", () => {
    expect(src).toContain("function shouldRunSeedXaiRagIngest()");
    expect(src).toContain("SEED_ADMIN_XAI_RAG_INGEST");
    expect(src).toContain("didRunXaiRagIngest");
  });
});
