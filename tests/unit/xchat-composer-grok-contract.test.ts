import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readXchatThreadCss } from "../helpers/read-xchat-stylesheet";

/**
 * Locks Grok-style approved composer structure: sources link, attach/mic affordances,
 * stroke icons, and hint copy without retired Beta pill.
 */
describe("xChat composer Grok shell contract", () => {
  const composerPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-composer-panel.tsx");
  const conversationPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx");
  const iconsPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-composer-icons.tsx");
  const composer = readFileSync(composerPath, "utf8");
  const conversation = readFileSync(conversationPath, "utf8");
  const icons = readFileSync(iconsPath, "utf8");
  const css = readXchatThreadCss();

  it("wires sources rail href from conversation into composer", () => {
    expect(composer).toContain("sourcesRailHref: string");
    expect(composer).toContain("href={sourcesRailHref}");
    expect(conversation).toContain("sourcesRailHref={sourcesRailHref}");
    expect(conversation).toContain("/xchat?rail=xchat&item=attachments");
  });

  it("uses Grok bar layout classes and tenant attach flags", () => {
    expect(composer).toContain("xchat-composer--grok");
    expect(composer).toContain("xchat-composer__grok-bar");
    expect(composer).toContain("xchat-composer__grok-tool--attach");
    expect(composer).toContain("xchat-composer__grok-tool--mic");
    expect(composer).toContain("tenantFileUploadEnabled");
    expect(composer).toContain("XchatTemplatesStrip");
    expect(composer).toContain("composerDraft={input}");
    expect(composer).toContain("XchatReasoningModeToggle");
    expect(composer).toContain("reasoningMode");
    expect(composer).toContain("xchat-composer__toolbar-meta");
    expect(composer).toContain("XchatPersonaMenu");
    expect(composer).toContain("templatesGalleryInitiallyExpanded");
    expect(conversation).toContain("reasoningMode={reasoningMode}");
  });

  it("does not restore Beta pill in composer footer hint", () => {
    expect(composer).not.toContain("xchat-composer-hint__pill");
    expect(composer).not.toContain("Beta");
  });

  it("uses Lucide-style stroke icons for attach + mic (readable at small sizes)", () => {
    expect(icons).toContain("export function XchatComposerAttachIcon");
    expect(icons).toContain("export function XchatComposerMicIcon");
    expect(icons).toMatch(/XchatComposerAttachIcon[\s\S]*fill="none"/);
    expect(icons).toMatch(/XchatComposerMicIcon[\s\S]*fill="none"/);
    expect(icons).toContain('strokeWidth={2}');
  });

  it("sizes attach/mic glyphs in CSS for bar alignment", () => {
    expect(css).toContain(".xchat-composer__grok-tool--attach svg");
    expect(css).toContain(".xchat-composer__grok-tool--mic svg");
    expect(css).toMatch(/width:\s*20px/);
    expect(css).toContain(".xchat-composer__grok-bar");
    expect(css).toContain("align-items: center");
  });
});
