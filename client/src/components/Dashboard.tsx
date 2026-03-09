import { useState, useEffect } from "react";
import { ArrowLeft, Crown, ArrowRight, TrendingUp, Activity, Bell, RefreshCw, BarChart3, Shield, Plus, Loader2, LogIn } from "lucide-react";
import type { DashboardData, AnalysisRecord } from "@shared/types";
import { ScoreRing } from "./ScoreRing";

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

export function Dashboard({ onAnalyze, onViewResult, onBack, userEmail, token }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
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
      const dashboardData: DashboardData = await res.json();
      setData(dashboardData);
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
            <button className="back-link" onClick={onBack}>
              <ArrowLeft size={16} /> Back
            </button>
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
            <button className="back-link" onClick={onBack}>
              <ArrowLeft size={16} /> Back
            </button>
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
  const latestAnalysis = analyses[0];
  const chartData = [...analyses].reverse().slice(-10);

  const maxScore = 100;

  return (
    <div className="results-page">
      <div className="results-container">
        <div className="results-header">
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        <div className="report-hero">
          <div className="report-hero-badge pro-badge">
            <Crown size={14} /> Magnet Pro
          </div>
          <h2 className="report-hero-title">Your Dashboard</h2>
          <p className="report-hero-subtitle">
            {hasAnalyses
              ? `${analyses.length} analysis${analyses.length === 1 ? "" : "es"} tracked for ${userEmail}`
              : "Run your first analysis to start tracking your scores."}
          </p>
        </div>

        {!hasAnalyses ? (
          <div className="dashboard-empty-state">
            <div className="dashboard-empty-icon">
              <BarChart3 size={40} />
            </div>
            <h3>No analyses yet</h3>
            <p>Analyze your dating profile to see your scores, trends, and platform health here.</p>
            <button className="pricing-btn featured-btn" onClick={() => onAnalyze()} style={{ maxWidth: 300 }}>
              <Plus size={16} /> Analyze My Profile
            </button>
          </div>
        ) : (
          <>
            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="dashboard-card-icon">
                  <ScoreRing score={latestAnalysis.score.overall} size={80} />
                </div>
                <div>
                  <h4>Latest Score</h4>
                  <p className="dashboard-card-text">
                    {PLATFORM_LABELS[latestAnalysis.platform] || latestAnalysis.platform} — {timeAgo(latestAnalysis.created_at)}
                  </p>
                  <button
                    className="dashboard-view-btn"
                    onClick={() => onViewResult(latestAnalysis)}
                  >
                    View Full Results <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-icon stat-icon">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <h4>Score History</h4>
                  <p className="dashboard-card-text">
                    {chartData.length === 1
                      ? "Run more analyses to see your trend"
                      : `Last ${chartData.length} analyses`}
                  </p>
                  <div className="dashboard-chart">
                    {chartData.map((a, i) => (
                      <div key={a.id} className="chart-bar-wrap" title={`${PLATFORM_LABELS[a.platform] || a.platform}: ${a.score.overall}/100`}>
                        <div
                          className={`chart-bar ${i === chartData.length - 1 ? "active" : ""}`}
                          style={{ height: `${(a.score.overall / maxScore) * 100}%` }}
                        />
                        <span className="chart-bar-label">{a.score.overall}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dashboard-card full-width">
                <div className="dashboard-card-icon stat-icon">
                  <Activity size={28} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4>Platform Health</h4>
                  <p className="dashboard-card-text">Your analysis status across dating apps</p>
                  <div className="platform-health-grid">
                    {platforms.map((p) => (
                      <div key={p.platform} className="platform-health-item">
                        <div className="platform-health-top">
                          <span className={`platform-dot ${p.analysisCount > 0 ? "active" : "inactive"}`} />
                          <span className="platform-health-name">{PLATFORM_LABELS[p.platform]}</span>
                          {p.analysisCount > 0 && (
                            <span className="platform-health-score">{p.latestScore}/100</span>
                          )}
                        </div>
                        <div className="platform-health-bottom">
                          {p.analysisCount > 0 ? (
                            <>
                              <span className="platform-health-meta">
                                {p.analysisCount} review{p.analysisCount === 1 ? "" : "s"} · Last {timeAgo(p.lastAnalyzed)}
                              </span>
                              <button
                                className="platform-reanalyze-btn"
                                onClick={() => onAnalyze(p.platform)}
                              >
                                Re-analyze
                              </button>
                            </>
                          ) : (
                            <button
                              className="platform-analyze-btn"
                              onClick={() => onAnalyze(p.platform)}
                            >
                              Analyze <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-history">
              <h3>Analysis History</h3>
              <div className="history-list">
                {analyses.map((a) => (
                  <div key={a.id} className="history-item" onClick={() => onViewResult(a)}>
                    <div className="history-item-score">
                      <ScoreRing score={a.score.overall} size={44} />
                    </div>
                    <div className="history-item-info">
                      <span className="history-item-platform">
                        {PLATFORM_LABELS[a.platform] || a.platform}
                      </span>
                      <span className="history-item-date">{timeAgo(a.created_at)}</span>
                    </div>
                    <div className="history-item-roast">
                      "{a.feedback.roast.length > 80 ? a.feedback.roast.slice(0, 80) + "..." : a.feedback.roast}"
                    </div>
                    <ArrowRight size={16} className="history-item-arrow" />
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-actions">
              <button className="pricing-btn featured-btn" onClick={() => onAnalyze()}>
                <Plus size={16} /> New Analysis
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
