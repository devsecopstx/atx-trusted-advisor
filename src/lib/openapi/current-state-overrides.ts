import type {
    OpenApiMediaType,
    OpenApiOperation,
    OpenApiResponse,
    OpenApiSchema
} from "@/lib/openapi/types";

type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type OperationOverride = Pick<
  OpenApiOperation,
  "summary" | "description" | "parameters" | "requestBody" | "responses" | "deprecated"
>;

function refSchema(name: string): OpenApiSchema {
  return { $ref: `#/components/schemas/${name}` };
}

function jsonResponse(description: string, schemaName: string): OpenApiResponse {
  return {
    description,
    content: {
      "application/json": {
        schema: refSchema(schemaName)
      }
    }
  };
}

const SESSION_401_EXAMPLES: NonNullable<OpenApiMediaType["examples"]> = {
  session_required: {
    summary: "No valid session (session-scoped route)",
    description:
      "Typical when the caller is unauthenticated or `xf_core_session` is missing/expired. Exact `error` strings vary.",
    value: { error: "Unauthorized" }
  }
};

const ADMIN_403_EXAMPLES: NonNullable<OpenApiMediaType["examples"]> = {
  admin_role_required: {
    summary: "Authenticated but not allowed (admin route)",
    description:
      "Session accepted; caller lacks `global_admin` or the route-specific admin gate. Exact `error` strings vary.",
    value: { error: "Forbidden" }
  }
};

function json401Session(): OpenApiResponse {
  return {
    description: "Missing or invalid session cookie.",
    content: {
      "application/json": {
        schema: refSchema("ErrorResponse"),
        examples: SESSION_401_EXAMPLES
      }
    }
  };
}

function json403Admin(description: string, examples: NonNullable<OpenApiMediaType["examples"]> = ADMIN_403_EXAMPLES): OpenApiResponse {
  return {
    description,
    content: {
      "application/json": {
        schema: refSchema("ErrorResponse"),
        examples
      }
    }
  };
}

function xchatLimiterHeaders(includeRetryAfter: boolean): NonNullable<OpenApiResponse["headers"]> {
  const headers: NonNullable<OpenApiResponse["headers"]> = {
    "x-xchat-limit-remaining-minute": {
      description: "Remaining ask requests in the current one-minute limiter window.",
      schema: { type: "string" }
    },
    "x-xchat-limit-remaining-day": {
      description:
        "Remaining asks in the current UTC calendar window (non-admin). Billing surfaces per-hour labels for caps; this header reflects the underlying day-bucket counter.",
      schema: { type: "string" }
    },
    "x-xchat-limit-daily": {
      description:
        "Configured ask cap envelope for the caller plan + tenant (non-admin). Product copy uses per-hour framing on `/account/billing`; value aligns with usage window semantics in `ask-usage-limits`.",
      schema: { type: "string" }
    }
  };
  if (includeRetryAfter) {
    headers["retry-after"] = {
      description: "Seconds until the caller can retry after limiter rejection.",
      schema: { type: "string" }
    };
  }
  return headers;
}

