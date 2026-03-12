import { useState, useEffect } from "react";
import {
  ArrowLeft, Crown, ArrowRight, TrendingUp, TrendingDown,
  Activity, RefreshCw, BarChart3, Plus, Loader2, LogIn,
  Camera, Crosshair, Zap, Star, ChevronRight, Minus, Lock
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
  const chartData = [...analyses].reverse().slice(-10);
  const avgScore = hasAnalyses
    ? Math.round(analyses.reduce((s, a) => s + a.score.overall, 0) / analyses.length)
    : 0;
  const bestScore = hasAnalyses ? Math.max(...analyses.map(a => a.score.overall)) : 0;
  const scoreDelta = latest && previous ? latest.score.overall - previous.score.overall : null;

  return (
    <div className="results-page">
      <div className="results-container">

        <div className="results-header">
          <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        </div>

        <div className="dash-hero">
          <div className="report-hero-badge pro-badge"><Crown size={13} /> Magnet Pro</div>
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
                <div className="dash-new-btn dash-new-btn-locked">
                  <Lock size={12} /> New Analysis
                  <span className="dash-pro-chip"><Crown size={10} /> Pro</span>
                </div>
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
                        <div className="dash-pro-locked-btn">
                          <Lock size={12} /> Re-analyze
                          <span className="dash-pro-chip"><Crown size={10} /> Pro</span>
                        </div>
                      </>
                    ) : (
                      <div className="dash-platform-empty">
                        <p>Not analyzed yet</p>
                        <div className="dash-pro-locked-btn">
                          <Lock size={12} /> Analyze
                          <span className="dash-pro-chip"><Crown size={10} /> Pro</span>
                        </div>
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

            <FeedbackSurvey page="dashboard" />
          </>
        )}
      </div>
    </div>
  );
}
