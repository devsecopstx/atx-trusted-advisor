import { afterEach, describe, expect, it, vi } from "vitest";

import {
    getPdfIngestCapabilities,
    pdfIngestAllowsPythonUpload,
    pdfIngestAllowsRepoWrites
} from "@/modules/rag/pdf-ingest-runtime";

describe("pdf-ingest-runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disables repo writes and python upload in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(pdfIngestAllowsRepoWrites()).toBe(false);
    expect(pdfIngestAllowsPythonUpload()).toBe(false);
    expect(getPdfIngestCapabilities()).toEqual({ repoWrites: false, pdfUpload: false });
  });

  it("allows repo writes in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(pdfIngestAllowsRepoWrites()).toBe(true);
    expect(pdfIngestAllowsPythonUpload()).toBe(true);
  });

  it("honors explicit allow-repo-writes in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATX_PDF_INGEST_ALLOW_REPO_WRITES", "true");
    expect(pdfIngestAllowsRepoWrites()).toBe(true);
    expect(pdfIngestAllowsPythonUpload()).toBe(true);
  });
});
