import { describe, expect, it } from "vitest";

import {
  atxAdminJsonSuccessSchema,
  atxErrorBodySchema,
  atxPublicJsonSuccessSchema,
  atxSessionJsonSuccessSchema
} from "@/lib/openapi/cluster-schemas";

describe("atx openapi cluster Zod schemas", () => {
  it("accepts typical session envelope", () => {
    expect(atxSessionJsonSuccessSchema.safeParse({ data: { id: "1" }, meta: 1 }).success).toBe(true);
  });

  it("accepts admin envelope like session", () => {
    expect(atxAdminJsonSuccessSchema.safeParse({ data: [] }).success).toBe(true);
  });

  it("accepts public health and arbitrary objects", () => {
    expect(atxPublicJsonSuccessSchema.safeParse({ status: "ok" }).success).toBe(true);
    expect(atxPublicJsonSuccessSchema.safeParse({ data: null }).success).toBe(true);
    expect(atxPublicJsonSuccessSchema.safeParse({ openapi: "3.1.0" }).success).toBe(true);
  });

  it("parses error body", () => {
    expect(atxErrorBodySchema.safeParse({ error: "nope" }).success).toBe(true);
    expect(atxErrorBodySchema.safeParse({ error: "nope", details: { x: 1 } }).success).toBe(true);
  });
});
