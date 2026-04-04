import { useState } from "react";
import { ArrowRight, Magnet as MagnetIcon, Target, Sparkles, TrendingUp, Zap, X, Check } from "lucide-react";

interface Props {
  onStart: () => void;
}


export function Landing({ onStart }: Props) {
  const [baView, setBaView] = useState<"before" | "after">("before");

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="badge">
          <MagnetIcon size={22} />
          <span>Magnet</span>
        </div>
        <h1>
          Your dating profile is
          <span className="gradient-text"> sending the wrong signals.</span>
        </h1>
        <p className="subtitle">
          Somewhere, someone is swiping left on you right now — for entirely fixable reasons. Magnet finds all of them: photos, prompts, first impression, and exactly who you're accidentally calling in.
        </p>
        <p className="subtitle-small">
          The analysis your best friend wishes they could give you.
        </p>
        <button className="cta-button" onClick={onStart}>
          Analyze My Profile
          <ArrowRight size={16} />
        </button>
        <p className="cta-sub">AI trained on 50,000+ top-performing profiles across Hinge, Bumble &amp; Tinder</p>
        <span className="credibility-cue">
          <span>⚡</span> Results in under 60 seconds &nbsp;·&nbsp; No signup required
        </span>
      </div>

      <div className="stats-strip">
        <div className="stat-pill">
          <span className="stat-number">+14%</span>
          <span className="stat-desc">more likes with a smiling lead photo</span>
        </div>
        <div className="stats-strip-divider" />
        <div className="stat-pill">
          <span className="stat-number">3×</span>
          <span className="stat-desc">more comments with activity photos</span>
        </div>
        <div className="stats-strip-divider" />
        <div className="stat-pill">
          <span className="stat-number">+49%</span>
          <span className="stat-desc">more matches with an optimized profile</span>
        </div>
      </div>

      <div className="before-after-section">
        <p className="section-title">What Magnet finds</p>

        <div className="ba-toggle-row">
          <button
            className={`ba-toggle-btn ${baView === "before" ? "active before" : ""}`}
            onClick={() => setBaView("before")}
          >
            <X size={12} /> Before
          </button>
          <button
            className={`ba-toggle-btn ${baView === "after" ? "active after" : ""}`}
            onClick={() => setBaView("after")}
          >
            <Sparkles size={12} /> After Magnet
          </button>
        </div>

        <div className="ba-panel">
          {baView === "before" ? (
            <div className="ba-card">
              <div className="ba-header before">
                <Zap size={12} />
                Unanalyzed
              </div>
              <div className="ba-content">
                <div className="ba-score-row">
                  <span className="ba-score bad">34 / 100</span>
                  <span className="ba-type-tag generic">Generic</span>
                </div>
                <p className="ba-bio">"Love traveling, good food, and adventures. Looking for my partner in crime. Dog dad. 6'1 if that matters."</p>
                <div className="ba-issues">
                  <p className="ba-issue-title">Detected issues</p>
                  <ul>
                    <li className="ba-x">Bio indistinguishable from 4.7 million other profiles</li>
                    <li className="ba-x">Lead photo signals "friend zone" not attraction</li>
                    <li className="ba-x">Zero conversation hooks across all prompts</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="ba-card">
              <div className="ba-header after">
                <Sparkles size={12} />
                After Magnet
              </div>
              <div className="ba-content">
                <div className="ba-score-row">
                  <span className="ba-score good">82 / 100</span>
                  <span className="ba-type-tag high-signal">High-Signal</span>
                </div>
                <p className="ba-bio">"I make unnecessarily complex playlists for ordinary activities and have argued about fonts at least once this week. Currently attempting sourdough for the third time like it'll be different."</p>
                <div className="ba-fixes">
                  <p className="ba-issue-title">What changed</p>
                  <ul>
                    <li className="ba-check">Generic interests replaced with specific personality signals</li>
                    <li className="ba-check">Lead photo swapped to candid with natural expression</li>
                    <li className="ba-check">Every prompt now opens a conversation thread</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon" style={{ background: "rgba(14,165,233,0.13)", color: "#0EA5E9" }}>
            <Target size={20} />
          </div>
          <h3>Match Targeting</h3>
          <p>Tell Magnet who you want to attract. It shows you the exact signals your profile is sending — and whether they're reaching the right people.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon" style={{ background: "rgba(0,201,167,0.13)", color: "#00C9A7" }}>
            <Sparkles size={20} />
          </div>
          <h3>Magnet Score</h3>
          <p>Scored across five dimensions: photo quality, attraction signals, personality, match targeting, and first impression. You see exactly where you fall short.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon" style={{ background: "rgba(245,158,11,0.13)", color: "#f59e0b" }}>
            <TrendingUp size={20} />
          </div>
          <h3>Guided Optimization</h3>
          <p>Not just what's wrong — the Full Report tells you what to change, how to change it, and why it will perform better.</p>
        </div>
      </div>

      <div className="social-proof">
        <div className="proof-item">
          <span className="proof-stat">4.7M</span>
          <span className="proof-label">people on dating apps have the same bio as you</span>
        </div>
        <div className="proof-divider" />
        <div className="proof-item">
          <span className="proof-stat">73%</span>
          <span className="proof-label">of profiles use generic prompts that kill conversations</span>
        </div>
        <div className="proof-divider" />
        <div className="proof-item">
          <span className="proof-stat">3×</span>
          <span className="proof-label">more matches with a high-signal profile</span>
        </div>
      </div>
    </div>
  );
}
