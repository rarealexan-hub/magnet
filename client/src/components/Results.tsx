import { useState, useEffect } from "react";
import { Copy, Check, AlertTriangle, Crosshair, ArrowRight, Share2, FileText, Zap, Crown, Lock } from "lucide-react";
import type { ProfileResult, ProfileInput } from "@shared/types";
import { ScoreRing } from "./ScoreRing";
import { FeedbackSurvey } from "./FeedbackSurvey";

interface Props {
  result: ProfileResult;
  profileInput: ProfileInput;
  onStartOver: () => void;
  onFullReport: () => void;
  onDashboard: () => void;
  fullReportViewed?: boolean;
}

export function Results({ result, profileInput, onStartOver, onFullReport, onDashboard, fullReportViewed }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const { score, feedback } = result;

  const copyRoast = () => {
    navigator.clipboard.writeText(
      `MAGNET SCORE: ${score.overall}/100\n\n"${feedback.roast}"\n\nGet your Magnet score at magnet.app`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

        <div className="roast-card">
          <p className="roast-text">"{feedback.roast}"</p>
          <button className="copy-btn" onClick={copyRoast}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Share your roast"}
          </button>
        </div>

        <div className="mistakes-section">
          <h3>
            <AlertTriangle size={18} />
            Issues Detected
          </h3>
          <ul className="mistakes-list">
            {feedback.mistakes.map((mistake, i) => (
              <li key={i}>
                <span className="fix-number">{i + 1}</span>
                {mistake}
              </li>
            ))}
          </ul>
        </div>

        <div className="upgrade-section">
          <h3 className="upgrade-title">Ready to fix your profile?</h3>
          <p className="upgrade-subtitle">
            You've seen the problems. Now get the solutions.
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
                  <span className="price-amount">$2.99</span>
                  <span className="price-period">one time</span>
                </div>
                <ul className="pricing-features">
                  <li><Zap size={14} /> Detailed photo-by-photo analysis</li>
                  <li><Zap size={14} /> Exact bio & prompt rewrites</li>
                  <li><Zap size={14} /> Photo swap recommendations from your uploads</li>
                  <li><Zap size={14} /> Optimal photo order suggestion</li>
                  <li><Zap size={14} /> Platform-specific optimization tips</li>
                </ul>
                <button className="pricing-btn" onClick={onFullReport}>
                  Get Full Report <ArrowRight size={16} />
                </button>
              </div>
            )}

            <div className="pricing-card featured">
              <div className="pricing-badge">Best Value</div>
              <div className="pricing-card-header">
                <div className="pricing-icon featured-icon">
                  <Crown size={22} />
                </div>
                <div>
                  <h4>Magnet Pro</h4>
                  <p className="pricing-tagline">Unlimited optimization</p>
                </div>
              </div>
              <div className="pricing-price">
                <span className="price-amount">$12.99</span>
                <span className="price-period">/month</span>
              </div>
              <ul className="pricing-features">
                <li><Zap size={14} /> Everything in Full Report</li>
                <li><Zap size={14} /> Unlimited profile reviews</li>
                <li><Zap size={14} /> All platforms (Hinge, Tinder, Bumble)</li>
                <li><Zap size={14} /> Live dashboard monitoring</li>
                <li><Zap size={14} /> Algorithm change alerts</li>
                <li><Zap size={14} /> Priority AI analysis</li>
              </ul>
              <button className="pricing-btn featured-btn" onClick={onDashboard}>
                Go Pro <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="results-footer">
          <button className="share-roast-btn" onClick={copyRoast}>
            <Share2 size={16} />
            {copied ? "Copied!" : "Share your roast with friends"}
          </button>
          {fullReportViewed && (
            <button className="pricing-btn" style={{ width: "100%" }} onClick={onFullReport}>
              <FileText size={15} /> View Full Report
            </button>
          )}
          <div className="pro-locked-cta" onClick={onDashboard}>
            <div className="pro-locked-left">
              <Lock size={14} />
              <span>Analyze another platform</span>
            </div>
            <span className="pro-locked-badge"><Crown size={11} /> Pro only</span>
          </div>
        </div>

        <FeedbackSurvey
          page="results"
          platform={profileInput.platform}
          magnetScore={score.overall}
        />

      </div>
    </div>
  );
}
