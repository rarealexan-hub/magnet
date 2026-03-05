import { useState } from "react";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { TARGET_TYPES } from "@shared/types";
import type { ProfileInput, ProfileResult } from "@shared/types";

interface Props {
  onResult: (data: ProfileResult, input: ProfileInput) => void;
}

export function ProfileForm({ onResult }: Props) {
  const [platform, setPlatform] = useState<ProfileInput["platform"]>("hinge");
  const [bio, setBio] = useState("");
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [photoDescriptions, setPhotoDescriptions] = useState<string[]>([""]);
  const [targetType, setTargetType] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addPrompt = () => setPrompts([...prompts, ""]);
  const removePrompt = (i: number) => setPrompts(prompts.filter((_, idx) => idx !== i));
  const updatePrompt = (i: number, val: string) => {
    const updated = [...prompts];
    updated[i] = val;
    setPrompts(updated);
  };

  const addPhoto = () => setPhotoDescriptions([...photoDescriptions, ""]);
  const removePhoto = (i: number) => setPhotoDescriptions(photoDescriptions.filter((_, idx) => idx !== i));
  const updatePhoto = (i: number, val: string) => {
    const updated = [...photoDescriptions];
    updated[i] = val;
    setPhotoDescriptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bio && prompts.every(p => !p.trim())) {
      setError("Add at least your bio or one prompt to get started.");
      return;
    }
    if (!targetType) {
      setError("Choose who you want to attract.");
      return;
    }

    setLoading(true);
    setError("");

    const input: ProfileInput = {
      platform,
      bio,
      prompts: prompts.filter(p => p.trim()),
      photoDescriptions: photoDescriptions.filter(p => p.trim()),
      targetType,
      customTarget: targetType === "custom" ? customTarget : undefined,
    };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      onResult(data, input);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <div className="form-container">
        <div className="form-header">
          <h2>Paste Your Profile</h2>
          <p>The more you share, the better the audit. We don't store anything.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label">Which app?</label>
            <div className="platform-select">
              {(["hinge", "tinder", "bumble", "other"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`platform-btn ${platform === p ? "active" : ""}`}
                  onClick={() => setPlatform(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Your Bio</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder='e.g. "I love traveling, good food, and hanging out with friends"'
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="form-section">
            <label className="form-label">Prompts & Answers</label>
            <p className="form-hint">Paste your prompt responses (e.g. "A life goal of mine is...")</p>
            {prompts.map((prompt, i) => (
              <div key={i} className="input-row">
                <input
                  className="form-input"
                  placeholder={`Prompt ${i + 1}`}
                  value={prompt}
                  onChange={(e) => updatePrompt(i, e.target.value)}
                />
                {prompts.length > 1 && (
                  <button type="button" className="remove-btn" onClick={() => removePrompt(i)}>
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-btn" onClick={addPrompt}>
              <Plus size={16} /> Add Prompt
            </button>
          </div>

          <div className="form-section">
            <label className="form-label">Describe Your Photos</label>
            <p className="form-hint">Briefly describe each photo (e.g. "selfie at beach", "group photo at wedding")</p>
            {photoDescriptions.map((photo, i) => (
              <div key={i} className="input-row">
                <input
                  className="form-input"
                  placeholder={`Photo ${i + 1} description`}
                  value={photo}
                  onChange={(e) => updatePhoto(i, e.target.value)}
                />
                {photoDescriptions.length > 1 && (
                  <button type="button" className="remove-btn" onClick={() => removePhoto(i)}>
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-btn" onClick={addPhoto}>
              <Plus size={16} /> Add Photo
            </button>
          </div>

          <div className="form-section">
            <label className="form-label">Who are you trying to attract?</label>
            <p className="form-hint">This is the killer feature. Generic profiles get generic matches.</p>
            <div className="target-grid">
              {TARGET_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`target-card ${targetType === t.id ? "active" : ""}`}
                  onClick={() => setTargetType(t.id)}
                >
                  <span className="target-label">{t.label}</span>
                  <span className="target-desc">{t.description}</span>
                </button>
              ))}
            </div>
            {targetType === "custom" && (
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Describe your ideal match — personality, interests, vibe..."
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
              />
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={20} className="spin" />
                Analyzing your profile...
              </>
            ) : (
              "Get My Profile Score"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
