"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { WorkspaceRailAppearance } from "@/app/ui/workspace-rail-appearance";
import type { AdvisorFinraRegistrationStatus, AdvisorLicenseType } from "@/modules/compliance/types";

type DisclosureBundle = {
  version: string;
  short: string;
  full: string;
  attestationText: string;
};

type AdvisorProfileWire = {
  complianceContactEmail: string | null;
  attestationAccepted: boolean;
  aiDisclosureVersionAccepted: string | null;
};

type FinraRegistrationWire = {
  id: string;
  crdNumber: string;
  licenseType: AdvisorLicenseType;
  jurisdiction: string;
  evidenceUrl: string | null;
  notes: string | null;
  status: AdvisorFinraRegistrationStatus;
};

type ComplianceStatusWire = {
  enforced: boolean;
  complete: boolean;
  missingSteps: string[];
  finraRegistrationCount: number;
  tenantFirmName: string | null;
  chatHistoryRetentionRequired?: boolean;
  profile: AdvisorProfileWire | null;
};

const LICENSE_OPTIONS: { value: AdvisorLicenseType; label: string }[] = [
  { value: "series_7", label: "Series 7" },
  { value: "series_65", label: "Series 65" },
  { value: "series_66", label: "Series 66" },
  { value: "other", label: "Other" }
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
  "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND",
  "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

type WorkspacePreferencesClientProps = {
  isAdvisorRole: boolean;
};

export function WorkspacePreferencesClient({ isAdvisorRole }: WorkspacePreferencesClientProps) {
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
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests: Promise<Response>[] = [fetch("/api/app-user/compliance/status")];
      if (isAdvisorRole) {
        requests.push(fetch("/api/app-user/compliance/disclosures"));
        requests.push(fetch("/api/app-user/compliance/finra-registrations"));
      }
      const responses = await Promise.all(requests);
      const statusRes = responses[0]!;
      if (!statusRes.ok) {
        throw new Error("Could not load workspace preferences.");
      }
      const statusBody = (await statusRes.json()) as { data: ComplianceStatusWire };
      setStatus(statusBody.data);

      const profile = statusBody.data.profile;
      if (profile) {
        setComplianceContactEmail(profile.complianceContactEmail ?? "");
        setAttestationAccepted(profile.attestationAccepted);
        setAiDisclosureAccepted(
          Boolean(profile.aiDisclosureVersionAccepted && profile.attestationAccepted)
        );
      }

      if (isAdvisorRole && responses[1]?.ok && responses[2]?.ok) {
        const disclosureBody = (await responses[1]!.json()) as { data: DisclosureBundle };
        const finraBody = (await responses[2]!.json()) as { data: FinraRegistrationWire[] };
        setDisclosures(disclosureBody.data);
        setRegistrations(finraBody.data);
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

  const canSaveAck = useMemo(
    () => attestationAccepted && aiDisclosureAccepted,
    [aiDisclosureAccepted, attestationAccepted]
  );

  async function saveAcknowledgments(event: React.FormEvent) {
    event.preventDefault();
    if (!canSaveAck) {
      return;
    }
    setSavingAck(true);
    setError(null);
    setSuccess(null);
    try {
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
        throw new Error("Could not save acknowledgments.");
      }
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
      const res = await fetch("/api/app-user/compliance/finra-registrations", {
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
      if (!res.ok) {
        throw new Error("Could not add FINRA registration.");
      }
      setCrdNumber("");
      setEvidenceUrl("");
      setNotes("");
      setSuccess("FINRA registration added.");
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

  if (loading) {
    return <p className="compliance-page__muted">Loading workspace preferences…</p>;
  }

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

      <section className="compliance-page__panel">
        <h2 className="compliance-page__section-title">Appearance</h2>
        <p className="compliance-page__muted">Shell density for workspace surfaces (soft, deep, or system).</p>
        <WorkspaceRailAppearance variant="rail" />
      </section>

      {isAdvisorRole ? (
        <>
          {status && status.enforced && !status.complete ? (
            <div className="compliance-page__banner" role="status">
              Complete advisor compliance before xChat ask and Quant Trader. Missing:{" "}
              {status.missingSteps.join(", ")}.
            </div>
          ) : null}

          <section className="compliance-page__panel">
            <h2 className="compliance-page__section-title">IA firm</h2>
            <p className="compliance-page__muted">
              Each tenant is one Investment Advisor firm. Your workspace:{" "}
              <strong>{status?.tenantFirmName ?? "—"}</strong>. Operators on this tenant do not require this
              section — only platform role <strong>advisor</strong>.
            </p>
          </section>

          <section className="compliance-page__panel">
            <h2 className="compliance-page__section-title">FINRA registrations</h2>
            <p className="compliance-page__muted">
              Add at least one active registration (CRD, license type, jurisdiction). Evidence URL is optional
              (firm document store link).
            </p>
            {registrations.length > 0 ? (
              <ul className="compliance-page__client-list">
                {registrations.map((row) => (
                  <li key={row.id} className="compliance-page__finra-row">
                    <span>
                      CRD {row.crdNumber} · {row.licenseType} · {row.jurisdiction} ·{" "}
                      <em>{row.status}</em>
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
                <span>Notes (optional)</span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <button className="compliance-page__submit" disabled={savingFinra} type="submit">
                {savingFinra ? "Adding…" : "Add registration"}
              </button>
            </form>
          </section>

          <section className="compliance-page__panel">
            <h2 className="compliance-page__section-title">AI disclosure &amp; attestation</h2>
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
        </>
      ) : null}
    </div>
  );
}
