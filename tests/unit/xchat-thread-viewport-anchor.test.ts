import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
    anchorXchatThreadViewportAfterTurn,
    clearXchatComposerDraft
} from "@/lib/xchat/xchat-thread-viewport-anchor";

describe("xchat thread viewport anchor", () => {
  const conversation = readFileSync(join(process.cwd(), "src/app/xchat/ui/xchat-conversation.tsx"), "utf8");

  it("anchors the main chat column and latest prompt chrome after turns", () => {
    expect(conversation).toContain("anchorXchatThreadViewportAfterTurn");
    expect(conversation).toContain("mainChatScrollRef");
    expect(conversation).toContain("stickyLatestPromptRef");
    expect(conversation).toContain("clearXchatComposerDraft");
  });

  it("scrolls the main chat column and latest prompt chrome into view", () => {
    const mainChatScrollEl = {
      scrollTo: vi.fn()
    } as unknown as HTMLElement;
    const stickyLatestPromptEl = {
      scrollIntoView: vi.fn()
    } as unknown as HTMLElement;
    const messagesEndEl = {
      scrollIntoView: vi.fn()
    } as unknown as HTMLElement;
    const threadScrollEl = {
      querySelectorAll: vi.fn(() => ({
        length: 0,
        item: () => null
      }))
    } as unknown as HTMLElement;

    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      }
    );

    anchorXchatThreadViewportAfterTurn({
      mainChatScrollEl,
      threadScrollEl,
      stickyLatestPromptEl,
      messagesEndEl,
      threadVirtualized: false,
      lastVisibleMessageIndex: 0
    });

    expect(mainChatScrollEl.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(stickyLatestPromptEl.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest"
    });
    expect(messagesEndEl.scrollIntoView).toHaveBeenCalled();
  });

  it("clears composer draft state and textarea height", () => {
    const setInput = vi.fn();
    const resizeComposer = vi.fn();
    const composerEl = {
      value: "scan my options",
      blur: vi.fn()
    } as unknown as HTMLTextAreaElement;

    clearXchatComposerDraft(setInput, composerEl, resizeComposer, { blur: true });

    expect(setInput).toHaveBeenCalledWith("");
    expect(composerEl.value).toBe("");
    expect(resizeComposer).toHaveBeenCalled();
    expect(composerEl.blur).toHaveBeenCalled();
  });
});
