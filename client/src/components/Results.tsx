import { useEffect } from "react";
import { AlertTriangle, Crosshair, ArrowRight, FileText, Lightbulb, TrendingUp, BookMarked, X, Smartphone } from "lucide-react";
import type { ProfileResult, ProfileInput } from "@shared/types";
import { PLATFORM_LABEL } from "@shared/types";
import { ScoreRing } from "./ScoreRing";
import type { AuthUser } from "../hooks/useAuth";

function MatchVolumeBlock({ score, platform }: { score: number; platform: string }) {
  const label = PLATFORM_LABEL[platform] ?? platform;

  type Tier = { range: string; weekly: string; bar: number };
  const tiers: Tier[] = [
    { range: "0–49",  weekly: "1–3 / week",   bar: 15  },
    { range: "50–64", weekly: "3–6 / week",   bar: 35  },
    { range: "65–79", weekly: "6–12 / week",  bar: 60  },
    { range: "80–100",weekly: "12–20+ / week", bar: 100 },
  ];
  const currentTierIdx =
    score >= 80 ? 3 : score >= 65 ? 2 : score >= 50 ? 1 : 0;
  const current = tiers[currentTierIdx];
  const top = tiers[3];

  return (
    <div className="match-volume-block">
      <div className="match-volume-header">
        <TrendingUp size={18} />
        <span>Match Volume Estimate</span>
        <span className="match-volume-platform">{label}</span>
      </div>
      <div className="match-volume-body">
        <div className="match-volume-row current">
          <span className="match-volume-label">Your profile now</span>
          <div className="match-volume-bar-wrap">
            <div className="match-volume-bar" style={{ width: `${current.bar}%` }} />
          </div>
          <span className="match-volume-count">{current.weekly}</span>
        </div>
        <div className="match-volume-row optimized">
          <span className="match-volume-label">Score 80+ profile</span>
          <div className="match-volume-bar-wrap">
            <div className="match-volume-bar optimized" style={{ width: `${top.bar}%` }} />
          </div>
          <span className="match-volume-count highlight">{top.weekly}</span>
        </div>
      </div>
      <p className="match-volume-note">
        Based on {label} platform data · Top 10% of profiles get 5–10× more matches than average
      </p>
    </div>
  );
}

interface Props {
  result: ProfileResult;
  profileInput: ProfileInput;
  onStartOver: () => void;
  onFullReport: () => void;
  onBundle?: () => void;
  fullReportViewed?: boolean;
  user?: AuthUser | null;
  onSignIn?: () => void;
  reviewStatus?: string;
  auditAccess?: { auditId: number; token: string; status: string } | null;
  onAuditReady?: (report: ProfileResult, status: string) => void;
}

const QUICK_SUGGESTIONS: Record<string, { tip: string }> = {
  photoQuality: {
    tip: "Replace group shots, blurry photos, or bathroom selfies with clear solo photos taken in natural light. Every photo should pass a quick test: does this make someone want to know more about me?",
  },
  attractionSignals: {
    tip: "Your lead photo should show your face clearly — no sunglasses, no hats, no group shots. A genuine smile and natural eye contact are the two highest-converting signals on any app.",
  },
  personalitySignals: {
    tip: "Replace at least one generic prompt with a specific story, strong opinion, or niche interest. 'I love hiking and trying new restaurants' doesn't tell anyone anything. Find the detail only you would say.",
  },
  matchTargeting: {
    tip: "Include at least one specific, slightly polarizing detail — a niche hobby, a strong opinion, or an unusual trait. Generic profiles attract no one. Specific profiles attract the right people.",
  },
  firstImpression: {
    tip: "In under 2 seconds a swiper sees your lead photo and maybe your first line. Make sure both stop the scroll: your best photo first, your sharpest prompt line up front.",
  },
};

