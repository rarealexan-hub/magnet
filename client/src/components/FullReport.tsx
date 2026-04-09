import { useState } from "react";
import { ArrowLeft, FileText, Zap, Camera, Type, Layout, ArrowRight, ArrowLeftRight, PlusCircle, MinusCircle, MoveVertical, ListOrdered, MessageSquare, AlertCircle, Lightbulb, Sparkles, Quote, TrendingUp, Users, ChevronRight, Copy, Check, TrendingDown, Minus, Send, Layers } from "lucide-react";
import type { ProfileResult, ProfileInput } from "@shared/types";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "@shared/types";
import { ScoreRing } from "./ScoreRing";


interface Props {
  result: ProfileResult;
  profileInput: ProfileInput;
  onBack: () => void;
  purchased?: boolean;
  purchaseType?: string | null;
  onAnalyzeAnother?: () => void;
}

function parsePhotoData(raw: string): { data: string; mimeType: string } | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.data && parsed.mimeType) return parsed;
  } catch {}
  return null;
}

function PhotoThumb({ raw, label }: { raw: string; label: string }) {
  const parsed = parsePhotoData(raw);
  if (!parsed) return null;
  return (
    <div className="photo-thumb-wrap">
      <img
        src={`data:${parsed.mimeType};base64,${parsed.data}`}
        alt={label}
        className="photo-thumb"
      />
      <span className="photo-thumb-label">{label}</span>
    </div>
  );
}

