import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("xChat composer + workspace rail contract", () => {
  const viewPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx");
  const composerPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-composer-panel.tsx");
  const source = readFileSync(viewPath, "utf8");
  const composerSource = readFileSync(composerPath, "utf8");

  it("keeps xChat section grouped under the workspace rail (Composer + Chat history, no Persona rail)", () => {
    expect(source).toContain(
      'section className="app-user-rail-section app-user-rail-section--workspace-core" aria-label="xChat"'
    );
    expect(source).toContain('title="Chat history"');
    expect(source).not.toContain('title="Persona"');
    expect(source).toContain("RailDisclosure");
  });

  it("keeps composer persona menu plus Templates strip above the composer", () => {
    expect(composerSource).toContain("!personaPickerLocked");
    expect(composerSource).toContain("XchatPersonaMenu");
    expect(composerSource).toContain("XchatTemplatesStrip");
    expect(composerSource).toContain("askInFlight={loading}");
    expect(composerSource).toContain("templatesGalleryInitiallyExpanded");
    expect(source).toContain('templatesGalleryInitiallyExpanded={initialXchatItem === "examples"}');
  });
});
