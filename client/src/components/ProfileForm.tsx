import { useState, useRef } from "react";
import { Plus, X, Loader2, Upload, Image, Type, Camera } from "lucide-react";
import { TARGET_TYPES } from "@shared/types";
import type { ProfileInput, ProfileResult } from "@shared/types";

interface Props {
  onResult: (data: ProfileResult, input: ProfileInput) => void;
}

type InputMode = "type" | "screenshot";

interface ScreenshotFile {
  file: File;
  preview: string;
  label: string;
}

export function ProfileForm({ onResult }: Props) {
  const [platform, setPlatform] = useState<ProfileInput["platform"]>("hinge");
  const [inputMode, setInputMode] = useState<InputMode>("type");
  const [bio, setBio] = useState("");
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [photoDescriptions, setPhotoDescriptions] = useState<string[]>([""]);
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [targetType, setTargetType] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const MAX_SCREENSHOTS = 6;
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_SCREENSHOTS} screenshots allowed.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const newScreenshots: ScreenshotFile[] = [];
    const skipped: string[] = [];

    Array.from(files).slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        skipped.push(`${file.name} (not an image)`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        skipped.push(`${file.name} (over 20MB)`);
        return;
      }
      const preview = URL.createObjectURL(file);
      newScreenshots.push({ file, preview, label: "" });
    });

    if (skipped.length > 0) {
      setError(`Skipped: ${skipped.join(", ")}`);
    }

    setScreenshots((prev) => [...prev, ...newScreenshots]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeScreenshot = (i: number) => {
    setScreenshots((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const updateScreenshotLabel = (i: number, label: string) => {
    setScreenshots((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], label };
      return updated;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasTextContent = bio.trim() || prompts.some((p) => p.trim());
    const hasScreenshots = screenshots.length > 0;

    if (!hasTextContent && !hasScreenshots) {
      setError("Add at least your bio, a prompt, or upload a screenshot to get started.");
      return;
    }
    if (!targetType) {
      setError("Choose who you want to attract.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const screenshotBase64 = await Promise.all(
        screenshots.map(async (s) => ({
          data: await fileToBase64(s.file),
          label: s.label,
          mimeType: s.file.type,
        }))
      );

      const input: ProfileInput = {
        platform,
        bio,
        prompts: prompts.filter((p) => p.trim()),
        photoDescriptions: photoDescriptions.filter((p) => p.trim()),
        screenshots: screenshotBase64.map(
          (s) => JSON.stringify({ data: s.data, label: s.label, mimeType: s.mimeType })
        ),
        targetType,
        customTarget: targetType === "custom" ? customTarget : undefined,
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Analysis failed");
      }
      const data = await res.json();
      onResult(data, input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
            <label className="form-label">How do you want to share your profile?</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${inputMode === "type" ? "active" : ""}`}
                onClick={() => setInputMode("type")}
              >
                <Type size={16} />
                Type it out
              </button>
              <button
                type="button"
                className={`mode-btn ${inputMode === "screenshot" ? "active" : ""}`}
                onClick={() => setInputMode("screenshot")}
              >
                <Camera size={16} />
                Upload screenshots
              </button>
            </div>
          </div>

          {inputMode === "screenshot" ? (
            <div className="form-section">
              <label className="form-label">Profile Screenshots</label>
              <p className="form-hint">
                Upload screenshots of your dating profile — bio, prompts, photos, anything you want reviewed.
                The AI will read everything from the images.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />

              {screenshots.length > 0 && (
                <div className="screenshot-grid">
                  {screenshots.map((s, i) => (
                    <div key={i} className="screenshot-card">
                      <div className="screenshot-preview">
                        <img src={s.preview} alt={`Screenshot ${i + 1}`} />
                        <button
                          type="button"
                          className="screenshot-remove"
                          onClick={() => removeScreenshot(i)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        className="form-input screenshot-label"
                        placeholder={`What's this? (e.g. "my bio", "prompt 1", "photos")`}
                        value={s.label}
                        onChange={(e) => updateScreenshotLabel(i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={18} />
                <div className="upload-btn-text">
                  <span className="upload-btn-title">
                    {screenshots.length === 0 ? "Upload screenshots" : "Add more screenshots"}
                  </span>
                  <span className="upload-btn-hint">PNG, JPG, HEIC — up to 20MB each</span>
                </div>
              </button>

              <div className="screenshot-tips">
                <p className="form-hint">Tips for best results:</p>
                <ul className="tips-list">
                  <li>Screenshot your full profile from the app</li>
                  <li>Include your bio, all prompts, and photo lineup</li>
                  <li>Multiple screenshots are fine — we'll read them all</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

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
                {screenshots.length > 0 ? "Reading your screenshots..." : "Analyzing your profile..."}
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
