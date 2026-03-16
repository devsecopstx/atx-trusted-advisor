"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type Persona = {
  _id?: string;
  name: string;
  systemPrompt: string;
  overridePrompt: string;
  xaiCollection: {
    collectionId: string;
    collectionName?: string;
  };
  model: string;
  temperature: number;
  enableRag: boolean;
  defaultScope: string;
  xaiCollectionVerification?: {
    status: "verified" | "missing" | "error" | "skipped";
    checkedAt: string;
    message?: string;
    resolvedCollectionName?: string;
  } | null;
  latestAuditEvent?: {
    action: string;
    createdAt: string;
    actor: {
      userId: string;
      email?: string;
      username?: string;
    };
  } | null;
};

type RagFileOption = {
  _id?: string;
  filename: string;
  scope: string;
  xaiUploadStatus: "uploaded" | "failed" | "skipped";
  xaiFileId?: string;
  createdAt?: string;
};

const EMPTY_CREATE_FORM: PersonaFormState = {
  name: "",
  systemPrompt: "",
  overridePrompt: "",
  xaiCollectionId: "",
  xaiCollectionName: "",
  model: "grok-4-latest",
  temperature: "0.2",
  enableRag: true,
  defaultScope: "global"
};

type PersonaFormState = {
  name: string;
  systemPrompt: string;
  overridePrompt: string;
  xaiCollectionId: string;
  xaiCollectionName: string;
  model: string;
  temperature: string;
  enableRag: boolean;
  defaultScope: string;
};

type VerificationFilter = "all" | "missing" | "stale";

const VERIFICATION_STALE_MS = 15 * 60_000;

