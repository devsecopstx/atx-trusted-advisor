import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("xChat persona left-rail contract", () => {
  const viewPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx");
  const composerPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-composer-panel.tsx");
  const source = readFileSync(viewPath, "utf8");
  const composerSource = readFileSync(composerPath, "utf8");

  it("keeps Persona grouped under the xChat rail disclosure", () => {
    expect(source).toContain('section className="app-user-rail-section" aria-label="xChat"');
    expect(source).toContain('title="Persona"');
    expect(source).toContain("RailDisclosure");
  });

  it("keeps composer persona picker (rendered when workspace changePersonaEnabled / not locked) plus rail active/status blocks", () => {
    expect(composerSource).toContain("!personaPickerLocked");
    expect(composerSource).toContain('id="xchat-composer-persona-picker"');
    expect(source).toContain('aria-label="Active persona and last turn tools"');
    expect(source).toContain('aria-label="Knowledge collections and scope status"');
  });
});
