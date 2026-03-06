import { ArrowRight, Flame, Target, Sparkles, TrendingUp, Zap, Shield } from "lucide-react";

interface Props {
  onStart: () => void;
}

export function Landing({ onStart }: Props) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="badge">
          <Flame size={14} />
          <span>Profile Reality Check</span>
        </div>
        <h1>
          Your dating profile is
          <span className="gradient-text"> sending the wrong signals </span>
        </h1>
        <p className="subtitle">
          Dating apps reward certain signals. Most profiles accidentally send the wrong ones.
          Get a brutally honest score and fix what's killing your matches.
        </p>
        <button className="cta-button" onClick={onStart}>
          Get My Profile Score
          <ArrowRight size={20} />
        </button>
        <p className="cta-sub">Free analysis. Just enter your email to get started.</p>
        <p className="credibility-cue">
          <Shield size={14} />
          Built using behavioral patterns from high-performing profiles
        </p>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">
            <Target size={24} />
          </div>
          <h3>Match Targeting</h3>
          <p>Tell us who you want to attract. We'll show you exactly what signals to send.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <Sparkles size={24} />
          </div>
          <h3>Profile Score Card</h3>
          <p>Get scored across 5 dimensions: photo quality, attraction signals, personality, match targeting, and first impression.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <TrendingUp size={24} />
          </div>
          <h3>Full Optimization</h3>
          <p>Rewritten bio, better prompts, photo ordering, and tone adjustments. The whole package.</p>
        </div>
      </div>

      <div className="before-after-section">
        <h2 className="section-title">What a profile audit looks like</h2>
        <div className="before-after-grid">
          <div className="ba-card">
            <div className="ba-header before">
              <Zap size={16} />
              Before
            </div>
            <div className="ba-content">
              <div className="ba-score-row">
                <span className="ba-score bad">Score: 34/100</span>
                <span className="ba-type-tag generic">Generic Profile</span>
              </div>
              <p className="ba-bio">"Love traveling, good food, and adventures. Looking for my partner in crime. Dog dad. 6'1 if that matters."</p>
              <div className="ba-issues">
                <p className="ba-issue-title">Top issues:</p>
                <ul>
                  <li>Bio could belong to 4.7 million other people</li>
                  <li>First photo signals "friend energy" not attraction</li>
                  <li>Prompts give matches nothing to respond to</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="ba-card">
            <div className="ba-header after">
              <Sparkles size={16} />
              After Optimization
            </div>
            <div className="ba-content">
              <div className="ba-score-row">
                <span className="ba-score good">Score: 82/100</span>
                <span className="ba-type-tag high-signal">High-Signal Profile</span>
              </div>
              <p className="ba-bio">"I make a mean shakshuka at 2am and argue about architecture nobody asked about. Currently training for a half marathon I'll probably regret."</p>
              <div className="ba-fixes">
                <p className="ba-issue-title">What changed:</p>
                <ul>
                  <li>Replaced generic interests with specific personality signals</li>
                  <li>Lead photo swapped to candid with natural expression</li>
                  <li>Every prompt now creates a conversation opener</li>
                </ul>
              </div>
            </div>
          </div>
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
          <span className="proof-stat">3x</span>
          <span className="proof-label">more matches with a high-signal profile</span>
        </div>
      </div>
    </div>
  );
}
