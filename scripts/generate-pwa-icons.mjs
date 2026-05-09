#!/usr/bin/env node
/**
 * Resize public/pwa/atx-logo-512.png into WebP icons under public/icons/.
 * Requires sharp (provided by Next.js / @capacitor/assets in this repo).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public/pwa/atx-logo-512.png");
const outDir = path.join(root, "public/icons");
const sizes = [48, 72, 96, 128, 192, 256, 512];

if (!fs.existsSync(src)) {
  console.error(`Missing source: ${src}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

for (const s of sizes) {
  const dest = path.join(outDir, `icon-${s}.webp`);
  await sharp(src)
    .resize(s, s, { fit: "cover", position: "centre" })
    .webp({ quality: 88 })
    .toFile(dest);
  console.log("wrote", path.relative(root, dest));
}
