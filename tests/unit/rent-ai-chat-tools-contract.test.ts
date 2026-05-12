import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("rental AI chat tool wire contract", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/ai/rent/chat/route.ts"), "utf8");

  it("expands persona marker tools before xAI Responses tool loop", () => {
    expect(route).toContain('import { personaXapiToolsToXaiRequestTools } from "@/lib/xai-tools";');
    expect(route).toContain("tools: personaXapiToolsToXaiRequestTools(xapiConfig.tools)");
  });
});