export function FullReport({ result, profileInput, onBack, purchased, purchaseType, onAnalyzeAnother }: Props) {
  const { score, feedback } = result;
  const platform = profileInput.platform || "other";
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [progressOutcome, setProgressOutcome] = useState<"improved" | "same" | "worse" | null>(null);
  const [progressNotes, setProgressNotes] = useState("");
  const [progressSubmitted, setProgressSubmitted] = useState(false);
  const [progressSubmitting, setProgressSubmitting] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const submitProgress = async () => {
    if (!progressOutcome) return;
    setProgressSubmitting(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: result.analysisId || null,
          userEmail: profileInput.email || null,
          outcome: progressOutcome,
          notes: progressNotes || null,
        }),
      });
      setProgressSubmitted(true);
    } catch {
      setProgressSubmitted(true);
    } finally {
      setProgressSubmitting(false);
    }
  };

  const scoreCategories = [
    { key: "photoQuality" as const, label: "Photo Quality", icon: Camera, analysisKey: "photoQuality" as const },
    { key: "attractionSignals" as const, label: "Attraction Signals", icon: Zap, analysisKey: "attractionSignals" as const },
    { key: "personalitySignals" as const, label: "Personality Signals", icon: Type, analysisKey: "personalitySignals" as const },
    { key: "matchTargeting" as const, label: "Match Targeting", icon: Layout, analysisKey: "matchTargeting" as const },
    { key: "firstImpression" as const, label: "First Impression", icon: FileText, analysisKey: "firstImpression" as const },
  ];

  const FALLBACK_ANALYSIS: Record<string, string> = {
    photoQuality: "Your photos were evaluated for lighting, composition, resolution, and variety. A strong profile needs 4–6 high-quality photos showing different sides of your life.",
    attractionSignals: "We looked at body language, eye contact, smile authenticity, and overall confidence conveyed through your photos and bio.",
    personalitySignals: "Your prompts, bio, and photos were analyzed for depth, humor, and authenticity. Generic content scores low here.",
    matchTargeting: "How well does your profile speak to the type of person you want to attract? Broad, unfocused profiles underperform targeted ones.",
    firstImpression: "Your lead photo and opening line are everything. We evaluated the first 2 seconds of your profile experience.",
  };

  const FALLBACK_FIX: Record<string, string> = {
    photoQuality: "Replace blurry, dark, or group-heavy photos. Lead with a clear, well-lit solo shot. Add variety — hobbies, travel, social settings.",
    attractionSignals: "Use photos where you're genuinely smiling and making eye contact. Avoid crossed arms or sunglasses as your main photo.",
    personalitySignals: "Rewrite generic prompts with specific stories. 'I once got lost in Tokyo for 6 hours and it was the best day' beats 'I love adventure.'",
    matchTargeting: "Define who you want to attract and tailor your content. If you want someone active, show yourself being active — not just saying you like hiking.",
    firstImpression: "Your first photo should be a clear headshot or upper body shot with good lighting. No sunglasses, no group photos, no heavy filters.",
  };

  const hasPrompts = profileInput.prompts?.some(p => p.trim());
  const hasBio = !!profileInput.bio?.trim();

  return (
    <div className="results-page">
      <div className="results-container">
        <div className="results-header">
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Results
          </button>
        </div>

        {purchased && (
          <div className="report-unlocked-banner">
            <Sparkles size={15} />
            <span>Full Report Unlocked</span>
          </div>
        )}

        <div className="report-hero">
          <div className="report-hero-badge">Full Report</div>
          <h2 className="report-hero-title">
            Your {platformLabel} Profile Report
          </h2>
          <p className="report-hero-subtitle">
            Detailed analysis with specific fixes for every part of your profile.
          </p>
          <div className="report-hero-score">
            <ScoreRing score={score.overall} size={120} />
          </div>
        </div>

        {/* ── Score category breakdown cards ── */}
        {scoreCategories.map((cat) => {
          const Icon = cat.icon;
          const catScore = score[cat.key];
          const aiAnalysis = feedback.categoryAnalysis?.[cat.analysisKey];
          const analysisText = aiAnalysis || FALLBACK_ANALYSIS[cat.key];
          const scoreClass = catScore >= 70 ? "good" : catScore >= 40 ? "mid" : "low";

          return (
            <div key={cat.key} className="report-section-card">
              <div className="report-section-header">
                <div className="report-section-icon">
                  <Icon size={18} />
                </div>
                <h3>{cat.label}</h3>
                <span className={`report-section-score ${scoreClass}`}>
                  {catScore}/100
                </span>
              </div>
              <div className="report-section-body">
                <p className="report-section-analysis">{analysisText}</p>
                {cat.key === "personalitySignals" && feedback.personalitySignalsPromptRewrite ? (
                  <div className="prompt-rec-item" style={{ marginTop: "16px" }}>
                    <div className="prompt-rec-current">
                      <span className="prompt-rec-label"><AlertCircle size={12} /> Weakest prompt</span>
                      <p className="prompt-rec-text">"{feedback.personalitySignalsPromptRewrite.original}"</p>
                    </div>
                    <div className="prompt-rec-divider" />
                    <div className="prompt-rec-suggestion">
                      <span className="prompt-rec-label suggest-label"><Lightbulb size={12} /> Better direction</span>
                      <p className="prompt-rec-suggest-text">{feedback.personalitySignalsPromptRewrite.suggestion}</p>
                    </div>
                  </div>
                ) : catScore < 70 ? (
                  <div className="report-fix-box">
                    <p className="report-fix-title">How to improve</p>
                    <p className="report-fix-text">{FALLBACK_FIX[cat.key]}</p>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* ── Prompt recommendations ── */}
        {(hasPrompts || hasBio) && (
          <div className="report-section-card">
            <div className="report-section-header">
              <div className="report-section-icon">
                <MessageSquare size={18} />
              </div>
              <h3>Prompt & Bio Coaching</h3>
              {feedback.promptRecommendations && feedback.promptRecommendations.length > 0 && (
                <span className="report-section-badge">
                  {feedback.promptRecommendations.length} issue{feedback.promptRecommendations.length > 1 ? "s" : ""} found
                </span>
              )}
            </div>
            <div className="report-section-body">
              {feedback.promptRecommendations && feedback.promptRecommendations.length > 0 ? (
                <div className="prompt-rec-list">
                  {feedback.promptRecommendations.map((rec, i) => (
                    <div key={i} className="prompt-rec-item">
                      <div className="prompt-rec-current">
                        <span className="prompt-rec-label"><AlertCircle size={12} /> Current prompt {rec.promptIndex}</span>
                        <p className="prompt-rec-text">"{rec.currentPrompt}"</p>
                      </div>
                      <div className="prompt-rec-divider" />
                      <div className="prompt-rec-issue">
                        <span className="prompt-rec-label issue-label"><AlertCircle size={12} /> Honest take</span>
                        <p className="prompt-rec-issue-text">{rec.issue}</p>
                      </div>
                      <div className="prompt-rec-suggestion">
                        <span className="prompt-rec-label suggest-label"><Lightbulb size={12} /> Direction</span>
                        <p className="prompt-rec-suggest-text">{rec.suggestion}</p>
                      </div>
                      {(rec.rewriteA || rec.rewriteB) && (
                        <div className="prompt-rewrites">
                          <span className="prompt-rewrites-label">Ready-to-paste rewrites</span>
                          <div className="prompt-rewrite-variants">
                            {rec.rewriteA && (
                              <div className="prompt-rewrite-variant">
                                <div className="prompt-rewrite-header">
                                  <span className="prompt-rewrite-tag">{rec.rewriteAAngle || "Option A"}</span>
                                  <span className="prompt-rewrite-chars">{rec.rewriteA.length} chars</span>
                                </div>
                                <p className="prompt-rewrite-text">"{rec.rewriteA}"</p>
                                <button
                                  className={`prompt-copy-btn ${copiedKey === `${i}-a` ? "copied" : ""}`}
                                  onClick={() => copyToClipboard(rec.rewriteA!, `${i}-a`)}
                                >
                                  {copiedKey === `${i}-a` ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                                </button>
                              </div>
                            )}
                            {rec.rewriteB && (
                              <div className="prompt-rewrite-variant">
                                <div className="prompt-rewrite-header">
                                  <span className="prompt-rewrite-tag">{rec.rewriteBAngle || "Option B"}</span>
                                  <span className="prompt-rewrite-chars">{rec.rewriteB.length} chars</span>
                                </div>
                                <p className="prompt-rewrite-text">"{rec.rewriteB}"</p>
                                <button
                                  className={`prompt-copy-btn ${copiedKey === `${i}-b` ? "copied" : ""}`}
                                  onClick={() => copyToClipboard(rec.rewriteB!, `${i}-b`)}
                                >
                                  {copiedKey === `${i}-b` ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="report-fix-box">
                  <p className="report-fix-title">General guidance</p>
                  <p className="report-fix-text">
                    Lead with a hook, add a specific detail or story, and end with something that invites conversation. Avoid listing traits — show, don't tell.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Better lead photo suggestion ── */}
        {feedback.betterLeadPhotoSuggestion && (
          <div className="report-section-card" style={{ borderLeft: "3px solid #0EA5E9" }}>
            <div className="report-section-header">
              <div className="report-section-icon">
                <Camera size={18} />
              </div>
              <h3>Lead Photo Upgrade</h3>
              <span className="report-section-badge" style={{ background: "rgba(14,165,233,0.15)", color: "#0EA5E9" }}>
                High Impact
              </span>
            </div>
            <div className="report-section-body">
              <p className="report-section-analysis" style={{ whiteSpace: "pre-line" }}>
                {feedback.betterLeadPhotoSuggestion}
              </p>
            </div>
          </div>
        )}

        {/* ── Photo swap recommendations ── */}
        {(feedback.photoSwapRecommendations && feedback.photoSwapRecommendations.length > 0) && (
          <div className="report-section-card">
            <div className="report-section-header">
              <div className="report-section-icon">
                <Camera size={18} />
              </div>
              <h3>Photo Swap Recommendations</h3>
              <span className="report-section-badge">
                {feedback.photoSwapRecommendations.length} suggestion{feedback.photoSwapRecommendations.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="report-section-body">
              <p className="report-section-analysis">
                Your additional photos were compared against your current lineup. Here's exactly what to swap to maximize your profile's impact.
              </p>
              {feedback.photoSwapRecommendations && feedback.photoSwapRecommendations.length > 0 ? (
                <div className="swap-recommendations">
                  {feedback.photoSwapRecommendations.map((rec, i) => {
                    const actionIcon = rec.action === "swap" ? <ArrowLeftRight size={14} />
                      : rec.action === "add" ? <PlusCircle size={14} />
                      : rec.action === "remove" ? <MinusCircle size={14} />
                      : <MoveVertical size={14} />;
                    const actionLabel = rec.action === "swap" ? "Swap"
                      : rec.action === "add" ? "Add"
                      : rec.action === "remove" ? "Remove"
                      : "Reorder";

                    const currentIdx = rec.currentPhoto
                      ? parseInt(rec.currentPhoto.replace(/\D/g, "")) - 1
                      : -1;
                    const extraLetter = rec.additionalPhoto
                      ? rec.additionalPhoto.match(/extra photo ([A-Z])/i)?.[1]
                      : null;
                    const additionalIdx = extraLetter
                      ? extraLetter.toUpperCase().charCodeAt(0) - 65
                      : -1;

                    const currentPhotoRaw = currentIdx >= 0 ? profileInput.currentPhotos?.[currentIdx] : null;
                    const additionalPhotoRaw = additionalIdx >= 0 ? profileInput.additionalPhotos?.[additionalIdx] : null;

                    return (
                      <div key={i} className="swap-rec-item">
                        <div className="swap-rec-header">
                          <span className={`swap-action-badge swap-action-${rec.action}`}>
                            {actionIcon} {actionLabel}
                          </span>
                          {!(currentPhotoRaw || additionalPhotoRaw) && (
                            <>
                              {rec.currentPhoto && <span className="swap-photo-label">{rec.currentPhoto}</span>}
                              {rec.currentPhoto && rec.additionalPhoto && <ArrowRight size={12} style={{ opacity: 0.4 }} />}
                              {rec.additionalPhoto && <span className="swap-photo-label">{rec.additionalPhoto}</span>}
                            </>
                          )}
                        </div>

                        {(currentPhotoRaw || additionalPhotoRaw) && (
                          <div className="swap-photo-thumbs">
                            {currentPhotoRaw && (
                              <PhotoThumb raw={currentPhotoRaw} label="Current" />
                            )}
                            {currentPhotoRaw && additionalPhotoRaw && (
                              <div className="swap-thumb-arrow"><ArrowRight size={16} /></div>
                            )}
                            {additionalPhotoRaw && (
                              <PhotoThumb raw={additionalPhotoRaw} label="Replace with" />
                            )}
                          </div>
                        )}

                        <p className="swap-rec-reason">{rec.reason}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="report-fix-box">
                  <p className="report-fix-title">General recommendation</p>
                  <p className="report-fix-text">
                    Compare your additional photos against your current lineup. Swap in photos with better lighting, clearer expressions, and more variety. Your strongest photo should always be first.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Photo order recommendation ── */}
        {feedback.photoOrderRecommendation && (
          <div className="report-section-card">
            <div className="report-section-header">
              <div className="report-section-icon">
                <ListOrdered size={18} />
              </div>
              <h3>Optimal Photo Order</h3>
            </div>
            <div className="report-section-body">
              <p className="report-section-analysis">
                The order of your photos determines first impressions and swiping momentum. Here's the sequence that will perform best:
              </p>
              <div className="photo-order-list">
                {feedback.photoOrderRecommendation.suggestedOrder.map((photoRef, i) => {
                  const isExtra = photoRef.toLowerCase().includes("extra");
                  const currentIdx = !isExtra ? parseInt(photoRef.replace(/\D/g, "")) - 1 : -1;
                  const extraLetter = isExtra ? photoRef.match(/extra photo ([A-Z])/i)?.[1] : null;
                  const additionalIdx = extraLetter ? extraLetter.toUpperCase().charCodeAt(0) - 65 : -1;
                  const rawPhoto = isExtra
                    ? profileInput.additionalPhotos?.[additionalIdx]
                    : profileInput.currentPhotos?.[currentIdx];

                  return (
                    <div key={i} className="photo-order-item">
                      <div className="photo-order-num">{i + 1}</div>
                      {rawPhoto ? (
                        <img
                          src={`data:${parsePhotoData(rawPhoto)?.mimeType};base64,${parsePhotoData(rawPhoto)?.data}`}
                          alt={photoRef}
                          className="photo-order-thumb"
                        />
                      ) : (
                        <div className="photo-order-placeholder">
                          <Camera size={16} />
                        </div>
                      )}
                      {!rawPhoto && <span className="photo-order-ref">{photoRef}</span>}
                      {i === 0 && <span className="photo-order-badge first-badge">Lead photo</span>}
                      {isExtra && <span className="photo-order-badge new-badge">New addition</span>}
                    </div>
                  );
                })}
              </div>
              {feedback.photoOrderRecommendation.reason && (
                <div className="report-fix-box" style={{ marginTop: 14 }}>
                  <p className="report-fix-title">Why this order works</p>
                  <p className="report-fix-text">{feedback.photoOrderRecommendation.reason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Profile preview ── */}
        {feedback.sampleProfile && (
          <div className="report-section-card sample-profile-card">
            <div className="report-section-header">
              <div className="report-section-icon" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                <Sparkles size={18} />
              </div>
              <div>
                <h3>Your Profile, Upgraded</h3>
                <p className="report-section-subhead">A sample of what your profile could look like after applying this feedback</p>
              </div>
            </div>
            <div className="report-section-body">
              <div className="sample-profile-mock">
                <div className="sample-mock-header" style={{
                  borderColor: PLATFORM_COLOR[platform] ?? "#6366f1"
                }}>
                  <span className="sample-mock-platform">{platformLabel}</span>
                  <span className="sample-mock-headline">{feedback.sampleProfile.headline}</span>
                </div>

                {feedback.sampleProfile.bio && (
                  <div className="sample-mock-bio">
                    <p className="sample-mock-bio-label">About me</p>
                    <p className="sample-mock-bio-text">{feedback.sampleProfile.bio}</p>
                  </div>
                )}

                {feedback.sampleProfile.prompts && feedback.sampleProfile.prompts.length > 0 && (
                  <div className="sample-mock-prompts">
                    {feedback.sampleProfile.prompts.map((p, i) => (
                      <div key={i} className="sample-mock-prompt-card">
                        <p className="sample-mock-prompt-q">
                          <Quote size={11} style={{ opacity: 0.5, marginRight: 5, flexShrink: 0 }} />
                          {p.question}
                        </p>
                        <p className="sample-mock-prompt-a">{p.answer}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="sample-mock-summary">
                  <Sparkles size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                  <p>{feedback.sampleProfile.summary}</p>
                </div>
              </div>

              <p className="sample-profile-disclaimer">
                This is a directional sample — personalise it with your own voice and specifics before using it.
              </p>
            </div>
          </div>
        )}

        {/* ── Option 3: Before / After match potential ── */}
        {feedback.matchPotential && (
          <div className="report-section-card">
            <div className="report-section-header">
              <div className="report-section-icon" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
                <TrendingUp size={18} />
              </div>
              <div>
                <h3>Your Match Potential</h3>
                <p className="report-section-subhead">Current vs. optimized profile performance</p>
              </div>
            </div>
            <div className="report-section-body">
              <div className="match-potential-compare">
                <div className="match-potential-box current">
                  <p className="match-potential-box-label">Current profile</p>
                  <p className="match-potential-box-count">{feedback.matchPotential.currentWeeklyEstimate}</p>
                  <p className="match-potential-box-sub">estimated per week</p>
                </div>
                <div className="match-potential-arrow">
                  <ChevronRight size={28} />
                  <span className="match-potential-multiplier">{feedback.matchPotential.percentageIncrease}</span>
                </div>
                <div className="match-potential-box optimized">
                  <p className="match-potential-box-label">After fixes</p>
                  <p className="match-potential-box-count">{feedback.matchPotential.optimizedWeeklyEstimate}</p>
                  <p className="match-potential-box-sub">estimated per week</p>
                </div>
              </div>
              {feedback.matchPotential.topImprovements?.length > 0 && (
                <div className="match-potential-improvements">
                  <p className="match-potential-improvements-title">Highest-impact fixes</p>
                  <ul>
                    {feedback.matchPotential.topImprovements.map((item, i) => (
                      <li key={i}>
                        <span className="match-potential-rank">{i + 1}</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Option 2: Potential match profiles ── */}
        {feedback.potentialMatches && feedback.potentialMatches.length > 0 && (
          <div className="report-section-card">
            <div className="report-section-header">
              <div className="report-section-icon" style={{ background: "linear-gradient(135deg, #db2777, #9333ea)" }}>
                <Users size={18} />
              </div>
              <div>
                <h3>Who You'd Attract</h3>
                <p className="report-section-subhead">People who'd swipe on your optimized profile</p>
              </div>
            </div>
            <div className="report-section-body">
              <div className="potential-matches-grid">
                {feedback.potentialMatches.map((match, i) => (
                  <div key={i} className="potential-match-card">
                    <div className="potential-match-avatar">
                      {match.name.charAt(0)}
                    </div>
                    <div className="potential-match-body">
                      <p className="potential-match-name">{match.name}, {match.age}</p>
                      <p className="potential-match-bio">{match.bio}</p>
                      <div className="potential-match-why">
                        <Sparkles size={12} />
                        <p>{match.whyTheySwipe}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="sample-profile-disclaimer" style={{ marginTop: 16 }}>
                AI-generated examples based on your target audience and optimized profile — for illustration only.
              </p>
            </div>
          </div>
        )}

        {/* ── Report Back ── */}
        <div className="report-section-card report-back-card">
          <div className="report-section-header">
            <div className="report-section-icon">
              <TrendingUp size={18} />
            </div>
            <h3>Report Back</h3>
          </div>
          <div className="report-section-body">
            {progressSubmitted ? (
              <div className="report-back-submitted">
                <Check size={28} className="report-back-check" />
                <p className="report-back-submitted-title">Thanks for reporting back.</p>
                <p className="report-back-submitted-sub">This helps us understand what's actually moving the needle for real profiles.</p>
              </div>
            ) : (
              <>
                <p className="report-back-prompt">After you make these changes — did your matches improve?</p>
                <div className="report-back-options">
                  <button
                    className={`report-back-btn improved ${progressOutcome === "improved" ? "selected" : ""}`}
                    onClick={() => setProgressOutcome("improved")}
                  >
                    <TrendingUp size={15} /> Yes, improved
                  </button>
                  <button
                    className={`report-back-btn same ${progressOutcome === "same" ? "selected" : ""}`}
                    onClick={() => setProgressOutcome("same")}
                  >
                    <Minus size={15} /> About the same
                  </button>
                  <button
                    className={`report-back-btn worse ${progressOutcome === "worse" ? "selected" : ""}`}
                    onClick={() => setProgressOutcome("worse")}
                  >
                    <TrendingDown size={15} /> Worse somehow
                  </button>
                </div>
                {progressOutcome && (
                  <>
                    <textarea
                      className="report-back-notes"
                      placeholder="Anything specific? (optional — e.g. 'opened more but fewer matches' or 'finally getting more likes')"
                      value={progressNotes}
                      onChange={e => setProgressNotes(e.target.value)}
                      rows={3}
                    />
                    <button
                      className="report-back-submit"
                      onClick={submitProgress}
                      disabled={progressSubmitting}
                    >
                      {progressSubmitting ? "Saving…" : <><Send size={13} /> Submit</>}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {purchaseType === "profile-pack" && onAnalyzeAnother && (
          <div className="report-section-card" style={{ textAlign: "center", padding: "32px 24px" }}>
            <div style={{ marginBottom: "8px" }}>
              <Layers size={28} style={{ color: "#0EA5E9", margin: "0 auto" }} />
            </div>
            <h3 style={{ marginBottom: "8px", fontSize: "18px" }}>You have reports left in your pack.</h3>
            <p style={{ color: "#6b7280", marginBottom: "20px", fontSize: "14px" }}>
              Use your next report to analyze a different app — or the same one after making changes.
            </p>
            <button
              className="cta-button"
              style={{ maxWidth: "260px", margin: "0 auto" }}
              onClick={onAnalyzeAnother}
            >
              Analyze Another App <ArrowRight size={16} />
            </button>
          </div>
        )}

        <div className="report-footer">
          <button className="results-start-over-btn" onClick={onBack}>
            Back to Results <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
