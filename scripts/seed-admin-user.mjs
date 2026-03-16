import { MongoClient } from "mongodb";

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "atxbogart@gmail.com";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "xfinance-core";
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? "xFinance Core";
const DB_NAME = process.env.MONGODB_DB_NAME ?? "xfinancedb";

function decodeMongoUri() {
  const encoded = process.env.MONGODB_URI_B64 ?? process.env.MONGODB_URI_B4;
  if (!encoded) {
    throw new Error("Set MONGODB_URI_B64 (or legacy alias MONGODB_URI_B4)");
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();
  if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
    throw new Error("Decoded Mongo URI is invalid");
  }
  return decoded;
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("core_users").createIndex({ email: 1 }, { unique: true, name: "uniq_core_user_email" }),
    db.collection("core_users").createIndex(
      { "xAccount.xUserId": 1 },
      { unique: true, sparse: true, name: "uniq_core_user_x_user_id" }
    ),
    db.collection("core_tenants").createIndex({ slug: 1 }, { unique: true, name: "uniq_tenant_slug" }),
    db.collection("core_tenants").createIndex(
      { isDefault: 1 },
      {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_tenant"
      }
    ),
    db.collection("core_tenant_memberships").createIndex(
      { userId: 1, tenantId: 1 },
      { unique: true, name: "uniq_membership_user_tenant" }
    )
  ]);
}

async function seed() {
  const mongoUri = decodeMongoUri();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);
  const now = new Date();
  const email = normalizeEmail(ADMIN_EMAIL);

  try {
    await ensureIndexes(db);

    await db.collection("core_users").updateOne(
      { email },
      {
        $setOnInsert: {
          email,
          createdAt: now
        },
        $set: {
          roles: ["global_admin"],
          status: "active",
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const user = await db.collection("core_users").findOne({ email });
    if (!user?._id) {
      throw new Error("Failed to create or fetch seeded admin user");
    }

    await db.collection("core_tenants").updateOne(
      { slug: DEFAULT_TENANT_SLUG },
      {
        $setOnInsert: {
          slug: DEFAULT_TENANT_SLUG,
          name: DEFAULT_TENANT_NAME,
          createdAt: now
        },
        $set: {
          isDefault: true,
          updatedAt: now
        }
      },
      { upsert: true }
    );
    const tenant = await db.collection("core_tenants").findOne({ slug: DEFAULT_TENANT_SLUG });
    if (!tenant?._id) {
      throw new Error("Failed to create or fetch default tenant");
    }

    await db.collection("core_tenant_memberships").updateOne(
      { userId: user._id, tenantId: tenant._id },
      {
        $setOnInsert: { createdAt: now },
        $set: {
          role: "tenant_admin",
          isDefaultTenant: true,
          updatedAt: now
        }
      },
      { upsert: true }
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          adminEmail: email,
          userId: String(user._id),
          tenantId: String(tenant._id),
          tenantSlug: tenant.slug
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
