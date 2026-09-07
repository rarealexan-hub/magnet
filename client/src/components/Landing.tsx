import { useState } from "react";
import { ArrowRight, Magnet as MagnetIcon, Target, Sparkles, TrendingUp, Zap, X } from "lucide-react";

interface Props {
  onStart: () => void;
  onPrivacy: () => void;
}

export function Landing({ onStart, onPrivacy }: Props) {
  const [baView, setBaView] = useState<"before" | "after">("before");

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-hero-topline">
          <div className="badge">
            <MagnetIcon size={20} strokeWidth={2.2} />
            <span>Magnet</span>
          </div>
          <span className="landing-hero-note">AI-assisted, framework-led profile feedback.</span>
        </div>
        <div className="landing-hero-copy">
          <p className="landing-kicker">Magnet Profile Audit</p>
          <h1>
              See exactly what your profile is
              <span className="gradient-text"> really saying.</span>
          </h1>
          <div className="landing-hero-detail">
            <p className="subtitle">
              Upload your profile and get one complete audit: photos, prompts, first impression, accidental signals, rewrites, and the changes most likely to improve your results.
            </p>
            <p className="subtitle-small">The honest breakdown no one else will give you.</p>
            <button className="cta-button" onClick={onStart}>
              Start your Profile Audit
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="landing-hero-mark" aria-hidden="true">M</div>
      </section>

      <section className="stats-strip" aria-label="Profile performance benchmarks">
        <p className="stats-strip-label">Small changes. Noticeable difference.</p>
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
      </section>

      <section className="before-after-section">
        <div className="landing-section-intro">
          <p className="section-title">A profile, with the subtext included</p>
          <h2>See what people see.</h2>
          <p>Magnet doesn't polish your profile into someone else. It explains the signal you're already sending, then gives you a clearer way forward.</p>
        </div>
        <div className="ba-toggle-row" role="tablist" aria-label="Highlight an analysis">
          <button className={`ba-toggle-btn ${baView === "before" ? "active before" : ""}`} onClick={() => setBaView("before")} role="tab" aria-selected={baView === "before"}>
            <X size={12} /> Before
          </button>
          <button className={`ba-toggle-btn ${baView === "after" ? "active after" : ""}`} onClick={() => setBaView("after")} role="tab" aria-selected={baView === "after"}>
            <Sparkles size={12} /> After Magnet
          </button>
        </div>
        <div className="before-after-grid">
          <div className={`ba-card ${baView === "before" ? "is-focused" : ""}`}>
            <div className="ba-header before"><Zap size={12} /> Unanalyzed</div>
            <div className="ba-content">
              <div className="ba-score-row"><span className="ba-score bad">34 / 100</span><span className="ba-type-tag generic">Generic</span></div>
              <p className="ba-bio">"Love traveling, good food, and adventures. Looking for my partner in crime. Dog dad. 6'1 if that matters."</p>
              <div className="ba-issues"><p className="ba-issue-title">Detected issues</p><ul>
                <li className="ba-x">Bio indistinguishable from 4.7 million other profiles</li>
                <li className="ba-x">Lead photo signals "friend zone" not attraction</li>
                <li className="ba-x">Zero conversation hooks across all prompts</li>
              </ul></div>
            </div>
          </div>
          <div className={`ba-card ${baView === "after" ? "is-focused" : ""}`}>
            <div className="ba-header after"><Sparkles size={12} /> After Magnet</div>
            <div className="ba-content">
              <div className="ba-score-row"><span className="ba-score good">82 / 100</span><span className="ba-type-tag high-signal">High-Signal</span></div>
              <p className="ba-bio">"I make unnecessarily complex playlists for ordinary activities and have argued about fonts at least once this week. Currently attempting sourdough for the third time like it'll be different."</p>
              <div className="ba-fixes"><p className="ba-issue-title">What changed</p><ul>
                <li className="ba-check">Generic interests replaced with specific personality signals</li>
                <li className="ba-check">Lead photo swapped to candid with natural expression</li>
                <li className="ba-check">Every prompt now opens a conversation thread</li>
              </ul></div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-grid">
        <div className="feature-card feature-card-large">
          <div className="feature-icon" style={{ background: "rgba(26,24,22,0.06)", color: "#1A1816" }}><Target size={20} /></div>
          <p className="feature-index">01 / WHO YOU'RE CALLING IN</p>
          <h3>Match Targeting</h3>
          <p>Tell Magnet who you want to attract. It shows you the exact signals your profile is sending — and whether they're reaching the right people.</p>
        </div>
        <div className="feature-card feature-card-dark">
          <div className="feature-icon" style={{ background: "rgba(250,249,247,0.12)", color: "#FAF9F7" }}><Sparkles size={20} /></div>
          <p className="feature-index">02 / THE NUMBER, EXPLAINED</p>
          <h3>Magnet Score</h3>
          <p>Scored across five dimensions: photo quality, attraction signals, personality, match targeting, and first impression. You see exactly where you fall short.</p>
        </div>
        <div className="feature-card feature-card-wide">
          <div className="feature-icon" style={{ background: "rgba(26,24,22,0.06)", color: "#1A1816" }}><TrendingUp size={20} /></div>
          <p className="feature-index">03 / WHAT TO DO NEXT</p>
          <h3>Guided Optimization</h3>
          <p>One complete report tells you what to change, how to change it, and why it will perform better on your app.</p>
          <span className="feature-arrow"><ArrowRight size={18} /></span>
        </div>
      </section>

      <section className="social-proof">
        <p className="proof-eyebrow">The numbers behind the awkward truth</p>
        <div className="proof-item"><span className="proof-stat">4.7M</span><span className="proof-label">people on dating apps have the same bio as you</span></div>
        <div className="proof-item"><span className="proof-stat">73%</span><span className="proof-label">of profiles use generic prompts that kill conversations</span></div>
        <div className="proof-item"><span className="proof-stat">3×</span><span className="proof-label">more matches with a high-signal profile</span></div>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-copy">© {new Date().getFullYear()} Magnet</span>
        <span className="landing-footer-dot">·</span>
        <button className="landing-footer-link" onClick={onPrivacy}>Privacy Policy</button>
        <span className="landing-footer-dot">·</span>
        <a className="landing-footer-link" href="mailto:hello@trymagnetapp.com">Contact</a>
      </footer>
    </main>
  );
}