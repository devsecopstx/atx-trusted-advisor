/**
 * @file Enforces the sprint policy: no new direct Mongo collection writes outside the data plane
 * (`src/modules/**`, `src/lib/mongodb.ts`, and a small legacy API allowlist), no `MongoClient` imports
 * outside `src/lib/mongodb.ts`, and no ambiguous `.save()` calls outside those areas (Mongoose-style).
 * Extend `API_ROUTE_MONGO_WRITE_ALLOWLIST` only for legacy exceptions being migrated to Spring BFF.
 * @see atx-docs/sre-ops/mongo-next-write-boundary.md
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const WRITE_METHOD_NAMES = new Set([
  "updateOne",
  "insertOne",
  "insertMany",
  "deleteOne",
  "deleteMany",
  "replaceOne",
  "bulkWrite",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete"
]);

/** Relative to repo root — tenant bootstrap paths still mutating Mongo from route files until JVM cutover. */
const API_ROUTE_MONGO_WRITE_ALLOWLIST = new Set([
  "src/app/api/admin/tenants/route.ts",
  "src/app/api/admin/tenants/[tenantId]/workspace-limits/route.ts",
  "src/app/api/admin/platform/route-catalog/[tenantId]/route.ts",
  "src/app/api/admin/tenants/[tenantId]/roles/route.ts",
  "src/app/api/admin/tenants/[tenantId]/roles/[role]/route.ts"
]);

/** Known `foo.save(...)` calls that are not Mongoose (e.g. jsPDF). Add path here if ESLint flags a new false positive. */
const NON_MONGOOSE_SAVE_FILE_ALLOWLIST = new Set([
  "src/components/xoptions/wheel-report-view.tsx",
  "src/app/reports/scan/ui/options-action-scan-report.tsx",
  "src/app/xoptions/ui/quant-trader-panel.tsx"
]);

function isMongoDataPlanePath(rel) {
  if (rel.startsWith("src/modules/")) {
    return true;
  }
  if (rel === "src/lib/mongodb.ts") {
    return true;
  }
  if (API_ROUTE_MONGO_WRITE_ALLOWLIST.has(rel)) {
    return true;
  }
  return false;
}

function isLintedSrcPath(rel) {
  if (!rel.startsWith("src/")) {
    return false;
  }
  if (rel.startsWith("tests/") || rel.startsWith("scripts/") || rel.startsWith("services/")) {
    return false;
  }
  return true;
}

function repoRelativeFilename(filename) {
  const fsPath = typeof filename === "string" && filename.startsWith("file:") ? fileURLToPath(filename) : filename;
  const abs = path.resolve(fsPath);
  const root = path.resolve(process.cwd());
  let rel = path.relative(root, abs).replace(/\\/g, "/");
  if (rel.startsWith("../")) {
    return abs.replace(/\\/g, "/");
  }
  return rel;
}

/** @type {import('eslint').ESLint.Plugin} */
export const atxMongoDataPlane = {
  meta: { name: "atx-mongo-data-plane", version: "1.1.0" },
  rules: {
    "no-mongo-client-import-outside-lib": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow importing MongoClient from the mongodb package outside src/lib/mongodb.ts (use getDb / getMongoClient)."
        },
        schema: [],
        messages: {
          banned:
            "Do not import MongoClient here — use getMongoClient() / getDb() from src/lib/mongodb.ts so connections stay centralized."
        }
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            if (node.source?.value !== "mongodb") {
              return;
            }
            const rel = repoRelativeFilename(context.filename);
            if (rel === "src/lib/mongodb.ts") {
              return;
            }
            if (rel.startsWith("tests/") || rel.startsWith("scripts/") || rel.startsWith("services/")) {
              return;
            }
            if (!rel.startsWith("src/")) {
              return;
            }
            for (const spec of node.specifiers) {
              if (spec.type === "ImportSpecifier" && spec.imported?.name === "MongoClient") {
                context.report({ node: spec, messageId: "banned" });
              }
            }
          }
        };
      }
    },
    "no-mongo-collection-writes-outside-data-plane": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow Mongo collection write helpers (updateOne, insertOne, …) outside src/modules/**, src/lib/mongodb.ts, and the legacy API allowlist — use Spring BFF + thin routes, or add code under src/modules/*."
        },
        schema: [],
        messages: {
          banned:
            "Mongo write '{{method}}' is only allowed in the data plane (src/modules/**, src/lib/mongodb.ts, or API_ROUTE_MONGO_WRITE_ALLOWLIST in eslint-rules/atx-mongo-data-plane.mjs). Route handlers should proxy to Spring or call a repository module."
        }
      },
      create(context) {
        const rel = repoRelativeFilename(context.filename);
        if (!isLintedSrcPath(rel) || isMongoDataPlanePath(rel)) {
          return {};
        }
        return {
          CallExpression(node) {
            if (node.callee?.type !== "MemberExpression") {
              return;
            }
            const prop = node.callee.property;
            if (prop?.type !== "Identifier") {
              return;
            }
            if (!WRITE_METHOD_NAMES.has(prop.name)) {
              return;
            }
            context.report({
              node,
              messageId: "banned",
              data: { method: prop.name }
            });
          }
        };
      }
    },
    "no-suspicious-save-outside-data-plane": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow `.save()` calls outside the data plane unless the receiver is `ctx` (canvas) or the file is allowlisted for jsPDF and similar."
        },
        schema: [],
        messages: {
          banned:
            "`.save()` here looks like a persistence side-effect. Mongoose `document.save()` belongs in src/modules/**. If this is canvas `ctx.save()` use a `ctx` receiver; if it is jsPDF or similar, add this file to NON_MONGOOSE_SAVE_FILE_ALLOWLIST in eslint-rules/atx-mongo-data-plane.mjs."
        }
      },
      create(context) {
        const rel = repoRelativeFilename(context.filename);
        if (!isLintedSrcPath(rel) || isMongoDataPlanePath(rel)) {
          return {};
        }
        if (NON_MONGOOSE_SAVE_FILE_ALLOWLIST.has(rel)) {
          return {};
        }
        return {
          CallExpression(node) {
            if (node.callee?.type !== "MemberExpression") {
              return;
            }
            const prop = node.callee.property;
            if (prop?.type !== "Identifier" || prop.name !== "save") {
              return;
            }
            const obj = node.callee.object;
            if (obj?.type === "Identifier" && obj.name === "ctx") {
              return;
            }
            context.report({ node, messageId: "banned" });
          }
        };
      }
    }
  }
};
