import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, X, Loader2, Upload, Type, Camera, GripVertical, ImagePlus, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import heic2any from "heic2any";
import { TARGET_TYPES } from "@shared/types";
import type { ProfileInput, ProfileResult } from "@shared/types";

interface Props {
  onResult: (data: ProfileResult, input: ProfileInput) => void;
  userEmail?: string;
}

type InputMode = "type" | "screenshot";

interface UploadedPhoto {
  file: File;
  preview: string;
}

interface ScreenshotFile {
  file: File;
  preview: string;
  label: string;
}

const MAX_SCREENSHOTS = 6;
const MAX_CURRENT_PHOTOS = 9;
const MAX_ADDITIONAL_PHOTOS = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif"];

function isHeic(file: File): boolean {
  if (HEIC_TYPES.includes(file.type)) return true;
  const ext = file.name.toLowerCase();
  return ext.endsWith(".heic") || ext.endsWith(".heif");
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 }) as Blob;
  const name = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
}

export function ProfileForm({ onResult, userEmail }: Props) {
  const [platform, setPlatform] = useState<ProfileInput["platform"]>("hinge");
  const [email, setEmail] = useState(userEmail || "");
  const [inputMode, setInputMode] = useState<InputMode>("screenshot");
  const [bio, setBio] = useState("");
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [photoDescriptions, setPhotoDescriptions] = useState<string[]>([""]);
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [currentPhotos, setCurrentPhotos] = useState<UploadedPhoto[]>([]);
  const [additionalPhotos, setAdditionalPhotos] = useState<UploadedPhoto[]>([]);
  const [targetType, setTargetType] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    if (userEmail) setEmail(userEmail);
  }, [userEmail]);

  const paidSessionId = sessionStorage.getItem("paidSessionId");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPhotosRef = useRef<HTMLInputElement>(null);
  const additionalPhotosRef = useRef<HTMLInputElement>(null);

  const addPrompt = () => setPrompts([...prompts, ""]);
  const removePrompt = (i: number) => setPrompts(prompts.filter((_, idx) => idx !== i));
  const updatePrompt = (i: number, val: string) => {
    const updated = [...prompts];
    updated[i] = val;
    setPrompts(updated);
  };

  const addPhotoDesc = () => setPhotoDescriptions([...photoDescriptions, ""]);
  const removePhotoDesc = (i: number) => setPhotoDescriptions(photoDescriptions.filter((_, idx) => idx !== i));
  const updatePhotoDesc = (i: number, val: string) => {
    const updated = [...photoDescriptions];
    updated[i] = val;
    setPhotoDescriptions(updated);
  };

  const processFiles = useCallback(
    async (
      files: FileList,
      setter: React.Dispatch<React.SetStateAction<UploadedPhoto[]>>,
      current: UploadedPhoto[],
      max: number
    ) => {
      const remaining = max - current.length;
      if (remaining <= 0) {
        setError(`Maximum ${max} photos allowed in this section.`);
        return;
      }

      const newPhotos: UploadedPhoto[] = [];
      const skipped: string[] = [];

      const filesToProcess = Array.from(files).slice(0, remaining);
      for (const file of filesToProcess) {
        if (isHeic(file)) {
          try {
            const converted = await convertHeicToJpeg(file);
            if (converted.size > MAX_FILE_SIZE) {
              skipped.push(`${file.name} (over 20MB after conversion)`);
              continue;
            }
            newPhotos.push({ file: converted, preview: URL.createObjectURL(converted) });
          } catch {
            skipped.push(`${file.name} (failed to convert HEIC)`);
          }
          continue;
        }
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          skipped.push(`${file.name} (use JPG, PNG, GIF, WebP, or HEIC)`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          skipped.push(`${file.name} (over 20MB)`);
          continue;
        }
        newPhotos.push({ file, preview: URL.createObjectURL(file) });
      }

      if (skipped.length > 0) setError(`Skipped: ${skipped.join(", ")}`);
      setter((prev) => [...prev, ...newPhotos]);
    },
    []
  );

  const handleCurrentPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files, setCurrentPhotos, currentPhotos, MAX_CURRENT_PHOTOS);
    if (currentPhotosRef.current) currentPhotosRef.current.value = "";
  };

  const handleAdditionalPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files, setAdditionalPhotos, additionalPhotos, MAX_ADDITIONAL_PHOTOS);
    if (additionalPhotosRef.current) additionalPhotosRef.current.value = "";
  };

  const removeCurrentPhoto = (i: number) => {
    setCurrentPhotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const removeAdditionalPhoto = (i: number) => {
    setAdditionalPhotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOverIndex(i);
  };
  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setCurrentPhotos((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(dragIndex, 1);
        updated.splice(dragOverIndex, 0, moved);
        return updated;
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const movePhoto = (i: number, direction: "up" | "down") => {
    setCurrentPhotos((prev) => {
      const target = direction === "up" ? i - 1 : i + 1;
      if (target < 0 || target >= prev.length) return prev;
      const updated = [...prev];
      [updated[i], updated[target]] = [updated[target], updated[i]];
      return updated;
    });
  };

  const handleScreenshotSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const filesToProcess = Array.from(files).slice(0, remaining);
    for (const file of filesToProcess) {
      if (isHeic(file)) {
        try {
          const converted = await convertHeicToJpeg(file);
          if (converted.size > MAX_FILE_SIZE) {
            skipped.push(`${file.name} (over 20MB)`);
            continue;
          }
          newScreenshots.push({ file: converted, preview: URL.createObjectURL(converted), label: "" });
        } catch {
          skipped.push(`${file.name} (couldn't process this image)`);
        }
        continue;
      }
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        skipped.push(`${file.name} (unsupported format)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        skipped.push(`${file.name} (over 20MB)`);
        continue;
      }
      newScreenshots.push({ file, preview: URL.createObjectURL(file), label: "" });
    }
    if (skipped.length > 0) setError(`Skipped: ${skipped.join(", ")}`);
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
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const photosToPayload = async (photos: UploadedPhoto[]) => {
    return Promise.all(
      photos.map(async (p) => JSON.stringify({ data: await fileToBase64(p.file), mimeType: p.file.type }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasTextContent = bio.trim() || prompts.some((p) => p.trim());
    const hasScreenshots = screenshots.length > 0;
    const hasPhotos = currentPhotos.length > 0;

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
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
      const [screenshotPayload, currentPhotoPayload, additionalPhotoPayload] = await Promise.all([
        Promise.all(
          screenshots.map(async (s) =>
            JSON.stringify({ data: await fileToBase64(s.file), label: s.label, mimeType: s.file.type })
          )
        ),
        photosToPayload(currentPhotos),
        photosToPayload(additionalPhotos),
      ]);

      const input: ProfileInput = {
        platform,
        email: email.trim(),
        bio,
        prompts: prompts.filter((p) => p.trim()),
        photoDescriptions: photoDescriptions.filter((p) => p.trim()),
        screenshots: screenshotPayload,
        currentPhotos: currentPhotoPayload,
        additionalPhotos: additionalPhotoPayload,
        targetType,
        customTarget: targetType === "custom" ? customTarget : undefined,
      };

      const authToken = localStorage.getItem("magnet_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      if (paidSessionId) {
        const res = await fetch("/api/optimize", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...input, sessionId: paidSessionId }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Optimization failed");
        }
        const data = await res.json();
        sessionStorage.removeItem("paidSessionId");
        onResult(data, input);
      } else {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          if (errData?.code === "AUDIT_LIMIT_REACHED") {
            setError(errData.error || "You've already used your free Magnet analysis. Upgrade to Pro for full guidance.");
            return;
          }
          throw new Error(errData?.error || "Analysis failed");
        }
        const data = await res.json();
        onResult(data, input);
      }
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
          <h2>{paidSessionId ? "Upload for Full Guidance" : "Paste Your Profile"}</h2>
          <p>{paidSessionId ? "Upload your profile to receive your full Magnet guidance with bio advice, prompt suggestions, and photo strategy." : "The more you share, the better the analysis. We don't store anything."}</p>
        </div>
        {paidSessionId && (
          <div className="paid-banner">
            <Sparkles size={16} />
            Full Magnet guidance unlocked — submit your profile to get your results
          </div>
        )}

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
            <label className="form-label">Your email</label>
            <p className="form-hint">{userEmail ? "Signed in — using your account email." : "We'll send your results here so you don't lose them."}</p>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={!!userEmail}
              style={userEmail ? { opacity: 0.7, cursor: "default" } : undefined}
            />
          </div>

          <div className="form-section">
            <label className="form-label">How do you want to share your profile?</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${inputMode === "screenshot" ? "active" : ""}`}
                onClick={() => setInputMode("screenshot")}
              >
                <Camera size={16} />
                Upload screenshots
              </button>
              <button
                type="button"
                className={`mode-btn ${inputMode === "type" ? "active" : ""}`}
                onClick={() => setInputMode("type")}
              >
                <Type size={16} />
                Type it out
              </button>
            </div>
          </div>

          {inputMode === "screenshot" ? (
            <div className="form-section">
              <label className="form-label">Profile Screenshots</label>
              <p className="form-hint">
                Upload screenshots of your dating profile — bio, prompts, anything you want reviewed.
                The AI will read everything from the images.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                multiple
                onChange={handleScreenshotSelect}
                style={{ display: "none" }}
              />
              {screenshots.length > 0 && (
                <div className="screenshot-grid">
                  {screenshots.map((s, i) => (
                    <div key={i} className="screenshot-card">
                      <div className="screenshot-preview">
                        <img src={s.preview} alt={`Screenshot ${i + 1}`} />
                        <button type="button" className="screenshot-remove" onClick={() => removeScreenshot(i)}>
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        className="form-input screenshot-label"
                        placeholder={`What's this? (e.g. "my bio", "prompt 1")`}
                        value={s.label}
                        onChange={(e) => updateScreenshotLabel(i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="upload-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                <div className="upload-btn-text">
                  <span className="upload-btn-title">
                    {screenshots.length === 0 ? "Upload screenshots" : "Add more screenshots"}
                  </span>
                  <span className="upload-btn-hint">PNG, JPG, HEIC — up to 20MB each</span>
                </div>
              </button>
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
            </>
          )}

          <div className="form-section photos-section">
            <label className="form-label">Your Current Profile Photos</label>
            <p className="form-hint">
              Upload the photos currently on your profile, in the order they appear.
              Drag to reorder them.
            </p>
            <input
              ref={currentPhotosRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
              multiple
              onChange={handleCurrentPhotos}
              style={{ display: "none" }}
            />
            {currentPhotos.length > 0 && (
              <div className="photo-grid sortable">
                {currentPhotos.map((p, i) => (
                  <div
                    key={i}
                    className={`photo-card ${dragIndex === i ? "dragging" : ""} ${dragOverIndex === i ? "drag-over" : ""}`}
                    {...(!isTouchDevice ? {
                      draggable: true,
                      onDragStart: () => handleDragStart(i),
                      onDragOver: (e: React.DragEvent) => handleDragOver(e, i),
                      onDragEnd: handleDragEnd
                    } : {})}
                  >
                    <div className="photo-card-img">
                      <img src={p.preview} alt={`Photo ${i + 1}`} />
                      <div className="photo-position-badge">{i + 1}</div>
                      <button type="button" className="screenshot-remove" onClick={() => removeCurrentPhoto(i)}>
                        <X size={14} />
                      </button>
                      <div className="drag-handle desktop-only">
                        <GripVertical size={14} />
                      </div>
                    </div>
                    {currentPhotos.length > 1 && (
                      <div className="mobile-reorder">
                        <button type="button" className="reorder-btn" onClick={() => movePhoto(i, "up")} disabled={i === 0} aria-label="Move up">
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" className="reorder-btn" onClick={() => movePhoto(i, "down")} disabled={i === currentPhotos.length - 1} aria-label="Move down">
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="upload-btn"
              onClick={() => currentPhotosRef.current?.click()}
            >
              <ImagePlus size={18} />
              <div className="upload-btn-text">
                <span className="upload-btn-title">
                  {currentPhotos.length === 0
                    ? "Upload your current profile photos"
                    : `${currentPhotos.length} photo${currentPhotos.length !== 1 ? "s" : ""} — add more`}
                </span>
                <span className="upload-btn-hint">Upload them in the order they appear on your profile (up to {MAX_CURRENT_PHOTOS})</span>
              </div>
            </button>
          </div>

          <div className="form-section photos-section">
            <label className="form-label">Additional Photos</label>
            <p className="form-hint">
              Upload up to {MAX_ADDITIONAL_PHOTOS} extra photos of yourself — group shots, candids, anything.
              The AI will tell you which ones to use and which to swap in.
            </p>
            <input
              ref={additionalPhotosRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
              multiple
              onChange={handleAdditionalPhotos}
              style={{ display: "none" }}
            />
            {additionalPhotos.length > 0 && (
              <div className="photo-grid">
                {additionalPhotos.map((p, i) => (
                  <div key={i} className="photo-card">
                    <div className="photo-card-img">
                      <img src={p.preview} alt={`Additional ${i + 1}`} />
                      <button type="button" className="screenshot-remove" onClick={() => removeAdditionalPhoto(i)}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="upload-btn"
              onClick={() => additionalPhotosRef.current?.click()}
            >
              <ImagePlus size={18} />
              <div className="upload-btn-text">
                <span className="upload-btn-title">
                  {additionalPhotos.length === 0
                    ? "Upload additional photos"
                    : `${additionalPhotos.length} photo${additionalPhotos.length !== 1 ? "s" : ""} — add more`}
                </span>
                <span className="upload-btn-hint">Group photos, candids, selfies — the AI picks the best ones (up to {MAX_ADDITIONAL_PHOTOS})</span>
              </div>
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
                {paidSessionId ? "Generating your guidance..." : "Analyzing your profile..."}
              </>
            ) : paidSessionId ? (
              <>
                <Sparkles size={20} />
                Get My Full Guidance
              </>
            ) : (
              "Analyze My Profile"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
