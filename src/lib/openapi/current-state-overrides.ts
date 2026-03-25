import type {
    OpenApiMediaType,
    OpenApiOperation,
    OpenApiResponse,
    OpenApiSchema
} from "@/lib/openapi/types";

type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type OperationOverride = Pick<
  OpenApiOperation,
  "summary" | "description" | "parameters" | "requestBody" | "responses"
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
      description: "Remaining asks in the current UTC day for the caller plan (non-admin sessions).",
      schema: { type: "string" }
    },
    "x-xchat-limit-daily": {
      description: "Daily ask limit for the current caller plan (non-admin sessions).",
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
        "User message with optional persona selection. Non-admin users can only select published professional personas and cannot override model ids. Ask always runs through a single `/v1/responses` tool-loop execution path (no chat-completions fallback), and tools/collection scope follow the resolved persona document only (no implicit merges). If persona model is unset, server uses `XAI_CHAT_MODEL` or falls back to `grok-4-1-fast-reasoning`. When the persona includes atxfinance, the server loads portfolio/accounts/watchlist (and a capped positions preview) into the system prompt. The user turn is augmented with the same KB-style metadata as batch — see `buildWorkspaceServerSnapshotBlock`, `appendXchatKbMetadata`, and `resolveXchatLinkedCollectionIds` (persona `xaiCollection` + `teamCollection` + tool `collection_ids` only; no per-user bootstrap merge for RAG).",
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
      "503": jsonResponse("Default admin persona (Super-Agent) missing from database.", "ErrorResponse")
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
  "POST /api/xchat/batch": {
    summary: "Submit xChat batch job",
    description:
      "Uses persona from DB for system prompt, override prompt, and tool list (no hardcoded prompt/tools). See atx-docs/atx-xchat/xchat-tools-guide.md (Batch section).",
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
  XChatAskResponseData: {
    type: "object",
    required: ["response", "model", "personaName", "contextCount", "contextSource"],
    properties: {
      response: { type: "string" },
      model: { type: "string" },
      personaName: {
        type: "string",
        description:
          "Resolved persona display name. Published defaults: Super-Agent (global_admin), xFinance (other roles)."
      },
      modelSelectionSource: {
        type: "string",
        enum: ["default", "persona"],
        description:
          "`persona` when the effective xAI model id came from the resolved persona document; `default` when the persona has no model set (server fallback)."
      },
      contextCount: { type: "integer", minimum: 0 },
      contextSource: { type: "string", enum: ["none", "mongo_scope", "xai_collection"] },
      toolCalls: { type: "array", items: refSchema("XChatToolCallSummary") }
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
          collectionId: { type: "string", nullable: true }
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
      xapi: refSchema("PersonaXapiConfig"),
      status: refSchema("PersonaStatus"),
      version: { type: "integer", minimum: 0 },
      publishedAt: { type: "string", format: "date-time", nullable: true },
      isSystem: { type: "boolean", description: "True when upserted from repo YAML (seed:xpersonas)." },
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
        required: ["documentCount", "createdAt", "updatedAt"],
        properties: {
          documentCount: { type: "integer", nullable: true },
          chunkCount: { type: "integer", nullable: true },
          fileCount: { type: "integer", nullable: true },
          indexStatus: { type: "string", nullable: true },
          createdAt: { type: "string", nullable: true },
          updatedAt: { type: "string", nullable: true }
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
    enum: ["free", "pro", "enterprise"]
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
      lastLoginAt: { type: "string", format: "date-time", nullable: true }
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
