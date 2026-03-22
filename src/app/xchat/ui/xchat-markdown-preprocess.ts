/**
 * Light cleanup before ReactMarkdown — Grok/xAI output quirks and denser market summaries.
 */

export function preprocessXchatMarkdown(raw: string): string {
  if (!raw.trim()) {
    return raw;
  }
  let s = raw.replace(/\*\*\*\*/g, "**");
  s = s.replace(/(?:\n[ \t]*){3,}/g, "\n\n");

  const lines = s.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (
      t.length > 0 &&
      t.length < 240 &&
      !t.startsWith("#") &&
      !t.startsWith("|") &&
      !t.startsWith("```") &&
      !t.startsWith("-") &&
      !t.startsWith("*") &&
      !t.includes("://") &&
      /^[A-Z][A-Za-z0-9 '&/%+.()–-]{0,44}:\s+\S/.test(t)
    ) {
      const colon = t.indexOf(":");
      const key = t.slice(0, colon).trim();
      const rest = t.slice(colon + 1).trim();
      out.push(`### ${key}`);
      out.push(rest);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
