export type XchatThreadViewportAnchorTarget = {
  mainChatScrollEl: HTMLElement | null;
  threadScrollEl: HTMLElement | null;
  stickyLatestPromptEl: HTMLElement | null;
  messagesEndEl: HTMLElement | null;
  threadVirtualized: boolean;
  lastVisibleMessageIndex: number;
  scrollToVirtualIndex?: (index: number, behavior: ScrollBehavior) => void;
};

/**
 * After a successful send or assistant turn lands, keep the Latest prompt chrome and
 * preceding turns in the primary chat viewport so the composer duplicate fades below focus.
 */
export function anchorXchatThreadViewportAfterTurn(
  target: XchatThreadViewportAnchorTarget,
  behavior: ScrollBehavior = "smooth"
): void {
  const run = () => {
    target.mainChatScrollEl?.scrollTo({ top: 0, behavior });

    target.stickyLatestPromptEl?.scrollIntoView({
      behavior,
      block: "start",
      inline: "nearest"
    });

    if (
      target.threadVirtualized &&
      target.scrollToVirtualIndex &&
      target.lastVisibleMessageIndex >= 0
    ) {
      target.scrollToVirtualIndex(target.lastVisibleMessageIndex, behavior);
    } else if (target.threadScrollEl) {
      const rows = target.threadScrollEl.querySelectorAll<HTMLElement>(".xchat-thread-row");
      const lastRow = rows.item(rows.length - 1);
      if (lastRow) {
        lastRow.scrollIntoView({ behavior, block: "start", inline: "nearest" });
      } else {
        target.messagesEndEl?.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
      }
    } else {
      target.messagesEndEl?.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
    }
  };

  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
}

export type ClearXchatComposerDraftOptions = {
  blur?: boolean;
};

/** Reset composer draft + textarea height after a successful dispatch. */
export function clearXchatComposerDraft(
  setInput: (value: string) => void,
  composerEl: HTMLTextAreaElement | null,
  resizeComposer: () => void,
  options: ClearXchatComposerDraftOptions = {}
): void {
  setInput("");
  if (!composerEl) {
    return;
  }
  composerEl.value = "";
  resizeComposer();
  if (options.blur) {
    composerEl.blur();
  }
}
