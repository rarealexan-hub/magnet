import { useState, useEffect } from "react";
import { AlertTriangle, Crosshair, ArrowRight, FileText, Zap, Lightbulb, Lock, Layers, TrendingUp, BookMarked, X } from "lucide-react";
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
  bypassPayment?: boolean;
}

const BASIC_SUGGESTIONS: Record<string, { tip: string; locked: string }> = {
  photoQuality: {
    tip: "Replace group shots, blurry photos, or bathroom selfies with clear solo photos taken in natural light. Every photo should pass a quick test: does this make someone want to know more about me?",
    locked: "Which specific photos to swap and exactly what order they should appear in",
  },
  attractionSignals: {
    tip: "Your lead photo should show your face clearly — no sunglasses, no hats, no group shots. A genuine smile and natural eye contact are the two highest-converting signals on any app.",
    locked: "A photo-by-photo breakdown of what each shot is signaling and how to fix it",
  },
  personalitySignals: {
    tip: "Replace at least one generic prompt with a specific story, strong opinion, or niche interest. 'I love hiking and trying new restaurants' doesn't tell anyone anything. Find the detail only you would say.",
    locked: "Specific coaching on each of your prompts with direction on exactly what to change",
  },
  matchTargeting: {
    tip: "Include at least one specific, slightly polarizing detail — a niche hobby, a strong opinion, or an unusual trait. Generic profiles attract no one. Specific profiles attract the right people.",
    locked: "Platform-specific targeting analysis based on your actual content",
  },
  firstImpression: {
    tip: "In under 2 seconds a swiper sees your lead photo and maybe your first line. Make sure both stop the scroll: your best photo first, your sharpest prompt line up front.",
    locked: "Your optimal photo order and which prompt to lead with for maximum first-impression impact",
  },
};

