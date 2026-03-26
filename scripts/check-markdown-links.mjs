import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const defaultFiles = ["atx-docs/guides/README.md"];
const filesToCheck = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultFiles;

/**
 * Lightweight markdown link checker for local repo docs.
 * Scope:
 * - Validates local markdown links like ./foo.md, ../bar.md#anchor, #anchor
 * - Skips external URLs (http/https/mailto/tel)
 */

const markdownLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
const headingRegex = /^#{1,6}\s+(.+)$/gm;
const htmlAnchorRegex = /<a\s+id=["']([^"']+)["']\s*><\/a>/g;

const errors = [];
const anchorCache = new Map();

function normalizeTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }
  // Drop optional title suffix: (path "title")
  const firstSpace = trimmed.indexOf(" ");
  return firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
}

function isExternalLink(target) {
  return (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("tel:")
  );
}

function slugifyHeading(rawHeading) {
  const normalized = rawHeading
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized;
}

function readAnchors(absPath) {
  if (anchorCache.has(absPath)) {
    return anchorCache.get(absPath);
  }

  if (!fs.existsSync(absPath)) {
    anchorCache.set(absPath, new Set());
    return new Set();
  }

  const content = fs.readFileSync(absPath, "utf8");
  const anchors = new Set();
  const slugCounts = new Map();

  let match;
  while ((match = htmlAnchorRegex.exec(content)) !== null) {
    anchors.add(match[1]);
  }

  while ((match = headingRegex.exec(content)) !== null) {
    const base = slugifyHeading(match[1]);
    if (!base) continue;
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  anchorCache.set(absPath, anchors);
  return anchors;
}

function checkFile(relFilePath) {
  const absFilePath = path.resolve(repoRoot, relFilePath);
  if (!fs.existsSync(absFilePath)) {
    errors.push(`Missing markdown file: ${relFilePath}`);
    return;
  }

  const content = fs.readFileSync(absFilePath, "utf8");
  let match;

  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const startIdx = match.index;
    const prevChar = startIdx > 0 ? content[startIdx - 1] : "";
    if (prevChar === "!") {
      continue; // skip image links
    }

    const rawTarget = match[1];
    const target = normalizeTarget(rawTarget);
    if (!target || isExternalLink(target)) {
      continue;
    }

    const [pathPart, anchorPart] = target.split("#");
    const hasAnchor = target.includes("#");

    if (!pathPart && hasAnchor) {
      const anchors = readAnchors(absFilePath);
      if (!anchors.has(anchorPart)) {
        errors.push(`${relFilePath}: missing local anchor '#${anchorPart}'`);
      }
      continue;
    }

    const linkedAbsPath = path.resolve(path.dirname(absFilePath), pathPart);
    const linkedRelPath = path.relative(repoRoot, linkedAbsPath) || relFilePath;

    if (!fs.existsSync(linkedAbsPath)) {
      errors.push(`${relFilePath}: missing target '${target}'`);
      continue;
    }

    if (hasAnchor) {
      const anchors = readAnchors(linkedAbsPath);
      if (!anchors.has(anchorPart)) {
        errors.push(
          `${relFilePath}: target '${linkedRelPath}' missing anchor '#${anchorPart}'`,
        );
      }
    }
  }
}

for (const file of filesToCheck) {
  checkFile(file);
}

if (errors.length > 0) {
  console.error("[docs-links] link check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`[docs-links] OK (${filesToCheck.length} file${filesToCheck.length === 1 ? "" : "s"})`);
