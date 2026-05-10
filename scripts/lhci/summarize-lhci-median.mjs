#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = {
    manifest: ".lighthouseci/reports-auth/manifest.json",
    out: ""
  };
  for (const raw of argv) {
    if (raw.startsWith("--manifest=")) {
      out.manifest = raw.slice("--manifest=".length);
      continue;
    }
    if (raw.startsWith("--out=")) {
      out.out = raw.slice("--out=".length);
      continue;
    }
  }
  return out;
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value, digits = 3) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const mul = 10 ** digits;
  return Math.round(value * mul) / mul;
}

function summarizeUrl(url, reportPaths) {
  const rows = reportPaths.map((jsonPath) => {
    const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const audits = report.audits ?? {};
    const num = (id) => {
      const v = audits[id]?.numericValue;
      return Number.isFinite(v) ? v : null;
    };
    return {
      score: Number.isFinite(report.categories?.performance?.score)
        ? report.categories.performance.score
        : null,
      lcpMs: num("largest-contentful-paint"),
      fcpMs: num("first-contentful-paint"),
      tbtMs: num("total-blocking-time"),
      speedIndexMs: num("speed-index"),
      cls: num("cumulative-layout-shift"),
      serverResponseMs: num("server-response-time")
    };
  });

  const collect = (k) => rows.map((r) => r[k]).filter((v) => v != null);
  const scoreVals = collect("score");
  const lcpVals = collect("lcpMs");
  const fcpVals = collect("fcpMs");
  const tbtVals = collect("tbtMs");
  const siVals = collect("speedIndexMs");
  const clsVals = collect("cls");
  const srVals = collect("serverResponseMs");

  return {
    url,
    runs: rows.length,
    median: {
      performance: round(median(scoreVals), 2),
      lcpMs: round(median(lcpVals), 1),
      fcpMs: round(median(fcpVals), 1),
      tbtMs: round(median(tbtVals), 1),
      speedIndexMs: round(median(siVals), 1),
      cls: round(median(clsVals), 4),
      serverResponseMs: round(median(srVals), 1)
    },
    spread: {
      performanceMin: scoreVals.length ? round(Math.min(...scoreVals), 2) : null,
      performanceMax: scoreVals.length ? round(Math.max(...scoreVals), 2) : null,
      lcpMinMs: lcpVals.length ? round(Math.min(...lcpVals), 1) : null,
      lcpMaxMs: lcpVals.length ? round(Math.max(...lcpVals), 1) : null,
      serverResponseMinMs: srVals.length ? round(Math.min(...srVals), 1) : null,
      serverResponseMaxMs: srVals.length ? round(Math.max(...srVals), 1) : null
    }
  };
}

function formatMarkdownTable(rows) {
  const header = [
    "| URL | runs | perf (median) | LCP ms | FCP ms | TBT ms | SpeedIndex ms | CLS | TTFB ms |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|"
  ];
  const body = rows.map((r) => {
    const m = r.median;
    return `| ${r.url} | ${r.runs} | ${m.performance ?? "-"} | ${m.lcpMs ?? "-"} | ${m.fcpMs ?? "-"} | ${m.tbtMs ?? "-"} | ${m.speedIndexMs ?? "-"} | ${m.cls ?? "-"} | ${m.serverResponseMs ?? "-"} |`;
  });
  return [...header, ...body].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error(`Manifest has no runs: ${manifestPath}`);
  }

  const grouped = new Map();
  for (const row of manifest) {
    const url = row?.url;
    const jsonPath = row?.jsonPath;
    if (typeof url !== "string" || typeof jsonPath !== "string") {
      continue;
    }
    if (!grouped.has(url)) {
      grouped.set(url, []);
    }
    grouped.get(url).push(jsonPath);
  }

  const summaries = [...grouped.entries()]
    .map(([url, reportPaths]) => summarizeUrl(url, reportPaths))
    .sort((a, b) => a.url.localeCompare(b.url));

  const markdown = formatMarkdownTable(summaries);
  console.log("LHCI median summary");
  console.log(markdown);

  const payload = {
    generatedAt: new Date().toISOString(),
    manifest: manifestPath,
    summaries
  };

  if (args.out) {
    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`\nWrote JSON summary: ${outPath}`);
  }
}

main();
