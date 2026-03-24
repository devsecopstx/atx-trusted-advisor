import { z } from "zod";

import type { OpenApiSchema } from "@/lib/openapi/types";

/**
 * Zod shapes for OpenAPI "route cluster" success envelopes (aligned with components.schemas in current-state).
 * Use for tests and future runtime validation; OpenAPI fragments stay hand-authored for 3.1 compatibility.
 */

export const atxErrorBodySchema = z.object({
  error: z.string(),
  details: z.unknown().optional()
});

/** Typical session-scoped JSON body: `{ data: … }` plus optional top-level keys. */
export const atxSessionJsonSuccessSchema = z.object({ data: z.unknown() }).passthrough();

/** Admin routes use the same envelope as session in practice. */
export const atxAdminJsonSuccessSchema = z.object({ data: z.unknown() }).passthrough();

/** Public routes: health, OpenAPI meta, or ad-hoc JSON. */
export const atxPublicJsonSuccessSchema = z.union([
  z.object({ status: z.string() }),
  z.object({ data: z.unknown() }).passthrough(),
  z.record(z.string(), z.unknown())
]);

/** OpenAPI 3.1 component fragments merged into `buildCurrentStateOpenApi`. */
export const ATX_CLUSTER_OPENAPI_SCHEMAS: Record<string, OpenApiSchema> = {
  AtxSessionJsonSuccess: {
    type: "object",
    required: ["data"],
    properties: {
      data: { description: "Route-specific payload (see handler / overrides)." }
    },
    additionalProperties: true,
    description:
      "Session-scoped success JSON (Zod: atxSessionJsonSuccessSchema). Extra keys may appear on some routes."
  },
  AtxAdminJsonSuccess: {
    type: "object",
    required: ["data"],
    properties: {
      data: { description: "Route-specific payload (see handler / overrides)." }
    },
    additionalProperties: true,
    description:
      "Admin success JSON (Zod: atxAdminJsonSuccessSchema). Mirrors session envelope for most `/api/admin/*` routes."
  },
  AtxPublicJsonSuccess: {
    oneOf: [
      {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string" } },
        additionalProperties: true
      },
      {
        type: "object",
        required: ["data"],
        properties: {
          data: { description: "Public payload when wrapped." }
        },
        additionalProperties: true
      },
      {
        type: "object",
        additionalProperties: true,
        description: "Other small public JSON objects (e.g. OpenAPI document root)."
      }
    ],
    description: "Public-route success JSON (Zod: atxPublicJsonSuccessSchema)."
  }
};
