import { ArrowRight, Flame, Target, Sparkles, TrendingUp } from "lucide-react";

interface Props {
  onStart: () => void;
}

export function Landing({ onStart }: Props) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="badge">
          <Flame size={14} />
          <span>The Dating Profile Audit</span>
        </div>
        <h1>
          Your dating profile is probably
          <span className="gradient-text"> repelling </span>
          the people you actually want
        </h1>
        <p className="subtitle">
          Dating apps reward good profiles. Most people build theirs wrong.
          Get a brutally honest score, find out what's killing your matches,
          and learn exactly how to fix it.
        </p>
        <button className="cta-button" onClick={onStart}>
          Audit My Profile
          <ArrowRight size={20} />
        </button>
        <p className="cta-sub">Free analysis. No signup required.</p>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">
            <Target size={24} />
          </div>
          <h3>Match Targeting</h3>
          <p>Tell us who you want to attract. We'll rewrite your profile to speak directly to them.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <Sparkles size={24} />
          </div>
          <h3>Profile Score</h3>
          <p>Get scored on specificity, conversation hooks, authenticity, and photo strategy.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <TrendingUp size={24} />
          </div>
          <h3>Full Optimization</h3>
          <p>Rewritten bio, better prompts, photo ordering, and tone adjustments. The whole package.</p>
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
