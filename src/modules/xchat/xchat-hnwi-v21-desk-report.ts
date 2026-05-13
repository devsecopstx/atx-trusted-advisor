import type { HnwiPromptTemplateV21Slug } from "@/modules/xchat/prompt-templates-v21-defaults";

/** User-visible / log marker for v2.1 desk turns. */
export const HNWI_DESK_REPORT_V21_TITLE = "Desk Report v2.1";

const DESK_TABLE_COLUMNS =
  "Strategy | Underlying | Strike | Expiry | Premium | Contracts | Annualized ROC | PoP | Assignment risk | Rationale";

/**
 * Appended to the xChat system prompt when the client sends `hnwiPromptTemplateV21Slug`
 * (quick-action / v2.1 template turns). Keeps structure auditable across tenants.
 */
export function buildHnwiV21DeskReportSystemAddon(slug: HnwiPromptTemplateV21Slug): string {
  return [
    `## ${HNWI_DESK_REPORT_V21_TITLE}`,
    `Template slug: \`${slug}\` (HNWI options desk standardization v2.1).`,
    "",
    "For this turn, structure the assistant reply exactly with the following Markdown sections (headings must match):",
    "",
    "### Executive snapshot",
    "- 3–6 bullets: book posture, key risks, and what changed vs prior context if any.",
    "",
    "### Ideas",
    `- Up to five concrete options-income or risk-management ideas aligned with the user request and workspace.`,
    `- Include one **markdown pipe table** with columns: **${DESK_TABLE_COLUMNS}**.`,
    "- If data is missing for a cell, use `—` rather than inventing fills.",
    "",
    "### Risk & disclaimer",
    "- Not financial advice; cite tools/RAG when used; no fabricated fills.",
    ""
  ].join("\n");
}

export type HnwiV21DeskReportValidation = {
  ok: boolean;
  missing: string[];
};

/**
 * Soft validation after the model returns — operational warning only (does not rewrite output).
 */
export function validateHnwiV21DeskReportMarkdown(markdown: string): HnwiV21DeskReportValidation {
  const text = markdown.trim();
  const lower = text.toLowerCase();
  const missing: string[] = [];
  if (!lower.includes(HNWI_DESK_REPORT_V21_TITLE.toLowerCase())) {
    missing.push("title:Desk Report v2.1");
  }
  const hasHeading = (label: string) =>
    new RegExp(`^#{1,6}\\s+${label}\\s*$`, "im").test(text) || lower.includes(`### ${label}`) || lower.includes(`## ${label}`);
  if (!hasHeading("executive snapshot")) {
    missing.push("heading:Executive snapshot");
  }
  if (!hasHeading("ideas")) {
    missing.push("heading:Ideas");
  }
  // Avoid `[` / `]` literals in RegExp string fragments — Tailwind v4 can treat `[...]` in TS as
  // arbitrary-property candidates and emit invalid CSS during PostCSS.
  const lb = String.fromCharCode(0x5b);
  const rb = String.fromCharCode(0x5d);
  const pipe = String.fromCharCode(0x7c);
  const mdPipeTableDivider = new RegExp(
    "\\n\\|" + lb + "-" + ":" + "\\s" + pipe + rb + "+" + "\\|\\s*\\n"
  );
  if (!/\|/.test(text) || !mdPipeTableDivider.test(text)) {
    missing.push("markdown_table");
  }
  if (!hasHeading("risk & disclaimer") && !hasHeading("risk")) {
    missing.push("heading:Risk & disclaimer");
  }
  return { ok: missing.length === 0, missing };
}
