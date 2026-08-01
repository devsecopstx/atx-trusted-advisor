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

function json401RentalBearer(): OpenApiResponse {
  return {
    description:
      "Missing or invalid rental API key. Send `Authorization: Bearer atxr_<16-hex key id>_<64-hex secret>`. Keys live on `core_tenants.apiKeys` (hashed); each key lists allowed scopes (`chat`, `strategy`, `analyze`).",
    content: {
      "application/json": {
        schema: refSchema("ErrorResponse")
      }
    }
  };
}

function rentalChatSuccessHeaders(): NonNullable<OpenApiResponse["headers"]> {
  return {
    "x-rental-tokens-used": {
      description: "Rental tokens consumed for the tenant in the current UTC calendar day **after** this completion.",
      schema: { type: "string" }
    },
    "x-rental-tokens-remaining": {
      description: "Tokens remaining in `rentalProfile.maxDailyTokens` for the UTC day **after** this completion.",
      schema: { type: "string" }
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
    "x-xchat-limit-remaining-hour": {
      description:
        "Remaining asks in the current UTC clock-hour window when the tenant sets `userChatHourlyLimit` > 0; omitted when no hourly cap.",
      schema: { type: "string" }
    },
    "x-xchat-limit-remaining-day": {
      description:
        "Remaining asks in the current UTC calendar-day window for non-admin sessions (`userChatLimit` / day bucket in `ask-usage-limits`).",
      schema: { type: "string" }
    },
    "x-xchat-limit-hourly": {
      description:
        "Configured hourly ask cap from merged tenant workspace limits when set; aligns with the UTC hour bucket in `ask-usage-limits`.",
      schema: { type: "string" }
    },
    "x-xchat-limit-daily": {
      description:
        "Configured daily ask cap from merged tenant workspace limits (`userChatLimit`); aligns with the UTC day bucket in `ask-usage-limits`.",
      schema: { type: "string" }
    },
    "x-latency-ms": {
      description:
        "Wall-clock milliseconds from ask handler entry through model loop completion (JSON `200` path).",
      schema: { type: "string" }
    },
    "x-cache-hit": {
      description: "`1` when the response was served from a server-side short-circuit cache (e.g. income-ideas Redis); `0` otherwise.",
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
      "403": json403Admin(
        "Session is valid, but admin role is required — or persona is system-seeded (`isSystem`) and cannot be deleted."
      ),
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
        "User message with optional persona selection. Non-admin users can only select published professional personas and cannot override model ids. Ask always runs through a single **non-streaming** `/v1/responses` tool-loop execution path (no chat-completions fallback; no SSE streaming in this route). Hosted RAG pre-search uses **persona-linked** xAI collection ids (`resolveXchatPersonaDeclaredCollectionIds` — `xaiCollection`, `teamCollection`, tool `collection_ids`; no implicit deploy env team KB merge). Optional **`financeKbRagSurface`** (`xchat` default, or **`reports`** for scheduled portfolio monitor / weekly summary tasks) steers Finance KB snippet retrieval toward **`atx-response-guidelines`** chat vs report-surface rows before the model turn. At most **four turns** (~eight `recentMessages` rows) are forwarded to the model for latency; UI “keep last 10” affects Mongo persistence, not this cap. When **`XCHAT_USE_REMOTE_HISTORY=true`**, persona `keepXchatHistory` is true, **Keep last 10 messages** is on, `threadId` is present, and a prior turn stored `xaiResponseId`, ask sends `store_messages` + `previous_response_id` and omits client recent-turn injection for that continuation (no separate **long-term xAI memory** toggle required). Otherwise recent messages from the request are still merged into the system prompt when long-term memory is off. If persona model is unset, server uses `XAI_CHAT_MODEL` or falls back to `grok-4-1-fast-reasoning`. When the persona includes **`atx_function`** (workspace tool; UI citations use slug **`atx_function`**, legacy **`atxfinance`** normalizes the same), the server loads portfolio/accounts/watchlist (desk riskProfile/outlook + symbols, capped positions preview) into the system prompt. User turn uses `appendXchatKbMetadata` with the same persona-linked id list wired into tools. Successful **`200`** includes **`data.content`** (markdown alias of **`data.response`**) and **`data.metadata`** (`durationMs`, `sourcesUsed`, `personaId`, `model`, `threadId` echo) alongside **`interactionMeta`**. Successful JSON may include optional **`xaiUsage`** (token counts from the Responses API `usage` object) for client session stats and admin cost rollups.",
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
  "POST /api/xchat/message-feedback": {
    summary: "Vote on an xChat assistant turn (thumbs up/down)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("XChatMessageFeedbackRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Feedback stored.", "XChatMessageFeedbackOkResponse"),
      "400": jsonResponse("Invalid JSON, payload, or log id.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid but login-eligible platform role is required."),
      "404": jsonResponse("Log row not found for this user/tenant.", "ErrorResponse")
    }
  },
  "POST /api/ai/rent/chat": {
    summary: "Rental AI chat (tenant-scoped xChat tool-loop)",
    description:
      "White-label partner chat. Authenticate with `Authorization: Bearer atxr_*` and **`chat`** scope. Injects tenant `strategyBias` and workspace snapshot: optional **`username`** (X handle, `@` optional) scopes the book to that tenant member without Mongo user-id hex; otherwise use owned **`portfolioId`** or the provisioned sample portfolio from `rentalProfile`. **Non-streaming:** `200` JSON envelope below. **Streaming:** set `Accept: text/event-stream` **or** `stream: true` for SSE (`chat.completion.chunk` deltas + terminal `data: [DONE]`). Token metering updates `rental_ai_token_usage` / `xchat_usage_limits`; successful JSON responses include **`x-rental-tokens-*`** headers.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("RentalAiChatRequest")
        }
      }
    },
    responses: {
      "200": {
        description:
          "Assistant markdown reply (`data.response`) and xAI usage snapshot, **unless** `Accept: text/event-stream` or `stream: true` — then the body is **text/event-stream** (not documented as alternate media here).",
        headers: rentalChatSuccessHeaders(),
        content: {
          "application/json": {
            schema: refSchema("RentalAiChatJsonResponse")
          }
        }
      },
      "400": jsonResponse("Invalid JSON or validation error.", "ValidationErrorResponse"),
      "401": json401RentalBearer(),
      "403": jsonResponse("Rental inactive, expired, scope mismatch, or API keys disabled.", "ErrorResponse"),
      "404": jsonResponse(
        "Workspace user not found for optional `username`, or user has no membership in this tenant.",
        "ErrorResponse"
      ),
      "429": jsonResponse("Rate limit, concurrency, or token budget exhausted.", "RateLimitErrorResponse"),
      "502": jsonResponse("xAI provider error.", "XaiProviderErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/ai/rent/strategy": {
    summary: "Rental AI strategy job (accept + poll)",
    description:
      "**`strategy`** scope. **`202`** returns `jobId` + relative `pollUrl`. **`GET /api/ai/rent/strategy?jobId=`** with the same Bearer returns materialized job row (MVP completes synchronously in persistence — see `rental-ai-platform.md`).",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("RentalAiStrategyPostRequest")
        }
      }
    },
    responses: {
      "202": jsonResponse("Job accepted.", "RentalAiJobAcceptedResponse"),
      "400": jsonResponse("Invalid JSON or validation error.", "ValidationErrorResponse"),
      "401": json401RentalBearer(),
      "403": jsonResponse("Rental inactive, expired, scope mismatch, or API keys disabled.", "ErrorResponse"),
      "429": jsonResponse("Rate limit, concurrency, or token budget exhausted.", "RateLimitErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/ai/rent/strategy": {
    summary: "Poll rental AI strategy job",
    parameters: [
      {
        name: "jobId",
        in: "query",
        required: true,
        description: "ObjectId hex returned from `POST /api/ai/rent/strategy`.",
        schema: { type: "string", minLength: 8, maxLength: 32 }
      }
    ],
    responses: {
      "200": jsonResponse("Job status and payload.", "RentalAiJobPollResponse"),
      "400": jsonResponse("Missing jobId.", "ErrorResponse"),
      "401": json401RentalBearer(),
      "403": jsonResponse("Rental inactive, expired, scope mismatch, or API keys disabled.", "ErrorResponse"),
      "404": jsonResponse("Job not found for tenant.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/ai/rent/analyze": {
    summary: "Rental AI portfolio analyze job (accept + poll)",
    description: "**`analyze`** scope. Same **`202` + GET poll** pattern as strategy.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("RentalAiAnalyzePostRequest")
        }
      }
    },
    responses: {
      "202": jsonResponse("Job accepted.", "RentalAiJobAcceptedResponse"),
      "400": jsonResponse("Invalid JSON or validation error.", "ValidationErrorResponse"),
      "401": json401RentalBearer(),
      "403": jsonResponse("Rental inactive, expired, scope mismatch, or API keys disabled.", "ErrorResponse"),
      "429": jsonResponse("Rate limit, concurrency, or token budget exhausted.", "RateLimitErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/ai/rent/analyze": {
    summary: "Poll rental AI analyze job",
    parameters: [
      {
        name: "jobId",
        in: "query",
        required: true,
        description: "ObjectId hex returned from `POST /api/ai/rent/analyze`.",
        schema: { type: "string", minLength: 8, maxLength: 32 }
      }
    ],
    responses: {
      "200": jsonResponse("Job status and payload.", "RentalAiJobPollResponse"),
      "400": jsonResponse("Missing jobId.", "ErrorResponse"),
      "401": json401RentalBearer(),
      "403": jsonResponse("Rental inactive, expired, scope mismatch, or API keys disabled.", "ErrorResponse"),
      "404": jsonResponse("Job not found for tenant.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
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
  "GET /api/xchat/workspace-warm": {
    summary: "Warm workspace snapshot cache for xChat",
    description:
      "Loads portfolio/accounts/watchlist snapshot (Mongo + optional Redis + Yahoo batch quotes for watchlist symbols) for the signed-in user. Optional **`portfolioId`** (24-char hex) scopes the same way as xChat workspace. Idempotent; safe to call on `/xchat` mount or portfolio changes.",
    parameters: [
      {
        name: "portfolioId",
        in: "query",
        required: false,
        description: "Workspace portfolio ObjectId hex; omit to use default portfolio resolution.",
        schema: { type: "string", minLength: 24, maxLength: 24 }
      }
    ],
    responses: {
      "200": jsonResponse("Warm accepted.", "XchatWorkspaceWarmResponseEnvelope"),
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
  "POST /api/reports/create": {
    summary: "Create temporary public options scan share link",
    description:
      "Session-scoped route for turning an options action scan payload into a 24-hour temporary share URL (`/reports/scan/{token}`). Stored in Mongo `options_scan_reports` with TTL on `expiresAt`.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("OptionsScanShareCreateRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Share link created.", "OptionsScanShareCreateResponseEnvelope"),
      "400": jsonResponse("Invalid JSON payload.", "ValidationErrorResponse"),
      "401": json401Session()
    }
  },
  "GET /api/reports/scan/{token}": {
    summary: "Fetch public options scan report by temporary token",
    parameters: [
      {
        name: "token",
        in: "path",
        required: true,
        schema: { type: "string" }
      }
    ],
    responses: {
      "200": jsonResponse("Public scan report payload.", "OptionsScanSharePublicResponseEnvelope"),
      "400": jsonResponse("Token is required.", "ErrorResponse"),
      "404": jsonResponse("Report token is missing, invalid, or expired.", "ErrorResponse")
    }
  },
  "POST /api/reports/scan/apply-watchlist": {
    summary: "Apply one options scan row to watchlist",
    description:
      "Session-scoped one-click mutation used by options scan report rows. Upserts the watchlist symbol metadata and can optionally create a portfolio price alert in the same request.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("OptionsScanApplyWatchlistRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Row applied to watchlist.", "OptionsScanApplyWatchlistResponseEnvelope"),
      "400": jsonResponse("Invalid JSON payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "404": jsonResponse("Default portfolio or watchlist not found.", "ErrorResponse")
    }
  },
  "POST /api/reports/wheel/apply-watchlist": {
    summary: "Add wheel related-supplier symbols to the default portfolio watchlist",
    description:
      "Session-scoped bulk upsert from Wheel Strategy report “Related Supplier Wheel Candidates”. Tags rows with a wheel_report_related rationale and review status.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("WheelRelatedApplyWatchlistRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Related supplier symbols applied to watchlist.", "WheelRelatedApplyWatchlistResponseEnvelope"),
      "400": jsonResponse("Invalid JSON payload.", "ValidationErrorResponse"),
      "401": json401Session(),
      "404": jsonResponse("Default portfolio or watchlist not found.", "ErrorResponse")
    }
  },
  "POST /api/internal/user-tasks/process-due": {
    summary: "Process due app_user automation tasks ( Mongo `user_tasks` )",
    description:
      "Server-to-server. Polls due `user_tasks` and runs `prompt` types via the same path as interactive xChat (signed session cookie + `POST /api/xchat/ask` with **finance-advisor** default, **`reasoningMode: fast`**, **`financeKbRagSurface: reports`**). **`admin_scheduled_tasks`** (Admin → Tasks: scanners, digests, etc.) **deliberately bypass** this path and run on direct Next/Spring task-runner hooks for operational efficiency—not xChat. Guard with `X-Atx-Scheduler-Secret` === `ATX_SCHEDULER_INTERNAL_SECRET` (min 24 chars).",
    parameters: [
      {
        name: "X-Atx-Scheduler-Secret",
        in: "header",
        required: true,
        description: "Shared secret; must match `ATX_SCHEDULER_INTERNAL_SECRET`.",
        schema: { type: "string", minLength: 24 }
      }
    ],
    responses: {
      "200": jsonResponse("Batch processed.", "UserTasksProcessDueResponseEnvelope"),
      "401": jsonResponse("Missing or invalid scheduler secret.", "ErrorResponse"),
      "503": jsonResponse("Secret not configured on Next.", "ErrorResponse")
    }
  },
  "POST /api/internal/scheduler/execute-task": {
    summary: "Execute one Mongo-defined scheduled task on Next (JVM delegate)",
    description:
      "Server-to-server only. Spring `NextSchedulerExecuteClient` calls this so admin scheduled jobs run on the Next task-runner (Yahoo watchlist refresh, scanners, etc.). Authenticate with header `X-Atx-Scheduler-Secret` equal to `ATX_SCHEDULER_INTERNAL_SECRET` (same value on JVM and Next; min 24 chars). Not cookie session auth.",
    parameters: [
      {
        name: "X-Atx-Scheduler-Secret",
        in: "header",
        required: true,
        description: "Shared secret; must match `ATX_SCHEDULER_INTERNAL_SECRET`.",
        schema: { type: "string", minLength: 24 }
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("SchedulerInternalExecuteTaskRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Run finished (check `status` in payload).", "SchedulerInternalExecuteTaskResponseEnvelope"),
      "400": jsonResponse("Invalid JSON or body validation.", "ValidationErrorResponse"),
      "401": jsonResponse("Missing or invalid scheduler secret.", "ErrorResponse"),
      "404": jsonResponse("Task id not found.", "ErrorResponse"),
      "503": jsonResponse("Next has no `ATX_SCHEDULER_INTERNAL_SECRET` configured.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
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
  "GET /api/admin/system/db-connection": {
    summary: "Sanitized Mongo diagnostics for Next + optional Spring backend",
    description:
      "global_admin only. Returns redacted URI, `MONGODB_URI` / legacy `MONGODB_URI_B64` presence, effective DB name, and when `ATXFINANCE_BACKEND_ORIGIN` is set compares host/database fingerprint to Spring `GET /api/backend/health`. Audited as `db_connection_viewed`.",
    responses: {
      "200": jsonResponse("Mongo diagnostics envelope (no credentials).", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Failed to read Mongo configuration.", "ErrorResponse")
    }
  },
  "GET /api/admin/system/ops-summary": {
    summary: "Admin ops summary: Next Mongo/Redis + optional Spring backend health + platform KPIs",
    description:
      "`global_admin`, `advisor`, or `operator` (viewer excluded). Returns session tenant id, Next.js app version, Mongo ping + DB name, Next Redis health (`checkRedisHealth`), optional Spring `GET /api/backend/health`, and **`platformOps`**: tenant/user counts, `audit_login` success totals (platform-wide only), xChat usage aggregates (`xchat_usage_limits`), optional **`platformOps.xchat.promptLatency24h`** (p50/p95 per `promptType` from `xchat_prompt_latency_samples` when **`XCHAT_PROMPT_LATENCY_METRICS_ENABLED`**), merged **last 5 jobs** (batch + `admin_task_runs` + `strategy_jobs`), and conservative **`costEstimate`** (tunable via `OPS_SUMMARY_*` env vars). Audited as `ops_summary_viewed`.",
    responses: {
      "200": jsonResponse("Ops summary JSON (no Mongo credentials).", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but operator/advisor/global_admin role is required."),
      "500": jsonResponse("Failed to build ops summary.", "ErrorResponse")
    }
  },
  "GET /api/admin/investment-outlooks": {
    summary: "List cached wheel/CSP investment outlook rows (pre-generated strikes)",
    description:
      "`global_admin`, `advisor`, or `operator`. **`global_admin`**: optional `tenantId` query filters Mongo `investment_outlooks`; otherwise all tenants. Non-global sessions are scoped to **`session.tenantId`**. Joins **`tenant_portfolio`** for portfolio name + owner user id; returns **`updatedAt`**, **`expiresAt`**, **`symbolCount`**. Use to verify scanner output without hitting xChat. Query: **`limit`** (default 100, max 500).",
    responses: {
      "200": jsonResponse("Investment outlook list envelope.", "ErrorResponse"),
      "400": jsonResponse("Invalid tenant scope.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but operator/advisor/global_admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "GET /api/admin/tenants": {
    summary: "Tenant register (platform directory)",
    description:
      "global_admin only. Lists every `core_tenants` row with id, slug, name, platform-default flag, `membershipCount` (all `core_tenant_memberships` for that tenant), optional xChat team KB id/name from `tenantPreferences` (`xchat_team_attachments_collection_id` / `xchat_team_attachments_collection_name`), stored `workspaceLimits` and `tenantPreferences` (JSON objects or null), and `tenant_admin` memberships (email, display name, user id, default session marker). Admin UI (`/admin/tenant-register`) also surfaces last-four id, accent preview from `tenantPreferences.xf_accent_color`, Edit → branding (`/admin/tenant-register/{tenantId}/edit`) or **Workspace limits** (`/admin/tenant-register/{tenantId}/workspace-limits`), Delete when `membershipCount` is 0, and collapsible JSON for workspace limits / preferences.",
    responses: {
      "200": jsonResponse("Tenant register rows.", "TenantRegisterListResponseEnvelope"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/admin/tenants": {
    summary: "Create or update tenant (spec-equivalent, no YAML file)",
    description:
      "global_admin only. Same Mongo contract as `npm run generate:tenant-spec` + `npm run seed:tenant` — upserts `core_tenants` by slug and optionally provisions `initialTenantAdmin` on `core_users` / `core_tenant_memberships`. **Next-only** (not BFF-proxied to Spring).",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: refSchema("AdminTenantCreateRequest")
        }
      }
    },
    responses: {
      "200": jsonResponse("Tenant upserted.", "TenantCreateResponseEnvelope"),
      "400": jsonResponse("Invalid payload or spec validation error.", "ValidationErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "409": jsonResponse("Conflict (e.g. X user id already linked to another email).", "ConflictErrorResponse"),
      "500": jsonResponse("Upsert or provisioning failed.", "ErrorResponse")
    }
  },
  "DELETE /api/admin/tenants/{tenantId}": {
    summary: "Delete tenant (no memberships)",
    description:
      "global_admin only. Deletes `core_tenants` when the tenant is not the platform default and has zero `core_tenant_memberships`. Before removing the row, attempts to **DELETE** the tenant's xAI team attachments collection (`tenantPreferences.xchat_team_attachments_collection_id`) via the Management API when `XAI_MANAGEMENT_API_KEY` is set; returns **502** if that delete fails (except 404/absent, which is treated as success). When the management key is missing but an id was stored, the Mongo row is still deleted and the response includes `xaiTeamAttachmentsCollection.outcome: skipped_no_management_key` so ops can remove the collection manually. Returns 409 when any user is still associated with the tenant.",
    parameters: [{ name: "tenantId", in: "path", required: true, schema: { type: "string" } }],
    responses: {
      "200": jsonResponse("Tenant deleted.", "AdminTenantDeleteResponseEnvelope"),
      "400": jsonResponse("Cannot delete platform default tenant.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("Tenant not found.", "ErrorResponse"),
      "409": jsonResponse("Tenant still has memberships.", "ErrorResponse"),
      "502": jsonResponse("xAI team collection delete failed; tenant row not removed.", "ErrorResponse"),
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
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/admin/users/{userId}/metered-usage/reset": {
    summary: "Clear xChat and feature daily usage meters for a user (Mongo)",
    responses: {
      "200": jsonResponse("Deleted usage bucket counts.", "AdminMeteredUsageResetResponseEnvelope"),
      "400": jsonResponse("Invalid user id.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "503": jsonResponse("Mongo delete failed.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/admin/users/{userId}/resend-credential-invite": {
    summary:
      "Reissue password-setup invite token and resend approval email (Mongo + desk SMTP). For users without a password who already have a login role. Optional JSON `{ \"forcePasswordRotate\": true }` clears an existing password first (same eligibility as normal invite otherwise).",
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              forcePasswordRotate: {
                type: "boolean",
                description:
                  "When true and the user currently has a password, clears it then issues a new 7-day set-password invite."
              }
            }
          }
        }
      }
    },
    responses: {
      "200": jsonResponse("Invite emailed.", "AdminCredentialInviteResendResponseEnvelope"),
      "400": jsonResponse("Invalid user id.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "409": jsonResponse(
        "User cannot receive a password invite in current state, or password-rotate path is blocked.",
        "ErrorResponse"
      ),
      "502": jsonResponse("Token reissued but outbound email failed.", "AdminCredentialInviteResendPartialFailureEnvelope"),
      "503": jsonResponse("Failed to issue invite token.", "ErrorResponse"),
      "500": jsonResponse("Unhandled server error.", "ErrorResponse")
    }
  },
  "POST /api/admin/users/{userId}/resend-email-verification": {
    summary:
      "Clears password, verification tokens, and emailVerifiedAt; issues a new verify-email token and sends desk mail (global_admin). Forces the user to re-verify and set a new password via a follow-up password invite.",
    responses: {
      "200": jsonResponse("Verification emailed.", "AdminEmailVerificationResendResponseEnvelope"),
      "400": jsonResponse("Invalid user id.", "ErrorResponse"),
      "401": json401Session(),
      "403": json403Admin("Session is valid, but admin role is required."),
      "404": jsonResponse("User not found.", "ErrorResponse"),
      "409": jsonResponse("User cannot receive a verification resend in current state.", "ErrorResponse"),
      "502": jsonResponse("Token reissued but outbound email failed.", "AdminEmailVerificationResendPartialFailureEnvelope"),
      "503": jsonResponse("Failed to reset auth state or issue verification token.", "ErrorResponse"),
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
  OptionsScanReportRow: {
    type: "object",
    required: [
      "rowId",
      "source",
      "symbol",
      "recommendedAction",
      "why",
      "urgency",
      "targetWindow",
      "confidence",
      "applyToWatchlist"
    ],
    properties: {
      rowId: { type: "string" },
      source: { type: "string", enum: ["holding", "watchlist"] },
      portfolioAccountId: {
        type: "string",
        description: "Mongo `portfolio_accounts` ObjectId hex when `source` is `holding`."
      },
      portfolioAccountName: {
        type: "string",
        description: "Custodian book display name when `source` is `holding`."
      },
      symbol: { type: "string" },
      strike: { type: "number" },
      exp: { type: "string", format: "date" },
      type: { type: "string", enum: ["call", "put"] },
      qty: { type: "number" },
      recommendedAction: {
        type: "string",
        enum: ["ROLL", "BTC", "HOLD", "LET_EXPIRE", "STC", "OPEN", "MONITOR", "WAIT"]
      },
      why: { type: "string" },
      urgency: { type: "string", enum: ["high", "med", "low"] },
      targetWindow: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      applyToWatchlist: refSchema("OptionsScanReportRowApplyToWatchlistAction")
    }
  },
  OptionsScanReportRowApplyToWatchlistAction: {
    type: "object",
    required: ["type", "symbol", "allowPriceAlert", "defaultPriceAlertSeverity"],
    properties: {
      type: { type: "string", enum: ["apply_to_watchlist"] },
      symbol: { type: "string" },
      allowPriceAlert: { type: "boolean" },
      defaultPriceAlertSeverity: { type: "string", enum: ["info"] }
    }
  },
  OptionsScanShareScanData: {
    type: "object",
    required: ["generatedAt", "planTier", "truncated", "rows", "disclaimer"],
    properties: {
      generatedAt: { type: "string", format: "date-time" },
      planTier: { type: "string", enum: ["basic", "premium", "premium_plus", "global_admin"] },
      truncated: { type: "boolean" },
      rows: { type: "array", items: refSchema("OptionsScanReportRow") },
      disclaimer: { type: "string" }
    }
  },
  OptionsScanShareCreateRequest: {
    type: "object",
    required: ["scanData"],
    properties: {
      scanData: refSchema("OptionsScanShareScanData")
    }
  },
  OptionsScanShareCreateResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["shareUrl", "shareToken", "expiresAt", "expiresIn"],
        properties: {
          shareUrl: { type: "string" },
          shareToken: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
          expiresIn: { type: "string", enum: ["24 hours"] }
        }
      }
    }
  },
  OptionsScanSharePublicResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["scanData", "createdAt", "expiresAt", "accessCount"],
        properties: {
          scanData: refSchema("OptionsScanShareScanData"),
          createdAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
          accessCount: { type: "integer", minimum: 1 }
        }
      }
    }
  },
  OptionsScanApplyWatchlistRequest: {
    type: "object",
    required: ["row"],
    properties: {
      row: refSchema("OptionsScanReportRow"),
      createPriceAlert: { type: "boolean" },
      priceAlertMinAbsMovePercent: { type: "number", minimum: 0.1, maximum: 100 },
      priceAlert: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          title: { type: "string", maxLength: 200 },
          body: { type: "string", maxLength: 4000 }
        }
      }
    }
  },
  OptionsScanApplyWatchlistResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["rowId", "symbol", "portfolioId", "watchlist", "priceAlert"],
        properties: {
          rowId: { type: "string" },
          symbol: { type: "string" },
          portfolioId: { type: "string" },
          watchlist: {
            type: "object",
            required: ["symbolCount", "applied", "alreadyPresent"],
            properties: {
              symbolCount: { type: "integer", minimum: 0 },
              applied: { type: "boolean" },
              alreadyPresent: { type: "boolean" }
            }
          },
          priceAlert: {
            nullable: true,
            oneOf: [
              {
                type: "object",
                required: ["_id", "title", "body", "severity", "symbol", "createdAt"],
                properties: {
                  _id: { type: "string" },
                  title: { type: "string" },
                  body: { type: "string", nullable: true },
                  severity: { type: "string", enum: ["info", "warning", "critical"] },
                  symbol: { type: "string", nullable: true },
                  createdAt: { type: "string", format: "date-time" }
                }
              }
            ]
          }
        }
      }
    }
  },
  WheelRelatedApplyWatchlistRequest: {
    type: "object",
    required: ["rootTicker", "symbols"],
    properties: {
      rootTicker: { type: "string", minLength: 1, maxLength: 16 },
      symbols: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: { type: "string", minLength: 1, maxLength: 32 }
      },
      generatedAtIso: { type: "string", format: "date-time" }
    }
  },
  WheelRelatedApplyWatchlistResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["portfolioId", "requestedSymbols", "addedNew", "mergedExisting", "watchlistSymbolCount"],
        properties: {
          portfolioId: { type: "string" },
          requestedSymbols: { type: "integer", minimum: 0 },
          addedNew: { type: "integer", minimum: 0 },
          mergedExisting: { type: "integer", minimum: 0 },
          watchlistSymbolCount: { type: "integer", minimum: 0 }
        }
      }
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
  SchedulerInternalExecuteTaskRequest: {
    type: "object",
    required: ["taskId"],
    properties: {
      taskId: { type: "string", minLength: 1, description: "Mongo `admin_scheduled_tasks` document id (24-char hex)." },
      triggeredBy: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Optional audit label (e.g. `system-scheduler` or `scheduler:ops@…`)."
      }
    }
  },
  SchedulerInternalExecuteTaskData: {
    type: "object",
    required: ["runId", "status"],
    properties: {
      runId: { type: "string", description: "Hex string of `admin_task_runs` insert id." },
      status: { type: "string", description: "Task runner terminal or in-progress status." },
      output: { type: "object", additionalProperties: true, description: "Structured runner output when present." }
    }
  },
  SchedulerInternalExecuteTaskResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: { $ref: "#/components/schemas/SchedulerInternalExecuteTaskData" }
    }
  },
  UserTasksProcessDueResultRow: {
    type: "object",
    required: ["taskId", "ok", "message"],
    properties: {
      taskId: { type: "string", description: "Mongo `user_tasks` document id." },
      ok: { type: "boolean" },
      message: { type: "string" }
    }
  },
  UserTasksProcessDueData: {
    type: "object",
    required: ["processed", "results"],
    properties: {
      processed: { type: "integer", minimum: 0 },
      results: {
        type: "array",
        items: { $ref: "#/components/schemas/UserTasksProcessDueResultRow" }
      }
    }
  },
  UserTasksProcessDueResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: { $ref: "#/components/schemas/UserTasksProcessDueData" }
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
    required: [],
    description:
      "Either **message** (trimmed length ≥ 2) or at least one pasted image (**`imageAttachment`** legacy single, and/or **`imageAttachments`** array, max **4** rows; **PNG or JPEG** only) is required. **Depth routing** overrides persona **`model`** for that turn: **`reasoningMode` omitted / fast** → **`grok-4-1-fast`**; **expert** / **heavy** → **`grok-4.5`** with **`reasoning.effort`** **medium** / **high** per [xAI reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning#the-reasoning_effort-parameter) (no multi-agent `agent_count`). Legacy **`reasoningEffort`** without **`reasoningMode`** maps non–multi-agent personas to **`grok-4.5`** + **`reasoning.effort`** (**`none`** disables reasoning on grok-4.5 / grok-4.3); **multi-agent** personas keep **`grok-4.20-multi-agent`** + plan **`multiAgentParallelMaxAgents`**. Optional **`XAI_VISION_MODEL`** overrides the resolved model **only for image turns** (and drops **`reasoning`** tuning). Multi-agent models fall back to the default chat model for image turns when **`XAI_VISION_MODEL`** is unset. **`visionUseWorkspace`** (with a scoped **`portfolioId`**) forces eager workspace preload on image turns so **`atx_function`** can see holdings/watchlist.",
    properties: {
      message: { type: "string", minLength: 0, maxLength: 8000 },
      imageAttachment: {
        type: "object",
        required: ["mediaType", "dataBase64"],
        properties: {
          mediaType: {
            type: "string",
            enum: ["image/png", "image/jpeg"]
          },
          dataBase64: {
            type: "string",
            description: "Base64-encoded image bytes (no data-URL prefix). Max decoded size 4MB."
          }
        }
      },
      imageAttachments: {
        type: "array",
        maxItems: 4,
        description:
          "Optional multi-image paste (PNG/JPEG). When set alongside legacy **`imageAttachment`**, the server merges and caps at four total.",
        items: {
          type: "object",
          required: ["mediaType", "dataBase64"],
          properties: {
            mediaType: {
              type: "string",
              enum: ["image/png", "image/jpeg"]
            },
            dataBase64: {
              type: "string",
              description: "Base64-encoded image bytes (no data-URL prefix). Max decoded size 4MB per item."
            },
            caption: {
              type: "string",
              maxLength: 2000,
              description: "Optional per-image note merged into the user prompt block."
            }
          }
        }
      },
      visionUseWorkspace: {
        type: "boolean",
        description:
          "When **true** with a scoped **`portfolioId`** and pasted image(s), the server eagerly preloads workspace holdings/watchlist for **`atx_function`** on that turn."
      },
      threadId: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description:
          "Client thread key for per-conversation routing memory (for example, strategy-job opt-out persistence)."
      },
      portfolioId: {
        type: "string",
        description:
          "Optional 24-char hex workspace portfolio override. When provided and owned by the signed-in user, xChat tools/preload resolve watchlist and portfolio context from this portfolio instead of the default."
      },
      personaId: {
        type: "string",
        description: "Optional persona selection. App users are restricted to published allowlisted personas."
      },
      reasoningEffort: {
        type: "string",
        enum: ["none", "low", "medium", "high", "xhigh"],
        description:
          "Mutually exclusive with **`reasoningMode`**. When the persona **`model`** is **not** a multi-agent id, the server uses **`grok-4.5`** with matching Responses API **`reasoning.effort`** for this turn (**`none`** disables reasoning on grok-4.5 / grok-4.3). Not allowed when the persona model is multi-agent. **Multi-agent** personas keep **`grok-4.20-multi-agent`** for **`low`**/**`medium`**/**`high`**/**`xhigh`**; plan **`multiAgentParallelMaxAgents`** clamps **`agent_count`**."
      },
      reasoningMode: {
        type: "string",
        enum: ["fast", "expert", "heavy"],
        description:
          "Grok-style preset (mutually exclusive with **`reasoningEffort`**): **fast** — **`grok-4-1-fast`** for this turn (latency-first); **expert** — **`grok-4.5`** + **`reasoning.effort`: medium**; **heavy** — **`grok-4.5`** + **`reasoning.effort`: high** ([effort levels](https://docs.x.ai/developers/model-capabilities/text/reasoning#the-reasoning_effort-parameter)). Omitting **`reasoningMode`** matches **fast** when **`reasoningEffort`** is also omitted (UI default)."
      },
      scope: { type: "string", minLength: 1, maxLength: 128 },
      topK: { type: "integer", minimum: 1, maximum: 10 },
      quoteFreshness: {
        type: "string",
        enum: ["cached_first", "live"],
        description:
          "Workspace watchlist quote policy for **`atx_function`** snapshot preload: **cached_first** (default when omitted and server applies conservative routing) uses Redis / in-process Yahoo batch cache only during US regular session for portfolio-style prompts; **live** always allows Yahoo on cache miss. **Expert** / **heavy** depth and phrases like **live refresh** force **live** regardless."
      },
      financeKbRagSurface: {
        type: "string",
        enum: ["xchat", "reports"],
        description:
          "Finance KB pre-search on the canonical collection: **`xchat`** (default) prefers `atx-response-guidelines` rows tagged for chat + compliance; **`reports`** prefers report-template / report-surface guidelines — use for scheduled **Daily Monitor** / **Weekly Summary** user tasks and other markdown desk reports."
      }
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
  XChatAskInteractionMeta: {
    type: "object",
    required: ["generationMs", "sources"],
    description:
      "Client-facing timing and source counts for the assistant turn (RAG snippets, tool invocations, persona-linked collections).",
    properties: {
      generationMs: { type: "integer", minimum: 0 },
      sources: {
        type: "object",
        required: ["ragChunks", "toolInvocations", "personaCollections", "total"],
        properties: {
          ragChunks: { type: "integer", minimum: 0 },
          toolInvocations: { type: "integer", minimum: 0 },
          personaCollections: { type: "integer", minimum: 0 },
          total: { type: "integer", minimum: 0 }
        }
      }
    }
  },
  XChatAskResponseMetadata: {
    type: "object",
    required: ["durationMs", "sourcesUsed", "personaId", "model", "threadId"],
    description:
      "Compact metadata for UI/analytics: mirrors `interactionMeta.generationMs` and `interactionMeta.sources.total`, plus resolved persona id, effective model id, and echo of request `threadId` (empty when omitted). Persists only via Mongo when opt-in history is on (`getXchatUserPreferences` / `saveXChatLog`).",
    properties: {
      durationMs: { type: "integer", minimum: 1 },
      sourcesUsed: { type: "integer", minimum: 0 },
      personaId: {
        type: "string",
        description: "Resolved xPersona ObjectId hex for this turn (after admin assignment + picker override policy)."
      },
      model: {
        type: "string",
        description: "Effective model id from xAI or a sentinel for shortcut paths (e.g. `strategy_job_preflight`)."
      },
      threadId: {
        type: "string",
        description: "Echo of JSON body `threadId`; empty string when the client omitted it."
      }
    }
  },
  XChatAskResponseData: {
    type: "object",
    required: [
      "response",
      "content",
      "metadata",
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
      content: {
        type: "string",
        description: "Same assistant markdown as `response` (canonical alias for integrations)."
      },
      metadata: refSchema("XChatAskResponseMetadata"),
      model: { type: "string" },
      personaName: {
        type: "string",
        description:
          "Resolved persona display name. Published defaults: advisor (global_admin), atx-trusted-advisor (other roles)."
      },
      modelSelectionSource: {
        type: "string",
        enum: [
          "default",
          "persona",
          "vision_env",
          "reasoning_mode",
          "reasoning_mode_fallback",
          "reasoning_effort"
        ],
        description:
          "`reasoning_mode` — Depth preset routing (**Fast** → **`grok-4-1-fast`**, **Expert**/**Heavy** → **`grok-4.5`** + reasoning); `reasoning_effort` — legacy body **`reasoningEffort`** routed to **`grok-4.5`** (non–multi-agent personas); `vision_env` — **`XAI_VISION_MODEL`** image override; `persona` / `default` — persona vs server default when no depth controls apply (rare in current product paths); `reasoning_mode_fallback` — reserved (prior tier clamp path; may be absent on newer servers)."
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
        description:
          "True when the server returned a one-turn strategy-job preflight instead of a full model pass (suppressed after thread opt-out)."
      },
      optionsActionScan: {
        allOf: [refSchema("OptionsScanShareScanData")],
        description:
          "Present for direct `options_action_scan` asks. Enables rich table/card rendering plus export/share actions in xChat."
      },
      multiAgentDowngraded: {
        type: "boolean",
        description: "Present when a multi-agent persona model was downgraded to the default fast model for this turn."
      },
      personaModelRequested: {
        type: "string",
        description: "When `multiAgentDowngraded` is true, the persona’s configured model id before downgrade."
      },
      xaiUsage: refSchema("XChatAskXaiUsage"),
      interactionMeta: refSchema("XChatAskInteractionMeta")
    }
  },
  XChatMessageFeedbackRequest: {
    type: "object",
    required: ["logId", "vote"],
    additionalProperties: false,
    properties: {
      logId: { type: "string", minLength: 24, maxLength: 24, description: "Mongo `xchat_logs` ObjectId hex." },
      vote: { type: "string", enum: ["up", "down"] }
    }
  },
  XChatMessageFeedbackOkResponse: {
    type: "object",
    required: ["ok"],
    properties: {
      ok: { type: "boolean", enum: [true] }
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
          historyMode: { type: "string", enum: ["mongo", "ephemeral"] }
        }
      }
    }
  },
  XchatWorkspaceWarmResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["warmed"],
        properties: {
          warmed: { type: "boolean", enum: [true] }
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
          "Reserved legacy flag; remote xAI conversation continuity is disabled in MVP privacy mode."
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
  TenantRegisterAdminRow: {
    type: "object",
    required: ["userId", "email", "displayName", "isDefaultSessionTenant"],
    properties: {
      userId: { type: "string", description: "core_users._id hex" },
      email: { type: "string", description: "core_users.email (may be empty for edge cases)" },
      displayName: { type: "string" },
      isDefaultSessionTenant: {
        type: "boolean",
        description: "True when this membership is the user's default session tenant."
      }
    }
  },
  TenantRegisterRow: {
    type: "object",
    required: [
      "tenantId",
      "slug",
      "name",
      "isPlatformDefault",
      "createdAt",
      "updatedAt",
      "membershipCount",
      "xchatTeamAttachmentsCollectionId",
      "xchatTeamAttachmentsCollectionName",
      "workspaceLimits",
      "tenantPreferences",
      "tenantAdmins"
    ],
    properties: {
      tenantId: { type: "string", description: "core_tenants._id hex" },
      slug: { type: "string" },
      name: { type: "string" },
      isPlatformDefault: {
        type: "boolean",
        description: "True when this tenant is the platform default (`core_tenants.isDefault`)."
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      membershipCount: {
        type: "integer",
        minimum: 0,
        description: "Count of `core_tenant_memberships` rows for this tenant (all roles)."
      },
      xchatTeamAttachmentsCollectionId: {
        type: "string",
        nullable: true,
        description: "xAI team collection id for xChat uploads when provisioned."
      },
      xchatTeamAttachmentsCollectionName: {
        type: "string",
        nullable: true,
        description: "xAI collection display / folder name."
      },
      workspaceLimits: {
        oneOf: [
          { type: "object", additionalProperties: true, description: "Stored `core_tenants.workspaceLimits` partial." },
          { type: "null" }
        ]
      },
      tenantPreferences: {
        oneOf: [
          {
            type: "object",
            additionalProperties: true,
            description: "Stored `core_tenants.tenantPreferences` (branding, xf_ui_theme, flags)."
          },
          { type: "null" }
        ]
      },
      tenantAdmins: { type: "array", items: refSchema("TenantRegisterAdminRow") }
    }
  },
  TenantRegisterListResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: { type: "array", items: refSchema("TenantRegisterRow") }
    }
  },
  AdminTenantDeleteResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["deleted", "tenantId"],
        properties: {
          deleted: { type: "boolean", enum: [true] },
          tenantId: { type: "string", description: "Deleted `core_tenants._id` hex." },
          xaiTeamAttachmentsCollection: {
            type: "object",
            required: ["outcome"],
            properties: {
              outcome: {
                type: "string",
                enum: ["deleted", "already_absent", "no_collection_id", "skipped_no_management_key"],
                description:
                  "Result of removing the xChat team KB collection on xAI. `skipped_no_management_key` means configure `XAI_MANAGEMENT_API_KEY` or delete the collection in xAI manually."
              },
              collectionId: {
                type: "string",
                description: "xAI collection id when provisioned (omit when `no_collection_id`)."
              }
            }
          }
        }
      }
    }
  },
  AdminTenantCreateRequest: {
    type: "object",
    required: ["slug", "name"],
    properties: {
      slug: { type: "string", description: "Tenant slug (lowercase, hyphens)." },
      name: { type: "string", description: "Display name." },
      initialAdminEmail: { type: "string", description: "When set, provisions initialTenantAdmin." },
      initialAdminXUserId: { type: "string", description: "Optional X REST user id or handle." },
      initialAdminPlatformRole: {
        type: "string",
        enum: ["advisor", "operator", "viewer"],
        description: "Platform role added to the user when initial admin is set (default operator in YAML)."
      },
      setAsDefaultSessionTenant: {
        type: "boolean",
        description: "When initial admin is set, whether membership is default session tenant (default true)."
      },
      xfUiTheme: { type: "string", enum: ["light", "dark", "system"], description: "tenantPreferences.xf_ui_theme." },
      xfBrandPalette: {
        type: "string",
        enum: ["default", "violet", "cyan", "amber", "rose", "emerald"],
        description: "tenantPreferences.xf_brand_palette — accent preset for tenant-branded shells."
      },
      xfHeroIconUrl: {
        type: "string",
        maxLength: 450000,
        description:
          "tenantPreferences.xf_hero_icon_url — https URL, http for localhost/127.0.0.1 only, or data:image/*;base64,… (size-capped)."
      },
      xfAccentColor: {
        type: "string",
        maxLength: 32,
        description:
          "tenantPreferences.xf_accent_color — CSS hex #rgb or #rrggbb (default #8b5cf6 when omitted)."
      },
      xfTenantLogoUrl: {
        type: "string",
        maxLength: 3_000_000,
        description:
          "tenantPreferences.xf_tenant_logo_url — https, localhost http, or data:image/*;base64,… (larger cap than hero)."
      },
      xfTenantTagline: {
        type: "string",
        maxLength: 60,
        description: "tenantPreferences.xf_tenant_tagline — subtitle under tenant name in product shell."
      },
      workspaceLimits: {
        type: "object",
        additionalProperties: true,
        description:
          "Optional partial `core_tenants.workspaceLimits` — same validation as tenant-spec YAML (`userXoptionsLimit`, `userChatLimit`, `userChatHourlyLimit` 0–1e6, `tenantPortfolioLimit`, `portfolioAccountLimit`, `chatHistoryMax`, `maxUsersPerTenant`, `userTasksMax`, `changePersonaEnabled`). Unknown keys ignored. Per-plan overrides are not set here; use `PATCH /api/admin/tenants/{tenantId}/workspace-limits` after create."
      }
    }
  },
  TenantCreateResultData: {
    type: "object",
    required: ["tenantId", "slug", "name", "provisionedInitialAdmin", "message"],
    properties: {
      tenantId: { type: "string" },
      slug: { type: "string" },
      name: { type: "string" },
      provisionedInitialAdmin: { type: "boolean" },
      message: { type: "string" },
      xchatTeamAttachments: {
        type: "object",
        required: ["collectionId", "collectionName", "alreadyConfigured"],
        properties: {
          collectionId: { type: "string", description: "xAI team collection id (Management API)." },
          collectionName: { type: "string" },
          alreadyConfigured: {
            type: "boolean",
            description: "True when ids were already stored on the tenant (re-upsert)."
          }
        }
      }
    }
  },
  TenantCreateResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: refSchema("TenantCreateResultData")
    }
  },
  CoreUserTenantMembership: {
    type: "object",
    required: ["tenantId", "slug", "name", "tenantRole", "isDefaultSessionTenant"],
    properties: {
      tenantId: { type: "string", description: "Mongo ObjectId hex for core_tenants._id" },
      slug: { type: "string" },
      name: { type: "string" },
      tenantRole: { type: "string", enum: ["tenant_admin", "member"] },
      isDefaultSessionTenant: {
        type: "boolean",
        description: "True when this row is the user's default session tenant (isDefaultTenant on membership)."
      }
    }
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
      lastLoginUserAgent: { type: "string", nullable: true },
      tenantMemberships: {
        type: "array",
        items: refSchema("CoreUserTenantMembership"),
        description: "Tenant links from core_tenant_memberships (admin list/detail)."
      },
      hasPassword: {
        type: "boolean",
        description: "True when core_users.passwordHash is set (email/password login configured)."
      },
      credentialInviteExpiresAt: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "Expiry of the current password-invite token, if any."
      },
      resendPasswordInviteAvailable: {
        type: "boolean",
        description: "Whether POST …/resend-credential-invite is expected to succeed for this user."
      },
      resendPasswordInviteBlockedReason: {
        type: "string",
        nullable: true,
        description: "When resend is unavailable, a short admin-facing reason."
      },
      resendPasswordInviteForceAvailable: {
        type: "boolean",
        description:
          "When true, POST …/resend-credential-invite with `{ \"forcePasswordRotate\": true }` can clear an existing password and send a new invite."
      },
      resendPasswordInviteForceBlockedReason: {
        type: "string",
        nullable: true,
        description: "When force-rotate invite is unavailable, a short admin-facing reason."
      },
      resendEmailVerificationAvailable: {
        type: "boolean",
        description: "Whether POST …/resend-email-verification is expected to succeed for this user."
      },
      resendEmailVerificationBlockedReason: {
        type: "string",
        nullable: true,
        description: "When verification resend is unavailable, a short admin-facing reason."
      }
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
  AdminMeteredUsageResetResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["userId", "xchatUsageDeleted", "featureDailyDeleted"],
        properties: {
          userId: { type: "string" },
          xchatUsageDeleted: { type: "integer", minimum: 0 },
          featureDailyDeleted: { type: "integer", minimum: 0 }
        }
      }
    }
  },
  AdminCredentialInviteResendResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["userId", "emailedTo", "credentialInviteExpiresAt"],
        properties: {
          userId: { type: "string" },
          emailedTo: { type: "string", format: "email" },
          credentialInviteExpiresAt: { type: "string", format: "date-time", nullable: true }
        }
      }
    }
  },
  AdminCredentialInviteResendPartialFailureEnvelope: {
    type: "object",
    required: ["error", "code", "data"],
    properties: {
      error: { type: "string" },
      code: { type: "string", enum: ["credential_invite_email_failed"] },
      data: {
        type: "object",
        required: ["userId", "emailedTo", "credentialInviteExpiresAt"],
        properties: {
          userId: { type: "string" },
          emailedTo: { type: "string", format: "email" },
          credentialInviteExpiresAt: { type: "string", format: "date-time", nullable: true }
        }
      }
    }
  },
  AdminEmailVerificationResendResponseEnvelope: {
    type: "object",
    required: ["data"],
    properties: {
      data: {
        type: "object",
        required: ["userId", "emailedTo", "emailVerificationExpiresAt"],
        properties: {
          userId: { type: "string" },
          emailedTo: { type: "string", format: "email" },
          emailVerificationExpiresAt: { type: "string", format: "date-time", nullable: true }
        }
      }
    }
  },
  AdminEmailVerificationResendPartialFailureEnvelope: {
    type: "object",
    required: ["error", "code", "data"],
    properties: {
      error: { type: "string" },
      code: { type: "string", enum: ["email_verification_email_failed"] },
      data: {
        type: "object",
        required: ["userId", "emailedTo", "emailVerificationExpiresAt"],
        properties: {
          userId: { type: "string" },
          emailedTo: { type: "string", format: "email" },
          emailVerificationExpiresAt: { type: "string", format: "date-time", nullable: true }
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
  },
  RentalAiChatRequest: {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", minLength: 1, maxLength: 32000 },
      username: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description:
          "X (Twitter) handle for a user who belongs to this tenant (`xAccount.username`). Case-insensitive; leading `@` optional. Resolves Mongo user id server-side — no hex `userId` in the payload. When set, defaults omit `rentalProfile.samplePortfolioId` unless `portfolioId` is also sent."
      },
      portfolioId: {
        type: "string",
        minLength: 24,
        maxLength: 24,
        description:
          "Mongo ObjectId hex for an owned portfolio; when omitted with no `username`, server uses `rentalProfile.samplePortfolioId` when set."
      },
      stream: {
        type: "boolean",
        description: "When true (or when `Accept: text/event-stream`), response is SSE instead of JSON."
      }
    }
  },
  RentalAiChatJsonResponse: {
    type: "object",
    required: ["ok", "correlationId", "tenantSlug", "data"],
    properties: {
      ok: { type: "boolean", enum: [true] },
      correlationId: { type: "string" },
      tenantSlug: { type: "string" },
      data: {
        type: "object",
        required: ["response", "model", "usage"],
        properties: {
          response: { type: "string", description: "Assistant markdown." },
          model: { type: "string" },
          usage: {
            type: "object",
            description: "xAI Responses usage fields when present.",
            additionalProperties: true
          }
        }
      }
    }
  },
  RentalAiStrategyPostRequest: {
    type: "object",
    required: ["symbols"],
    properties: {
      symbols: {
        type: "array",
        minItems: 1,
        maxItems: 64,
        items: { type: "string", minLength: 1, maxLength: 32 }
      },
      portfolioId: {
        type: "string",
        minLength: 24,
        maxLength: 24,
        description: "Optional Mongo ObjectId hex."
      },
      notes: { type: "string", maxLength: 8000 }
    }
  },
  RentalAiAnalyzePostRequest: {
    type: "object",
    properties: {
      jobId: { type: "string", minLength: 8, maxLength: 128 },
      deepRun: { type: "boolean" }
    }
  },
  RentalAiJobAcceptedResponse: {
    type: "object",
    required: ["ok", "correlationId", "code", "data"],
    properties: {
      ok: { type: "boolean", enum: [true] },
      correlationId: { type: "string" },
      code: { type: "string", enum: ["accepted"] },
      data: {
        type: "object",
        required: ["jobId", "status", "pollUrl"],
        properties: {
          jobId: { type: "string" },
          status: { type: "string", enum: ["accepted"] },
          pollUrl: { type: "string", description: "Relative URL — prefix with deployment origin." }
        }
      }
    }
  },
  RentalAiJobPollResponse: {
    type: "object",
    required: ["ok", "correlationId", "data"],
    properties: {
      ok: { type: "boolean", enum: [true] },
      correlationId: { type: "string" },
      data: {
        type: "object",
        required: ["jobId", "status", "scope", "result", "createdAt", "updatedAt"],
        properties: {
          jobId: { type: "string" },
          status: { type: "string" },
          scope: { type: "string", enum: ["strategy", "analyze"] },
          result: { nullable: true, description: "Opaque job payload (object or null).", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      }
    }
  }
};
