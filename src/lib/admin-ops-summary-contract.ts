import type { RedisHealth } from "@/lib/redis-client";

export type AdminOpsSummaryBackend = {
  role: "compute_backend";
  label: string;
  configured: boolean;
  origin: string | null;
  skippedReason?: string;
  httpReachable: boolean;
  httpStatus?: number;
  fetchError?: string;
  service?: string;
  timeUtc?: string;
  mongoStatus?: string;
  redisStatus?: string;
  redisDetail?: string;
};

export type AdminOpsSummaryResponse = {
  generatedAt: string;
  sessionTenantId: string;
  nextApp: {
    role: "frontend";
    label: string;
    service: string;
    version: string;
    database: { ok: boolean; name: string | null; error?: string };
    redis: RedisHealth;
  };
  backend: AdminOpsSummaryBackend;
};
