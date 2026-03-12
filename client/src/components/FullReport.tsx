import { ArrowLeft, FileText, Zap, Camera, Type, Layout, ArrowRight, ArrowLeftRight, PlusCircle, MinusCircle, MoveVertical } from "lucide-react";
import type { ProfileResult, ProfileInput } from "@shared/types";
import { ScoreRing } from "./ScoreRing";
import { FeedbackSurvey } from "./FeedbackSurvey";

interface Props {
  result: ProfileResult;
  profileInput: ProfileInput;
  onBack: () => void;
}

export function FullReport({ result, profileInput, onBack }: Props) {
  const { score, feedback } = result;
  const platform = profileInput.platform || "dating app";

  const scoreCategories = [
    { key: "photoQuality" as const, label: "Photo Quality", icon: Camera },
    { key: "attractionSignals" as const, label: "Attraction Signals", icon: Zap },
    { key: "personalitySignals" as const, label: "Personality Signals", icon: Type },
    { key: "matchTargeting" as const, label: "Match Targeting", icon: Layout },
    { key: "firstImpression" as const, label: "First Impression", icon: FileText },
  ];

  return (
    <div className="results-page">
      <div className="results-container">
        <div className="results-header">
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Results
          </button>
        </div>

        <div className="report-hero">
          <div className="report-hero-badge">Full Report</div>
          <h2 className="report-hero-title">
            Your {platform.charAt(0).toUpperCase() + platform.slice(1)} Profile Report
          </h2>
          <p className="report-hero-subtitle">
            Detailed analysis with actionable fixes to improve your Magnet Score.
          </p>
          <div className="report-hero-score">
            <ScoreRing score={score.overall} size={120} />
          </div>
        </div>

        {scoreCategories.map((cat) => {
          const Icon = cat.icon;
          const catScore = score[cat.key];
          return (
            <div key={cat.key} className="report-section-card">
              <div className="report-section-header">
                <div className="report-section-icon">
                  <Icon size={18} />
                </div>
                <h3>{cat.label}</h3>
                <span className={`report-section-score ${catScore >= 70 ? "good" : catScore >= 40 ? "mid" : "low"}`}>
                  {catScore}/100
                </span>
              </div>
              <div className="report-section-body">
                <p className="report-section-analysis">
                  {cat.key === "photoQuality" && "Your photos were evaluated for lighting, composition, resolution, and variety. A strong profile needs at least 4-6 high-quality photos showing different sides of your life."}
                  {cat.key === "attractionSignals" && "We looked at body language, eye contact, smile authenticity, and overall confidence conveyed through your photos and bio."}
                  {cat.key === "personalitySignals" && "Your prompts, bio, and photos were analyzed for personality depth, humor, and authenticity. Generic content scores low here."}
                  {cat.key === "matchTargeting" && "How well does your profile speak to the type of person you want to attract? Broad, unfocused profiles perform worse than targeted ones."}
                  {cat.key === "firstImpression" && "Your lead photo and opening line are everything. We evaluated the first 2 seconds of your profile experience."}
                </p>
                {catScore < 70 && (
                  <div className="report-fix-box">
                    <p className="report-fix-title">How to improve</p>
                    <p className="report-fix-text">
                      {cat.key === "photoQuality" && "Replace any blurry, dark, or group-heavy photos. Lead with a clear, well-lit solo shot. Add variety — show hobbies, travel, social settings."}
                      {cat.key === "attractionSignals" && "Use photos where you're genuinely smiling and making eye contact. Avoid crossed arms or sunglasses in your main photo."}
                      {cat.key === "personalitySignals" && "Rewrite generic prompts ('I love to travel') with specific stories. Show don't tell — 'I once got lost in Tokyo for 6 hours and it was the best day' beats 'I love adventure.'"}
                      {cat.key === "matchTargeting" && "Define who you want to attract and tailor your content. If you want someone active, show yourself being active — not just saying you like hiking."}
                      {cat.key === "firstImpression" && "Your first photo should be a clear headshot or upper body shot with good lighting. No sunglasses, no group photos, no heavy filters."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {profileInput.additionalPhotos && profileInput.additionalPhotos.length > 0 && (
          <div className="report-section-card photo-swap-card">
            <div className="report-section-header">
              <div className="report-section-icon">
                <Camera size={18} />
              </div>
              <h3>Photo Swap Recommendations</h3>
              <span className="report-section-badge">{profileInput.additionalPhotos.length} extra photo{profileInput.additionalPhotos.length > 1 ? "s" : ""} reviewed</span>
            </div>
            <div className="report-section-body">
              <p className="report-section-analysis">
                Your additional photos were compared against your current lineup. Here's what to swap, add, or remove to maximize your profile's impact.
              </p>
              {result.feedback.photoSwapRecommendations && result.feedback.photoSwapRecommendations.length > 0 ? (
                <div className="swap-recommendations">
                  {result.feedback.photoSwapRecommendations.map((rec, i) => {
                    const actionIcon = rec.action === "swap" ? <ArrowLeftRight size={14} />
                      : rec.action === "add" ? <PlusCircle size={14} />
                      : rec.action === "remove" ? <MinusCircle size={14} />
                      : <MoveVertical size={14} />;
                    const actionLabel = rec.action === "swap" ? "Swap"
                      : rec.action === "add" ? "Add"
                      : rec.action === "remove" ? "Remove"
                      : "Reorder";
                    return (
                      <div key={i} className="swap-rec-item">
                        <div className="swap-rec-header">
                          <span className={`swap-action-badge swap-action-${rec.action}`}>
                            {actionIcon} {actionLabel}
                          </span>
                          {rec.currentPhoto && rec.additionalPhoto && (
                            <span className="swap-photo-label">
                              {rec.currentPhoto} → {rec.additionalPhoto}
                            </span>
                          )}
                          {rec.currentPhoto && !rec.additionalPhoto && (
                            <span className="swap-photo-label">{rec.currentPhoto}</span>
                          )}
                          {rec.additionalPhoto && !rec.currentPhoto && (
                            <span className="swap-photo-label">{rec.additionalPhoto}</span>
                          )}
                        </div>
                        <p className="swap-rec-reason">{rec.reason}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="report-fix-box">
                  <p className="report-fix-title">General recommendation</p>
                  <p className="report-fix-text">
                    Compare your additional photos against your current profile. Swap in photos with better lighting, clearer expressions, and more variety. Your strongest photo should always be first.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="report-section-card">
          <div className="report-section-header">
            <div className="report-section-icon">
              <Type size={18} />
            </div>
            <h3>Bio & Prompt Rewrites</h3>
          </div>
          <div className="report-section-body">
            <p className="report-section-analysis">
              Your current bio and prompts were analyzed for engagement potential. Below are optimized versions tailored to {platform}.
            </p>
            <div className="report-fix-box">
              <p className="report-fix-title">Optimized approach</p>
              <p className="report-fix-text">
                Lead with a hook, add humor or a specific detail, and end with something that invites conversation. Avoid listing traits — tell a micro-story instead.
              </p>
            </div>
          </div>
        </div>

        <FeedbackSurvey
          page="full-report"
          platform={profileInput.platform}
          magnetScore={result.score.overall}
        />

        <div className="report-footer">
          <button className="results-start-over-btn" onClick={onBack}>
            Back to Results <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
