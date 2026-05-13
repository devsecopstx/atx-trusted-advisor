# xChat vision paste (HNWI v2.1) — architecture & security

This document describes **production-hardened** clipboard / pasted-image handling for `POST /api/xchat/ask`: server-side resize, metadata stripping, optional **ClamAV** scanning, SHA-256 lineage, Mongo audit metadata, multi-image payloads, optional auto-caption, and HNWI **Desk Report v2.1** directive injection when persona + workspace context match.

## Architecture (request path)

1. **Auth / billing / limits** — unchanged: session, plan, distributed ask limiter (`enforceDistributedAskUsageLimit`).
2. **Payload (Zod)** — `message`, optional `imageAttachment` (legacy single), optional `imageAttachments[]` (max 4), optional `visionUseWorkspace` (scopes eager workspace preload when portfolio is selected).
3. **Merge** — `mergeRawAskImageAttachmentsFromAskPayload` dedupes shape and caps at 4.
4. **Decode + validate MIME** — `parseAndValidateXchatPasteImage` per row (PNG/JPEG, byte cap).
5. **Security pipeline** — `processDecodedXchatVisionImage` (`src/modules/xchat/vision-processor.ts`):
   - `sharp`: EXIF-oriented `rotate()`, resize max edge `VISION_MAX_DIMENSION` (default **1920**, clamped 256–8192), re-encode (JPEG by default; PNG if alpha).
   - **SHA-256**: full hex of **original** decoded bytes and **processed** bytes (stored on `xchat_image_attachments`).
   - **Virus scan** — `scanImageBufferWithClamAV` (`xchat-vision-virus-scan.ts`): when `VISION_VIRUS_SCAN_ENABLED=true`, `clamscan` (or `VISION_CLAMSCAN_BIN`) on **processed** bytes; exit code **1** = threat.
6. **Auto-caption** — if `message` is empty and images present: `generateXchatVisionAutoCaption` (single xAI vision call, `toolChoice: "none"`, `maxTurns: 1`, model `XAI_VISION_MODEL` or default chat model).
7. **Persistence** — `insertXchatImageAttachmentRows` (`xchat_image_attachments`) after `userId` is known, before the main tool loop (includes `correlationId`, `requestId`, caption snippet, dimensions, `virusScanned` flag).
8. **Model routing** — unchanged vision rules: optional `XAI_VISION_MODEL` override; multi-agent personas downgraded on vision turns; parallel agents cleared.
9. **HNWI directive** — when `shouldInjectHnwiVisionDeskDirective` is true, append the user-line directive to `userPrompt` (see below).
10. **xAI** — `respondWithXaiToolLoop` receives `userImageDataUrls: string[]` (multimodal first turn).

## Security matrix

| Control | Implementation | Failure mode |
|--------|----------------|--------------|
| MIME allowlist | PNG / JPEG only (clipboard client + server Zod) | `400` unsupported / invalid payload |
| Size cap (wire) | `MAX_XCHAT_ASK_JSON_BYTES` + per-image base64 max in Zod | `413` / `400` |
| Decode bomb guard | `sharp` `limitInputPixels` | `400` `vision_process_failed` |
| Metadata / EXIF | Re-encode strips EXIF / IPTC in practice | n/a |
| Resize | Longest edge ≤ `VISION_MAX_DIMENSION` | n/a (normalize) |
| Integrity / audit | Dual SHA-256 + Mongo row + `correlationId` / `requestId` | insert errors logged; ask may still proceed |
| Malware | Optional ClamAV on processed buffer | `422` `vision_threat_detected` + `createAuditEvent` |
| Scanner infra | ClamAV missing / exec error when scan enabled | `503` `vision_scan_unavailable` (fail-closed) |
| Multi-tenant | Rows include `tenantId` + `userId` | purge deletes by `userId` |

## HNWI Desk Report v2.1 injection (vision)

When all are true:

- At least one processed image is present.
- Persona name matches **HNWI** heuristics (`isHnwiPersonaName`).
- **Options / workspace context**: any of — client sent `hnwiPromptTemplateV21Slug`, or workspace preload has holdings/watchlist rows, or (`visionUseWorkspace` **and** a scoped `portfolioId`).

…the route appends to the composed `userPrompt`:

`Analyze this image in context of my current workspace holdings and watchlist. Output as HNWI Options Desk Report v2.1.`

(System addon from `hnwiPromptTemplateV21Slug` / `buildHnwiV21DeskReportSystemAddon` remains unchanged when slug is present.)

## Roadmap

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Single-image paste + xAI `input_image` + model override | Shipped (pre-3.19.7 baseline) |
| **2** | Multi-image, `sharp` pipeline, SHA-256, ClamAV hook, Mongo `xchat_image_attachments`, purge parity, auto-caption, HNWI directive, composer UX | **Shipped** (this slice) |
| **3** | GridFS / object-store binary retention, per-image caption columns, tenant admin retention policy UI | Planned |
| **4** | JVM-authoritative ask + BFF consolidation (`api-consolidation-spring-backend.md`) | Planned |

## Related docs

- `atx-docs/xchat/xchat-history-storage.md` — history vs image metadata (images are **not** xAI `store_messages` blobs; metadata lives in Mongo).
- `atx-docs/guides/deploy-and-ops.md` — env vars `XAI_VISION_MODEL`, `VISION_MAX_DIMENSION`, `VISION_VIRUS_SCAN_ENABLED`, `VISION_CLAMSCAN_BIN`.
- `atx-docs/design-system/current-state-features.md` — surface map + known gaps.

## Tests

- **Route + harness:** `tests/integration/xchat-vision-paste.test.ts` — happy path, `XAI_VISION_MODEL`, multi-agent downgrade on image turns, multi-image `userImageDataUrls`, virus `422` + audit, pipeline `400`, plus payload merge/cap and oversize parse rejection. Broader ask-route coverage remains in `tests/integration/xchat-ask-route.test.ts`.
- **History input:** `tests/unit/xchat-ask-history-input.test.ts` — `hasVisionImages` clears structured `conversationInput`.
