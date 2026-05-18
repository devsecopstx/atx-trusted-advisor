#!/usr/bin/env node
/**
 * Reports source CSS sizes for xChat / portfolio desks and, when present, built chunks under .next/static/css.
 * Run after `npm run build` to correlate source split with emitted CSS files.
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const sourceFiles = [
  "src/app/xchat/xchat.css",
  "src/app/xchat/xchat-shell.css",
  "src/app/xchat/xchat-thread.css",
  "src/app/portfolios/portfolios-dashboard.css",
  "src/app/watchlist/watchlist.css"
];

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function fileSize(rel) {
  const abs = path.join(root, rel);
  try {
    const s = await stat(abs);
    return s.size;
  } catch {
    return null;
  }
}

async function builtCssSizes() {
  const dir = path.join(root, ".next/static/css");
  try {
    const names = await readdir(dir);
    const rows = await Promise.all(
      names
        .filter((n) => n.endsWith(".css"))
        .map(async (n) => {
          const s = await stat(path.join(dir, n));
          return { name: n, bytes: s.size };
        })
    );
    return rows.sort((a, b) => b.bytes - a.bytes);
  } catch {
    return null;
  }
}

console.log("Source CSS (bytes on disk):\n");
let sourceTotal = 0;
for (const rel of sourceFiles) {
  const bytes = await fileSize(rel);
  if (bytes == null) {
    console.log(`  (missing) ${rel}`);
    continue;
  }
  sourceTotal += bytes;
  console.log(`  ${kb(bytes).padStart(10)}  ${rel}`);
}
console.log(`  ${kb(sourceTotal).padStart(10)}  (listed total)\n`);

const built = await builtCssSizes();
if (!built) {
  console.log("No .next/static/css — run `NODE_ENV=production npm run build` first for emitted chunk sizes.\n");
  process.exit(0);
}

console.log("Built CSS chunks (.next/static/css, top 15):\n");
for (const row of built.slice(0, 15)) {
  console.log(`  ${kb(row.bytes).padStart(10)}  ${row.name}`);
}
console.log(`\n  ${built.length} file(s) total, ${kb(built.reduce((n, r) => n + r.bytes, 0))} combined\n`);
