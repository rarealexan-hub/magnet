import { useState, useEffect } from "react";
import { ArrowLeft, Copy, Check, Lock, Sparkles, AlertTriangle, Loader2, RotateCcw, Crosshair, Zap, Crown } from "lucide-react";
import type { ProfileResult, ProfileInput, FullOptimizationResult } from "@shared/types";
import { ScoreRing } from "./ScoreRing";

interface Props {
  result: ProfileResult;
  profileInput: ProfileInput;
  onBack: () => void;
  onStartOver: () => void;
  onUpgrade: (result: FullOptimizationResult) => void;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata: { tier?: string; features?: string };
  prices: { id: string; unit_amount: number; currency: string }[];
}

export function Results({ result, profileInput, onBack, onStartOver, onUpgrade }: Props) {
  const [copied, setCopied] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    if (!result.isPaid) {
      fetch("/api/products")
        .then((r) => r.json())
        .then((data) => setProducts(data.products || []))
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }
  }, [result.isPaid]);

  const { score, feedback } = result;

  const copyRoast = () => {
    navigator.clipboard.writeText(
      `My dating profile scored ${score.overall}/100\n\n"${feedback.roast}"\n\nGet your profile audited too`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckout = async (priceId: string) => {
    setUpgrading(true);
    setUpgradeError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, profileInput }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setUpgradeError("Something went wrong. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  const profileTypeColor = {
    "high-signal": "#2cb67d",
    "generic": "#f2a93b",
    "entertainment": "#8b5cf6",
  };

  const scoreCategories = [
    { key: "specificity" as const, label: "Specificity" },
    { key: "conversationHooks" as const, label: "Conversation Hooks" },
    { key: "authenticity" as const, label: "Authenticity" },
    { key: "photoStrategy" as const, label: "Photo Strategy" },
  ];

  const lowestCategory = scoreCategories.reduce(
    (min, cat) => (score[cat.key] < score[min.key] ? cat : min),
    scoreCategories[0]
  );

  const proProduct = products.find((p) => p.metadata?.tier === "pro");
  const premiumProduct = products.find((p) => p.metadata?.tier === "premium");

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
            <p className="score-card-title">Dating Profile Score</p>
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
            Top Fixes
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

        {result.isPaid ? (
          <PaidResults result={result as FullOptimizationResult} />
        ) : (
          <div className="upgrade-section">
            <h3 className="pricing-title">Unlock Full Optimization</h3>
            <p className="pricing-subtitle">
              Get your profile completely rewritten to attract exactly who you want.
            </p>

            <div className="pricing-grid">
              <div className="pricing-card free">
                <div className="pricing-card-header">
                  <Sparkles size={20} />
                  <h4>Free</h4>
                </div>
                <div className="pricing-price">
                  <span className="price-amount">$0</span>
                </div>
                <ul className="pricing-features">
                  <li><Check size={14} /> Profile score + breakdown</li>
                  <li><Check size={14} /> Witty roast</li>
                  <li><Check size={14} /> Top 3 mistakes identified</li>
                  <li className="disabled"><Lock size={14} /> Bio rewrite</li>
                  <li className="disabled"><Lock size={14} /> Prompt optimization</li>
                  <li className="disabled"><Lock size={14} /> Photo strategy</li>
                </ul>
                <p className="pricing-note">You're on this plan</p>
              </div>

              <div className="pricing-card pro highlighted">
                <div className="pricing-popular-badge">Most Popular</div>
                <div className="pricing-card-header">
                  <Zap size={20} />
                  <h4>Profile Optimization</h4>
                </div>
                <div className="pricing-price">
                  <span className="price-amount">$19</span>
                  <span className="price-period">one-time</span>
                </div>
                <ul className="pricing-features">
                  <li><Check size={14} /> Everything in Free</li>
                  <li><Check size={14} /> Full bio rewrite</li>
                  <li><Check size={14} /> Optimized prompts (before/after)</li>
                  <li><Check size={14} /> Photo ordering strategy</li>
                  <li><Check size={14} /> Tone adjustments</li>
                  <li><Check size={14} /> Match targeting alignment</li>
                </ul>
                {upgradeError && <div className="form-error">{upgradeError}</div>}
                <button
                  className="pricing-btn pro"
                  onClick={() => {
                    if (proProduct?.prices[0]?.id) {
                      handleCheckout(proProduct.prices[0].id);
                    } else {
                      setUpgradeError("Unable to load pricing. Please refresh and try again.");
                    }
                  }}
                  disabled={upgrading || loadingProducts}
                >
                  {upgrading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      Processing...
                    </>
                  ) : (
                    "Get Full Optimization"
                  )}
                </button>
              </div>

              <div className="pricing-card premium">
                <div className="pricing-card-header">
                  <Crown size={20} />
                  <h4>Elite Optimization</h4>
                </div>
                <div className="pricing-price">
                  <span className="price-amount">$49</span>
                  <span className="price-period">one-time</span>
                </div>
                <ul className="pricing-features">
                  <li><Check size={14} /> Everything in Pro</li>
                  <li><Check size={14} /> All dating apps covered</li>
                  <li><Check size={14} /> Ongoing update suggestions</li>
                  <li><Check size={14} /> Priority support</li>
                  <li><Check size={14} /> Advanced photo analysis</li>
                  <li><Check size={14} /> Detailed match psychology</li>
                </ul>
                <button
                  className="pricing-btn premium"
                  onClick={() => {
                    if (premiumProduct?.prices[0]?.id) {
                      handleCheckout(premiumProduct.prices[0].id);
                    }
                  }}
                  disabled={upgrading || !premiumProduct}
                >
                  {upgrading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      Processing...
                    </>
                  ) : (
                    "Go Elite"
                  )}
                </button>
              </div>
            </div>
            <p className="pricing-footer">One-time payment. No subscription. No recurring charges.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PaidResults({ result }: { result: FullOptimizationResult }) {
  const [copiedBio, setCopiedBio] = useState(false);

  const copyBio = () => {
    navigator.clipboard.writeText(result.optimizedBio);
    setCopiedBio(true);
    setTimeout(() => setCopiedBio(false), 2000);
  };

  return (
    <div className="paid-results">
      <div className="optimization-section">
        <h3>
          <Sparkles size={18} />
          Your Optimized Bio
        </h3>
        <div className="optimized-bio">
          <p>{result.optimizedBio}</p>
          <button className="copy-btn small" onClick={copyBio}>
            {copiedBio ? <Check size={14} /> : <Copy size={14} />}
            {copiedBio ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {result.optimizedPrompts?.length > 0 && (
        <div className="optimization-section">
          <h3>
            <Sparkles size={18} />
            Optimized Prompts
          </h3>
          {result.optimizedPrompts.map((prompt, i) => (
            <div key={i} className="prompt-compare">
              <div className="prompt-before">
                <span className="prompt-tag before">Before</span>
                <p>{prompt.original}</p>
              </div>
              <div className="prompt-after">
                <span className="prompt-tag after">After</span>
                <p>{prompt.improved}</p>
              </div>
              <p className="prompt-reason">{prompt.reason}</p>
            </div>
          ))}
        </div>
      )}

      {result.photoAdvice?.length > 0 && (
        <div className="optimization-section">
          <h3>Photo Strategy</h3>
          {result.photoAdvice.map((photo, i) => (
            <div key={i} className="photo-advice-card">
              <div className="photo-position">#{photo.recommendedPosition}</div>
              <div>
                <p className="photo-desc">{photo.description}</p>
                <p className="photo-issue">{photo.issue}</p>
                <p className="photo-suggestion">{photo.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {result.signalsToRemove?.length > 0 && (
        <div className="optimization-section">
          <h3>
            <AlertTriangle size={18} />
            Signals to Remove
          </h3>
          <p className="section-subtitle">These are attracting the wrong people:</p>
          <ul className="signals-list">
            {result.signalsToRemove.map((signal, i) => (
              <li key={i}>{signal}</li>
            ))}
          </ul>
        </div>
      )}

      {result.toneAdjustments?.length > 0 && (
        <div className="optimization-section">
          <h3>Tone Adjustments</h3>
          <ul className="tone-list">
            {result.toneAdjustments.map((adj, i) => (
              <li key={i}>{adj}</li>
            ))}
          </ul>
        </div>
      )}

      {result.targetAlignment && (
        <div className="optimization-section">
          <h3>Target Alignment</h3>
          <p className="alignment-text">{result.targetAlignment}</p>
        </div>
      )}
    </div>
  );
}
