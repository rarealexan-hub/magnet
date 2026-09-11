import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Loader2, RefreshCw } from "lucide-react";
import type {
  HumanAudit,
  HumanAuditListItem,
  HumanAuditStatus,
  ProfileInput,
  ProfileResult,
} from "@shared/types";
import { FullReport } from "./FullReport";

interface Props {
  token?: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<HumanAuditStatus, string> = {
  intake_started: "Intake started",
  intake_complete: "Intake complete",
  awaiting_admin_review: "Awaiting review",
  followup_sent: "Follow-up needed",
  followup_complete: "Follow-up complete",
  final_report_ready: "Final report ready",
};

const EDITABLE_STATUSES: HumanAuditStatus[] = [
  "intake_started",
  "intake_complete",
  "awaiting_admin_review",
  "followup_sent",
  "followup_complete",
];

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function HumanAuditAdmin({ token, onBack }: Props) {
  const [audits, setAudits] = useState<HumanAuditListItem[]>([]);
  const [selected, setSelected] = useState<HumanAudit | null>(null);
  const [notes, setNotes] = useState("");
  const [reportJson, setReportJson] = useState("");
  const [preview, setPreview] = useState<ProfileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAudits = async () => {
    try {
      const response = await fetch("/api/admin/human-audits", { headers: authHeaders(token) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load review queue.");
      setAudits(data.audits);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load review queue.");
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async (id: number) => {
    setError("");
    try {
      const response = await fetch(`/api/admin/human-audits/${id}`, { headers: authHeaders(token) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load client brief.");
      setSelected(data.audit);
      setNotes(data.audit.adminNotes || "");
      setReportJson(JSON.stringify(data.audit.finalReport || data.audit.clientBrief || {}, null, 2));
      setPreview(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load client brief.");
    }
  };

  useEffect(() => {
    void loadAudits();
  }, [token]);

  const parseReport = (): ProfileResult | null => {
    try {
      const parsed = JSON.parse(reportJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Report must be a JSON object.");
      }
      setError("");
      return parsed as ProfileResult;
    } catch (caught) {
      setError(`JSON error: ${caught instanceof Error ? caught.message : "Invalid JSON"}`);
      return null;
    }
  };

  const patchAudit = async (patch: { status?: HumanAuditStatus; adminNotes?: string; finalReport?: ProfileResult }) => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/human-audits/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update audit.");
      setSelected(data.audit);
      await loadAudits();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update audit.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdits = () => {
    const report = parseReport();
    if (report) void patchAudit({ finalReport: report });
  };

  const release = async () => {
    if (!selected) return;
    const finalReport = parseReport();
    if (!finalReport || !window.confirm("Approve and release this report to the user?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/human-audits/${selected.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ finalReport }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not release report.");
      setSelected(data.audit);
      await loadAudits();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not release report.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="audit-shell audit-centered"><Loader2 size={30} className="spin" /><p>Loading review queue…</p></div>;
  }

  const awaitingCount = audits.filter((audit) => audit.status === "awaiting_admin_review").length;
  const previewInput: ProfileInput | null = selected ? {
    platform: selected.platform as ProfileInput["platform"],
    email: selected.email,
    bio: "",
    prompts: [],
    photoDescriptions: [],
    screenshots: [],
    currentPhotos: [],
    additionalPhotos: [],
    targetType: "",
  } : null;

  return (
    <div className="audit-shell audit-admin-shell">
      <div className="audit-header">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <span className="audit-kicker">Magnet Profile Audit · Admin</span>
        <button className="audit-refresh" onClick={() => void loadAudits()}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="audit-admin-layout">
        <aside className="audit-queue">
          <div className="audit-admin-title"><p className="audit-eyebrow">Review queue</p><h1>Profile audits</h1></div>
          <p className="audit-queue-count">{awaitingCount} Awaiting review</p>
          {audits.length === 0 && <p className="audit-empty">No submissions yet.</p>}
          {audits.map((audit) => (
            <button key={audit.id} className={`audit-queue-item ${selected?.id === audit.id ? "active" : ""}`} onClick={() => void loadAudit(audit.id)}>
              <strong>{audit.email}</strong>
              <span>{audit.platform} · {STATUS_LABELS[audit.status]}</span>
            </button>
          ))}
        </aside>
        <section className="audit-brief">
          {!selected ? (
            <div className="audit-empty audit-brief-empty"><ClipboardList size={32} /><h2>Select a profile audit</h2><p>Choose a submission to review and release.</p></div>
          ) : (
            <>
              <div className="audit-brief-header">
                <div><p className="audit-eyebrow">{selected.email} · {selected.platform}</p><h2>Audit #{selected.id}</h2></div>
                {selected.status !== "final_report_ready" && (
                  <select value={selected.status} onChange={(event) => void patchAudit({ status: event.target.value as HumanAuditStatus })} disabled={saving}>
                    {EDITABLE_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                )}
              </div>
              <div className="brief-block">
                <h3>Editable report JSON</h3>
                <textarea className="admin-report-editor" value={reportJson} onChange={(event) => setReportJson(event.target.value)} rows={18} spellCheck={false} />
                <div className="audit-actions">
                  <button className="audit-secondary-btn" onClick={saveEdits} disabled={saving}>Save edits</button>
                  <button className="audit-secondary-btn" onClick={() => { const report = parseReport(); if (report) setPreview(report); }}>Preview as user</button>
                  <button className="audit-secondary-btn" onClick={() => { setReportJson(JSON.stringify(selected.clientBrief || {}, null, 2)); setError(""); }}>Reset to AI draft</button>
                  <button className="audit-primary-btn" onClick={() => void release()} disabled={saving || selected.status === "final_report_ready"}>Approve and release</button>
                </div>
              </div>
              <div className="brief-block">
                <h3>Submission context</h3>
                <div className="brief-data-grid">
                  {Object.entries(selected.intakeData).filter(([, value]) => String(value || "").trim()).map(([key, value]) => (
                    <div key={key}><small>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</small><p>{String(value)}</p></div>
                  ))}
                </div>
              </div>
              <div className="brief-block">
                <h3>Internal notes</h3>
                <textarea className="admin-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} />
                <button className="audit-secondary-btn" onClick={() => void patchAudit({ adminNotes: notes })} disabled={saving}>Save notes</button>
              </div>
            </>
          )}
        </section>
      </div>
      {preview && previewInput && (
        <div className="admin-preview-overlay">
          <div className="admin-preview-panel">
            <button className="audit-secondary-btn" onClick={() => setPreview(null)}>Close preview</button>
            <FullReport result={preview} profileInput={previewInput} onBack={() => setPreview(null)} />
          </div>
        </div>
      )}
      {error && <p className="audit-error">{error}</p>}
    </div>
  );
}