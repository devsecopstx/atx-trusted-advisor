import { MongoClient } from "mongodb";

import { resolveMongoUri, resolveSeedDbName } from "./lib/resolve-mongo-uri.mjs";

const DB_NAME = resolveSeedDbName();

async function run() {
  const client = new MongoClient(resolveMongoUri());
  await client.connect();
  const db = client.db(DB_NAME);

  try {
    const users = await db
      .collection("core_users")
      .find({ "xAccount.username": { $exists: true } })
      .toArray();
    const userByUsername = new Map(
      users
        .filter((user) => user._id && user.xAccount?.username)
        .map((user) => [String(user.xAccount.username).toLowerCase(), user])
    );

    const membershipByUserId = new Map();
    for (const user of users) {
      const membership = await db
        .collection("core_tenant_memberships")
        .findOne({ userId: user._id, isDefaultTenant: true });
      if (membership?.tenantId) {
        membershipByUserId.set(String(user._id), membership.tenantId);
      }
    }

    const chatLogs = await db
      .collection("xchat_logs")
      .find({
        $or: [{ userId: { $exists: false } }, { tenantId: { $exists: false } }]
      })
      .toArray();

    let updatedChatCount = 0;
    for (const log of chatLogs) {
      if (!log.requestedBy) {
        continue;
      }
      const mappedUser = userByUsername.get(String(log.requestedBy).toLowerCase());
      if (!mappedUser?._id) {
        continue;
      }
      const tenantId = membershipByUserId.get(String(mappedUser._id));
      await db.collection("xchat_logs").updateOne(
        { _id: log._id },
        {
          $set: {
            userId: mappedUser._id,
            tenantId,
            userEmail: mappedUser.email
          }
        }
      );
      updatedChatCount += 1;
    }

    const ragFiles = await db
      .collection("xai_collections")
      .find({
        $or: [{ userId: { $exists: false } }, { tenantId: { $exists: false } }]
      })
      .toArray();

    let updatedRagFileCount = 0;
    for (const file of ragFiles) {
      if (!file.uploadedBy) {
        continue;
      }
      const mappedUser = userByUsername.get(String(file.uploadedBy).toLowerCase());
      if (!mappedUser?._id) {
        continue;
      }
      const tenantId = membershipByUserId.get(String(mappedUser._id));
      await db.collection("xai_collections").updateOne(
        { _id: file._id },
        {
          $set: {
            userId: mappedUser._id,
            tenantId,
            userEmail: mappedUser.email
          }
        }
      );

      await db.collection("xchat_rag_chunks").updateMany(
        { fileId: file._id },
        {
          $set: {
            userId: mappedUser._id,
            tenantId
          }
        }
      );
      updatedRagFileCount += 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          updatedChatCount,
          updatedRagFileCount
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
