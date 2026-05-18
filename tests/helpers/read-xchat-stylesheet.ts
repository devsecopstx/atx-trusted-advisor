import { readFileSync } from "node:fs";
import { join } from "node:path";

const XCHAT_DIR = join(process.cwd(), "src/app/xchat");

/** Layout, plans guest, workspace rail — imported by non-chat product routes. */
export function readXchatShellCss(): string {
  return readFileSync(join(XCHAT_DIR, "xchat-shell.css"), "utf8");
}

/** Conversation thread, composer, templates strip — mounted with approved xChat. */
export function readXchatThreadCss(): string {
  return readFileSync(join(XCHAT_DIR, "xchat-thread.css"), "utf8");
}

/** Shell + thread (parity with `xchat.css` aggregate imports). */
export function readXchatFullCss(): string {
  return `${readXchatShellCss()}\n${readXchatThreadCss()}`;
}

/** `xchat.css` entry (import-only after CSS split). */
export function readXchatCssEntry(): string {
  return readFileSync(join(XCHAT_DIR, "xchat.css"), "utf8");
}