export function PersonasConsole({
  initialPersonas
}: {
  initialPersonas: Persona[];
}) {
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas);
  const [createForm, setCreateForm] = useState<PersonaFormState>(EMPTY_CREATE_FORM);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PersonaFormState>(EMPTY_CREATE_FORM);
  const [status, setStatus] = useState("Ready");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [pickerPersonaId, setPickerPersonaId] = useState<string | null>(null);
  const [pickerFiles, setPickerFiles] = useState<RagFileOption[]>([]);
  const [selectedPickerFileIds, setSelectedPickerFileIds] = useState<string[]>([]);

  const refreshPersonas = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: Persona[] }>(await fetch("/api/personas"));
      setPersonas(payload.data);
      setStatus("Synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load personas");
    }
  }, []);

  const editingPersona = useMemo(
    () => personas.find((persona) => persona._id && persona._id === editingPersonaId) ?? null,
    [editingPersonaId, personas]
  );
  const missingCount = useMemo(
    () => personas.filter((persona) => isMissingVerification(persona)).length,
    [personas]
  );
  const staleCount = useMemo(
    () => personas.filter((persona) => isStaleVerification(persona)).length,
    [personas]
  );
  const filteredPersonas = useMemo(
    () =>
      personas.filter((persona) => {
        if (verificationFilter === "missing") {
          return isMissingVerification(persona);
        }
        if (verificationFilter === "stale") {
          return isStaleVerification(persona);
        }
        return true;
      }),
    [personas, verificationFilter]
  );

  function updateCreateForm<K extends keyof PersonaFormState>(key: K, value: PersonaFormState[K]) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function updateEditForm<K extends keyof PersonaFormState>(key: K, value: PersonaFormState[K]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  async function createPersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Creating persona...");
    try {
      const temperature = parseTemperatureInput(createForm.temperature);
      await parseJson(
        await fetch("/api/personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPersonaPayload(createForm, temperature))
        })
      );
      setCreateForm(EMPTY_CREATE_FORM);
      await refreshPersonas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create persona");
    }
  }

  function startEditing(persona: Persona) {
    if (!persona._id) {
      setStatus("Persona missing id and cannot be edited");
      return;
    }
    setEditingPersonaId(persona._id);
    setEditForm({
      name: persona.name,
      systemPrompt: persona.systemPrompt,
      overridePrompt: persona.overridePrompt,
      xaiCollectionId: persona.xaiCollection.collectionId,
      xaiCollectionName: persona.xaiCollection.collectionName ?? "",
      model: persona.model,
      temperature: String(persona.temperature),
      enableRag: persona.enableRag,
      defaultScope: persona.defaultScope
    });
  }

  async function updatePersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPersonaId) {
      return;
    }
    setStatus("Updating persona...");
    try {
      const temperature = parseTemperatureInput(editForm.temperature);
      await parseJson(
        await fetch(`/api/personas/${editingPersonaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPersonaPayload(editForm, temperature))
        })
      );
      setEditingPersonaId(null);
      setEditForm(EMPTY_CREATE_FORM);
      await refreshPersonas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update persona");
    }
  }

  async function removePersona(personaId: string) {
    setStatus("Deleting persona...");
    try {
      await parseJson(
        await fetch(`/api/personas/${personaId}`, {
          method: "DELETE"
        })
      );
      if (editingPersonaId === personaId) {
        setEditingPersonaId(null);
        setEditForm(EMPTY_CREATE_FORM);
      }
      await refreshPersonas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete persona");
    }
  }

  async function recheckPersonaCollection(persona: Persona) {
    if (!persona._id) {
      setStatus("Persona missing id and cannot be rechecked");
      return;
    }
    setStatus(`Rechecking ${persona.name} collection...`);
    try {
      await parseJson(
        await fetch(`/api/personas/${persona._id}/verify-collection`, {
          method: "POST"
        })
      );
      setStatus(`Recheck queued for ${persona.name}`);
      await refreshPersonas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to recheck collection");
    }
  }

  async function createPersonaCollection(persona: Persona) {
    if (!persona._id) {
      setStatus("Persona missing id and cannot create collection");
      return;
    }
    setStatus(`Creating collection for ${persona.name}...`);
    try {
      await parseJson(
        await fetch(`/api/personas/${persona._id}/collection/create`, {
          method: "POST"
        })
      );
      setStatus(`Collection created for ${persona.name}`);
      await refreshPersonas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create collection");
    }
  }

  async function linkPersonaScopeFiles(persona: Persona) {
    if (!persona._id) {
      setStatus("Persona missing id and cannot link files");
      return;
    }
    setStatus(`Linking uploaded files for ${persona.name}...`);
    try {
      const payload = await parseJson<{
        data: { linkedCount: number; candidateFiles: number; failed: Array<{ fileId: string }> };
      }>(
        await fetch(`/api/personas/${persona._id}/collection/link-files`, {
          method: "POST"
        })
      );
      setStatus(
        `Linked ${payload.data.linkedCount}/${payload.data.candidateFiles} files for ${persona.name}`
      );
      await refreshPersonas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to link files");
    }
  }

  async function openFilePicker(persona: Persona) {
    if (!persona._id) {
      setStatus("Persona missing id and cannot select files");
      return;
    }
    setStatus(`Loading files for ${persona.name}...`);
    try {
      const payload = await parseJson<{ data: RagFileOption[] }>(
        await fetch(`/api/rag/files?scope=${encodeURIComponent(persona.defaultScope)}`)
      );
      const selectableFiles = payload.data.filter(
        (file) => file.xaiUploadStatus === "uploaded" && Boolean(file.xaiFileId)
      );
      setPickerPersonaId(persona._id);
      setPickerFiles(selectableFiles);
      setSelectedPickerFileIds(
        selectableFiles.flatMap((file) => (file._id ? [file._id] : []))
      );
      setStatus(`Loaded ${selectableFiles.length} selectable files for ${persona.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load selectable files");
    }
  }

  function togglePickerFile(fileId: string, checked: boolean) {
    setSelectedPickerFileIds((current) => {
      if (checked) {
        return current.includes(fileId) ? current : [...current, fileId];
      }
      return current.filter((value) => value !== fileId);
    });
  }

  async function syncSelectedFilesForPersona(persona: Persona) {
    if (!persona._id) {
      setStatus("Persona missing id and cannot sync selected files");
      return;
    }
    setStatus(`Syncing ${selectedPickerFileIds.length} selected files for ${persona.name}...`);
    try {
      const payload = await parseJson<{
        data: { linkedCount: number; candidateFiles: number; failed: Array<{ fileId: string }> };
      }>(
        await fetch(`/api/personas/${persona._id}/collection/link-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: selectedPickerFileIds })
        })
      );
      setStatus(
        `Linked ${payload.data.linkedCount}/${payload.data.candidateFiles} selected files for ${persona.name}`
      );
      await refreshPersonas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to sync selected files");
    }
  }

  function parseTemperatureInput(value: string): number {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw new Error("Temperature must be a valid number between 0 and 1");
    }
    if (parsed < 0 || parsed > 1) {
      throw new Error("Temperature must be between 0 and 1");
    }
    return parsed;
  }

  function buildPersonaPayload(form: PersonaFormState, temperature: number) {
    return {
      name: form.name,
      systemPrompt: form.systemPrompt,
      overridePrompt: form.overridePrompt,
      xaiCollection: {
        collectionId: form.xaiCollectionId,
        collectionName: form.xaiCollectionName
      },
      model: form.model,
      temperature,
      enableRag: form.enableRag,
      defaultScope: form.defaultScope
    };
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <Link className="cta cta-secondary" href="/admin">
          Back to admin functions
        </Link>
        <button className="cta cta-secondary" onClick={() => void refreshPersonas()} type="button">
          Refresh personas
        </button>
        <p className="status-text">{status}</p>
      </div>

      <div className="surface-grid two-col">
        <article className="surface-card xf-widget section-card">
          <h3>Create xPersona</h3>
          <form className="stack-form" onSubmit={createPersona}>
            <input
              maxLength={80}
              name="name"
              onChange={(event) => updateCreateForm("name", event.target.value)}
              placeholder="persona name"
              required
              value={createForm.name}
            />
            <textarea
              maxLength={16000}
              name="systemPrompt"
              onChange={(event) => updateCreateForm("systemPrompt", event.target.value)}
              placeholder="xchat persona system prompt"
              rows={4}
              required
              value={createForm.systemPrompt}
            />
            <textarea
              maxLength={16000}
              name="overridePrompt"
              onChange={(event) => updateCreateForm("overridePrompt", event.target.value)}
              placeholder="override prompt template"
              rows={3}
              required
              value={createForm.overridePrompt}
            />
            <input
              maxLength={120}
              name="xaiCollectionId"
              onChange={(event) => updateCreateForm("xaiCollectionId", event.target.value)}
              pattern="collection_[A-Za-z0-9-]+"
              placeholder="collection_..."
              required
              value={createForm.xaiCollectionId}
            />
            <input
              maxLength={120}
              name="xaiCollectionName"
              onChange={(event) => updateCreateForm("xaiCollectionName", event.target.value)}
              placeholder="optional collection display name"
              value={createForm.xaiCollectionName}
            />
            <input
              maxLength={120}
              name="model"
              onChange={(event) => updateCreateForm("model", event.target.value)}
              placeholder="model id"
              required
              value={createForm.model}
            />
            <input
              max={1}
              min={0}
              name="temperature"
              onChange={(event) => updateCreateForm("temperature", event.target.value)}
              placeholder="0.2"
              required
              step="0.1"
              type="number"
              value={createForm.temperature}
            />
            <input
              maxLength={80}
              name="defaultScope"
              onChange={(event) => updateCreateForm("defaultScope", event.target.value)}
              placeholder="global"
              required
              value={createForm.defaultScope}
            />
            <label>
              <input
                checked={createForm.enableRag}
                name="enableRag"
                onChange={(event) => updateCreateForm("enableRag", event.target.checked)}
                type="checkbox"
              />{" "}
              Enable RAG
            </label>
            <button className="cta cta-primary" type="submit">
              Save persona
            </button>
          </form>
        </article>

        <article className="surface-card xf-widget section-card">
          <h3>Existing Personas (read-only list)</h3>
          <div className="tool-row">
            <button
              className="tiny-button"
              onClick={() => setVerificationFilter("all")}
              type="button"
            >
              All ({personas.length})
            </button>
            <button
              className="tiny-button"
              onClick={() => setVerificationFilter("missing")}
              type="button"
            >
              Missing ({missingCount})
            </button>
            <button
              className="tiny-button"
              onClick={() => setVerificationFilter("stale")}
              type="button"
            >
              Stale ({staleCount})
            </button>
          </div>
          <ul className="data-list">
            {filteredPersonas.map((persona) => (
              <li key={persona._id ?? persona.name}>
                <div>
                  <strong>{persona.name}</strong> ({persona.model}) [{persona.defaultScope}]{" "}
                  {persona.enableRag ? "RAG:on" : "RAG:off"} t={persona.temperature}
                  <br />
                  <small>System: {persona.systemPrompt}</small>
                  {persona.overridePrompt ? (
                    <>
                      <br />
                      <small>Override: {persona.overridePrompt}</small>
                    </>
                  ) : null}
                  <br />
                  <small>
                    Collection: {persona.xaiCollection.collectionId}
                    {persona.xaiCollection.collectionName
                      ? ` (${persona.xaiCollection.collectionName})`
                      : ""}
                  </small>
                  {persona.xaiCollectionVerification ? (
                    <>
                      <br />
                      <span
                        aria-label={`collection-verification-${getVerificationBadgeLabel(persona)}`}
                        className="tiny-button"
                        style={{ marginBottom: "0.25rem", display: "inline-block" }}
                      >
                        {getVerificationBadgeLabel(persona)}
                      </span>
                      <br />
                      <small>
                        Collection verification: {persona.xaiCollectionVerification.status}
                        {" at "}
                        {new Date(persona.xaiCollectionVerification.checkedAt).toLocaleString()}
                        {persona.xaiCollectionVerification.resolvedCollectionName
                          ? ` (${persona.xaiCollectionVerification.resolvedCollectionName})`
                          : ""}
                        {persona.xaiCollectionVerification.message
                          ? ` - ${persona.xaiCollectionVerification.message}`
                          : ""}
                      </small>
                    </>
                  ) : null}
                  {!persona.xaiCollectionVerification ? (
                    <>
                      <br />
                      <span
                        aria-label="collection-verification-not-checked"
                        className="tiny-button"
                        style={{ marginBottom: "0.25rem", display: "inline-block" }}
                      >
                        Not checked
                      </span>
                    </>
                  ) : null}
                  {persona.latestAuditEvent ? (
                    <>
                      <br />
                      <small>
                        Audit: {persona.latestAuditEvent.action} by{" "}
                        {persona.latestAuditEvent.actor.email ??
                          persona.latestAuditEvent.actor.username ??
                          persona.latestAuditEvent.actor.userId} at{" "}
                        {new Date(persona.latestAuditEvent.createdAt).toLocaleString()}
                      </small>
                    </>
                  ) : null}
                </div>
                <div className="tool-row">
                  <button
                    className="tiny-button"
                    onClick={() => void createPersonaCollection(persona)}
                    type="button"
                    disabled={!persona._id}
                  >
                    Create xCollection
                  </button>
                  <button
                    className="tiny-button"
                    onClick={() => void linkPersonaScopeFiles(persona)}
                    type="button"
                    disabled={!persona._id}
                  >
                    Sync all scope files
                  </button>
                  <button
                    className="tiny-button"
                    onClick={() => void openFilePicker(persona)}
                    type="button"
                    disabled={!persona._id}
                  >
                    Select files
                  </button>
                  <button
                    className="tiny-button"
                    onClick={() => void recheckPersonaCollection(persona)}
                    type="button"
                    disabled={!persona._id}
                  >
                    Recheck now
                  </button>
                  <button
                    className="tiny-button"
                    onClick={() => startEditing(persona)}
                    type="button"
                    disabled={!persona._id}
                  >
                    Edit
                  </button>
                  <button
                    className="tiny-button"
                    onClick={() => (persona._id ? void removePersona(persona._id) : undefined)}
                    type="button"
                    disabled={!persona._id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {filteredPersonas.length === 0 ? (
            <p className="status-text">
              No personas match this filter ({verificationFilter}).
            </p>
          ) : null}
        </article>
      </div>

      {pickerPersonaId
        ? (() => {
            const pickerPersona = personas.find((persona) => persona._id === pickerPersonaId) ?? null;
            if (!pickerPersona) {
              return null;
            }
            return (
              <article className="surface-card xf-widget section-card">
                <h3>Select files for {pickerPersona.name}</h3>
                <p className="status-text">
                  Scope: {pickerPersona.defaultScope} - choose exact uploaded files to link.
                </p>
                <div className="tool-row">
                  <button
                    className="tiny-button"
                    onClick={() =>
                      setSelectedPickerFileIds(
                        pickerFiles.flatMap((file) => (file._id ? [file._id] : []))
                      )
                    }
                    type="button"
                  >
                    Select all
                  </button>
                  <button
                    className="tiny-button"
                    onClick={() => setSelectedPickerFileIds([])}
                    type="button"
                  >
                    Clear
                  </button>
                  <button
                    className="cta cta-primary"
                    onClick={() => void syncSelectedFilesForPersona(pickerPersona)}
                    type="button"
                    disabled={selectedPickerFileIds.length === 0}
                  >
                    Sync selected ({selectedPickerFileIds.length})
                  </button>
                  <button
                    className="cta cta-secondary"
                    onClick={() => {
                      setPickerPersonaId(null);
                      setPickerFiles([]);
                      setSelectedPickerFileIds([]);
                    }}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <ul className="data-list">
                  {pickerFiles.map((file) => {
                    const fileId = file._id;
                    if (!fileId) {
                      return null;
                    }
                    return (
                      <li key={fileId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedPickerFileIds.includes(fileId)}
                            onChange={(event) => togglePickerFile(fileId, event.target.checked)}
                          />{" "}
                          {file.filename}
                          {file.createdAt ? ` (${new Date(file.createdAt).toLocaleString()})` : ""}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {pickerFiles.length === 0 ? (
                  <p className="status-text">No uploaded xAI-ready files found for this scope.</p>
                ) : null}
              </article>
            );
          })()
        : null}

      {editingPersona ? (
        <article className="surface-card xf-widget section-card">
          <h3>Edit xPersona: {editingPersona.name}</h3>
          <form className="stack-form" onSubmit={updatePersona}>
            <input
              maxLength={80}
              name="name"
              onChange={(event) => updateEditForm("name", event.target.value)}
              placeholder="persona name"
              required
              value={editForm.name}
            />
            <textarea
              maxLength={16000}
              name="systemPrompt"
              onChange={(event) => updateEditForm("systemPrompt", event.target.value)}
              placeholder="xchat persona system prompt"
              rows={4}
              required
              value={editForm.systemPrompt}
            />
            <textarea
              maxLength={16000}
              name="overridePrompt"
              onChange={(event) => updateEditForm("overridePrompt", event.target.value)}
              placeholder="override prompt template"
              rows={3}
              required
              value={editForm.overridePrompt}
            />
            <input
              maxLength={120}
              name="xaiCollectionId"
              onChange={(event) => updateEditForm("xaiCollectionId", event.target.value)}
              pattern="collection_[A-Za-z0-9-]+"
              placeholder="collection_..."
              required
              value={editForm.xaiCollectionId}
            />
            <input
              maxLength={120}
              name="xaiCollectionName"
              onChange={(event) => updateEditForm("xaiCollectionName", event.target.value)}
              placeholder="optional collection display name"
              value={editForm.xaiCollectionName}
            />
            <input
              maxLength={120}
              name="model"
              onChange={(event) => updateEditForm("model", event.target.value)}
              placeholder="model id"
              required
              value={editForm.model}
            />
            <input
              max={1}
              min={0}
              name="temperature"
              onChange={(event) => updateEditForm("temperature", event.target.value)}
              placeholder="0.2"
              required
              step="0.1"
              type="number"
              value={editForm.temperature}
            />
            <input
              maxLength={80}
              name="defaultScope"
              onChange={(event) => updateEditForm("defaultScope", event.target.value)}
              placeholder="global"
              required
              value={editForm.defaultScope}
            />
            <label>
              <input
                checked={editForm.enableRag}
                name="enableRag"
                onChange={(event) => updateEditForm("enableRag", event.target.checked)}
                type="checkbox"
              />{" "}
              Enable RAG
            </label>
            <div className="tool-row">
              <button className="cta cta-primary" type="submit">
                Update persona
              </button>
              <button
                className="cta cta-secondary"
                onClick={() => setEditingPersonaId(null)}
                type="button"
              >
                Cancel edit
              </button>
            </div>
          </form>
        </article>
      ) : null}
    </section>
  );
}

function isMissingVerification(persona: Persona): boolean {
  const verification = persona.xaiCollectionVerification;
  if (!verification) {
    return true;
  }
  return verification.status === "missing" || verification.status === "error";
}

function isStaleVerification(persona: Persona): boolean {
  const verification = persona.xaiCollectionVerification;
  if (!verification) {
    return false;
  }
  const checkedAtMs = Date.parse(verification.checkedAt);
  if (!Number.isFinite(checkedAtMs)) {
    return true;
  }
  return Date.now() - checkedAtMs > VERIFICATION_STALE_MS;
}

function getVerificationBadgeLabel(persona: Persona): string {
  if (!persona.xaiCollectionVerification) {
    return "not-checked";
  }
  if (isMissingVerification(persona)) {
    return "missing";
  }
  if (isStaleVerification(persona)) {
    return "stale";
  }
  return persona.xaiCollectionVerification.status;
}
