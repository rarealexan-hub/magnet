import { useState } from "react";
import { ArrowLeft, Copy, Check, AlertTriangle, RotateCcw, Crosshair, ArrowRight, Share2, RefreshCw } from "lucide-react";
import type { ProfileResult, ProfileInput } from "@shared/types";
import { ScoreRing } from "./ScoreRing";

interface Props {
  result: ProfileResult;
  profileInput: ProfileInput;
  onBack: () => void;
  onStartOver: () => void;
}

export function Results({ result, profileInput, onBack, onStartOver }: Props) {
  const [copied, setCopied] = useState(false);

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
        <div className="results-header">
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={16} /> Edit profile
          </button>
          <button className="back-link" onClick={onStartOver}>
            <RotateCcw size={16} /> Start over
          </button>
        </div>

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

        <div className="results-next-steps">
          <h3 className="next-steps-title">What's next?</h3>
          <p className="next-steps-subtitle">
            Now you know what's holding your profile back. Here's how to move forward.
          </p>
          <div className="next-steps-grid">
            <div className="next-step-card">
              <div className="next-step-icon">
                <RefreshCw size={20} />
              </div>
              <h4>Fix & Resubmit</h4>
              <p>Make the changes above, then analyze your updated profile to see your new score.</p>
              <button className="next-step-btn" onClick={onBack}>
                Edit Profile <ArrowRight size={14} />
              </button>
            </div>
            <div className="next-step-card">
              <div className="next-step-icon">
                <Share2 size={20} />
              </div>
              <h4>Share Your Score</h4>
              <p>Challenge your friends to beat your Magnet Score. See who has the best profile.</p>
              <button className="next-step-btn" onClick={copyRoast}>
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Roast</>}
              </button>
            </div>
          </div>
          <button className="results-start-over-btn" onClick={onStartOver}>
            Analyze a Different Profile <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}
