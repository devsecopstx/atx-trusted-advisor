import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearXchatPendingComposerHandoffMemory,
    consumeXchatPendingComposerHandoff,
    writeXchatPendingComposerHandoff
} from "@/lib/xchat/xchat-pending-prompt";

describe("xchat pending composer handoff", () => {
  const store = new Map<string, string>();

  const sessionStoragePolyfill = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  beforeEach(() => {
    store.clear();
    clearXchatPendingComposerHandoffMemory();
    vi.stubGlobal("sessionStorage", sessionStoragePolyfill);
    vi.stubGlobal("window", { sessionStorage: sessionStoragePolyfill });
  });

  afterEach(() => {
    clearXchatPendingComposerHandoffMemory();
    vi.unstubAllGlobals();
  });

  it("writes and consumes prompt + persona once", () => {
    writeXchatPendingComposerHandoff({
      prompt: "Review my book",
      personaName: "finance-advisor"
    });

    const first = consumeXchatPendingComposerHandoff();
    expect(first.prompt).toBe("Review my book");
    expect(first.personaName).toBe("finance-advisor");

    const second = consumeXchatPendingComposerHandoff();
    expect(second.prompt).toBe("Review my book");
    expect(second.personaName).toBe("finance-advisor");
  });

  it("clears in-memory handoff after send", () => {
    writeXchatPendingComposerHandoff({ prompt: "Desk prompt" });
    consumeXchatPendingComposerHandoff();
    clearXchatPendingComposerHandoffMemory();
    // Also drain the sessionStorage backing store (simulates the value having been fully consumed)
    store.clear();
    expect(consumeXchatPendingComposerHandoff().prompt).toBe("");
  });
});
