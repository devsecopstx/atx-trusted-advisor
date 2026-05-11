import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    clearXchatPendingComposerHandoffMemory,
    consumeXchatPendingComposerHandoff,
    writeXchatPendingComposerHandoff
} from "@/lib/xchat/xchat-pending-prompt";

describe("xchat pending composer handoff", () => {
  beforeEach(() => {
    clearXchatPendingComposerHandoffMemory();
    sessionStorage.clear();
  });

  afterEach(() => {
    clearXchatPendingComposerHandoffMemory();
    sessionStorage.clear();
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
    expect(consumeXchatPendingComposerHandoff().prompt).toBe("");
  });
});
