/**
 * Minimal Mustache subset used by admin email templates. Intentionally narrow:
 *
 * - `{{var}}` and `{{path.to.var}}` simple substitution (HTML-escaped by default).
 * - `{{{var}}}` and `{{& var}}` raw substitution (NOT escaped — only used internally for pre-rendered HTML).
 * - `{{#section}} … {{/section}}` array/boolean sections. Inside an array section, dot-paths and
 *   bare `{{this}}` resolve against each item; outer scope is also accessible.
 * - `{{^section}} … {{/section}}` inverted sections (renders when value is falsy/empty array).
 * - `{{! comment }}` ignored.
 *
 * Not supported (intentional): partials, lambdas, set delimiters, dotted-falsey ambiguity beyond above.
 *
 * Goals: zero runtime deps, predictable output for templated email subjects + Markdown bodies,
 * safe HTML escaping for any operator-controlled variable values.
 */

type ContextStack = ReadonlyArray<unknown>;

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function lookupInScope(scope: unknown, segment: string): unknown {
  if (segment === "this" || segment === ".") {
    return scope;
  }
  if (isPlainObject(scope)) {
    return scope[segment];
  }
  return undefined;
}

function resolvePath(stack: ContextStack, path: string): unknown {
  if (path === "." || path === "this") {
    return stack[stack.length - 1];
  }
  const segments = path.split(".").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    let current = stack[i];
    let resolved: unknown = current;
    let ok = true;
    for (const seg of segments) {
      resolved = lookupInScope(resolved, seg);
      if (resolved === undefined) {
        ok = false;
        break;
      }
      current = resolved;
    }
    if (ok) {
      return resolved;
    }
  }
  return undefined;
}

function stringifyScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function isTruthySection(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value === null || value === undefined || value === false || value === 0 || value === "") {
    return false;
  }
  return true;
}

type Token =
  | { kind: "text"; value: string }
  | { kind: "var"; path: string; escape: boolean }
  | { kind: "section"; path: string; inverted: boolean; children: Token[] };

const TAG = /\{\{\s*([!#^/&]?)\s*([^}]*?)\s*\}\}/g;

function parseTokens(template: string): Token[] {
  const root: Token[] = [];
  const stack: { path: string; inverted: boolean; children: Token[] }[] = [
    { path: "__root__", inverted: false, children: root }
  ];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG.lastIndex = 0;
  while ((match = TAG.exec(template)) !== null) {
    const [raw, sigil, body] = match;
    const start = match.index;
    if (start > lastIndex) {
      const text = template.slice(lastIndex, start);
      const top = stack[stack.length - 1]!;
      top.children.push({ kind: "text", value: text });
    }
    lastIndex = start + raw.length;
    const path = body!.trim();
    if (sigil === "!") {
      continue;
    }
    if (sigil === "#" || sigil === "^") {
      const node = { path, inverted: sigil === "^", children: [] as Token[] };
      const top = stack[stack.length - 1]!;
      top.children.push({ kind: "section", path, inverted: node.inverted, children: node.children });
      stack.push(node);
      continue;
    }
    if (sigil === "/") {
      const open = stack.pop();
      if (!open || open.path !== path) {
        throw new Error(
          `mustache-render: unbalanced section: closing "${path}" but open is "${open?.path ?? "(none)"}"`
        );
      }
      continue;
    }
    if (sigil === "{") {
      // matches `{{{var}}}` — TAG regex captures `{var` in body, sigil is "{". We don't get here under TAG regex above.
      continue;
    }
    const escape = sigil !== "&";
    const top = stack[stack.length - 1]!;
    top.children.push({ kind: "var", path: sigil === "&" ? path : path, escape });
  }
  if (lastIndex < template.length) {
    const tail = template.slice(lastIndex);
    const top = stack[stack.length - 1]!;
    top.children.push({ kind: "text", value: tail });
  }
  if (stack.length !== 1) {
    throw new Error(`mustache-render: unclosed section "${stack[stack.length - 1]!.path}"`);
  }
  return root;
}

function renderTokens(tokens: ReadonlyArray<Token>, stack: ContextStack): string {
  let out = "";
  for (const token of tokens) {
    if (token.kind === "text") {
      out += token.value;
      continue;
    }
    if (token.kind === "var") {
      const value = resolvePath(stack, token.path);
      const str = stringifyScalar(value);
      out += token.escape ? escapeHtml(str) : str;
      continue;
    }
    const value = resolvePath(stack, token.path);
    const truthy = isTruthySection(value);
    if (token.inverted) {
      if (!truthy) {
        out += renderTokens(token.children, stack);
      }
      continue;
    }
    if (!truthy) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        out += renderTokens(token.children, [...stack, item]);
      }
      continue;
    }
    if (isPlainObject(value)) {
      out += renderTokens(token.children, [...stack, value]);
      continue;
    }
    out += renderTokens(token.children, stack);
  }
  return out;
}

export type MustacheRenderOptions = {
  /** When true, `{{var}}` does NOT HTML-escape — used for plain-text subject substitution. */
  rawByDefault?: boolean;
};

export function renderMustache(
  template: string,
  context: Record<string, unknown>,
  options: MustacheRenderOptions = {}
): string {
  const tokens = parseTokens(template);
  if (options.rawByDefault) {
    forEachVarToken(tokens, (token) => {
      token.escape = false;
    });
  }
  return renderTokens(tokens, [context]);
}

function forEachVarToken(tokens: Token[], visit: (token: { kind: "var"; path: string; escape: boolean }) => void): void {
  for (const token of tokens) {
    if (token.kind === "var") {
      visit(token);
      continue;
    }
    if (token.kind === "section") {
      forEachVarToken(token.children, visit);
    }
  }
}
