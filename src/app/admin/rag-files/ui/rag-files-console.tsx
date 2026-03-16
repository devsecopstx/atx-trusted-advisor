"use client";

import { FormEvent, useCallback, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type RagFile = {
  _id?: string;
  filename: string;
  scope: string;
  xaiUploadStatus: "uploaded" | "failed" | "skipped";
  createdAt: string;
};

export function RagFilesConsole() {
  const [files, setFiles] = useState<RagFile[]>([]);
  const [status, setStatus] = useState("Ready - tap refresh");

  const refreshFiles = useCallback(async () => {
    setStatus("Loading RAG files...");
    try {
      const payload = await parseJson<{ data: RagFile[] }>(
        await fetch("/api/rag/files?scope=global")
      );
      setFiles(payload.data);
      setStatus("Synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to refresh files");
    }
  }, []);

  async function uploadRagFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("Uploading file...");
    try {
      await parseJson(
        await fetch("/api/rag/files", {
          method: "POST",
          body: formData
        })
      );
      event.currentTarget.reset();
      await refreshFiles();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to upload file");
    }
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" onClick={() => void refreshFiles()} type="button">
          Refresh files
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Upload File</h3>
        <form className="stack-form" onSubmit={uploadRagFile}>
          <input name="scope" defaultValue="global" placeholder="scope" />
          <input name="file" required type="file" />
          <button className="cta cta-primary" type="submit">
            Upload to RAG
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Latest Files</h3>
        <ul className="data-list">
          {files.map((file) => (
            <li key={file._id ?? file.filename}>
              <strong>{file.filename}</strong>
              <span>[{file.xaiUploadStatus}]</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
