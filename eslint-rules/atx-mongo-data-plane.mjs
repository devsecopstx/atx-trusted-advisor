/**
 * @file Enforces the sprint policy: no new direct Mongo writes from Next `src/app/api/**` route handlers,
 * and no `MongoClient` imports outside `src/lib/mongodb.ts`. Extend `API_ROUTE_MONGO_WRITE_ALLOWLIST`
 * only for legacy exceptions being migrated to Spring BFF.
 * @see atx-docs/sre-ops/mongo-next-write-boundary.md
 */
import path from "node:path";

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
  "src/app/api/admin/tenants/[tenantId]/workspace-limits/route.ts"
]);

function repoRelativeFilename(filename) {
  const abs = path.resolve(filename);
  const root = path.resolve(process.cwd());
  let rel = path.relative(root, abs).replace(/\\/g, "/");
  if (rel.startsWith("../")) {
    return abs.replace(/\\/g, "/");
  }
  return rel;
}

function isUnderSrcAppApiRoute(rel) {
  return rel.startsWith("src/app/api/") && (rel.endsWith("/route.ts") || rel.endsWith("/route.tsx"));
}

/** @type {import('eslint').ESLint.Plugin} */
export const atxMongoDataPlane = {
  meta: { name: "atx-mongo-data-plane", version: "1.0.0" },
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
    "no-collection-write-in-app-api-routes": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow Mongo collection write helpers (updateOne, insertOne, …) in src/app/api route handlers — use Spring BFF or delegate to src/modules/* repositories."
        },
        schema: [],
        messages: {
          banned:
            "Mongo write '{{method}}' is not allowed in App Router API handlers (POST/PUT/PATCH/DELETE must go through backend APIs). Move to Spring BFF + proxy, or call a repository module from a thin route. Allowlisted legacy files: see eslint-rules/atx-mongo-data-plane.mjs."
        }
      },
      create(context) {
        const rel = repoRelativeFilename(context.filename);
        if (!isUnderSrcAppApiRoute(rel)) {
          return {};
        }
        if (API_ROUTE_MONGO_WRITE_ALLOWLIST.has(rel)) {
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
    }
  }
};
