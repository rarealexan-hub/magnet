import { useState, useEffect } from "react";
import {
  ArrowLeft, ArrowRight, TrendingUp, TrendingDown,
  Activity, RefreshCw, BarChart3, Plus, Loader2, LogIn,
  Camera, Crosshair, Zap, Star, ChevronRight, Minus
} from "lucide-react";
import type { DashboardData, AnalysisRecord } from "@shared/types";
import { ScoreRing } from "./ScoreRing";
import { FeedbackSurvey } from "./FeedbackSurvey";

interface Props {
  onAnalyze: (platform?: string) => void;
  onViewResult: (analysis: AnalysisRecord) => void;
  onBack: () => void;
  userEmail?: string;
  token?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  hinge: "Hinge",
  tinder: "Tinder",
  bumble: "Bumble",
  other: "Other",
};

const PLATFORM_COLORS: Record<string, string> = {
  hinge: "#e8472f",
  tinder: "#fd5564",
  bumble: "#f8b916",
  other: "#6366f1",
};

const CATEGORY_META = [
  { key: "photoQuality", label: "Photo Quality", icon: Camera },
  { key: "attractionSignals", label: "Attraction Signals", icon: Zap },
  { key: "personalitySignals", label: "Personality", icon: Star },
  { key: "matchTargeting", label: "Match Targeting", icon: Crosshair },
  { key: "firstImpression", label: "First Impression", icon: Activity },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function scoreColor(score: number): string {
  if (score >= 75) return "#4ade80";
  if (score >= 55) return "#facc15";
  if (score >= 40) return "#f97316";
  return "#f87171";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Average";
  if (score >= 35) return "Weak";
  return "Poor";
}

export function Dashboard({ onAnalyze, onViewResult, onBack, userEmail, token }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchDashboard();
  }, [token]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load dashboard");
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="results-page">
        <div className="results-container">
          <div className="results-header">
            <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          </div>
          <div className="dashboard-empty">
            <LogIn size={48} />
            <h3>Sign in to access your dashboard</h3>
            <p>Create an account or sign in to track your profile scores over time.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="results-page">
        <div className="results-container">
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <p>Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-page">
        <div className="results-container">
          <div className="results-header">
            <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          </div>
          <div className="dashboard-empty">
            <p className="dashboard-error-text">{error}</p>
            <button className="pricing-btn" onClick={fetchDashboard} style={{ maxWidth: 200 }}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const analyses = data?.analyses || [];
  const platforms = data?.platforms || [];
  const hasAnalyses = analyses.length > 0;
  const latest = analyses[0];
  const previous = analyses[1];
  const oldest = analyses[analyses.length - 1];
  const chartData = [...analyses].reverse().slice(-10);
  const avgScore = hasAnalyses
    ? Math.round(analyses.reduce((s, a) => s + a.score.overall, 0) / analyses.length)
    : 0;
  const bestScore = hasAnalyses ? Math.max(...analyses.map(a => a.score.overall)) : 0;
  const scoreDelta = latest && previous ? latest.score.overall - previous.score.overall : null;
  const totalGain = latest && oldest && latest !== oldest ? latest.score.overall - oldest.score.overall : null;
  const daysSinceLast = latest
    ? Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 86400000)
    : null;

  const issueFrequency = new Map<string, number>();
  for (const a of analyses) {
    for (const m of a.feedback.mistakes) {
      issueFrequency.set(m, (issueFrequency.get(m) || 0) + 1);
    }
  }
  const recurringIssues = Array.from(issueFrequency.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  const categoryAvgs = CATEGORY_META.map(({ key, label, icon }) => {
    const avg = Math.round(analyses.reduce((s, a) => s + ((a.score as any)[key] as number), 0) / analyses.length);
    const latestVal = (latest?.score as any)?.[key] as number;
    const oldestVal = (oldest?.score as any)?.[key] as number;
    const trend = analyses.length > 1 ? latestVal - oldestVal : null;
    return { key, label, icon, avg, latestVal, trend };
  });
  const focusCategory = [...categoryAvgs].sort((a, b) => a.avg - b.avg)[0];

  const profileTypeHistory = [...analyses].reverse().map(a => a.feedback.profileType);
  const typeChanges = profileTypeHistory.reduce<string[]>((acc, t) => {
    if (acc[acc.length - 1] !== t) acc.push(t);
    return acc;
  }, []);

  const TYPE_LABELS: Record<string, string> = {
    "high-signal": "High-Signal",
    "generic": "Generic",
    "entertainment": "Entertainment",
  };
  const TYPE_COLORS: Record<string, string> = {
    "high-signal": "#4ade80",
    "generic": "#facc15",
    "entertainment": "#60a5fa",
  };

  return (
    <div className="results-page">
      <div className="results-container">

        <div className="results-header">
          <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        </div>

        <div className="dash-hero">
          <h2 className="dash-hero-title">Your Dashboard</h2>
          <p className="dash-hero-sub">{userEmail}</p>
        </div>

        {!hasAnalyses ? (
          <div className="dashboard-empty-state">
            <div className="dashboard-empty-icon"><BarChart3 size={40} /></div>
            <h3>No analyses yet</h3>
            <p>Run your first analysis to start tracking your scores and improvement over time.</p>
            <button className="pricing-btn featured-btn" onClick={() => onAnalyze()} style={{ maxWidth: 300 }}>
              <Plus size={16} /> Analyze My Profile
            </button>
          </div>
        ) : (
          <>
            {/* ── Stats strip ── */}
            <div className="dash-stats-strip">
              <div className="dash-stat">
                <span className="dash-stat-val">{analyses.length}</span>
                <span className="dash-stat-label">Total Scans</span>
              </div>
              <div className="dash-stat">
                <span className="dash-stat-val" style={{ color: scoreColor(latest.score.overall) }}>
                  {latest.score.overall}
                </span>
                <span className="dash-stat-label">Latest Score</span>
              </div>
              <div className="dash-stat">
                <span className="dash-stat-val">{avgScore}</span>
                <span className="dash-stat-label">Avg Score</span>
              </div>
              <div className="dash-stat">
                <span className="dash-stat-val" style={{ color: scoreColor(bestScore) }}>{bestScore}</span>
                <span className="dash-stat-label">Best Score</span>
              </div>
            </div>

            {/* ── Main grid ── */}
            <div className="dash-main-grid">

              {/* Latest score card */}
              <div className="dash-card dash-latest-card">
                <div className="dash-card-header">
                  <span className="dash-card-title">Latest Analysis</span>
                  <span className="dash-card-meta">
                    {PLATFORM_LABELS[latest.platform] || latest.platform} · {timeAgo(latest.created_at)}
                  </span>
                </div>
                <div className="dash-latest-body">
                  <div className="dash-latest-ring">
                    <ScoreRing score={latest.score.overall} size={96} />
                    {scoreDelta !== null && (
                      <div className={`dash-delta ${scoreDelta > 0 ? "up" : scoreDelta < 0 ? "down" : "flat"}`}>
                        {scoreDelta > 0 ? <TrendingUp size={13} /> : scoreDelta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                        {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} pts
                      </div>
                    )}
                  </div>
                  <div className="dash-latest-categories">
                    {CATEGORY_META.map(({ key, label, icon: Icon }) => {
                      const val = (latest.score as any)[key] as number;
                      return (
                        <div key={key} className="dash-cat-row">
                          <div className="dash-cat-left">
                            <Icon size={13} />
                            <span>{label}</span>
                          </div>
                          <div className="dash-cat-bar-wrap">
                            <div
                              className="dash-cat-bar"
                              style={{ width: `${val}%`, background: scoreColor(val) }}
                            />
                          </div>
                          <span className="dash-cat-val" style={{ color: scoreColor(val) }}>{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button className="dash-view-btn" onClick={() => onViewResult(latest)}>
                  View Full Results <ChevronRight size={14} />
                </button>
              </div>

              {/* Score trend chart */}
              <div className="dash-card dash-chart-card">
                <div className="dash-card-header">
                  <span className="dash-card-title">Score Trend</span>
                  <span className="dash-card-meta">Last {chartData.length} scan{chartData.length > 1 ? "s" : ""}</span>
                </div>
                {chartData.length < 2 ? (
                  <div className="dash-chart-empty">
                    <TrendingUp size={28} />
                    <p>Run another analysis to see your score trend over time.</p>
                  </div>
                ) : (
                  <div className="dash-chart-area">
                    <div className="dash-chart-bars">
                      {chartData.map((a, i) => (
                        <div key={a.id} className="dash-bar-col">
                          <span className="dash-bar-score">{a.score.overall}</span>
                          <div className="dash-bar-track">
                            <div
                              className={`dash-bar-fill ${i === chartData.length - 1 ? "latest" : ""}`}
                              style={{
                                height: `${a.score.overall}%`,
                                background: i === chartData.length - 1 ? scoreColor(a.score.overall) : undefined,
                              }}
                            />
                          </div>
                          <span className="dash-bar-label" title={PLATFORM_LABELS[a.platform] || a.platform}>
                            {(PLATFORM_LABELS[a.platform] || a.platform).slice(0, 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="dash-chart-axis">
                      {[100, 75, 50, 25].map(v => (
                        <span key={v} className="dash-axis-label">{v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* ── Platform health ── */}
            <div className="dash-section">
              <div className="dash-section-header">
                <h3>Platform Health</h3>
                <button className="dash-new-btn" onClick={() => onAnalyze()}>
                  <Plus size={12} /> New Analysis
                </button>
              </div>
              <div className="dash-platform-grid">
                {platforms.map((p) => (
                  <div key={p.platform} className="dash-platform-card">
                    <div className="dash-platform-top">
                      <div className="dash-platform-dot" style={{ background: PLATFORM_COLORS[p.platform] ?? "#6366f1" }} />
                      <span className="dash-platform-name">{PLATFORM_LABELS[p.platform]}</span>
                      {p.analysisCount > 0 && (
                        <span className="dash-platform-count">{p.analysisCount} scan{p.analysisCount > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {p.analysisCount > 0 ? (
                      <>
                        <div className="dash-platform-score-row">
                          <ScoreRing score={p.latestScore} size={56} />
                          <div className="dash-platform-score-info">
                            <span className="dash-platform-score-num" style={{ color: scoreColor(p.latestScore) }}>
                              {p.latestScore}<span style={{ fontSize: 13, opacity: 0.5 }}>/100</span>
                            </span>
                            <span className="dash-platform-score-label">{scoreLabel(p.latestScore)}</span>
                            <span className="dash-platform-last">Last {timeAgo(p.lastAnalyzed)}</span>
                          </div>
                        </div>
                        <button className="dash-platform-action-btn" onClick={() => onAnalyze()}>
                          Re-analyze <ArrowRight size={12} />
                        </button>
                      </>
                    ) : (
                      <div className="dash-platform-empty">
                        <p>Not analyzed yet</p>
                        <button className="dash-platform-action-btn" onClick={() => onAnalyze()}>
                          Analyze <ArrowRight size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── History ── */}
            <div className="dash-section">
              <div className="dash-section-header">
                <h3>Analysis History</h3>
                <span className="dash-section-count">{analyses.length} total</span>
              </div>
              <div className="dash-history-list">
                {analyses.map((a, i) => {
                  const prevScore = analyses[i + 1]?.score.overall;
                  const delta = prevScore !== undefined ? a.score.overall - prevScore : null;
                  return (
                    <div key={a.id} className="dash-history-item" onClick={() => onViewResult(a)}>
                      <ScoreRing score={a.score.overall} size={44} />
                      <div className="dash-history-main">
                        <div className="dash-history-top">
                          <span
                            className="dash-history-platform"
                            style={{ color: PLATFORM_COLORS[a.platform] ?? "#6366f1" }}
                          >
                            {PLATFORM_LABELS[a.platform] || a.platform}
                          </span>
                          <span className="dash-history-date">{timeAgo(a.created_at)}</span>
                        </div>
                        <p className="dash-history-roast">
                          "{a.feedback.roast.length > 90 ? a.feedback.roast.slice(0, 90) + "…" : a.feedback.roast}"
                        </p>
                        {a.feedback.mistakes.length > 0 && (
                          <div className="dash-history-issues">
                            {a.feedback.mistakes.slice(0, 3).map((m, j) => (
                              <span key={j} className="dash-issue-chip">{m}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="dash-history-right">
                        {delta !== null && (
                          <span className={`dash-history-delta ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`}>
                            {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                        <ChevronRight size={15} className="dash-history-arrow" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Insight cards ── */}
            <div className="dash-insight-grid">
              <div className="dash-insight-card focus-card">
                <div className="dash-insight-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
                  <focusCategory.icon size={18} />
                </div>
                <div className="dash-insight-body">
                  <span className="dash-insight-label">Focus Area</span>
                  <span className="dash-insight-title">{focusCategory.label}</span>
                  <p className="dash-insight-desc">
                    Averaging <strong>{focusCategory.avg}/100</strong> — your lowest category. Improving this is your biggest lever.
                  </p>
                </div>
              </div>

              <div className="dash-insight-card">
                <div className="dash-insight-icon" style={{ background: "rgba(250,204,21,0.1)", color: "#facc15" }}>
                  <Star size={18} />
                </div>
                <div className="dash-insight-body">
                  <span className="dash-insight-label">Personal Best</span>
                  <span className="dash-insight-title" style={{ color: scoreColor(bestScore) }}>{bestScore}/100</span>
                  {totalGain !== null ? (
                    <p className="dash-insight-desc">
                      {totalGain > 0
                        ? <>You've gained <strong style={{ color: "#4ade80" }}>+{totalGain} pts</strong> since your first scan.</>
                        : totalGain < 0
                        ? <>You're <strong style={{ color: "#f87171" }}>{totalGain} pts</strong> below your starting score.</>
                        : <>Your score has held steady since your first scan.</>}
                    </p>
                  ) : (
                    <p className="dash-insight-desc">Run more analyses to track your progress.</p>
                  )}
                </div>
              </div>

              <div className="dash-insight-card">
                <div className="dash-insight-icon" style={{ background: daysSinceLast && daysSinceLast > 14 ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)", color: daysSinceLast && daysSinceLast > 14 ? "#f87171" : "#4ade80" }}>
                  <Activity size={18} />
                </div>
                <div className="dash-insight-body">
                  <span className="dash-insight-label">Last Analysis</span>
                  <span className="dash-insight-title">
                    {daysSinceLast === 0 ? "Today" : daysSinceLast === 1 ? "Yesterday" : `${daysSinceLast}d ago`}
                  </span>
                  <p className="dash-insight-desc">
                    {daysSinceLast && daysSinceLast > 14
                      ? "Profiles drift. A fresh scan could reveal new issues."
                      : "You're staying on top of your profile. Keep it up."}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Category trends ── */}
            {analyses.length > 1 && (
              <div className="dash-section">
                <div className="dash-section-header">
                  <h3>Category Trends</h3>
                  <span className="dash-section-count">First scan → Latest scan</span>
                </div>
                <div className="dash-category-trends">
                  {categoryAvgs.map(({ key, label, icon: Icon, avg, latestVal, trend }) => (
                    <div key={key} className="dash-trend-row">
                      <div className="dash-trend-left">
                        <Icon size={14} />
                        <span className="dash-trend-label">{label}</span>
                      </div>
                      <div className="dash-trend-bar-wrap">
                        <div className="dash-trend-bar-bg">
                          <div
                            className="dash-trend-bar-fill"
                            style={{ width: `${avg}%`, background: scoreColor(avg) }}
                          />
                        </div>
                      </div>
                      <span className="dash-trend-val" style={{ color: scoreColor(latestVal) }}>{latestVal}</span>
                      {trend !== null && (
                        <span className={`dash-trend-delta ${trend > 0 ? "up" : trend < 0 ? "down" : "flat"}`}>
                          {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                          {trend > 0 ? `+${trend}` : trend !== 0 ? trend : "—"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Recurring issues ── */}
            {recurringIssues.length > 0 && (
              <div className="dash-section">
                <div className="dash-section-header">
                  <h3>Recurring Issues</h3>
                  <span className="dash-section-count">Across all scans</span>
                </div>
                <div className="dash-recurring-list">
                  {recurringIssues.map(([issue, count]) => (
                    <div key={issue} className="dash-recurring-item">
                      <div className="dash-recurring-bar-wrap">
                        <div
                          className="dash-recurring-bar"
                          style={{ width: `${Math.round((count / analyses.length) * 100)}%` }}
                        />
                      </div>
                      <span className="dash-recurring-label">{issue}</span>
                      <span className="dash-recurring-count">{count}/{analyses.length} scans</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Profile type progression ── */}
            {analyses.length > 1 && (
              <div className="dash-section">
                <div className="dash-section-header">
                  <h3>Profile Type Progression</h3>
                  <span className="dash-section-count">{typeChanges.length === 1 ? "No change yet" : `${typeChanges.length - 1} transition${typeChanges.length > 2 ? "s" : ""}`}</span>
                </div>
                <div className="dash-type-timeline">
                  {[...analyses].reverse().map((a, i) => (
                    <div key={a.id} className="dash-type-step">
                      <div
                        className="dash-type-dot"
                        style={{ background: TYPE_COLORS[a.feedback.profileType] ?? "#6366f1" }}
                      />
                      {i < analyses.length - 1 && <div className="dash-type-line" />}
                      <div className="dash-type-info">
                        <span className="dash-type-name" style={{ color: TYPE_COLORS[a.feedback.profileType] ?? "#6366f1" }}>
                          {TYPE_LABELS[a.feedback.profileType]}
                        </span>
                        <span className="dash-type-meta">{timeAgo(a.created_at)} · {a.score.overall}/100</span>
                      </div>
                    </div>
                  ))}
                </div>
                {typeChanges[typeChanges.length - 1] !== "high-signal" && (
                  <p className="dash-type-goal">
                    Goal: <strong style={{ color: "#4ade80" }}>High-Signal</strong> — specific, authentic, and sending clear attraction cues on every photo and prompt.
                  </p>
                )}
              </div>
            )}

            <FeedbackSurvey page="dashboard" />
          </>
        )}
      </div>
    </div>
  );
}
