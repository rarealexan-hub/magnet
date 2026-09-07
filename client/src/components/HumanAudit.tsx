import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Clock3,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { PLATFORMS, RELATIONSHIP_INTENTS } from "@shared/types";
import type {
  HumanAudit,
  HumanAuditListItem,
  HumanAuditQuestion,
  HumanAuditStatus,
} from "@shared/types";

const CALIBRATION_EXAMPLES = [
  { id: "clear-solo", label: "Clear solo portrait", detail: "Face-forward, relaxed, easy to read", tone: "sand" },
  { id: "active-outdoors", label: "Active outdoors", detail: "A real setting with something going on", tone: "pine" },
  { id: "social-context", label: "Social context", detail: "You with friends, still easy to identify", tone: "blue" },
  { id: "style-shot", label: "Personal style", detail: "A look that says something specific", tone: "plum" },
  { id: "creative-hobby", label: "Creative hobby", detail: "A detail that opens a conversation", tone: "gold" },
  { id: "quiet-candid", label: "Quiet candid", detail: "Natural expression, no heavy posing", tone: "rose" },
] as const;

const STATUS_LABELS: Record<HumanAuditStatus, string> = {
  intake_started: "Intake started",
  intake_complete: "Intake complete",
  awaiting_admin_review: "Awaiting review",
  followup_sent: "Follow-up needed",
  followup_complete: "Follow-up complete",
  final_report_ready: "Final report ready",
};

function authHeaders(token?: string, auditToken?: string): HeadersInit {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (auditToken) headers["X-Human-Audit-Token"] = auditToken;
  return headers;
}

function statusDescription(status: HumanAuditStatus): string {
  switch (status) {
    case "intake_started":
      return "Your intake is saved. Finish the calibration step so we can prepare your brief.";
    case "intake_complete":
    case "awaiting_admin_review":
      return "Your audit is being prepared from your profile, context, and preference signals.";
    case "followup_sent":
      return "Your audit has a few follow-up questions. Answer them below so the report can be finalized.";
    case "followup_complete":
      return "Your answers are saved. We’ll use them to finish your audit.";
    case "final_report_ready":
      return "Your complete Magnet Profile Audit is ready.";
  }
}

interface HumanAuditFlowProps {
  token?: string;
  userEmail?: string;
  onSubmitted: (auditId: number, accessToken: string) => void;
  onBack: () => void;
}