function ImmediateDirection({ score, onFullReport }: { score: ProfileResult["score"]; onFullReport: () => void }) {
  const freeCategories = [
    { key: "photoQuality" as const, label: "Photo Quality" },
    { key: "attractionSignals" as const, label: "Attraction Signals" },
    { key: "personalitySignals" as const, label: "Personality Signals" },
  ];
  const weakFree = freeCategories.filter((c) => score[c.key] < 70);
  if (weakFree.length === 0) return null;

  return (
    <div className="basic-suggestions-section">
      <h3 className="basic-suggestions-title">
        <Lightbulb size={18} /> Direction to start with
      </h3>
      <p className="basic-suggestions-sub">
        Your complete Magnet Profile Audit has the exact photo, prompt, and order recommendations.
      </p>
      <div className="basic-suggestions-list">
        {weakFree.map((cat) => {
           const s = QUICK_SUGGESTIONS[cat.key];
          return (
            <div key={cat.key} className="basic-suggestion-item">
              <div className="basic-suggestion-header">
                <span className="basic-suggestion-label">{cat.label}</span>
                <span className="basic-suggestion-score">{score[cat.key]}/100</span>
              </div>
              <p className="basic-suggestion-tip">{s.tip}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Results({ result, profileInput, onStartOver, onFullReport, onBundle, fullReportViewed, user, onSignIn, reviewStatus, auditAccess, onAuditReady }: Props) {
  const pending = reviewStatus === "awaiting_admin_review";
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (!auditAccess || reviewStatus !== "awaiting_admin_review") return;
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/audits/${auditAccess.auditId}?token=${encodeURIComponent(auditAccess.token)}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (data.status === "final_report_ready" && data.report) {
          onAuditReady?.({
            ...data.report,
            analysisId: data.analysisId,
            auditId: auditAccess.auditId,
            accessToken: auditAccess.token,
            reviewStatus: data.status,
          }, data.status);
        }
      } catch {
        // Keep the first read visible and try again on the next interval.
      }
    };
    const timer = window.setInterval(() => void checkStatus(), 60000);
    return () => window.clearInterval(timer);
  }, [auditAccess, reviewStatus, onAuditReady]);

  const { score, feedback } = result;

  const profileTypeColor = {
    "high-signal": "#22c55e",
    "generic": "#eab308",
    "entertainment": "#8b5cf6",
  };

  const scoreCategories = [
    { key: "photoQuality" as const, label: "Photo Quality" },
    { key: "attractionSignals" as const, label: "Attraction Signals" },
    { key: "personalitySignals" as const, label: "Personality Signals" },
    { key: "matchTargeting" as const, label: "Match Targeting" },
    { key: "firstImpression" as const, label: "First Impression" },
  ];

  const lowestCategory = scoreCategories.reduce(
    (min, cat) => (score[cat.key] < score[min.key] ? cat : min),
    scoreCategories[0]
  );

  return (
    <div className="results-page">
      <div className="results-container">

        <div className="score-card">
          <div className="score-card-header">
            <p className="score-card-title">MAGNET SCORE</p>
          </div>
          <div className="score-hero">
            <ScoreRing score={score.overall} size={160} />
            <div className="score-label-wrap">
              <div
                className="profile-type-badge"
                style={{
                  background: profileTypeColor[feedback.profileType] + "20",
                  color: profileTypeColor[feedback.profileType],
                }}
              >
                {feedback.profileType.replace("-", " ")} profile
              </div>
              <p className="type-explanation">{feedback.profileTypeExplanation}</p>
            </div>
          </div>

          <div className="score-breakdown">
            <p className="breakdown-title">Breakdown</p>
            <div className="breakdown-rows">
              {scoreCategories.map((cat) => (
                <div
                  key={cat.key}
                  className={`breakdown-row ${cat.key === lowestCategory.key ? "weakest" : ""}`}
                >
                  <span className="breakdown-label">{cat.label}</span>
                  <div className="breakdown-bar-wrap">
                    <div className="breakdown-bar" style={{ width: `${score[cat.key]}%` }} />
                  </div>
                  <span className="breakdown-value">{score[cat.key]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="match-killer">
            <Crosshair size={16} />
            <div>
              <p className="match-killer-title">Your biggest match killer</p>
              <p className="match-killer-text">
                {lowestCategory.label} scored {score[lowestCategory.key]}/100 —{" "}
                {feedback.mistakes[0] || "this is what's holding your profile back"}
              </p>
            </div>
          </div>
        </div>

        <div className="mistakes-section">
          <h3>
            <AlertTriangle size={18} />
            Issues Detected
          </h3>
          <ul className="mistakes-list">
            {feedback.mistakes.slice(0, 3).map((mistake, i) => (
              <li key={i}>
                <span className="fix-number"><X size={13} /></span>
                {mistake}
              </li>
            ))}
          </ul>
          {feedback.mistakes.length > 3 && (
            <p className="mistakes-more-count">
               +{feedback.mistakes.length - 3} more issues detected — see the complete audit below
            </p>
          )}
        </div>

         <ImmediateDirection score={score} onFullReport={onFullReport} />

        {feedback.leadPhotoTeaser && (
          <div className="basic-suggestion-item">
            <div className="basic-suggestion-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>📸</span>
                <span className="basic-suggestion-label">Lead Photo Intel</span>
              </div>
              <span className="basic-suggestion-score">
                In your audit
              </span>
            </div>
            <p className="basic-suggestion-tip" style={{ fontStyle: "italic" }}>
              {feedback.leadPhotoTeaser}
            </p>
          </div>
        )}

        <MatchVolumeBlock score={score.overall} platform={profileInput.platform} />

        {!user && onSignIn && (
          <div className="save-results-prompt">
            <div className="save-results-icon">
              <BookMarked size={18} />
            </div>
            <div className="save-results-text">
              <p className="save-results-title">Save your results</p>
              <p className="save-results-sub">Create a free account to track your score over time and access your Dashboard.</p>
            </div>
            <button className="save-results-btn" onClick={onSignIn}>
              Sign In
            </button>
          </div>
        )}

         {pending ? (
           <div className="upgrade-section audit-report-cta audit-pending-card">
             <h3 className="upgrade-title">Your full audit is in review. It will be ready within 48 hours.</h3>
             {auditAccess && (
               <div className="audit-private-link">
                 <code>{`${window.location.origin}/?audit=${auditAccess.auditId}&token=${auditAccess.token}`}</code>
                 <button className="pricing-btn" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?audit=${auditAccess.auditId}&token=${auditAccess.token}`)}>Copy link</button>
               </div>
             )}
             {!user && onSignIn && <button className="pricing-btn" onClick={onSignIn}>Create an account to save your audit</button>}
           </div>
         ) : <div className="upgrade-section audit-report-cta">
           <h3 className="upgrade-title">Your complete Magnet Profile Audit</h3>
           <p className="upgrade-subtitle">
             See the full photo ranking, best order, accidental signals, rewrites, dating archetype, immediate fixes, reshoot briefs, and platform-specific guidance.
           </p>
           <button className="pricing-btn" onClick={onFullReport}>
             <FileText size={15} /> {fullReportViewed ? "View your complete audit" : "Open your complete audit"} <ArrowRight size={16} />
           </button>
         </div>}

        <div className="addon-section">
          <div className="addon-strip">
            <div className="addon-strip-left">
              <div className="addon-strip-icon">
                <Smartphone size={18} />
              </div>
              <div className="addon-strip-text">
                <span className="addon-strip-title">Also on Tinder, Bumble, or another app?</span>
                <span className="addon-strip-desc">Analyze another platform, full report included</span>
              </div>
            </div>
            <button className="pricing-btn" onClick={onStartOver}>
              Analyze another app
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
