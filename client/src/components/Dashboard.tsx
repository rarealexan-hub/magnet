import { ArrowLeft, Crown, BarChart3, Bell, RefreshCw, Shield, ArrowRight, TrendingUp, Activity } from "lucide-react";
import type { ProfileResult } from "@shared/types";
import { ScoreRing } from "./ScoreRing";

interface Props {
  result: ProfileResult;
  onBack: () => void;
}

export function Dashboard({ result, onBack }: Props) {
  const { score } = result;

  return (
    <div className="results-page">
      <div className="results-container">
        <div className="results-header">
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Results
          </button>
        </div>

        <div className="report-hero">
          <div className="report-hero-badge pro-badge">
            <Crown size={14} /> Magnet Pro
          </div>
          <h2 className="report-hero-title">Your Live Dashboard</h2>
          <p className="report-hero-subtitle">
            Track your profile performance, get algorithm alerts, and optimize continuously.
          </p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-icon">
              <ScoreRing score={score.overall} size={80} />
            </div>
            <div>
              <h4>Current Score</h4>
              <p className="dashboard-card-text">Your Magnet Score across all platforms</p>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-icon stat-icon">
              <TrendingUp size={28} />
            </div>
            <div>
              <h4>Score Trend</h4>
              <p className="dashboard-card-text">Track improvements over time as you optimize</p>
              <div className="dashboard-placeholder-chart">
                <div className="placeholder-bar" style={{ height: "40%" }} />
                <div className="placeholder-bar" style={{ height: "55%" }} />
                <div className="placeholder-bar" style={{ height: "50%" }} />
                <div className="placeholder-bar" style={{ height: "65%" }} />
                <div className="placeholder-bar active" style={{ height: "75%" }} />
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-icon stat-icon">
              <Activity size={28} />
            </div>
            <div>
              <h4>Platform Health</h4>
              <p className="dashboard-card-text">Monitor how algorithms rank your profile</p>
              <div className="platform-status-list">
                <div className="platform-status">
                  <span className="platform-dot active" /> Hinge
                  <span className="platform-label">Optimized</span>
                </div>
                <div className="platform-status">
                  <span className="platform-dot warning" /> Tinder
                  <span className="platform-label">Needs update</span>
                </div>
                <div className="platform-status">
                  <span className="platform-dot inactive" /> Bumble
                  <span className="platform-label">Not analyzed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-icon stat-icon">
              <Bell size={28} />
            </div>
            <div>
              <h4>Algorithm Alerts</h4>
              <p className="dashboard-card-text">Get notified when platform changes affect your profile</p>
              <div className="alert-preview">
                <div className="alert-item">
                  <span className="alert-dot" />
                  Hinge updated photo scoring weights
                </div>
                <div className="alert-item">
                  <span className="alert-dot" />
                  Tinder boosted profiles with video
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-features">
          <h3>Included with Magnet Pro</h3>
          <div className="dashboard-feature-grid">
            <div className="dashboard-feature">
              <RefreshCw size={18} />
              <span>Unlimited reviews</span>
            </div>
            <div className="dashboard-feature">
              <BarChart3 size={18} />
              <span>Full reports for all platforms</span>
            </div>
            <div className="dashboard-feature">
              <Bell size={18} />
              <span>Real-time algorithm alerts</span>
            </div>
            <div className="dashboard-feature">
              <Shield size={18} />
              <span>Priority AI analysis</span>
            </div>
          </div>
        </div>

        <div className="report-footer">
          <button className="results-start-over-btn" onClick={onBack}>
            Back to Results <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
