import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, X, Loader2, Upload, Type, Camera, GripVertical, ImagePlus, ChevronUp, ChevronDown } from "lucide-react";
import heic2any from "heic2any";
import { TARGET_TYPES, SEXUAL_ORIENTATIONS, PARTNER_PREFERENCES } from "@shared/types";
import type { ProfileInput, ProfileResult } from "@shared/types";

interface Props {
  onResult: (data: ProfileResult, input: ProfileInput) => void;
  userEmail?: string;
  preselectedPlatform?: string;
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

function compressImage(file: File, maxDim = 1600, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); URL.revokeObjectURL(url); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            canvas.width = 0;
            canvas.height = 0;
            if (!blob || blob.size < 100) { resolve(file); return; }
            const name = file.name.replace(/\.[^.]+$/, ".jpg");
            resolve(new File([blob], name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function ProfileForm({ onResult, userEmail, preselectedPlatform }: Props) {
  const [platform, setPlatform] = useState<ProfileInput["platform"]>(
    (preselectedPlatform as ProfileInput["platform"]) || "hinge"
  );
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
  const [sexualOrientation, setSexualOrientation] = useState("");
  const [partnerPreferences, setPartnerPreferences] = useState<string[]>([]);
  const [step, setStep] = useState<"form" | "taste">("form");
  const [tasteSelections, setTasteSelections] = useState<string[]>([]);
  const togglePartnerPref = (id: string) => {
    setPartnerPreferences((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleTaste = (id: string) => {
    setTasteSelections((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    if (userEmail) setEmail(userEmail);
  }, [userEmail]);

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
        let processed: File;
        if (isHeic(file)) {
          try {
            processed = await convertHeicToJpeg(file);
          } catch {
            skipped.push(`${file.name} (failed to convert HEIC)`);
            continue;
          }
        } else if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          skipped.push(`${file.name} (use JPG, PNG, GIF, WebP, or HEIC)`);
          continue;
        } else {
          processed = file;
        }
        if (processed.size > MAX_FILE_SIZE) {
          skipped.push(`${file.name} (over 20MB)`);
          continue;
        }
        processed = await compressImage(processed);
        newPhotos.push({ file: processed, preview: URL.createObjectURL(processed) });
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
      let processed: File;
      if (isHeic(file)) {
        try {
          processed = await convertHeicToJpeg(file);
        } catch {
          skipped.push(`${file.name} (couldn't process this image)`);
          continue;
        }
      } else if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        skipped.push(`${file.name} (unsupported format)`);
        continue;
      } else {
        processed = file;
      }
      if (processed.size > MAX_FILE_SIZE) {
        skipped.push(`${file.name} (over 20MB)`);
        continue;
      }
      processed = await compressImage(processed);
      newScreenshots.push({ file: processed, preview: URL.createObjectURL(processed), label: "" });
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

  const buildFormData = (tasteVibes: string[]) => {
    const fd = new FormData();
    fd.append("platform", platform);
    fd.append("email", email.trim());
    fd.append("bio", bio);
    fd.append("targetType", targetType);
    if (targetType === "custom" && customTarget) fd.append("customTarget", customTarget);
    if (sexualOrientation) fd.append("sexualOrientation", sexualOrientation);
    partnerPreferences.forEach((p) => fd.append("partnerPreferences", p));
    tasteVibes.forEach((v) => fd.append("photoTasteSelections", v));
    prompts.filter((p) => p.trim()).forEach((p) => fd.append("prompts", p));
    photoDescriptions.filter((p) => p.trim()).forEach((p) => fd.append("photoDescriptions", p));
    screenshots.forEach((s) => { fd.append("screenshots", s.file); fd.append("screenshotLabels", s.label || ""); });
    currentPhotos.forEach((p) => fd.append("currentPhotos", p.file));
    additionalPhotos.forEach((p) => fd.append("additionalPhotos", p.file));
    return fd;
  };

  const runAnalysis = async (tasteVibes: string[]) => {
    setLoading(true);
    setError("");
    try {
      const formData = buildFormData(tasteVibes);
      const authToken = localStorage.getItem("magnet_token");
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const res = await fetch("/api/analyze", { method: "POST", headers, body: formData, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (errData?.code === "AUDIT_LIMIT_REACHED") {
          setError(errData.error || "You've already used your free Magnet analysis.");
          setStep("form");
          return;
        }
        throw new Error(errData?.error || "Analysis failed");
      }
      const data = await res.json();
      const input: ProfileInput = {
        platform, email: email.trim(), bio,
        prompts: prompts.filter((p) => p.trim()),
        photoDescriptions: photoDescriptions.filter((p) => p.trim()),
        screenshots: [], currentPhotos: [], additionalPhotos: [],
        targetType,
        customTarget: targetType === "custom" ? customTarget : undefined,
        sexualOrientation: sexualOrientation || undefined,
        partnerPreferences: partnerPreferences.length > 0 ? partnerPreferences : undefined,
        photoTasteSelections: tasteVibes.length > 0 ? tasteVibes : undefined,
      };
      onResult(data, input);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Analysis timed out. Please try with fewer photos or a stronger connection.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasTextContent = bio.trim() || prompts.some((p) => p.trim());
    const hasScreenshots = screenshots.length > 0;
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
    setError("");
    setTasteSelections([]);
    setStep("taste");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const TASTE_PHOTOS = [
    {
      id: "adventurous",
      label: "Adventurous & Active",
      description: "Outdoors, travel, high energy",
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=500&fit=crop&auto=format&q=80",
    },
    {
      id: "sophisticated",
      label: "Polished & Confident",
      description: "Stylish, refined, put-together",
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&auto=format&q=80",
    },
    {
      id: "candid",
      label: "Natural & Authentic",
      description: "Genuine moments, real smiles",
      url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=500&fit=crop&auto=format&q=80",
    },
    {
      id: "playful",
      label: "Fun & Playful",
      description: "Lighthearted, laughing, expressive",
      url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop&auto=format&q=80",
    },
  ] as const;

  if (step === "taste") {
    return (
      <div className="form-page">
        <div className="form-container">
          <div className="form-header">
            <h2>What draws you in?</h2>
            <p>Pick the 2 photo styles you find most attractive. This helps us tailor your profile advice.</p>
          </div>
          <div className="taste-grid">
            {TASTE_PHOTOS.map((photo) => {
              const selected = tasteSelections.includes(photo.id);
              const maxed = tasteSelections.length >= 2 && !selected;
              return (
                <button
                  key={photo.id}
                  type="button"
                  className={`taste-card ${selected ? "selected" : ""} ${maxed ? "dimmed" : ""}`}
                  onClick={() => toggleTaste(photo.id)}
                >
                  <div className="taste-img-wrap">
                    <img src={photo.url} alt={photo.label} className="taste-img" loading="lazy" />
                    {selected && (
                      <div className="taste-check">
                        <span>✓</span>
                      </div>
                    )}
                    {!selected && tasteSelections.indexOf(photo.id) === -1 && !maxed && (
                      <div className="taste-number">
                        {tasteSelections.length === 0 ? "1st" : "2nd"}
                      </div>
                    )}
                  </div>
                  <div className="taste-card-body">
                    <p className="taste-label">{photo.label}</p>
                    <p className="taste-desc">{photo.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="taste-footer">
            <p className="taste-progress">
              {tasteSelections.length === 0 && "Select 2 photos to continue"}
              {tasteSelections.length === 1 && "Select 1 more to continue"}
              {tasteSelections.length === 2 && "Ready — let's analyze your profile"}
            </p>
            <button
              type="button"
              className="submit-btn"
              disabled={tasteSelections.length < 2 || loading}
              onClick={() => runAnalysis(tasteSelections)}
            >
              {loading ? (
                <><Loader2 size={20} className="spin" /> Analyzing your profile...</>
              ) : (
                "Analyze My Profile →"
              )}
            </button>
            <button type="button" className="taste-back-btn" onClick={() => setStep("form")}>
              ← Back to profile
            </button>
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page">
      <div className="form-container">
        <div className="form-header">
          <h2>Paste Your Profile</h2>
          <p>The more you share, the better the analysis. We don't store anything.</p>
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
            <label className="form-label">Your sexual orientation</label>
            <p className="form-hint">Helps the AI give context-relevant feedback for your platform and audience.</p>
            <div className="orientation-grid">
              {SEXUAL_ORIENTATIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`orientation-btn ${sexualOrientation === o.id ? "active" : ""}`}
                  onClick={() => setSexualOrientation(sexualOrientation === o.id ? "" : o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Who are you attracted to?</label>
            <p className="form-hint">Select all that apply — the AI will tailor match targeting advice accordingly.</p>
            <div className="pref-grid">
              {PARTNER_PREFERENCES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pref-btn ${partnerPreferences.includes(p.id) ? "active" : ""}`}
                  onClick={() => togglePartnerPref(p.id)}
                >
                  {partnerPreferences.includes(p.id) && <span className="pref-check">✓</span>}
                  {p.label}
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
                accept="image/*,.heic,.heif"
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
          )}

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

          <div className="form-section photos-section">
            <label className="form-label">Your Current Profile Photos</label>
            <p className="form-hint">
              Upload the photos currently on your profile, in the order they appear.
              Drag to reorder them.
            </p>
            <input
              ref={currentPhotosRef}
              type="file"
              accept="image/*,.heic,.heif"
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
            <div className="form-label-row">
              <label className="form-label">Additional Photos</label>
              <span className="form-label-badge">Used in $2.99 Full Report</span>
            </div>
            <p className="form-hint">
              Upload extra photos you haven't used yet — candids, group shots, travel, anything.
              The Full Report will compare them against your current lineup and tell you <strong>exactly which ones to swap in and where</strong>, with side-by-side previews.
            </p>
            <input
              ref={additionalPhotosRef}
              type="file"
              accept="image/*,.heic,.heif"
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
                Analyzing your profile...
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
