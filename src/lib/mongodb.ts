import { Db, MongoClient } from "mongodb";

import { getMongoUriFromB64, MONGODB_DB_NAME } from "@/lib/env";

type GlobalMongoCache = {
  client?: MongoClient;
};

const globalCache = globalThis as typeof globalThis & {
  __mongo?: GlobalMongoCache;
};

const cache: GlobalMongoCache = globalCache.__mongo ?? {};

if (!globalCache.__mongo) {
  globalCache.__mongo = cache;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (cache.client) {
    return cache.client;
  }

  const mongoUri = getMongoUriFromB64();

  const client = new MongoClient(mongoUri, {
    maxPoolSize: 20
  });

  await client.connect();
  cache.client = client;
  return client;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(MONGODB_DB_NAME);
}