export function HumanAuditFlow({ token, userEmail, onSubmitted, onBack }: HumanAuditFlowProps) {
  const [step, setStep] = useState<"intake" | "calibration">("intake");
  const [platform, setPlatform] = useState("hinge");
  const [email, setEmail] = useState(userEmail || "");
  const [relationshipIntent, setRelationshipIntent] = useState("");
  const [idealPartner, setIdealPartner] = useState("");
  const [datingStruggle, setDatingStruggle] = useState("");
  const [strengths, setStrengths] = useState("");
  const [nonNegotiables, setNonNegotiables] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleCalibration = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 3 ? [...current, id] : current);
  };

  const submit = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Add a valid email so Magnet can save your audit.");
      return;
    }
    if (selectedIds.length !== 3) {
      setError("Choose exactly three examples that feel most like the kind of profile you notice.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/human-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          platform,
          email: email.trim(),
          intakeData: {
            relationshipIntent,
            idealPartner,
            datingStruggle,
            strengths,
            nonNegotiables,
            additionalContext,
          },
          photoCalibration: { selectedIds, rankedIds: selectedIds },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your audit.");
      onSubmitted(data.audit.id, data.accessToken);
    } catch (err: any) {
      setError(err.message || "Could not save your audit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="audit-shell">
      <div className="audit-header">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <span className="audit-progress">Magnet Profile Audit · {step === "intake" ? "01" : "02"} / 02</span>
      </div>
      <div className="audit-intro audit-intro-compact">
        <p className="audit-eyebrow">{step === "intake" ? "A little context first" : "Calibrate your eye"}</p>
        <h1>{step === "intake" ? "Tell us what you actually want." : "What makes a profile catch your eye?"}</h1>
        <p>{step === "intake"
          ? "This is not a personality quiz. Your answers give the audit the context to be specific instead of generic."
          : "These are clearly artificial examples, not real people. Pick the three profile-photo directions you instinctively respond to most."}</p>
      </div>

      {step === "intake" ? (
        <div className="audit-form">
          <div className="audit-form-grid">
            <label className="audit-field">
              <span>Email for your audit</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
            </label>
            <label className="audit-field">
              <span>Which app are you focused on?</span>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <label className="audit-field">
            <span>What are you looking for right now?</span>
            <select value={relationshipIntent} onChange={(e) => setRelationshipIntent(e.target.value)}>
              <option value="">Choose one</option>
              {RELATIONSHIP_INTENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="audit-field"><span>Who do you want to attract?</span><textarea value={idealPartner} onChange={(e) => setIdealPartner(e.target.value)} placeholder="Describe the person and energy you want your profile to speak to." rows={3} /></label>
          <div className="audit-form-grid">
            <label className="audit-field"><span>What feels hardest about dating right now?</span><textarea value={datingStruggle} onChange={(e) => setDatingStruggle(e.target.value)} placeholder="For example: getting matches, starting conversations, or choosing photos." rows={4} /></label>
            <label className="audit-field"><span>What do you think your profile does well?</span><textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Give the audit something to protect, not just things to change." rows={4} /></label>
          </div>
          <label className="audit-field"><span>Any non-negotiables or context?</span><textarea value={nonNegotiables} onChange={(e) => setNonNegotiables(e.target.value)} placeholder="Values, lifestyle, boundaries, or anything else that should shape the review." rows={3} /></label>
          <label className="audit-field"><span>Anything else you want Magnet to know? <small>Optional</small></span><textarea value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} rows={3} /></label>
          <div className="audit-actions"><button className="audit-primary-btn" onClick={() => setStep("calibration")}>Continue to photo calibration <ArrowRight size={16} /></button></div>
        </div>
      ) : (
        <div className="calibration-wrap">
          <div className="calibration-grid">
            {CALIBRATION_EXAMPLES.map((example) => {
              const selectedIndex = selectedIds.indexOf(example.id);
              return (
                <button key={example.id} className={`calibration-card ${selectedIndex >= 0 ? "selected" : ""}`} onClick={() => toggleCalibration(example.id)}>
                  <span className={`calibration-image calibration-image-${example.tone}`}><span className="calibration-silhouette" /></span>
                  <span className="calibration-card-copy"><strong>{example.label}</strong><small>{example.detail}</small></span>
                  <span className="calibration-check">{selectedIndex >= 0 ? selectedIndex + 1 : ""}</span>
                </button>
              );
            })}
          </div>
          <div className="calibration-footer">
            <span>{selectedIds.length} of 3 selected</span>
            <div className="audit-actions">
              <button className="audit-secondary-btn" onClick={() => setStep("intake")}>Back</button>
              <button className="audit-primary-btn" onClick={submit} disabled={saving || selectedIds.length !== 3}>{saving ? <><Loader2 size={16} className="spin" /> Saving…</> : <>Submit profile audit <Send size={16} /></>}</button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="audit-error">{error}</p>}
    </div>
  );
}

interface HumanAuditStatusProps {
  auditId: number;
  accessToken: string;
  token?: string;
  onBack: () => void;
}

export function HumanAuditStatus({ auditId, accessToken, token, onBack }: HumanAuditStatusProps) {
  const [audit, setAudit] = useState<HumanAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [answering, setAnswering] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/human-audits/${auditId}`, { headers: authHeaders(token, accessToken) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load your audit.");
      setAudit(data.audit);
    } catch (err: any) {
      setError(err.message || "Could not load your audit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, [auditId, accessToken, token]);

  const answerQuestion = async (question: HumanAuditQuestion) => {
    const answer = (answers[question.id] || "").trim();
    if (!answer) return;
    setAnswering(question.id);
    try {
      const res = await fetch(`/api/human-audits/${auditId}/questions/${question.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token, accessToken) },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your answer.");
      setAnswers((current) => ({ ...current, [question.id]: "" }));
      setAudit(data.audit);
    } catch (err: any) {
      setError(err.message || "Could not send your answer.");
    } finally {
      setAnswering(null);
    }
  };

  if (loading) return <div className="audit-shell audit-centered"><Loader2 size={30} className="spin" /><p>Loading your audit…</p></div>;
  if (error && !audit) return <div className="audit-shell"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button><p className="audit-error">{error}</p></div>;
  if (!audit) return null;

  const openQuestions = audit.questions.filter((question) => question.status === "open");
  return (
    <div className="audit-shell">
      <div className="audit-header"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button><button className="audit-refresh" onClick={load}><RefreshCw size={14} /> Refresh</button></div>
      <div className="audit-status-card">
        <div className="audit-status-icon"><ShieldCheck size={24} /></div>
        <div><p className="audit-eyebrow">Magnet Profile Audit</p><h1>{STATUS_LABELS[audit.status]}</h1><p>{statusDescription(audit.status)}</p></div>
      </div>
      <div className="audit-status-meta"><span><ClipboardList size={15} /> {audit.platform}</span><span><Clock3 size={15} /> Started {new Date(audit.createdAt).toLocaleDateString()}</span></div>
      {openQuestions.length > 0 && (
        <section className="followup-panel">
          <div className="followup-heading"><MessageCircleQuestion size={19} /><div><h2>A quick follow-up for your audit</h2><p>Answer in your own words. Specific beats polished.</p></div></div>
          {openQuestions.map((question) => <div className="followup-question" key={question.id}><strong>{question.question}</strong><textarea value={answers[question.id] || ""} onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: e.target.value }))} rows={4} placeholder="Write your answer…" /><button className="audit-primary-btn" onClick={() => answerQuestion(question)} disabled={answering === question.id}>{answering === question.id ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Send answer</button></div>)}
        </section>
      )}
      {audit.status === "final_report_ready" && <div className="audit-ready-note"><Check size={18} /><span>Your Magnet Profile Audit is ready.</span></div>}
      {error && <p className="audit-error">{error}</p>}
    </div>
  );
}

