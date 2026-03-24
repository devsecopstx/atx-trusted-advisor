import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("atx-rag-collection layout", () => {
  const base = join(process.cwd(), "atx-rag-collection");

  it("documents RAG source tree paths referenced in README", () => {
    expect(existsSync(join(base, "README.md"))).toBe(true);
    expect(existsSync(join(base, "atx-personas-trusted-family"))).toBe(true);
    expect(existsSync(join(base, "finance-reference-docs"))).toBe(true);
    expect(existsSync(join(base, "atx-xchat-example-prompts"))).toBe(true);
  });
});
