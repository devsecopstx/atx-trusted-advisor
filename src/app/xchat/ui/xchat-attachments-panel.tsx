"use client";

import { useCallback, useEffect, useState } from "react";

function formatXaiProcessingLabel(status: string | undefined): string {
  if (!status) {
    return "";
  }
  if (status === "unknown") {
    return "indexing (status from xAI unclear — file may still be usable)";
  }
  return status;
}

type AttachmentsPayload = {
  files: Array<{
    _id?: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    xaiUploadStatus: string;
    xaiProcessingStatus?: string;
    xaiUploadError?: string;
    createdAt?: string;
  }>;
  collectionId: string | null;
  collectionName: string | null;
  collectionConfigured: boolean;
};

export function XchatAttachmentsPanel() {
  const [data, setData] = useState<AttachmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app-user/xchat/attachments");
      const body = (await res.json().catch(() => ({}))) as {
        data?: AttachmentsPayload;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setData(body.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attachments");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setUploadBusy(true);
    setUploadNote(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/app-user/xchat/attachments", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { linkedToCollection?: boolean; linkError?: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      if (body.data?.linkError) {
        setUploadNote(`Uploaded; xAI folder link pending: ${body.data.linkError}`);
      } else if (body.data?.linkedToCollection) {
        setUploadNote("Uploaded and linked to your tenant xAI folder.");
      } else {
        setUploadNote("Uploaded. Link to xAI folder runs when the file is ready.");
      }
      await load();
    } catch (e) {
      setUploadNote(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  if (loading) {
    return <p className="status-text">Loading attachments…</p>;
  }
  if (error) {
    return <p className="status-text status-error">{error}</p>;
  }

  return (
    <div className="xchat-attachments-panel space-y-3">
      <p className="status-text text-[0.78rem] leading-snug text-[var(--xf-text-300)]">
        Premium+ workspace: files upload to xAI and are added to your tenant&apos;s team collection when ready
        {data?.collectionName ? (
          <>
            {" "}
            (<span className="text-[var(--xf-text-200)]">{data.collectionName}</span>).
          </>
        ) : data?.collectionConfigured === false ? (
          <> Configure <code className="text-[var(--xf-text-200)]">XAI_TEAM_ID</code> on the server to provision the folder.</>
        ) : null}
      </p>
      {!data?.collectionConfigured ? (
        <p className="status-text text-[var(--xf-text-400)]">
          Tenant xAI folder not provisioned yet — uploads still store in xFinance; linking runs once the collection exists.
        </p>
      ) : null}
      <label className="inline-flex cursor-pointer flex-col gap-1">
        <span className="text-[0.72rem] font-medium uppercase tracking-wide text-[var(--xf-text-400)]">
          Add file
        </span>
        <input
          accept="*/*"
          className="max-w-full text-[0.78rem] text-[var(--xf-text-200)] file:mr-2 file:rounded-md file:border file:border-[var(--xf-xchat-rail-border)] file:bg-[var(--xf-surface-800)] file:px-2 file:py-1 file:text-[var(--xf-text-100)]"
          disabled={uploadBusy}
          type="file"
          onChange={(e) => void onUpload(e.target.files)}
        />
      </label>
      {uploadBusy ? <p className="status-text">Uploading…</p> : null}
      {uploadNote ? <p className="status-text">{uploadNote}</p> : null}
      {data?.files?.length ? (
        <ul className="xchat-attachments-panel__list max-h-52 space-y-1 overflow-y-auto text-[0.76rem]" role="list">
          {data.files.map((f) => {
            const id = typeof f._id === "string" ? f._id : "";
            return (
              <li
                key={id || f.filename + (f.createdAt ?? "")}
                className="rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] px-2 py-1.5 text-[var(--xf-text-200)]"
                role="listitem"
              >
                <div className="font-medium text-[var(--xf-text-100)]">{f.filename}</div>
                <div className="text-[var(--xf-text-400)]">
                  {(f.sizeBytes / 1024).toFixed(1)} KB · {f.xaiUploadStatus}
                  {f.xaiProcessingStatus
                    ? ` · ${formatXaiProcessingLabel(f.xaiProcessingStatus)}`
                    : ""}
                </div>
                {f.xaiUploadError ? <div className="status-text status-error">{f.xaiUploadError}</div> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="status-text">No files yet.</p>
      )}
    </div>
  );
}
