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

function authHeaders(token?: string, adminKey?: string): HeadersInit {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(adminKey ? { "x-admin-key": adminKey } : {}),
  };
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
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("magnet_admin_key") || "");
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [needsAdminKey, setNeedsAdminKey] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ url: string; label: string }>>([]);
  const [photosRemoved, setPhotosRemoved] = useState(false);

  const noteForbidden = (response: Response) => {
    if (response.status === 403) setNeedsAdminKey(true);
  };

  const loadAudits = async (key = adminKey) => {
    try {
      const response = await fetch("/api/admin/human-audits", { headers: authHeaders(token, key) });
      noteForbidden(response);
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
      const response = await fetch(`/api/admin/human-audits/${id}`, { headers: authHeaders(token, adminKey) });
      noteForbidden(response);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load client brief.");
      setSelected(data.audit);
      setUploadedPhotos([]);
      setPhotosRemoved(false);
      setNotes(data.audit.adminNotes || "");
      setReportJson(JSON.stringify(data.audit.finalReport || data.audit.clientBrief || {}, null, 2));
      setPreview(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load client brief.");
    }
  };

  useEffect(() => {
    if (!selected) return;
    const metadata = selected.reportPhotos
      || (selected.intakeData as { reportPhotos?: { screenshots?: unknown[]; currentPhotos?: unknown[]; additionalPhotos?: unknown[]; deleted?: boolean } }).reportPhotos;
    if (!metadata) return;
    setPhotosRemoved(!!metadata.deleted);
    const groups = [
      ...(metadata.screenshots || []).map((photo, i) => ({ photo, label: typeof photo === "object" && photo && "label" in photo ? String(photo.label) : `Screenshot ${i + 1}` })),
      ...(metadata.currentPhotos || []).map((photo, i) => ({ photo, label: typeof photo === "object" && photo && "label" in photo ? String(photo.label) : `Current photo ${i + 1}` })),
      ...(metadata.additionalPhotos || []).map((photo, i) => ({ photo, label: typeof photo === "object" && photo && "label" in photo ? String(photo.label) : `Additional photo ${i + 1}` })),
    ];
    let cancelled = false;
    const urls: string[] = [];
    const load = async () => {
      const loaded: Array<{ url: string; label: string }> = [];
      for (const item of groups) {
        const photo = item.photo as string | { endpoint?: string; path?: string; url?: string; label?: string };
        const endpoint = typeof photo === "string" ? (/^\/api\/|^https?:\/\//.test(photo) ? photo : null) : (photo.endpoint || photo.path || photo.url);
        if (!endpoint) continue;
        try {
          const response = await fetch(endpoint, { headers: authHeaders(token, adminKey) });
          if (!response.ok) { setPhotosRemoved(true); continue; }
          const url = URL.createObjectURL(await response.blob());
          urls.push(url);
          loaded.push({ url, label: typeof photo === "string" ? item.label : photo.label || item.label });
        } catch { setPhotosRemoved(true); }
      }
      if (!cancelled) setUploadedPhotos(loaded);
    };
    void load();
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [selected, token, adminKey]);

  const deletePhotos = async () => {
    if (!selected || !window.confirm("Delete all uploaded photos now?")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/human-audits/${selected.id}/photos`, { method: "DELETE", headers: authHeaders(token, adminKey) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete photos.");
      setUploadedPhotos([]);
      setPhotosRemoved(true);
      await loadAudit(selected.id);
      setPhotosRemoved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete photos.");
    } finally { setSaving(false); }
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
        headers: { "Content-Type": "application/json", ...authHeaders(token, adminKey) },
        body: JSON.stringify(patch),
      });
      noteForbidden(response);
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
        headers: { "Content-Type": "application/json", ...authHeaders(token, adminKey) },
        body: JSON.stringify({ finalReport }),
      });
      noteForbidden(response);
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

  const resendReadyEmail = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/human-audits/${selected.id}/resend-ready-email`, {
        method: "POST",
        headers: authHeaders(token, adminKey),
      });
      noteForbidden(response);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not resend the ready email.");
      if (!data.success) throw new Error(data.error || "The ready email could not be sent. You can retry.");
      setSelected(data.audit);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the ready email.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="audit-shell audit-centered"><Loader2 size={30} className="spin" /><p>Loading review queue…</p></div>;
  }

  const awaitingCount = audits.filter((audit) => audit.status === "awaiting_admin_review").length;
  const saveAdminKey = () => {
    const nextKey = adminKeyInput.trim();
    if (!nextKey) return;
    sessionStorage.setItem("magnet_admin_key", nextKey);
    setAdminKey(nextKey);
    setAdminKeyInput("");
    setNeedsAdminKey(false);
    setLoading(true);
    void loadAudits(nextKey);
  };
  const previewPhotos = selected && (selected.reportPhotos
    || (selected.intakeData as { reportPhotos?: { screenshots?: string[]; currentPhotos?: string[]; additionalPhotos?: string[] } }).reportPhotos);
  const previewInput: ProfileInput | null = selected ? {
    platform: selected.platform as ProfileInput["platform"],
    email: selected.email,
    bio: "",
    prompts: [],
    photoDescriptions: [],
    screenshots: previewPhotos?.screenshots || [],
    currentPhotos: previewPhotos?.currentPhotos || [],
    additionalPhotos: previewPhotos?.additionalPhotos || [],
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
        {needsAdminKey && (
          <div className="brief-block admin-key-prompt">
            <h3>Admin key required</h3>
            <p>Enter the admin key for this browser session.</p>
            <input
              type="password"
              value={adminKeyInput}
              onChange={(event) => setAdminKeyInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") saveAdminKey(); }}
              autoComplete="off"
            />
            <button className="audit-primary-btn" onClick={saveAdminKey}>Continue</button>
          </div>
        )}
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
                {(uploadedPhotos.length > 0 || photosRemoved) && (
                  <div className="uploaded-photos-card">
                    <h3>Uploaded photos</h3>
                    <div className="swap-photo-thumbs">
                      {uploadedPhotos.map((photo) => <div className="photo-thumb-wrap" key={photo.url}><img src={photo.url} alt={photo.label} className="photo-thumb" /><span className="photo-thumb-label">{photo.label}</span></div>)}
                      {photosRemoved && <div className="photo-thumb-wrap photo-missing"><div className="photo-placeholder">📷</div><span className="photo-thumb-label">Photos removed under the retention policy</span></div>}
                    </div>
                    <button className="audit-secondary-btn" onClick={() => void deletePhotos()} disabled={saving}>Delete photos now</button>
                  </div>
                )}
                <h3>Editable report JSON</h3>
                <textarea className="admin-report-editor" value={reportJson} onChange={(event) => setReportJson(event.target.value)} rows={18} spellCheck={false} />
                <div className="audit-actions">
                  <button className="audit-secondary-btn" onClick={saveEdits} disabled={saving}>Save edits</button>
                  <button className="audit-secondary-btn" onClick={() => { const report = parseReport(); if (report) setPreview(report); }}>Preview as user</button>
                  <button className="audit-secondary-btn" onClick={() => { setReportJson(JSON.stringify(selected.clientBrief || {}, null, 2)); setError(""); }}>Reset to AI draft</button>
                  <button className="audit-primary-btn" onClick={() => void release()} disabled={saving}>
                    {selected.status === "final_report_ready" ? "Release update" : "Approve and release"}
                  </button>
                </div>
              </div>
              <div className="brief-block">
                <h3>Ready email</h3>
                {selected.reportEmailSentAt ? (
                  <p>Sent {new Date(selected.reportEmailSentAt).toLocaleString()}</p>
                ) : selected.status === "final_report_ready" ? (
                  <>
                    <p>Not sent. You can retry without releasing the report again.</p>
                    <button className="audit-secondary-btn" onClick={() => void resendReadyEmail()} disabled={saving}>Resend ready email</button>
                  </>
                ) : (
                  <p>Not sent yet. It will be sent when this report is released.</p>
                )}
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
            <FullReport
              result={{ ...preview, reportPhotos: selected.reportPhotos || preview.reportPhotos }}
              profileInput={previewInput}
              photoRequestHeaders={authHeaders(token, adminKey)}
              onBack={() => setPreview(null)}
            />
          </div>
        </div>
      )}
      {error && <p className="audit-error">{error}</p>}
    </div>
  );
}