interface HumanAuditAdminProps {
  token?: string;
  onBack: () => void;
}

const ADMIN_STATUSES: HumanAuditStatus[] = ["intake_started", "intake_complete", "awaiting_admin_review", "followup_sent", "followup_complete", "final_report_ready"];

export function HumanAuditAdmin({ token, onBack }: HumanAuditAdminProps) {
  const [audits, setAudits] = useState<HumanAuditListItem[]>([]);
  const [selected, setSelected] = useState<HumanAudit | null>(null);
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAudits = async () => {
    try {
      const res = await fetch("/api/admin/human-audits", { headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load review queue.");
      setAudits(data.audits);
    } catch (err: any) {
      setError(err.message || "Could not load review queue.");
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async (id: number) => {
    const res = await fetch(`/api/admin/human-audits/${id}`, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load client brief.");
    setSelected(data.audit);
    setNotes(data.audit.adminNotes || "");
  };

  useEffect(() => { loadAudits(); }, [token]);

  const updateAudit = async (patch: { status?: HumanAuditStatus; adminNotes?: string }) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/human-audits/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update audit.");
      setSelected(data.audit);
      await loadAudits();
    } catch (err: any) {
      setError(err.message || "Could not update audit.");
    } finally {
      setSaving(false);
    }
  };

  const sendQuestion = async () => {
    if (!selected || !question.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/human-audits/${selected.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send follow-up.");
      setSelected(data.audit);
      setQuestion("");
      await loadAudits();
    } catch (err: any) {
      setError(err.message || "Could not send follow-up.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="audit-shell audit-centered"><Loader2 size={30} className="spin" /><p>Loading review queue…</p></div>;
  return (
    <div className="audit-shell audit-admin-shell">
      <div className="audit-header"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button><span className="audit-kicker">Magnet Profile Audit · Admin</span><button className="audit-refresh" onClick={loadAudits}><RefreshCw size={14} /> Refresh</button></div>
      <div className="audit-admin-layout">
        <aside className="audit-queue">
          <div className="audit-admin-title"><p className="audit-eyebrow">Completed submissions</p><h1>Profile audits</h1></div>
          {audits.length === 0 && <p className="audit-empty">No submissions yet.</p>}
          {audits.map((item) => <button key={item.id} className={`audit-queue-item ${selected?.id === item.id ? "active" : ""}`} onClick={() => loadAudit(item.id)}><strong>{item.email}</strong><span>{item.platform} · {STATUS_LABELS[item.status]}</span><small>{item.openQuestionCount ? `${item.openQuestionCount} open question${item.openQuestionCount === 1 ? "" : "s"}` : "No open questions"}</small></button>)}
        </aside>
        <section className="audit-brief">
           {!selected ? <div className="audit-empty audit-brief-empty"><ClipboardList size={32} /><h2>Select a profile audit</h2><p>Choose a completed submission to review its context, calibration choices, and generated report.</p></div> : <><div className="audit-brief-header"><div><p className="audit-eyebrow">{selected.email} · {selected.platform}</p><h2>Audit #{selected.id}</h2></div><select value={selected.status} onChange={(e) => updateAudit({ status: e.target.value as HumanAuditStatus })} disabled={saving}>{ADMIN_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></div><div className="brief-block"><h3>Generated report</h3><div className="admin-report-summary"><strong>{(selected.clientBrief as any)?.score?.overall ?? "—"}<small>/100</small></strong><span>Magnet Score</span></div><pre className="admin-report-json">{JSON.stringify(selected.clientBrief, null, 2)}</pre></div><div className="brief-block"><h3>Submission context</h3><div className="brief-data-grid">{Object.entries(selected.intakeData).filter(([, value]) => String(value || "").trim()).map(([key, value]) => <div key={key}><small>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</small><p>{String(value)}</p></div>)}</div></div><div className="brief-block"><h3>Photo preference calibration</h3><div className="brief-selection">{selected.photoCalibration.selectedIds.map((id, index) => <span key={id}>{index + 1}. {CALIBRATION_EXAMPLES.find((example) => example.id === id)?.label || id}</span>)}</div></div><div className="brief-block"><h3>Internal notes</h3><textarea className="admin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Private notes about this audit…" /><button className="audit-secondary-btn" onClick={() => updateAudit({ adminNotes: notes })} disabled={saving}>Save notes</button></div><div className="brief-block"><div className="followup-heading"><MessageCircleQuestion size={18} /><div><h3>Optional follow-up</h3><p>Use this only if the generated report needs one more piece of context.</p></div></div>{selected.questions.map((item) => <div className="admin-question" key={item.id}><strong>{item.question}</strong><span>{item.status}</span>{item.answers.map((answer) => <p key={answer.id}>“{answer.answer}”</p>)}</div>)}<textarea className="admin-notes" value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="Ask one specific question…" /><button className="audit-primary-btn" onClick={sendQuestion} disabled={saving || !question.trim()}><Send size={15} /> Add question</button></div></>}
        </section>
      </div>
      {error && <p className="audit-error">{error}</p>}
    </div>
  );
}