const OPERATION_OVERRIDES: Record<string, OperationOverride> = {
  "GET /api/personas": {
    summary: "List personas visible to current user",
    parameters: [
      {
        name: "status",
        in: "query",
        required: false,
        description: "Admin-only persona status filter.",
        schema: {
          type: "string",
          enum: ["draft", "published", "archived"]
        }
      }
    ],
    responses: {
      "200": jsonResponse("Persona list response.", "PersonaListResponseEnvelope"),
      "401": json401Session(),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/personas": {
    summary: "Create persona",
    requestBody: {
      required: true,
      description: "Persona creation payload.",
      content: {
        "application/json": {
          schema: refSchema("PersonaCreateRequest")
        }
      }
    },
    responses: {
      "201": jsonResponse("Persona created.", "PersonaResponseEnvelope"),
      "400": jsonResponse("Invalid persona payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "409": jsonResponse("Persona name conflict.", "ConflictErrorResponse"),
      "413": jsonResponse("Persona payload too large.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/personas/sync-from-xai": {
    summary: "Sync persona specs from xAI collection into Mongo",
    description:
      "Lists documents in the trusted-advisor xpersonas xAI collection (default display name `atx-trusted-advisor-<dev|stage|prod>-xpersonas`), downloads each file, parses YAML or frontmatter markdown, and upserts `xchat_personas`. Stamps `lastXaiPersonaSync` with the acting admin user id.",
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: refSchema("PersonaSyncFromXaiRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Sync summary (counts + per-file errors).", "PersonaSyncFromXaiResponseEnvelope"),
      "400": jsonResponse("Invalid JSON payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Named xAI collection not found.", "ErrorResponse"),
      "502": jsonResponse("xAI management or file download failed.", "UpstreamErrorResponse"),
      "503": jsonResponse("Management API key missing.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/personas/{personaId}": {
    summary: "Get persona details with audit trail",
    responses: {
      "200": jsonResponse("Persona details.", "PersonaWithAuditTrailResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "PUT /api/personas/{personaId}": {
    summary: "Update persona",
    requestBody: {
      required: true,
      description: "Partial persona update payload.",
      content: {
        "application/json": {
          schema: refSchema("PersonaUpdateRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Persona updated.", "PersonaResponseEnvelope"),
      "400": jsonResponse("Invalid persona payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "409": jsonResponse("Persona name conflict.", "ConflictErrorResponse"),
      "413": jsonResponse("Persona payload too large.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "DELETE /api/personas/{personaId}": {
    summary: "Delete persona",
    responses: {
      "200": jsonResponse("Persona deleted.", "PersonaDeleteResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/personas/collections": {
    summary: "List xAI collection inventory",
    responses: {
      "200": jsonResponse("Collection inventory.", "PersonaCollectionsListResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "502": jsonResponse("Upstream xAI collections inventory failed.", "UpstreamErrorResponse")
    }
  },
  "GET /api/personas/collections/{collectionId}": {
    summary: "Get xAI collection stats (RAG index)",
    responses: {
      "200": jsonResponse("Collection stats with document/chunk/file counts.", "PersonaCollectionStatsResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Collection not found.", "ErrorResponse"),
      "502": jsonResponse("Upstream xAI collection lookup failed.", "UpstreamErrorResponse")
    }
  },
  "DELETE /api/personas/collections/{collectionId}": {
    summary: "Delete xAI collection",
    responses: {
      "200": jsonResponse("Collection deleted.", "AtxSessionJsonSuccess"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Collection not found.", "ErrorResponse"),
      "502": jsonResponse("Upstream xAI collection delete failed.", "UpstreamErrorResponse")
    }
  },
  "POST /api/personas/collections": {
    summary: "Create xAI collection",
    requestBody: {
      required: true,
      description: "xAI collection creation payload.",
      content: {
        "application/json": {
          schema: refSchema("PersonaCollectionCreateRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Collection created.", "PersonaCollectionCreateResponseEnvelope"),
      "400": jsonResponse("Invalid collection payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "413": jsonResponse("Collection payload too large.", "ErrorResponse"),
      "502": jsonResponse("Upstream xAI collection create failed.", "UpstreamErrorResponse")
    }
  },
  "POST /api/personas/{personaId}/publish": {
    summary: "Publish persona",
    responses: {
      "200": jsonResponse("Persona published.", "PersonaLifecycleMutationResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "409": jsonResponse("Persona already published.", "ErrorResponse"),
      "500": jsonResponse("Persona publish failed.", "ErrorResponse")
    }
  },
  "POST /api/personas/{personaId}/archive": {
    summary: "Archive persona",
    responses: {
      "200": jsonResponse("Persona archived.", "PersonaLifecycleMutationResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "409": jsonResponse("Persona already archived.", "ErrorResponse"),
      "500": jsonResponse("Persona archive failed.", "ErrorResponse")
    }
  },
  "POST /api/personas/{personaId}/rollback": {
    summary: "Rollback persona to target version",
    requestBody: {
      required: true,
      description: "Target version to restore.",
      content: {
        "application/json": {
          schema: refSchema("PersonaRollbackRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Persona rolled back.", "PersonaLifecycleMutationResponseEnvelope"),
      "400": jsonResponse("Invalid rollback payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona or version not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/personas/{personaId}/versions": {
    summary: "List persona version history",
    responses: {
      "200": jsonResponse("Persona versions.", "PersonaVersionsResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/personas/{personaId}/collection/create": {
    summary: "Create and link xAI collection for persona",
    responses: {
      "200": jsonResponse("Persona collection linked.", "PersonaCollectionCreateLinkResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/personas/{personaId}/collection/link-files": {
    summary: "Link uploaded files into persona collection",
    requestBody: {
      required: false,
      description: "Optional list of file ids to restrict linking.",
      content: {
        "application/json": {
          schema: refSchema("PersonaCollectionLinkFilesRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Linking attempt summary.", "PersonaCollectionLinkFilesResponseEnvelope"),
      "400": jsonResponse("Invalid payload or persona collection id missing.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/personas/{personaId}/verify-collection": {
    summary: "Trigger async xAI collection verification",
    responses: {
      "200": jsonResponse("Verification trigger result.", "PersonaVerifyCollectionResponseEnvelope"),
      "400": jsonResponse("Persona collection id missing.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/xchat/ask": {
    summary: "Send xChat ask request",
    requestBody: {
      required: true,
      description:
        "User message with optional persona selection. Non-admin users can only select published professional personas and cannot override model ids. Ask always runs through a single `/v1/responses` tool-loop execution path (no chat-completions fallback). Hosted RAG pre-search uses **TEAM KB collections only** (`persona.teamCollection` + deploy team default from `resolveTeamKbCollectionId`); persona `xaiCollection` is not merged into ask RAG. Local Mongo prompt-history injection is retired. Continuity now uses xAI hosted state (`store_messages` + `previous_response_id`) when `XCHAT_USE_REMOTE_HISTORY=true`. If persona model is unset, server uses `XAI_CHAT_MODEL` or falls back to `grok-4-1-fast-reasoning`. When the persona includes **`atx_function`** (workspace tool; UI citations may use slug `atxfinance`), the server loads portfolio/accounts/watchlist (desk riskProfile/outlook + symbols, capped positions preview) into the system prompt. User turn uses `appendXchatKbMetadata` with the same TEAM id list wired into tools. Successful JSON may include optional **`xaiUsage`** (token counts from the Responses API `usage` object) for client session stats and admin cost rollups.",
      content: {
        "application/json": {
          schema: refSchema("XChatAskRequest")
        }
      }
    },
    responses: {
      "200": {
        ...jsonResponse("xChat ask response.", "XChatAskResponseEnvelope"),
        headers: xchatLimiterHeaders(false)
      },
      "400": jsonResponse("Invalid ask payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Persona/model selection not allowed for current role."),
      "404": jsonResponse("Requested persona not found.", "ErrorResponse"),
      "413": jsonResponse("Payload too large.", "ErrorResponse"),
      "429": {
        ...jsonResponse("Rate limit exceeded.", "RateLimitErrorResponse"),
        headers: xchatLimiterHeaders(true)
      },
      "502": jsonResponse("xAI provider request failed.", "XaiProviderErrorResponse"),
      "503": jsonResponse("Default admin persona (advisor) missing from database.", "ErrorResponse")
    }
  },
  "GET /api/xchat/history": {
    summary: "List saved xChat prompt history",
    description:
      "Returns persisted prompt/response history for the signed-in user. Current in-memory session messages are client-side and not included until persisted.",
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        description: "Maximum number of history items to return (1-50).",
        schema: { type: "integer", minimum: 1, maximum: 50, default: 20 }
      },
      {
        name: "cursor",
        in: "query",
        required: false,
        description: "ISO datetime cursor. Returns items older than this timestamp.",
        schema: { type: "string", format: "date-time" }
      },
      {
        name: "cursorId",
        in: "query",
        required: false,
        description:
          "Tie-break cursor ObjectId for stable pagination when multiple rows share the same createdAt timestamp.",
        schema: { type: "string" }
      }
    ],
    responses: {
      "200": jsonResponse("Saved xChat history list.", "XChatHistoryListResponseEnvelope"),
      "400": jsonResponse("Invalid history query.", "ValidationErrorResponse"),
      "401": json401Session()
    }
  },
  "GET /api/xchat/history/stats": {
    summary: "Read saved xChat history stats",
    responses: {
      "200": jsonResponse("Saved xChat history stats.", "XChatHistoryStatsResponseEnvelope"),
      "400": jsonResponse("Invalid session user id.", "ErrorResponse"),
      "401": json401Session()
    }
  },
  "POST /api/xchat/history/sync-turn": {
    summary: "Sync one local xChat turn to user history collection (deprecated)",
    description:
      "Deprecated endpoint kept for backward compatibility while xChat continuity migrates to xAI hosted conversation state (`store_messages` + `previous_response_id`).",
    deprecated: true,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["logId"],
            properties: {
              logId: { type: "string" }
            }
          }
        }
      }
    },
    responses: {
      "200": jsonResponse("Sync accepted.", "AtxSessionJsonSuccess"),
      "400": jsonResponse("Invalid JSON payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "404": jsonResponse("Log not found.", "ErrorResponse"),
      "502": jsonResponse("Upstream sync failed.", "UpstreamErrorResponse")
    }
  },
  "POST /api/xchat/batch": {
    summary: "Submit xChat batch job",
    description:
      "Uses persona from DB for system prompt, override prompt, and tool list (no hardcoded prompt/tools). See atx-docs/xchat/xchat-tools-guide.md (Batch section).",
    requestBody: {
      required: true,
      description: "Persona id and list of message items.",
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["personaId", "items"],
            properties: {
              personaId: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    itemId: { type: "string" },
                    message: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    responses: {
      "200": { description: "Batch job submitted; poll via GET /api/xchat/batch/{batchId}." },
      "400": jsonResponse("Invalid batch payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Admin role required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "500": jsonResponse("Batch submit failed.", "ErrorResponse")
    }
  },
  "POST /api/user-feedback": {
    summary: "Submit signed-in user feedback",
    description:
      "App_user header flow. Optional Slack notification when SLACK_WEBHOOK_URL is configured (fire-and-forget).",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("AppUserFeedbackRequest")
        }
      }
    },
    responses: {
      "201": jsonResponse("Feedback accepted.", "AppUserFeedbackResponse"),
      "400": jsonResponse("Invalid JSON or validation failed.", "ValidationErrorResponse"),
      "401": json401Session()
    }
  },
  "GET /api/recommendations": {
    summary: "List recommendations for the signed-in user",
    description:
      "App_user only (`canUserLogin`). Returns rows scoped to session `userId` and `tenantId` from collection `app_user_recommendations`.",
    responses: {
      "200": jsonResponse("Recommendation list.", "RecommendationsListResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid but login-eligible platform role is required.")
    }
  },
  "POST /api/recommendations": {
    summary: "Create a recommendation for the signed-in user",
    description:
      "App_user only. `userId` is taken from the session. When `RECOMMENDATIONS_PUBSUB_TOPIC` and a GCP project id are set, a `created` event is published for downstream agents.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("RecommendationCreateRequest")
        }
      }
    },
    responses: {
      "201": jsonResponse("Recommendation created.", "RecommendationResponseEnvelope"),
      "400": jsonResponse("Invalid JSON or validation failed.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid but login-eligible platform role is required.")
    }
  },
  "GET /api/recommendations/{recommendationId}": {
    summary: "Get one recommendation by id",
    parameters: [
      {
        name: "recommendationId",
        in: "path",
        required: true,
        schema: { type: "string" }
      }
    ],
    responses: {
      "200": jsonResponse("Recommendation detail.", "RecommendationResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid but login-eligible platform role is required."),
      "404": jsonResponse("Not found or not owned by the caller.", "ErrorResponse")
    }
  },
  "POST /api/admin/backoffice/core-users": {
    summary: "Backoffice core_users lookup or constrained patch",
    description:
      "global_admin only. Body discriminates on `op`: `lookup` (by email or user id) or `patch` (allowlisted core_users fields: plan, status, roles, email, X profile, xAI collection hints). Emits audit `backoffice_user_lookup` / `backoffice_user_patch`. Not an arbitrary Mongo shell.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("AdminBackofficeCoreUsersRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Lookup result or patched user.", "AdminBackofficeCoreUsersResponseEnvelope"),
      "400": jsonResponse("Invalid payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "409": jsonResponse("Duplicate email on patch.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/admin/users": {
    summary: "List users",
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        description: "Maximum number of users to return.",
        schema: { type: "integer", minimum: 1, maximum: 500, default: 100 }
      }
    ],
    responses: {
      "200": jsonResponse("User list response.", "AdminUsersListResponseEnvelope"),
      "400": jsonResponse("Invalid query payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/admin/users": {
    summary: "Create user",
    requestBody: {
      required: true,
      description: "User creation payload.",
      content: {
        "application/json": {
          schema: refSchema("AdminUserCreateRequest")
        }
      }
    },
    responses: {
      "201": jsonResponse("User created.", "AdminUserResponseEnvelope"),
      "400": jsonResponse("Invalid user payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "409": jsonResponse("Duplicate email.", "ConflictErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/admin/users/{userId}": {
    summary: "Get user details with audit trail",
    responses: {
      "200": jsonResponse("User details response.", "AdminUserWithAuditTrailResponseEnvelope"),
      "400": jsonResponse("Invalid user id.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "PUT /api/admin/users/{userId}": {
    summary: "Update user",
    requestBody: {
      required: true,
      description: "Partial update payload.",
      content: {
        "application/json": {
          schema: refSchema("AdminUserUpdateRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("User updated.", "AdminUserResponseEnvelope"),
      "400": jsonResponse("Invalid user id or payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "409": jsonResponse("Duplicate email.", "ConflictErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "DELETE /api/admin/users/{userId}": {
    summary: "Delete user",
    responses: {
      "200": jsonResponse("User deleted.", "AdminUserDeleteResponseEnvelope"),
      "400": jsonResponse("Invalid user id.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "PATCH /api/admin/users/{userId}/email": {
    summary: "Update user email",
    requestBody: {
      required: true,
      description: "Email update payload.",
      content: {
        "application/json": {
          schema: refSchema("AdminUserUpdateEmailRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("User email updated.", "AdminUserUpdateEmailResponseEnvelope"),
      "400": jsonResponse("Invalid user id or payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "PATCH /api/admin/users/{userId}/role": {
    summary: "Update user role",
    requestBody: {
      required: true,
      description: "Role update payload.",
      content: {
        "application/json": {
          schema: refSchema("AdminUserUpdateRoleRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("User role updated.", "AdminUserUpdateRoleResponseEnvelope"),
      "400": jsonResponse("Invalid user id or payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "PATCH /api/admin/users/{userId}/plan": {
    summary: "Update user subscription plan",
    requestBody: {
      required: true,
      description: "Plan update payload.",
      content: {
        "application/json": {
          schema: refSchema("AdminUserUpdatePlanRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("User plan updated.", "AdminUserUpdatePlanResponseEnvelope"),
      "400": jsonResponse("Invalid user id or payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/admin/users/{userId}/settings": {
    summary: "Get user admin settings",
    responses: {
      "200": jsonResponse("User settings.", "UserAdminSettingsResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User settings not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "PUT /api/admin/users/{userId}/settings": {
    summary: "Upsert user admin settings",
    requestBody: {
      required: true,
      description: "Full user admin settings payload.",
      content: {
        "application/json": {
          schema: refSchema("UserAdminSettings")
        }
      }
    },
    responses: {
      "200": jsonResponse("User settings updated.", "UserAdminSettingsResponseEnvelope"),
      "400": jsonResponse("Invalid settings payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/admin/xchat/settings": {
    summary: "Get platform xChat defaults (global admin)",
    responses: {
      "200": jsonResponse("Platform xChat settings.", "AdminXchatPlatformSettingsResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "PATCH /api/admin/xchat/settings": {
    summary: "Set default published xPersona for app users (or clear)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("AdminXchatPlatformSettingsPatchRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Settings updated.", "AdminXchatPlatformSettingsResponseEnvelope"),
      "400": jsonResponse("Invalid payload or persona not published.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Persona not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/openapi": {
    summary: "Download OpenAPI 3.1 current-state inventory",
    responses: {
      "200": {
        description: "Full OpenAPI document as JSON (used for codegen and review).",
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true,
              description: "OpenAPI 3.1 root (`openapi`, `info`, `paths`, `components`, …)."
            },
            examples: {
              inventory_preview: {
                summary: "Inventory root (truncated)",
                description:
                  "Production payloads are large. Protected operations embed `401` (session) and `403` (admin) with `examples` under `content.application/json`.",
                value: {
                  openapi: "3.1.0",
                  info: {
                    title: "atxFinance HTTP API — current-state inventory",
                    version: "0.0.0"
                  },
                  paths: {
                    "/api/health": {
                      get: {
                        operationId: "atx_health_get",
                        responses: {
                          "200": { description: "Successful response." }
                        }
                      }
                    },
                    "/api/personas": {
                      get: {
                        operationId: "atx_personas_list",
                        responses: {
                          "401": {
                            description: "Missing or invalid session cookie.",
                            content: {
                              "application/json": {
                                examples: {
                                  session_required: { value: { error: "Unauthorized" } }
                                }
                              }
                            }
                          }
                        }
                      }
                    },
                    "/api/admin/bootstrap-status": {
                      get: {
                        operationId: "atx_admin_bootstrap_status_get",
                        responses: {
                          "401": {
                            description: "Missing or invalid session cookie.",
                            content: {
                              "application/json": {
                                examples: {
                                  session_required: { value: { error: "Unauthorized" } }
                                }
                              }
                            }
                          },
                          "403": {
                            description: "Session is valid, but admin role is required.",
                            content: {
                              "application/json": {
                                examples: {
                                  admin_role_required: { value: { error: "Forbidden" } }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "400": jsonResponse("Malformed request (rare for GET).", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  }
};

export function getCurrentStateOperationOverride(method: RouteMethod, path: string) {
  return OPERATION_OVERRIDES[`${method} ${path}`];
}

export const CURRENT_STATE_COMPONENT_SCHEMAS: Record<string, OpenApiSchema> = {
  AppUserFeedbackRequest: {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", minLength: 3, maxLength: 4000 },
      page: { type: "string", maxLength: 500, description: "Optional UI context (e.g. xChat)." }
    }
  },
  AppUserFeedbackResponse: {
    type: "object",
    required: ["ok"],
    properties: {
      ok: { type: "boolean", enum: [true] }
    }
  },
  RecommendationCreateRequest: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 500 },
      summary: { type: "string", maxLength: 4000 },
      scopeTags: {
        type: "array",
        maxItems: 32,
        items: { type: "string", maxLength: 128 }
      },
      payload: { type: "object", additionalProperties: true },
      status: {
        type: "string",
        enum: ["draft", "active", "dismissed", "superseded"]
      }
    }
  },
  RecommendationJson: {
    type: "object",
    required: [
      "_id",
      "userId",
      "title",
      "scopeTags",
      "payload",
      "status",
      "source",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      _id: { type: "string" },
      tenantId: { type: "string" },
      userId: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      scopeTags: { type: "array", items: { type: "string" } },
      payload: { type: "object", additionalProperties: true },
      status: {
        type: "string",
        enum: ["draft", "active", "dismissed", "superseded"]
      },
      source: { type: "string", enum: ["user", "system", "agent"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    }
  },
  RecommendationResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: { $ref: "#/components/schemas/RecommendationJson" }
    }
  },
  RecommendationsListResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/RecommendationJson" }
      }
    }
  },
  ValidationErrorResponse: {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string" },
      details: { type: "object", additionalProperties: true }
    }
  },
  ConflictErrorResponse: {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string" },
      code: { type: "string" }
    }
  },
  UpstreamErrorResponse: {
    type: "object",
    required: ["error", "code"],
    properties: {
      error: { type: "string" },
      code: { type: "string" }
    }
  },
  RateLimitErrorResponse: {
    type: "object",
    required: ["error", "retryAfterSeconds"],
    properties: {
      error: { type: "string", enum: ["Rate limit exceeded"] },
      retryAfterSeconds: { type: "integer", minimum: 0 }
    }
  },
  XaiProviderErrorResponse: {
    type: "object",
    required: ["error", "provider", "retryable"],
    properties: {
      error: { type: "string", enum: ["xAI provider request failed"] },
      provider: { type: "string", enum: ["xai"] },
      retryable: { type: "boolean" },
      details: {
        type: "string",
        description: "Truncated upstream error text for operators (no secrets redaction beyond length cap)."
      }
    }
  },
  XChatAskRequest: {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", minLength: 2, maxLength: 8000 },
      personaId: {
        type: "string",
        description: "Optional persona selection. App users are restricted to published allowlisted personas."
      },
      reasoningEffort: {
        type: "string",
        enum: ["low", "medium", "high", "xhigh"],
        description:
          "Only valid when the resolved persona’s `model` is `grok-4.20-multi-agent` or `grok-4.20-multi-agent-0309` (set in Admin → Personas). Non–global_admin sessions may have multi-agent parallelism stripped per subscription plan (`multiAgentParallelMaxAgents` in plan limits; defaults cap app users at 0 until raised)."
      },
      scope: { type: "string", minLength: 1, maxLength: 128 },
      topK: { type: "integer", minimum: 1, maximum: 10 }
    }
  },
  XChatToolCallSummary: {
    type: "object",
    required: ["name", "durationMs"],
    properties: {
      name: { type: "string" },
      durationMs: { type: "integer", minimum: 0 }
    }
  },
  XChatAskXaiUsage: {
    type: "object",
    required: ["inputTokens", "outputTokens", "totalTokens"],
    description:
      "Token counts from xAI Responses API `usage` when present (same shape persisted on `xchat_logs.xaiUsage`). Omitted when the provider returns no usage block.",
    properties: {
      inputTokens: { type: "integer", minimum: 0 },
      outputTokens: { type: "integer", minimum: 0 },
      totalTokens: { type: "integer", minimum: 0 },
      reasoningTokens: { type: "integer", minimum: 0 },
      cachedPromptTokens: { type: "integer", minimum: 0 }
    }
  },
  XChatAskResponseData: {
    type: "object",
    required: [
      "response",
      "model",
      "personaName",
      "modelSelectionSource",
      "contextCount",
      "contextSource",
      "collectionSearchStatus",
      "collectionSearchNonReadyFileCount",
      "logId"
    ],
    properties: {
      response: { type: "string" },
      model: { type: "string" },
      personaName: {
        type: "string",
        description:
          "Resolved persona display name. Published defaults: advisor (global_admin), atx-trusted-advisor (other roles)."
      },
      modelSelectionSource: {
        type: "string",
        enum: ["default", "persona"],
        description:
          "`persona` when the effective xAI model id came from the resolved persona document; `default` when the persona has no model set (server fallback)."
      },
      contextCount: { type: "integer", minimum: 0 },
      contextSource: { type: "string", enum: ["none", "xai_collection"] },
      collectionSearchStatus: {
        type: "string",
        enum: ["ready", "blocked_non_ready_files", "skipped_no_collections"],
        description: "TEAM KB RAG readiness for this ask (linked collections only)."
      },
      collectionSearchNonReadyFileCount: { type: "integer", minimum: 0 },
      logId: { type: "string", description: "Mongo `xchat_logs` document id for this turn (hex)." },
      toolCalls: { type: "array", items: refSchema("XChatToolCallSummary") },
      strategyJobOffer: {
        type: "boolean",
        description: "True when the server returned a one-turn strategy-job preflight instead of a full model pass."
      },
      multiAgentDowngraded: {
        type: "boolean",
        description: "Present when a multi-agent persona model was downgraded to the default fast model for this turn."
      },
      personaModelRequested: {
        type: "string",
        description: "When `multiAgentDowngraded` is true, the persona’s configured model id before downgrade."
      },
      xaiUsage: refSchema("XChatAskXaiUsage")
    }
  },
  XChatAskResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("XChatAskResponseData")
    }
  },
  XChatHistoryItem: {
    type: "object",
    required: ["id", "message", "response", "model", "createdAt", "contextReferenceCount", "toolCallCount"],
    properties: {
      id: { type: "string" },
      message: { type: "string" },
      response: { type: "string" },
      model: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      personaId: { type: "string" },
      contextReferenceCount: { type: "integer", minimum: 0 },
      toolCallCount: { type: "integer", minimum: 0 }
    }
  },
  XChatHistoryListResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["items", "nextCursor", "hasMore"],
        properties: {
          items: { type: "array", items: refSchema("XChatHistoryItem") },
          nextCursor: { type: "string", format: "date-time", nullable: true },
          hasMore: { type: "boolean" }
        }
      }
    }
  },
  XChatHistoryStatsResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["totalPrompts", "activeDays", "referencedFileCount"],
        properties: {
          totalPrompts: { type: "integer", minimum: 0 },
          activeDays: { type: "integer", minimum: 0 },
          referencedFileCount: { type: "integer", minimum: 0 },
          lastPromptAt: { type: "string", format: "date-time", nullable: true },
          collectionId: { type: "string", nullable: true },
          historyMode: { type: "string", enum: ["mongo", "xai_remote"] }
        }
      }
    }
  },
  PersonaStatus: {
    type: "string",
    enum: ["draft", "published", "archived"]
  },
  PersonaXapiConfig: {
    type: "object",
    additionalProperties: true
  },
  PersonaBase: {
    type: "object",
    required: [
      "_id",
      "name",
      "systemPrompt",
      "overridePrompt",
      "xaiCollection",
      "model",
      "temperature",
      "enableRag",
      "defaultScope",
      "xapi",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      _id: { type: "string", nullable: true },
      name: { type: "string" },
      systemPrompt: { type: "string" },
      overridePrompt: { type: "string" },
      xaiCollection: {
        type: "object",
        required: ["collectionId"],
        properties: {
          collectionId: { type: "string" },
          collectionName: { type: "string", nullable: true }
        }
      },
      teamCollection: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          collectionName: { type: "string", nullable: true }
        }
      },
      model: { type: "string" },
      temperature: { type: "number" },
      enableRag: { type: "boolean" },
      defaultScope: { type: "string" },
      citationsEnabled: {
        type: "boolean",
        description: "When false, xChat omits citation-chip instructions from the system prompt."
      },
      keepXchatHistory: {
        type: "boolean",
        description:
          "When false, persona skips xAI remote conversation continuity when XCHAT_USE_REMOTE_HISTORY is enabled."
      },
      xapi: refSchema("PersonaXapiConfig"),
      status: refSchema("PersonaStatus"),
      version: { type: "integer", minimum: 0 },
      publishedAt: { type: "string", format: "date-time", nullable: true },
      isSystem: { type: "boolean", description: "True when upserted from repo YAML (seed:xpersonas)." },
      lastXaiPersonaSync: {
        type: "object",
        nullable: true,
        description: "Last successful sync-from-xAI for this persona row.",
        properties: {
          at: { type: "string", format: "date-time" },
          byUserId: { type: "string" },
          collectionDisplayName: { type: "string" }
        }
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    }
  },
  AuditEventSummary: {
    type: "object",
    required: ["action", "createdAt", "actor"],
    properties: {
      action: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      actor: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string" },
          email: { type: "string" },
          username: { type: "string" }
        }
      },
      details: { type: "object", additionalProperties: true }
    }
  },
  PersonaWithLatestAudit: {
    allOf: [
      refSchema("PersonaBase"),
      {
        type: "object",
        properties: {
          latestAuditEvent: {
            oneOf: [refSchema("AuditEventSummary"), { type: "null" }]
          }
        }
      }
    ]
  },
  PersonaWithAuditTrail: {
    allOf: [
      refSchema("PersonaBase"),
      {
        type: "object",
        required: ["auditTrail"],
        properties: {
          auditTrail: { type: "array", items: refSchema("AuditEventSummary") }
        }
      }
    ]
  },
  PersonaListResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "array",
        items: refSchema("PersonaWithLatestAudit")
      }
    }
  },
  PersonaResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("PersonaBase")
    }
  },
  PersonaWithAuditTrailResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("PersonaWithAuditTrail")
    }
  },
  PersonaDeleteResponseEnvelope: {
    type: "object",
    required: ["ok"],
    properties: {
      ok: { type: "boolean", enum: [true] }
    }
  },
  PersonaSyncFromXaiRequest: {
    type: "object",
    properties: {
      collectionDisplayName: {
        type: "string",
        description:
          "xAI collection display name to read from. When omitted, server uses NODE_ENV / ATX_DEPLOY_TARGET or XPERSONAS_XAI_COLLECTION_DISPLAY_NAME."
      },
      mode: {
        type: "string",
        enum: ["merge", "replace"],
        description: "merge (default) fills missing linkage/tools; replace overwrites prompts and xapi like seed:xpersonas."
      }
    },
    additionalProperties: false
  },
  PersonaSyncFromXaiResultData: {
    type: "object",
    required: [
      "collectionId",
      "collectionDisplayName",
      "listed",
      "examined",
      "imported",
      "updated",
      "skipped",
      "syntheticFallbacks",
      "errors"
    ],
    properties: {
      collectionId: { type: "string" },
      collectionDisplayName: { type: "string" },
      listed: { type: "integer", minimum: 0 },
      examined: { type: "integer", minimum: 0 },
      imported: { type: "integer", minimum: 0 },
      updated: { type: "integer", minimum: 0 },
      skipped: { type: "integer", minimum: 0 },
      syntheticFallbacks: { type: "integer", minimum: 0 },
      errors: {
        type: "array",
        items: {
          type: "object",
          required: ["source", "message"],
          properties: {
            source: { type: "string" },
            message: { type: "string" }
          }
        }
      }
    }
  },
  PersonaSyncFromXaiResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("PersonaSyncFromXaiResultData")
    }
  },
  PersonaCreateRequest: {
    type: "object",
    required: ["name", "systemPrompt", "model", "temperature", "enableRag", "defaultScope"],
    properties: {
      name: { type: "string" },
      systemPrompt: { type: "string" },
      overridePrompt: { type: "string" },
      model: { type: "string" },
      temperature: { type: "number" },
      enableRag: { type: "boolean" },
      defaultScope: { type: "string" },
      xapi: refSchema("PersonaXapiConfig"),
      xaiCollection: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          collectionName: { type: "string" }
        }
      },
      teamCollection: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          collectionName: { type: "string" }
        }
      }
    }
  },
  PersonaUpdateRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      systemPrompt: { type: "string" },
      overridePrompt: { type: "string" },
      model: { type: "string" },
      temperature: { type: "number" },
      enableRag: { type: "boolean" },
      defaultScope: { type: "string" },
      xapi: refSchema("PersonaXapiConfig"),
      xaiCollection: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          collectionName: { type: "string" }
        }
      },
      teamCollection: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          collectionName: { type: "string" }
        }
      }
    },
    additionalProperties: false
  },
  PersonaCollectionInventoryItem: {
    type: "object",
    required: ["id", "stats"],
    properties: {
      id: { type: "string" },
      name: { type: "string", nullable: true },
      stats: {
        type: "object",
        required: [
          "documentCount",
          "chunkCount",
          "fileCount",
          "indexStatus",
          "lastSyncedAt",
          "createdAt",
          "updatedAt",
          "usageStats"
        ],
        properties: {
          documentCount: { type: "integer", nullable: true },
          chunkCount: { type: "integer", nullable: true },
          fileCount: { type: "integer", nullable: true },
          indexStatus: { type: "string", nullable: true },
          lastSyncedAt: { type: "string", nullable: true },
          createdAt: { type: "string", nullable: true },
          updatedAt: { type: "string", nullable: true },
          usageStats: {
            type: "object",
            nullable: true,
            additionalProperties: true
          }
        }
      }
    }
  },
  PersonaCollectionStatsResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("PersonaCollectionInventoryItem")
    }
  },
  PersonaCollectionsListResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: { type: "array", items: refSchema("PersonaCollectionInventoryItem") }
    }
  },
  PersonaCollectionCreateRequest: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 2, maxLength: 120 }
    }
  },
  PersonaCollectionCreateResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("PersonaCollectionInventoryItem")
    }
  },
  PersonaLifecycleMutationData: {
    type: "object",
    required: ["_id", "name", "status", "version"],
    properties: {
      _id: { type: "string", nullable: true },
      name: { type: "string" },
      status: refSchema("PersonaStatus"),
      version: { type: "integer", minimum: 0 },
      publishedAt: { type: "string", format: "date-time", nullable: true }
    }
  },
  PersonaLifecycleMutationResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("PersonaLifecycleMutationData")
    }
  },
  PersonaRollbackRequest: {
    type: "object",
    required: ["targetVersion"],
    properties: {
      targetVersion: { type: "integer", minimum: 1 }
    }
  },
  PersonaVersionItem: {
    type: "object",
    required: ["_id", "personaId", "version", "action", "actor", "snapshotName", "snapshotModel", "createdAt"],
    properties: {
      _id: { type: "string", nullable: true },
      personaId: { type: "string" },
      version: { type: "integer" },
      action: { type: "string" },
      actor: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string" },
          email: { type: "string" },
          username: { type: "string" }
        }
      },
      snapshotName: { type: "string" },
      snapshotModel: { type: "string" },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  PersonaVersionsResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: { type: "array", items: refSchema("PersonaVersionItem") }
    }
  },
  PersonaCollectionCreateLinkResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["personaId", "collectionId", "collectionName"],
        properties: {
          personaId: { type: "string" },
          collectionId: { type: "string" },
          collectionName: { type: "string" }
        }
      }
    }
  },
  PersonaCollectionLinkFilesRequest: {
    type: "object",
    properties: {
      fileIds: { type: "array", items: { type: "string" }, maxItems: 200 }
    }
  },
  PersonaCollectionLinkFilesErrorItem: {
    type: "object",
    required: ["fileId", "error"],
    properties: {
      fileId: { type: "string" },
      error: { type: "string" }
    }
  },
  PersonaCollectionLinkFilesResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: [
          "personaId",
          "collectionId",
          "scope",
          "selectedFileIds",
          "selectedCount",
          "candidateFiles",
          "linkedCount",
          "alreadyLinkedCount",
          "failed"
        ],
        properties: {
          personaId: { type: "string" },
          collectionId: { type: "string" },
          scope: { type: "string" },
          selectedFileIds: { type: "array", items: { type: "string" } },
          selectedCount: { type: "integer", minimum: 0 },
          candidateFiles: { type: "integer", minimum: 0 },
          linkedCount: { type: "integer", minimum: 0 },
          alreadyLinkedCount: { type: "integer", minimum: 0 },
          failed: { type: "array", items: refSchema("PersonaCollectionLinkFilesErrorItem") }
        }
      }
    }
  },
  PersonaVerifyCollectionResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["personaId", "collectionId"],
        properties: {
          personaId: { type: "string" },
          collectionId: { type: "string" },
          enqueued: { type: "boolean" },
          status: { type: "string" },
          message: { type: "string" }
        },
        additionalProperties: true
      }
    }
  },
  AdminUserRole: {
    type: "string",
    enum: ["global_admin", "advisor", "operator", "viewer"]
  },
  AdminUserSubscriptionPlan: {
    type: "string",
    enum: ["basic", "premium", "premium_plus"]
  },
  AdminUserStatus: {
    type: "string",
    enum: ["active", "suspended"]
  },
  CoreUserBase: {
    type: "object",
    required: [
      "_id",
      "email",
      "roles",
      "subscriptionPlan",
      "status",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      _id: { type: "string", nullable: true },
      email: { type: "string", format: "email" },
      roles: { type: "array", items: refSchema("AdminUserRole") },
      subscriptionPlan: refSchema("AdminUserSubscriptionPlan"),
      status: refSchema("AdminUserStatus"),
      xAccount: { type: "object", additionalProperties: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      lastLoginAt: { type: "string", format: "date-time", nullable: true },
      lastLoginIp: { type: "string", nullable: true },
      lastLoginCountry: { type: "string", nullable: true },
      lastLoginUserAgent: { type: "string", nullable: true }
    }
  },
  CoreUserWithLatestAudit: {
    allOf: [
      refSchema("CoreUserBase"),
      {
        type: "object",
        properties: {
          latestAuditEvent: {
            oneOf: [refSchema("AuditEventSummary"), { type: "null" }]
          }
        }
      }
    ]
  },
  CoreUserWithAuditTrail: {
    allOf: [
      refSchema("CoreUserBase"),
      {
        type: "object",
        required: ["auditTrail"],
        properties: {
          auditTrail: {
            type: "array",
            items: refSchema("AuditEventSummary")
          }
        }
      }
    ]
  },
  AdminUsersListResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "array",
        items: refSchema("CoreUserWithLatestAudit")
      }
    }
  },
  AdminUserResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("CoreUserBase")
    }
  },
  AdminUserWithAuditTrailResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("CoreUserWithAuditTrail")
    }
  },
  AdminUserCreateRequest: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email" },
      role: refSchema("AdminUserRole"),
      subscriptionPlan: refSchema("AdminUserSubscriptionPlan"),
      status: refSchema("AdminUserStatus")
    }
  },
  AdminUserUpdateRequest: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      role: refSchema("AdminUserRole"),
      subscriptionPlan: refSchema("AdminUserSubscriptionPlan"),
      status: refSchema("AdminUserStatus")
    }
  },
  AdminUserDeleteResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["deleted", "userId"],
        properties: {
          deleted: { type: "boolean", enum: [true] },
          userId: { type: "string" }
        }
      }
    }
  },
  AdminUserUpdateEmailRequest: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email" }
    }
  },
  AdminUserUpdateEmailResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["userId", "email"],
        properties: {
          userId: { type: "string", nullable: true },
          email: { type: "string", format: "email" }
        }
      }
    }
  },
  AdminUserUpdateRoleRequest: {
    type: "object",
    required: ["role"],
    properties: {
      role: refSchema("AdminUserRole")
    }
  },
  AdminUserUpdateRoleResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["userId", "role"],
        properties: {
          userId: { type: "string", nullable: true },
          role: refSchema("AdminUserRole")
        }
      }
    }
  },
  AdminBackofficeCoreUsersRequest: {
    oneOf: [
      {
        type: "object",
        required: ["op", "by", "value"],
        properties: {
          op: { type: "string", enum: ["lookup"] },
          by: { type: "string", enum: ["email", "id"] },
          value: { type: "string", minLength: 1 }
        }
      },
      {
        type: "object",
        required: ["op", "userId"],
        properties: {
          op: { type: "string", enum: ["patch"] },
          userId: { type: "string", minLength: 24, maxLength: 24 },
          subscriptionPlan: refSchema("AdminUserSubscriptionPlan"),
          status: refSchema("AdminUserStatus"),
          roles: {
            type: "array",
            items: refSchema("AdminUserRole"),
            minItems: 1
          },
          email: { type: "string", format: "email" },
          xAccountDisplayName: { type: "string" },
          xAccountUsername: { type: "string" },
          xAccountAvatarUrl: { type: "string", nullable: true },
          xaiCollectionId: { type: "string", nullable: true },
          xaiCollectionName: { type: "string", nullable: true }
        },
        description: "At least one patch field besides op/userId is required at runtime."
      }
    ]
  },
  AdminBackofficeCoreUsersResponseEnvelope: {
    type: "object",
    description: "Lookup: { data, found }. Patch: { data } with serialized core user.",
    additionalProperties: true
  },
  AdminUserUpdatePlanRequest: {
    type: "object",
    required: ["subscriptionPlan"],
    properties: {
      subscriptionPlan: refSchema("AdminUserSubscriptionPlan")
    }
  },
  AdminUserUpdatePlanResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["userId", "subscriptionPlan"],
        properties: {
          userId: { type: "string", nullable: true },
          subscriptionPlan: refSchema("AdminUserSubscriptionPlan")
        }
      }
    }
  },
  AdminXchatPlatformSettingsPatchRequest: {
    type: "object",
    required: ["defaultAppUserPersonaId"],
    properties: {
      defaultAppUserPersonaId: {
        oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
        description: "Published persona ObjectId hex, or null to clear platform default for app users."
      }
    }
  },
  AdminXchatPlatformSettingsResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["defaultAppUserPersonaId"],
        properties: {
          defaultAppUserPersonaId: { type: "string", nullable: true },
          personaName: { type: "string" },
          updatedAt: { type: "string", format: "date-time", nullable: true },
          updatedByUserId: { type: "string", nullable: true }
        }
      }
    }
  },
  UserAdminSettings: {
    type: "object",
    required: ["broker", "portfolio", "account", "notificationDefaults"],
    properties: {
      broker: {
        type: "object",
        required: ["provider", "accountRef", "enabled"],
        properties: {
          provider: { type: "string", enum: ["alpaca", "interactive-brokers", "paper"] },
          accountRef: { type: "string", minLength: 1 },
          enabled: { type: "boolean" }
        }
      },
      portfolio: {
        type: "object",
        required: ["riskProfile", "investmentStrategy", "baseCurrency", "rebalanceFrequencyDays"],
        properties: {
          riskProfile: { type: "string", enum: ["conservative", "balanced", "growth"] },
          investmentStrategy: { type: "string", enum: ["growth", "income", "balanced", "aggressive"] },
          baseCurrency: { type: "string", enum: ["USD", "EUR", "GBP"] },
          rebalanceFrequencyDays: { type: "integer", minimum: 1 }
        }
      },
      account: {
        type: "object",
        required: ["accountStatus", "maxConcurrentSessions", "timezone"],
        properties: {
          accountStatus: refSchema("AdminUserStatus"),
          maxConcurrentSessions: { type: "integer", minimum: 1, maximum: 20 },
          timezone: { type: "string", minLength: 1 }
        }
      },
      notificationDefaults: {
        type: "object",
        required: ["email", "push", "sms", "digestHourUTC"],
        properties: {
          email: { type: "boolean" },
          push: { type: "boolean" },
          sms: { type: "boolean" },
          digestHourUTC: { type: "integer", minimum: 0, maximum: 23 }
        }
      }
    }
  },
  UserAdminSettingsResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("UserAdminSettings")
    }
  }
};
