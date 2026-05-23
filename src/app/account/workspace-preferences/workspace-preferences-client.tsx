"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PortfolioScoringFactorsReadonlyTable } from "@/app/ui/portfolio-scoring-factors-readonly";
import { WorkspaceRailAppearance } from "@/app/ui/workspace-rail-appearance";
import { buildAdvisorComplianceBlockedMessage } from "@/modules/compliance/advisor-compliance-redirect";
import type { AdvisorComplianceMissingStep, AdvisorFinraRegistrationStatus, AdvisorLicenseType } from "@/modules/compliance/types";
import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";

type DisclosureBundle = {
  version: string;
  short: string;
  full: string;
  attestationText: string;
};

type AdvisorProfileWire = {
  complianceContactEmail: string | null;
  attestationAccepted: boolean;
  attestationAcceptedAt: string | null;
  aiDisclosureVersionAccepted: string | null;
  aiDisclosureAcceptedAt: string | null;
  complianceCompletedAt: string | null;
  updatedAt: string | null;
};

type FinraRegistrationWire = {
  id: string;
  crdNumber: string;
  licenseType: AdvisorLicenseType;
  jurisdiction: string;
  evidenceUrl: string | null;
  evidenceFilename: string | null;
  evidenceXaiFileId: string | null;
  evidenceRagFileId: string | null;
  evidenceCollectionId: string | null;
  evidenceDocuments: Array<{
    evidenceFilename: string;
    evidenceXaiFileId: string;
    evidenceRagFileId: string | null;
    evidenceCollectionId: string | null;
    linkedToCollection: boolean | null;
  }>;
  notes: string | null;
  status: AdvisorFinraRegistrationStatus;
};

type ComplianceStatusWire = {
  enforced: boolean;
  complete: boolean;
  missingSteps: AdvisorComplianceMissingStep[];
  disclosureVersion?: string;
  finraRegistrationCount: number;
  credentialSecEnabled?: boolean;
  tenantFirmName: string | null;
  chatHistoryRetentionRequired?: boolean;
  profile: AdvisorProfileWire | null;
};

type WorkspacePreferencesTab = "compliance" | "scoring" | "appearance" | "history";

type TenantScoringFactorsWire = {
  tenantName: string;
  slug: string;
  hasTenantOverride: boolean;
  scoringFactors: PortfolioScoringFactorApi[];
};

const LICENSE_OPTIONS: { value: AdvisorLicenseType; label: string }[] = [
  { value: "series_7", label: "Series 7" },
  { value: "series_65", label: "Series 65" },
  { value: "series_66", label: "Series 66" },
  { value: "other", label: "Other" }
];

const MISSING_STEP_GUIDANCE: Record<AdvisorComplianceMissingStep, string> = {
  attestation: "accept the AI disclosure and attestation, then click Save acknowledgments",
  ai_disclosure: "accept the AI disclosure and attestation, then click Save acknowledgments",
  finra_registration: "add at least one FINRA registration (CRD, license, and jurisdiction)"
};

function complianceBannerLines(missingSteps: AdvisorComplianceMissingStep[]): string[] {
  const lines: string[] = [];
  if (missingSteps.includes("attestation") || missingSteps.includes("ai_disclosure")) {
    lines.push(MISSING_STEP_GUIDANCE.attestation);
  }
  if (missingSteps.includes("finra_registration")) {
    lines.push(MISSING_STEP_GUIDANCE.finra_registration);
  }
  return lines;
}

