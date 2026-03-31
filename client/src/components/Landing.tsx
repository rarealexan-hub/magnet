import { useState } from "react";
import { ArrowRight, Magnet as MagnetIcon, Target, Sparkles, TrendingUp, Zap, X, Check, Quote } from "lucide-react";

interface Props {
  onStart: () => void;
}

const TESTIMONIALS = [
  {
    quote: "Went from 2 matches a week to like 11. The photo feedback alone was worth it.",
    name: "Marcus T.",
    detail: "Hinge · 3 weeks after",
  },
  {
    quote: "I didn't realize my bio was actively repelling the type of person I wanted. Fixed it in an afternoon.",
    name: "Priya K.",
    detail: "Bumble · 1 month after",
  },
  {
    quote: "The prompt rewrite suggestions were eerily good. Got a date from the first new opener I tried.",
    name: "Jake R.",
    detail: "Hinge · 2 weeks after",
  },
  {
    quote: "Scored a 31 on first run. Felt personally attacked. Got to 74 after two rounds of fixes. Actually works.",
    name: "Chloe M.",
    detail: "Tinder · 6 weeks after",
  },
];

export function Landing({ onStart }: Props) {
  const [baView, setBaView] = useState<"before" | "after">("before");

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="badge">
          <MagnetIcon size={18} />
          <span>Magnet</span>
        </div>
        <h1>
          Your dating profile is
          <span className="gradient-text"> sending the wrong signals.</span>
        </h1>
        <p className="subtitle">
          Magnet scores your profile across five dimensions and shows you exactly what to fix — photos, prompts, first impression, and who you're signaling to.
        </p>
        <p className="subtitle-small">
          The analysis your best friend wishes they could give you.
        </p>
        <button className="cta-button" onClick={onStart}>
          Analyze My Profile
          <ArrowRight size={16} />
        </button>
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
                <p className="ba-bio">"I make a mean shakshuka at 2am and argue about architecture nobody asked about. Currently training for a half marathon I'll probably regret."</p>
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
          <div className="feature-icon">
            <Target size={20} />
          </div>
          <h3>Match Targeting</h3>
          <p>Tell Magnet who you want to attract. It shows you the exact signals your profile is sending — and whether they're reaching the right people.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <Sparkles size={20} />
          </div>
          <h3>Magnet Score</h3>
          <p>Scored across five dimensions: photo quality, attraction signals, personality, match targeting, and first impression. You see exactly where you fall short.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <TrendingUp size={20} />
          </div>
          <h3>Guided Optimization</h3>
          <p>Not just what's wrong — the Full Report tells you what to change, how to change it, and why it will perform better.</p>
        </div>
      </div>

      <div className="wall-of-love">
        <p className="section-title">Wall of Love</p>
        <div className="testimonial-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="testimonial-card">
              <Quote size={16} className="testimonial-quote-icon" />
              <p className="testimonial-text">{t.quote}</p>
              <div className="testimonial-footer">
                <span className="testimonial-name">{t.name}</span>
                <span className="testimonial-detail">{t.detail}</span>
              </div>
            </div>
          ))}
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
