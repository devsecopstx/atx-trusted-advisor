import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("xChat persona left-rail contract", () => {
  const viewPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx");
  const source = readFileSync(viewPath, "utf8");

  it("keeps Persona grouped in a rail disclosure matching other rail sections", () => {
    expect(source).toContain('section className="app-user-rail-section" aria-label="Persona"');
    expect(source).toContain('title="Persona"');
    expect(source).toContain("RailDisclosure");
  });

  it("keeps picker plus active/status blocks inside the Persona disclosure", () => {
    expect(source).toContain('id="xchat-persona-picker"');
    expect(source).toContain('aria-label="Active persona and last turn tools"');
    expect(source).toContain('aria-label="Knowledge collections and scope status"');
  });
});