function BasicSuggestions({ score, onFullReport }: { score: ProfileResult["score"]; onFullReport: () => void }) {
  const freeCategories = [
    { key: "photoQuality" as const, label: "Photo Quality" },
    { key: "attractionSignals" as const, label: "Attraction Signals" },
    { key: "personalitySignals" as const, label: "Personality Signals" },
  ];
  const lockedCategories = [
    { key: "matchTargeting" as const, label: "Match Targeting" },
    { key: "firstImpression" as const, label: "First Impression" },
  ];

  const weakFree = freeCategories.filter((c) => score[c.key] < 70);
  const weakLocked = lockedCategories.filter((c) => score[c.key] < 70);
  if (weakFree.length === 0 && weakLocked.length === 0) return null;

  return (
    <div className="basic-suggestions-section">
      <h3 className="basic-suggestions-title">
        <Lightbulb size={18} /> Basic fixes to start with
      </h3>
      <p className="basic-suggestions-sub">
        These are direction-level tips. The Full Report gives you the exact specifics.
      </p>
      <div className="basic-suggestions-list">
        {weakFree.map((cat) => {
          const s = BASIC_SUGGESTIONS[cat.key];
          return (
            <div key={cat.key} className="basic-suggestion-item">
              <div className="basic-suggestion-header">
                <span className="basic-suggestion-label">{cat.label}</span>
                <span className="basic-suggestion-score">{score[cat.key]}/100</span>
              </div>
              <p className="basic-suggestion-tip">{s.tip}</p>
              <div className="basic-suggestion-locked">
                <Lock size={11} />
                <span>Full Report: {s.locked}</span>
              </div>
            </div>
          );
        })}
        {weakLocked.map((cat) => (
          <div key={cat.key} className="basic-suggestion-item basic-suggestion-item--locked" onClick={onFullReport}>
            <div className="basic-suggestion-header">
              <span className="basic-suggestion-label">{cat.label}</span>
              <span className="basic-suggestion-score basic-suggestion-score--locked">
                <Lock size={11} /> Full Report
              </span>
            </div>
            <div className="basic-suggestion-tip basic-suggestion-tip--blurred">
              Your profile is sending mixed signals to the people you most want to attract.
            </div>
            <div className="basic-suggestion-locked">
              <Lock size={11} />
              <span>{BASIC_SUGGESTIONS[cat.key].locked}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Results({ result, profileInput, onStartOver, onFullReport, onBundle, fullReportViewed, user, onSignIn, bypassPayment }: Props) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stripe/prices')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, string> = {};
        for (const price of data.data ?? []) {
          const type = price.product?.metadata?.type;
          if (type) map[type] = price.id;
        }
        setPrices(map);
      })
      .catch(() => {});
  }, []);

  const handleCheckout = async (type: 'full-report' | 'profile-pack') => {
    if (bypassPayment) {
      onFullReport();
      return;
    }
    const priceId = prices[type];
    if (!priceId) {
      setCheckoutError('Payment not available right now. Please try again.');
      return;
    }
    setCheckoutLoading(type);
    setCheckoutError(null);
    try {
      sessionStorage.setItem('magnet_pending_purchase', JSON.stringify({
        result,
        profileInput,
        productType: type,
      }));

      const token = localStorage.getItem('magnet_token');
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          priceId,
          analysisId: result.analysisId,
          productType: type,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        sessionStorage.removeItem('magnet_pending_purchase');
        setCheckoutError(data.error || 'Checkout failed. Please try again.');
      }
    } catch {
      sessionStorage.removeItem('magnet_pending_purchase');
      setCheckoutError('Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const { score, feedback } = result;

  const profileTypeColor = {
    "high-signal": "#22c55e",
    "generic": "#eab308",
    "entertainment": "#8b5cf6",
  };

  const scoreCategories = [
    { key: "photoQuality" as const, label: "Photo Quality", locked: false },
    { key: "attractionSignals" as const, label: "Attraction Signals", locked: false },
    { key: "personalitySignals" as const, label: "Personality Signals", locked: false },
    { key: "matchTargeting" as const, label: "Match Targeting", locked: true },
    { key: "firstImpression" as const, label: "First Impression", locked: true },
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
                  className={`breakdown-row ${!cat.locked && cat.key === lowestCategory.key ? "weakest" : ""} ${cat.locked ? "breakdown-row--locked" : ""}`}
                >
                  <span className="breakdown-label">{cat.label}</span>
                  {cat.locked ? (
                    <>
                      <div className="breakdown-bar-wrap breakdown-bar-wrap--blurred">
                        <div className="breakdown-bar" style={{ width: "65%" }} />
                      </div>
                      <span className="breakdown-value breakdown-value--locked">
                        <Lock size={11} />
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="breakdown-bar-wrap">
                        <div className="breakdown-bar" style={{ width: `${score[cat.key]}%` }} />
                      </div>
                      <span className="breakdown-value">{score[cat.key]}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button className="breakdown-unlock-cta" onClick={onFullReport}>
              <Lock size={12} />
              Unlock Match Targeting &amp; First Impression with Full Report
            </button>
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
            {[...Array(2)].map((_, i) => (
              <li key={`locked-${i}`} className="mistakes-list-item--locked">
                <span className="fix-number fix-number--locked">{feedback.mistakes.slice(0, 3).length + i + 1}</span>
                <span className="mistakes-item-blurred">
                  {i === 0
                    ? "Your match targeting signals are sending the wrong message to your ideal type"
                    : "First impression context is misaligned — here's how to reframe it"}
                </span>
                <span className="mistakes-lock-badge"><Lock size={11} /> Full Report</span>
              </li>
            ))}
          </ul>
          <button className="breakdown-unlock-cta" onClick={onFullReport} style={{ marginTop: 12 }}>
            <Lock size={12} />
            See all fixes in the Full Report
          </button>
        </div>

        <BasicSuggestions score={score} onFullReport={onFullReport} />

        {feedback.leadPhotoTeaser && (
          <div className="basic-suggestion-item basic-suggestion-item--locked" onClick={onFullReport} style={{ cursor: "pointer" }}>
            <div className="basic-suggestion-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>📸</span>
                <span className="basic-suggestion-label">Lead Photo Intel</span>
              </div>
              <span className="basic-suggestion-score basic-suggestion-score--locked">
                <Lock size={11} /> Full Report
              </span>
            </div>
            <p className="basic-suggestion-tip basic-suggestion-tip--blurred" style={{ fontStyle: "italic" }}>
              {feedback.leadPhotoTeaser}
            </p>
            <div className="basic-suggestion-locked">
              <Lock size={11} />
              <span>Unlock to see the exact photo that should be your lead — and why</span>
            </div>
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

        <div className="upgrade-section">
          <h3 className="upgrade-title">Get the full fix, not just the diagnosis</h3>
          <p className="upgrade-subtitle">
            The Full Report tells you <em>exactly</em> what to change and how — per photo, per prompt, in order.
          </p>

          <div className="pricing-cards">
            {!fullReportViewed && (
              <div className="pricing-card">
                <div className="pricing-card-header">
                  <div className="pricing-icon">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h4>Full Report</h4>
                    <p className="pricing-tagline">One-time deep dive</p>
                  </div>
                </div>
                <div className="pricing-price">
                  <span className="price-amount">$4.99</span>
                  <span className="price-period">one time</span>
                </div>
                <ul className="pricing-features">
                  <li><Zap size={14} /> Per-photo breakdown — exactly what each photo signals</li>
                  <li><Zap size={14} /> Prompt coaching — what's wrong with each one & how to fix it</li>
                  <li><Zap size={14} /> Photo swap picks — your uploaded extras compared to your current lineup, with exact swap suggestions and side-by-side previews</li>
                  <li><Zap size={14} /> Optimal photo order — ranked 1–6 with reasoning</li>
                  <li><Zap size={14} /> Category-level AI analysis written about your profile</li>
                </ul>
                <button
                  className="pricing-btn"
                  onClick={() => handleCheckout('full-report')}
                  disabled={checkoutLoading === 'full-report'}
                >
                  {checkoutLoading === 'full-report' ? 'Loading…' : <><span>{bypassPayment ? 'Preview Full Report' : 'Get Full Report'}</span> <ArrowRight size={16} /></>}
                </button>
              </div>
            )}

            <div className="pricing-card featured">
              <div className="pricing-badge">Best Value</div>
              <div className="pricing-card-header">
                <div className="pricing-icon featured-icon">
                  <Layers size={22} />
                </div>
                <div>
                  <h4>Profile Pack</h4>
                  <p className="pricing-tagline">3 full reports · $3.66 each</p>
                </div>
              </div>
              <div className="pricing-price">
                <span className="price-amount">$10.99</span>
                <span className="price-period">one time</span>
              </div>
              <ul className="pricing-features">
                <li><Zap size={14} /> Everything in the Full Report — for 3 separate dating app profiles</li>
                <li><Zap size={14} /> Per-photo breakdown with exact swap suggestions on each profile</li>
                <li><Zap size={14} /> Prompt coaching & optimal photo order for each profile</li>
                <li><Zap size={14} /> Category-level AI analysis written per profile</li>
                <li><Zap size={14} /> Use across any platforms — Hinge, Tinder, Bumble & more</li>
                <li><Zap size={14} /> Never expires — use whenever you update your profiles</li>
              </ul>
              <button
                className="pricing-btn featured-btn"
                onClick={() => handleCheckout('profile-pack')}
                disabled={checkoutLoading === 'profile-pack'}
              >
                {checkoutLoading === 'profile-pack' ? 'Loading…' : <><span>{bypassPayment ? 'Preview Profile Pack' : 'Get Profile Pack'}</span> <ArrowRight size={16} /></>}
              </button>
            </div>

          </div>
        </div>

        {checkoutError && (
          <p style={{ color: '#ef4444', textAlign: 'center', marginTop: '0.75rem', fontSize: '0.875rem' }}>
            {checkoutError}
          </p>
        )}

        {fullReportViewed && (
          <div className="results-footer">
            <button className="pricing-btn" style={{ width: "100%" }} onClick={onFullReport}>
              <FileText size={15} /> View Full Report
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
