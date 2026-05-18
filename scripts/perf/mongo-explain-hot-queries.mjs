#!/usr/bin/env node
/**
 * Runs explain("executionStats") for common hot Mongo paths (xchat_logs, access_requests, watchlist).
 * Usage: node --env-file=.env scripts/perf/mongo-explain-hot-queries.mjs
 */
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const dbName =
  process.env.MONGODB_DB_NAME ||
  (() => {
    try {
      const u = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
      const seg = u.pathname.replace(/^\//, "").split("/")[0];
      return seg || "atxfinance";
    } catch {
      return "atxfinance";
    }
  })();

function summarize(plan) {
  const stats = plan?.executionStats;
  if (!stats) {
    return { examined: "?", returned: "?", millis: "?" };
  }
  return {
    examined: stats.totalDocsExamined ?? stats.totalKeysExamined,
    returned: stats.nReturned,
    millis: stats.executionTimeMillis
  };
}

async function explain(coll, op, label) {
  const cursor = coll.find(op.filter, op.options);
  const plan = await cursor.explain("executionStats");
  const s = summarize(plan);
  console.log(`${label}`);
  console.log(`  filter: ${JSON.stringify(op.filter)}`);
  console.log(`  examined: ${s.examined}  returned: ${s.returned}  ms: ${s.millis}`);
  const stage = plan?.queryPlanner?.winningPlan?.inputStage?.stage;
  if (stage) {
    console.log(`  winningPlan stage: ${stage}`);
  }
  console.log("");
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const sampleUser = await db.collection("core_users").findOne({}, { projection: { _id: 1 } });
const sampleTenant = await db.collection("core_tenants").findOne({}, { projection: { _id: 1 } });
const userId = sampleUser?._id ?? new ObjectId();
const tenantId = sampleTenant?._id ?? new ObjectId();

await explain(
  db.collection("xchat_logs"),
  {
    filter: { tenantId, userId },
    options: { sort: { createdAt: -1, _id: -1 }, limit: 20 }
  },
  "xchat_logs tenant+user history"
);

await explain(
  db.collection("admin_access_requests"),
  {
    filter: { status: { $in: ["new", "triaged", "pending"] } },
    options: { sort: { requestedAt: -1 }, limit: 200 }
  },
  "admin_access_requests open queue"
);

const portfolio = await db.collection("portfolio_portfolios").findOne(
  { userId: userId.toHexString() },
  { projection: { _id: 1 } }
);
if (portfolio?._id) {
  await explain(
    db.collection("portfolio_watchlists"),
    {
      filter: { portfolioId: portfolio._id.toHexString() },
      options: { limit: 5 }
    },
    "portfolio_watchlists by portfolioId"
  );
}

await client.close();