function formatComplianceTimestamp(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
  "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND",
  "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

type WorkspacePreferencesClientProps = {
  isAdvisorRole: boolean;
  complianceRequired?: boolean;
  complianceFrom?: string | null;
};

export function WorkspacePreferencesClient({
  isAdvisorRole,
  complianceRequired = false,
  complianceFrom = null
}: WorkspacePreferencesClientProps) {
  const [status, setStatus] = useState<ComplianceStatusWire | null>(null);
  const [disclosures, setDisclosures] = useState<DisclosureBundle | null>(null);
  const [registrations, setRegistrations] = useState<FinraRegistrationWire[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAck, setSavingAck] = useState(false);
  const [savingFinra, setSavingFinra] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [complianceContactEmail, setComplianceContactEmail] = useState("");
  const [attestationAccepted, setAttestationAccepted] = useState(false);
  const [aiDisclosureAccepted, setAiDisclosureAccepted] = useState(false);

  const [crdNumber, setCrdNumber] = useState("");
  const [licenseType, setLicenseType] = useState<AdvisorLicenseType>("series_65");
  const [jurisdiction, setJurisdiction] = useState("TX");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspacePreferencesTab>(() =>
    isAdvisorRole ? "compliance" : "scoring"
  );
  const [scoringLoading, setScoringLoading] = useState(false);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [scoringPayload, setScoringPayload] = useState<TenantScoringFactorsWire | null>(null);
  const [historyExportBusy, setHistoryExportBusy] = useState<"xchat" | "compliance" | null>(null);

  const tabs = useMemo(() => {
    const ordered: { id: WorkspacePreferencesTab; label: string }[] = [];
    if (isAdvisorRole) {
      ordered.push({ id: "compliance", label: "Advisor compliance" });
    }
    ordered.push(
      { id: "scoring", label: "Scoring factors" },
      { id: "appearance", label: "Appearance" },
      { id: "history", label: "History" }
    );
    return ordered;
  }, [isAdvisorRole]);

  useEffect(() => {
    if (complianceRequired && isAdvisorRole) {
      setActiveTab("compliance");
    }
  }, [complianceRequired, isAdvisorRole]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "appearance");
    }
  }, [activeTab, tabs]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests: Promise<Response>[] = [fetch("/api/app-user/compliance/status")];
      const statusRes = await requests[0]!;
      if (!statusRes.ok) {
        throw new Error("Could not load workspace preferences.");
      }
      const statusBody = (await statusRes.json()) as { data: ComplianceStatusWire };
      setStatus(statusBody.data);

      const credentialSecEnabled = statusBody.data.credentialSecEnabled === true;
      if (isAdvisorRole) {
        requests.push(fetch("/api/app-user/compliance/disclosures"));
        if (credentialSecEnabled) {
          requests.push(fetch("/api/app-user/compliance/finra-registrations"));
        }
      }
      const followUpResponses = await Promise.all(requests.slice(1));
      if (isAdvisorRole && followUpResponses[0]) {
        if (!followUpResponses[0].ok) {
          throw new Error("Could not load advisor disclosures.");
        }
        const disclosureBody = (await followUpResponses[0].json()) as { data: DisclosureBundle };
        setDisclosures(disclosureBody.data);
      }
      if (isAdvisorRole && credentialSecEnabled && followUpResponses[1]) {
        if (!followUpResponses[1].ok) {
          throw new Error("Could not load FINRA registrations.");
        }
        const finraBody = (await followUpResponses[1].json()) as { data: FinraRegistrationWire[] };
        setRegistrations(finraBody.data);
      } else {
        setRegistrations([]);
      }

      const profile = statusBody.data.profile;
      if (profile) {
        setComplianceContactEmail(profile.complianceContactEmail ?? "");
        setAttestationAccepted(profile.attestationAccepted);
        setAiDisclosureAccepted(
          Boolean(
            profile.aiDisclosureVersionAccepted &&
              profile.aiDisclosureVersionAccepted === statusBody.data.disclosureVersion
          )
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [isAdvisorRole]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadScoringFactors = useCallback(async () => {
    setScoringLoading(true);
    setScoringError(null);
    try {
      const res = await fetch("/api/app-user/tenant/scoring-factors");
      const body = (await res.json().catch(() => ({}))) as {
        data?: TenantScoringFactorsWire;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Could not load scoring factors.");
      }
      if (!body.data?.scoringFactors) {
        throw new Error("Missing scoring factors payload.");
      }
      setScoringPayload(body.data);
    } catch (e) {
      setScoringError(e instanceof Error ? e.message : "Load failed.");
      setScoringPayload(null);
    } finally {
      setScoringLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "scoring" || scoringPayload || scoringLoading) {
      return;
    }
    void loadScoringFactors();
  }, [activeTab, loadScoringFactors, scoringLoading, scoringPayload]);

  const canSaveAck = useMemo(
    () => attestationAccepted && aiDisclosureAccepted,
    [aiDisclosureAccepted, attestationAccepted]
  );

  const ackPersisted = useMemo(() => {
    if (!status?.profile || !status.disclosureVersion) {
      return false;
    }
    return (
      status.profile.attestationAccepted &&
      status.profile.aiDisclosureVersionAccepted === status.disclosureVersion
    );
  }, [status?.disclosureVersion, status?.profile]);

  const complianceBanner = useMemo(
    () => (status?.missingSteps ? complianceBannerLines(status.missingSteps) : []),
    [status?.missingSteps]
  );

  const complianceTimestamps = useMemo(() => {
    const profile = status?.profile;
    if (!profile) {
      return null;
    }
    const completedIso =
      profile.complianceCompletedAt ??
      (status?.complete
        ? [profile.attestationAcceptedAt, profile.aiDisclosureAcceptedAt]
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null
        : null);
    return {
      attestation: formatComplianceTimestamp(profile.attestationAcceptedAt),
      aiDisclosure: formatComplianceTimestamp(profile.aiDisclosureAcceptedAt),
      completed: formatComplianceTimestamp(completedIso),
      profileUpdated: formatComplianceTimestamp(profile.updatedAt)
    };
  }, [status?.complete, status?.profile]);

  async function persistAcknowledgments(): Promise<void> {
    if (!canSaveAck) {
      throw new Error("Check both the AI disclosure and attestation boxes before saving.");
    }
    const res = await fetch("/api/app-user/compliance/advisor-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complianceContactEmail: complianceContactEmail.trim() || undefined,
        attestationAccepted: true,
        acceptAiDisclosure: true
      })
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Could not save acknowledgments.");
    }
  }

  async function saveAcknowledgments(event: React.FormEvent) {
    event.preventDefault();
    if (!canSaveAck) {
      return;
    }
    setSavingAck(true);
    setError(null);
    setSuccess(null);
    try {
      await persistAcknowledgments();
      setSuccess("Compliance acknowledgments saved.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingAck(false);
    }
  }

  async function addFinraRegistration(event: React.FormEvent) {
    event.preventDefault();
    if (!crdNumber.trim()) {
      return;
    }
    setSavingFinra(true);
    setError(null);
    setSuccess(null);
    try {
      if (canSaveAck && !ackPersisted) {
        await persistAcknowledgments();
      }

      const selectedFiles = evidenceFiles.length > 0 ? evidenceFiles : evidenceFile ? [evidenceFile] : [];
      let res: Response;
      if (selectedFiles.length > 0) {
        const fd = new FormData();
        fd.set("crdNumber", crdNumber.trim());
        fd.set("licenseType", licenseType);
        fd.set("jurisdiction", jurisdiction);
        if (evidenceUrl.trim()) {
          fd.set("evidenceUrl", evidenceUrl.trim());
        }
        if (notes.trim()) {
          fd.set("notes", notes.trim());
        }
        fd.set("status", "active");
        for (const file of selectedFiles) {
          fd.append("evidenceFiles", file);
        }
        res = await fetch("/api/app-user/compliance/finra-registrations", {
          method: "POST",
          body: fd
        });
      } else {
        res = await fetch("/api/app-user/compliance/finra-registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crdNumber: crdNumber.trim(),
            licenseType,
            jurisdiction,
            evidenceUrl: evidenceUrl.trim() || null,
            notes: notes.trim() || null,
            status: "active"
          })
        });
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string[] };
        const detail = body.details?.[0];
        throw new Error(detail ?? body.error ?? "Could not add FINRA registration.");
      }
      setCrdNumber("");
      setEvidenceUrl("");
      setEvidenceFile(null);
      setEvidenceFiles([]);
      setNotes("");
      setSuccess(
        selectedFiles.length > 1
          ? `FINRA registration added with ${selectedFiles.length} credential documents.`
          : canSaveAck && !ackPersisted
            ? "FINRA registration and compliance acknowledgments saved."
            : "FINRA registration added."
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "FINRA save failed.");
    } finally {
      setSavingFinra(false);
    }
  }

  async function toggleRegistrationStatus(row: FinraRegistrationWire) {
    const next: AdvisorFinraRegistrationStatus = row.status === "active" ? "inactive" : "active";
    setError(null);
    try {
      const res = await fetch(`/api/app-user/compliance/finra-registrations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) {
        throw new Error("Could not update registration.");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    }
  }

  async function deleteRegistration(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/app-user/compliance/finra-registrations/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        throw new Error("Could not delete registration.");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  function parseDownloadFilename(contentDisposition: string | null, fallback: string): string {
    if (!contentDisposition) {
      return fallback;
    }
    const match = /filename="([^"]+)"/i.exec(contentDisposition);
    return match?.[1]?.trim() || fallback;
  }

  async function downloadExport(url: string, fallbackFilename: string, kind: "xchat" | "compliance") {
    setHistoryExportBusy(kind);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const filename = parseDownloadFilename(res.headers.get("Content-Disposition"), fallbackFilename);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setSuccess(
        kind === "xchat" ? "xChat history download started." : "Compliance report download started."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setHistoryExportBusy(null);
    }
  }

  if (loading) {
    return <p className="compliance-page__muted">Loading workspace preferences…</p>;
  }

  const credentialSecEnabled = status?.credentialSecEnabled === true;

  return (
    <div className="compliance-page">
      {error ? (
        <p className="compliance-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="compliance-page__success" role="status">
          {success}
        </p>
      ) : null}
      {complianceRequired && isAdvisorRole ? (
        <div className="compliance-page__banner" role="alert">
          <p className="compliance-page__banner-lead">
            {complianceFrom === "xchat"
              ? "xChat is paused until advisor compliance is complete."
              : complianceFrom === "quant-trader"
                ? "Quant Trader is paused until advisor compliance is complete."
                : "Complete advisor compliance to unlock advice-like product paths."}
          </p>
          <p className="compliance-page__muted">
            {buildAdvisorComplianceBlockedMessage(status?.missingSteps ?? [])}
          </p>
        </div>
      ) : null}

      <div className="compliance-page__tabs">
        <div className="compliance-page__tablist" role="tablist" aria-label="Workspace preferences sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="compliance-page__tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`workspace-prefs-panel-${tab.id}`}
              id={`workspace-prefs-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "appearance" ? (
          <section
            className="compliance-page__panel compliance-page__tab-panel"
            role="tabpanel"
            id="workspace-prefs-panel-appearance"
            aria-labelledby="workspace-prefs-tab-appearance"
          >
            <h2 className="compliance-page__section-title">Appearance</h2>
            <p className="compliance-page__muted">Shell density for workspace surfaces (soft, deep, or system).</p>
            <WorkspaceRailAppearance variant="rail" />
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section
            className="compliance-page__panel compliance-page__tab-panel"
            role="tabpanel"
            id="workspace-prefs-panel-history"
            aria-labelledby="workspace-prefs-tab-history"
          >
            <h2 className="compliance-page__section-title">History &amp; exports</h2>
            <p className="compliance-page__muted">
              Download a JSON snapshot of your stored xChat turns
              {isAdvisorRole
                ? credentialSecEnabled
                  ? ", and your compliance attestation and FINRA registration record."
                  : ", and your compliance attestation record."
                : "."}
              {status?.chatHistoryRetentionRequired ? (
                <>
                  {" "}
                  Chat history retention is enabled on your account for audit export.
                </>
              ) : null}
            </p>
            <div className="compliance-page__export-actions">
              <button
                className="compliance-page__submit"
                disabled={historyExportBusy !== null}
                type="button"
                onClick={() =>
                  void downloadExport(
                    "/api/app-user/xchat/history/export",
                    "xchat-history.json",
                    "xchat"
                  )
                }
              >
                {historyExportBusy === "xchat" ? "Preparing…" : "Download xChat history"}
              </button>
              {isAdvisorRole ? (
                <button
                  className="compliance-page__submit"
                  disabled={historyExportBusy !== null}
                  type="button"
                  onClick={() =>
                    void downloadExport(
                      "/api/app-user/compliance/report/export",
                      "advisor-compliance-report.json",
                      "compliance"
                    )
                  }
                >
                  {historyExportBusy === "compliance" ? "Preparing…" : "Download compliance report"}
                </button>
              ) : null}
            </div>
            <p className="compliance-page__muted text-xs">
              Exports are capped at the most recent 500 xChat turns. Files are JSON for exam prep, firm review, or
              personal records — not legal advice.
            </p>
          </section>
        ) : null}

        {activeTab === "scoring" ? (
          <section
            className="compliance-page__panel compliance-page__tab-panel"
            role="tabpanel"
            id="workspace-prefs-panel-scoring"
            aria-labelledby="workspace-prefs-tab-scoring"
          >
            <h2 className="compliance-page__section-title">Scoring factors</h2>
            <p className="compliance-page__muted">
              Tenant default weights for xOptions / strategy ranking on{" "}
              <strong>{scoringPayload?.tenantName ?? status?.tenantFirmName ?? "this workspace"}</strong>. Per-portfolio
              overrides may differ; contact your tenant admin to change defaults.
            </p>
            {scoringLoading ? <p className="compliance-page__muted">Loading scoring factors…</p> : null}
            {scoringError ? (
              <p className="compliance-page__error" role="alert">
                {scoringError}
              </p>
            ) : null}
            {!scoringLoading && !scoringError && scoringPayload ? (
              <>
                <p className="compliance-page__muted text-xs">
                  Source:{" "}
                  {scoringPayload.hasTenantOverride ? (
                    <>
                      tenant override (<code className="font-mono">{scoringPayload.slug}</code>)
                    </>
                  ) : (
                    <>product defaults (no tenant override)</>
                  )}
                </p>
                <PortfolioScoringFactorsReadonlyTable
                  factors={scoringPayload.scoringFactors}
                  intro="These tenant-level weights apply to new books unless a portfolio sets its own scoringFactors row (read-only)."
                />
              </>
            ) : null}
          </section>
        ) : null}

        {activeTab === "compliance" && isAdvisorRole ? (
          <div
            className="compliance-page__tab-panel"
            role="tabpanel"
            id="workspace-prefs-panel-compliance"
            aria-labelledby="workspace-prefs-tab-compliance"
          >
            {status && status.enforced && !status.complete ? (
              <div className="compliance-page__banner" role="status">
                <p className="compliance-page__banner-lead">
                  Complete advisor compliance before xChat ask and Quant Trader.
                </p>
                {complianceBanner.length > 0 ? (
                  <ul className="compliance-page__banner-list">
                    {complianceBanner.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <section className="compliance-page__panel">
              <h2 className="compliance-page__section-title">IA firm</h2>
              <p className="compliance-page__muted">
                Each tenant is one Investment Advisor firm. Your workspace:{" "}
                <strong>{status?.tenantFirmName ?? "—"}</strong>. Operators on this tenant do not require this section
                — only platform role <strong>advisor</strong>.
              </p>
            </section>

            {complianceTimestamps &&
            (complianceTimestamps.attestation ||
              complianceTimestamps.aiDisclosure ||
              complianceTimestamps.completed) ? (
              <section className="compliance-page__panel" aria-labelledby="workspace-prefs-compliance-record">
                <h2 className="compliance-page__section-title" id="workspace-prefs-compliance-record">
                  Compliance record
                </h2>
                <p className="compliance-page__muted">
                  Timestamps are stored on your account and written to the platform audit log for compliance review.
                </p>
                <dl className="compliance-page__timestamps">
                  {complianceTimestamps.attestation ? (
                    <>
                      <dt>Attestation accepted</dt>
                      <dd>{complianceTimestamps.attestation}</dd>
                    </>
                  ) : null}
                  {complianceTimestamps.aiDisclosure ? (
                    <>
                      <dt>AI disclosure accepted</dt>
                      <dd>
                        {complianceTimestamps.aiDisclosure}
                        {status?.profile?.aiDisclosureVersionAccepted ? (
                          <span className="compliance-page__timestamp-meta">
                            {" "}
                            · version {status.profile.aiDisclosureVersionAccepted}
                          </span>
                        ) : null}
                      </dd>
                    </>
                  ) : null}
                  {complianceTimestamps.completed ? (
                    <>
                      <dt>Advisor compliance completed</dt>
                      <dd>{complianceTimestamps.completed}</dd>
                    </>
                  ) : null}
                </dl>
                {status?.complete ? (
                  <p className="compliance-page__hint text-sm text-[var(--xf-gain-green)]" role="status">
                    Compliance is complete. Audit events are recorded for acknowledgments
                    {credentialSecEnabled ? ", FINRA changes," : ""} and completion.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="compliance-page__panel">
              <h2 className="compliance-page__section-title">AI disclosure &amp; attestation</h2>
              <p className="compliance-page__muted">
                Checking the boxes alone does not complete compliance — click <strong>Save acknowledgments</strong> to
                record them.
                {credentialSecEnabled
                  ? " If both boxes are checked when you add a FINRA registration below, acknowledgments save automatically."
                  : null}
              </p>
              {disclosures ? (
                <form className="compliance-page__form" onSubmit={saveAcknowledgments}>
                  <label className="compliance-page__field">
                    <span>Compliance contact email (optional)</span>
                    <input
                      type="email"
                      value={complianceContactEmail}
                      onChange={(e) => setComplianceContactEmail(e.target.value)}
                    />
                  </label>
                  <div className="compliance-page__disclosure">
                    <h3 className="compliance-page__disclosure-title">
                      AI &amp; algorithmic disclosure ({disclosures.version})
                    </h3>
                    <p className="compliance-page__disclosure-body">{disclosures.full}</p>
                    <label className="compliance-page__check">
                      <input
                        checked={aiDisclosureAccepted}
                        type="checkbox"
                        onChange={(e) => setAiDisclosureAccepted(e.target.checked)}
                      />
                      I acknowledge the AI limitations above.
                    </label>
                    <label className="compliance-page__check">
                      <input
                        checked={attestationAccepted}
                        type="checkbox"
                        onChange={(e) => setAttestationAccepted(e.target.checked)}
                      />
                      {disclosures.attestationText}
                    </label>
                  </div>
                  {canSaveAck && !ackPersisted ? (
                    <p className="compliance-page__hint text-sm text-[var(--xf-lightning-yellow)]" role="status">
                      Both boxes are checked but not saved yet — click Save acknowledgments to clear the attestation
                      requirement.
                    </p>
                  ) : null}
                  <p className="compliance-page__hint text-sm text-[var(--xf-text-300)]">
                    Saving attestation enables xChat history retention (keep last 10 messages) so conversations can be
                    stored and exported for compliance. This cannot be turned off while attestation is on the record.
                  </p>
                  {status?.chatHistoryRetentionRequired ? (
                    <p className="compliance-page__hint text-sm text-[var(--xf-gain-green)]" role="status">
                      xChat history retention is enabled for your account.
                    </p>
                  ) : null}
                  <button className="compliance-page__submit" disabled={!canSaveAck || savingAck} type="submit">
                    {savingAck ? "Saving…" : "Save acknowledgments"}
                  </button>
                </form>
              ) : null}
            </section>

            {credentialSecEnabled ? (
            <section className="compliance-page__panel">
              <h2 className="compliance-page__section-title">FINRA registrations</h2>
              <p className="compliance-page__muted">
                Add at least one active registration (CRD, license type, jurisdiction). Provide credential evidence as a
                file upload (indexed to your xChat history collection) and/or an external URL.
              </p>
              {registrations.length > 0 ? (
                <ul className="compliance-page__client-list">
                  {registrations.map((row) => (
                    <li key={row.id} className="compliance-page__finra-row">
                      <span>
                        CRD {row.crdNumber} · {row.licenseType} · {row.jurisdiction} ·{" "}
                        <em>{row.status}</em>
                        {row.evidenceFilename ? (
                          <>
                            {" "}
                            · file <span className="font-mono text-xs">{row.evidenceFilename}</span>
                          </>
                        ) : null}
                        {(row.evidenceDocuments?.length ?? 0) > 1 ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-mono text-xs">
                              +{(row.evidenceDocuments?.length ?? 0) - 1} more document
                              {(row.evidenceDocuments?.length ?? 0) - 1 === 1 ? "" : "s"}
                            </span>
                          </>
                        ) : null}
                        {row.evidenceUrl ? (
                          <>
                            {" "}
                            ·{" "}
                            <a href={row.evidenceUrl} rel="noopener noreferrer" target="_blank">
                              evidence URL
                            </a>
                          </>
                        ) : null}
                      </span>
                      <span className="compliance-page__finra-actions">
                        <button type="button" onClick={() => void toggleRegistrationStatus(row)}>
                          {row.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" onClick={() => void deleteRegistration(row.id)}>
                          Delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="compliance-page__muted">No registrations yet.</p>
              )}
              <form className="compliance-page__form compliance-page__form--inline" onSubmit={addFinraRegistration}>
                <label className="compliance-page__field">
                  <span>CRD / IARD #</span>
                  <input required value={crdNumber} onChange={(e) => setCrdNumber(e.target.value)} />
                </label>
                <label className="compliance-page__field">
                  <span>License</span>
                  <select value={licenseType} onChange={(e) => setLicenseType(e.target.value as AdvisorLicenseType)}>
                    {LICENSE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="compliance-page__field">
                  <span>Jurisdiction</span>
                  <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                    {US_STATES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="compliance-page__field">
                  <span>Evidence URL (optional)</span>
                  <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" />
                </label>
                <label className="compliance-page__field">
                  <span>Credential files (optional, one or more)</span>
                  <input
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.doc,.docx,application/pdf,image/*,text/*"
                    multiple
                    type="file"
                    onChange={(e) => {
                      const next = e.target.files ? Array.from(e.target.files) : [];
                      setEvidenceFiles(next);
                      setEvidenceFile(next[0] ?? null);
                    }}
                  />
                </label>
                {evidenceFiles.length > 0 ? (
                  <p className="compliance-page__muted text-xs">
                    Uploading{" "}
                    {evidenceFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`} className="font-mono">
                        {file.name}
                        {" "}
                      </span>
                    ))}
                    adds each file to your xChat history collection for export/audit. Invalid evidence URLs are
                    ignored when files are attached.
                  </p>
                ) : null}
                <label className="compliance-page__field">
                  <span>Notes (optional)</span>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
                <button className="compliance-page__submit" disabled={savingFinra} type="submit">
                  {savingFinra ? "Adding…" : "Add registration"}
                </button>
              </form>
            </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
