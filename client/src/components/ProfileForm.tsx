import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, X, Loader2, Upload, GripVertical, ImagePlus, ChevronUp, ChevronDown, Camera } from "lucide-react";
import heic2any from "heic2any";
import { TARGET_QUALITIES, GENDER_OPTIONS, PARTNER_PREFERENCES, PLATFORMS, PLATFORM_PROMPTS } from "@shared/types";
import type { ProfileInput, ProfileResult, PlatformId } from "@shared/types";

interface Props {
  onResult: (data: ProfileResult, input: ProfileInput) => void;
  onBack?: () => void;
  userEmail?: string;
  preselectedPlatform?: string;
}

type Step = "photos" | "details";

interface UploadedPhoto {
  file: File;
  preview: string;
}

interface ScreenshotFile {
  file: File;
  preview: string;
  label: string;
}

interface SelectedPrompt {
  question: string;
  answer: string;
}

const MAX_SCREENSHOTS = 6;
const MAX_CURRENT_PHOTOS = 9;
const MAX_ADDITIONAL_PHOTOS = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/bmp", "image/tiff", "image/svg+xml"];
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

export function ProfileForm({ onResult, onBack, userEmail, preselectedPlatform }: Props) {
  const [platform, setPlatform] = useState<PlatformId>(
    (preselectedPlatform as PlatformId) || "hinge"
  );
  const [email, setEmail] = useState(userEmail || "");
  const [bio, setBio] = useState("");
  const [bioAbout, setBioAbout] = useState("");
  const [selectedPrompts, setSelectedPrompts] = useState<SelectedPrompt[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [currentPhotos, setCurrentPhotos] = useState<UploadedPhoto[]>([]);
  const [friendsPhotos, setFriendsPhotos] = useState<UploadedPhoto[]>([]);
  const [selfiePhotos, setSelfiePhotos] = useState<UploadedPhoto[]>([]);
  const [familyPhotos, setFamilyPhotos] = useState<UploadedPhoto[]>([]);
  const [activitiesPhotos, setActivitiesPhotos] = useState<UploadedPhoto[]>([]);
  const [targetQualities, setTargetQualities] = useState<string[]>([]);
  const [customTarget, setCustomTarget] = useState("");
  const [gender, setGender] = useState("");
  const [attractedTo, setAttractedTo] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("photos");
  const [contextOpen, setContextOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    if (userEmail) setEmail(userEmail);
  }, [userEmail]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const leadPhotoRef = useRef<HTMLInputElement>(null);
  const currentPhotosRef = useRef<HTMLInputElement>(null);
  const friendsRef = useRef<HTMLInputElement>(null);
  const selfiesRef = useRef<HTMLInputElement>(null);
  const familyRef = useRef<HTMLInputElement>(null);
  const activitiesRef = useRef<HTMLInputElement>(null);

  const toggleSelectedPrompt = (question: string) => {
    setSelectedPrompts((prev) => {
      const exists = prev.find((sp) => sp.question === question);
      if (exists) return prev.filter((sp) => sp.question !== question);
      return [...prev, { question, answer: "" }];
    });
  };

  const updatePromptAnswer = (index: number, answer: string) => {
    setSelectedPrompts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], answer };
      return updated;
    });
  };

  const removeSelectedPrompt = (index: number) => {
    setSelectedPrompts((prev) => prev.filter((_, i) => i !== index));
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
        } else if (!file.type.startsWith("image/")) {
          skipped.push(`${file.name} (unsupported file type)`);
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

  const handleLeadPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (leadPhotoRef.current) leadPhotoRef.current.value = "";
    if (!file) return;
    let processed: File;
    if (isHeic(file)) {
      try { processed = await convertHeicToJpeg(file); }
      catch { setError("Couldn't convert this HEIC file."); return; }
    } else if (!file.type.startsWith("image/")) {
      setError("Please upload an image file."); return;
    } else {
      processed = file;
    }
    if (processed.size > MAX_FILE_SIZE) { setError("File is over 20MB."); return; }
    processed = await compressImage(processed);
    const newPhoto = { file: processed, preview: URL.createObjectURL(processed) };
    setCurrentPhotos((prev) => {
      if (prev[0]) URL.revokeObjectURL(prev[0].preview);
      return [newPhoto, ...prev.slice(1)];
    });
  };

  const makeCategoryHandler = (
    setter: React.Dispatch<React.SetStateAction<UploadedPhoto[]>>,
    current: UploadedPhoto[],
    ref: React.RefObject<HTMLInputElement | null>
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files, setter, current, 5);
    if (ref.current) ref.current.value = "";
  };

  const removeCategoryPhoto = (
    setter: React.Dispatch<React.SetStateAction<UploadedPhoto[]>>,
    i: number
  ) => {
    setter((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const removeCurrentPhoto = (i: number) => {
    setCurrentPhotos((prev) => {
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
      } else if (!file.type.startsWith("image/")) {
        skipped.push(`${file.name} (unsupported file type)`);
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

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("platform", platform);
    fd.append("email", email.trim());
    const combinedBio = [
      bio.trim() && `First prompt: ${bio.trim()}`,
      bioAbout.trim() && `Bio/About section: ${bioAbout.trim()}`,
    ].filter(Boolean).join("\n\n");
    fd.append("bio", combinedBio);
    targetQualities.forEach((q) => fd.append("targetQualities", q));
    if (customTarget.trim()) fd.append("customTarget", customTarget);
    if (gender) fd.append("gender", gender);
    attractedTo.forEach((p) => fd.append("partnerPreferences", p));
    selectedPrompts
      .filter((sp) => sp.answer.trim())
      .forEach((sp) => fd.append("prompts", `${sp.question}: ${sp.answer}`));
    screenshots.forEach((s) => { fd.append("screenshots", s.file); fd.append("screenshotLabels", s.label || ""); });
    currentPhotos.forEach((p) => fd.append("currentPhotos", p.file));
    const addLabeled = (photos: UploadedPhoto[], label: string) => {
      photos.forEach((p) => { fd.append("additionalPhotos", p.file); fd.append("additionalPhotoLabels", label); });
    };
    addLabeled(friendsPhotos, "With friends");
    addLabeled(selfiePhotos, "Selfie");
    addLabeled(familyPhotos, "Family");
    addLabeled(activitiesPhotos, "Activity / hobby");
    return fd;
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const formData = buildFormData();
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
          setStep("photos");
          return;
        }
        throw new Error(errData?.error || "Analysis failed");
      }
      const data = await res.json();
      const input: ProfileInput = {
        platform, email: email.trim(), bio,
        prompts: selectedPrompts.filter((sp) => sp.answer.trim()).map((sp) => `${sp.question}: ${sp.answer}`),
        photoDescriptions: [],
        screenshots: [], currentPhotos: [], additionalPhotos: [],
        targetType: targetQualities.join(", "),
        customTarget: customTarget || undefined,
        gender: gender || undefined,
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

  const handlePhotosNext = () => {
    if (!userEmail && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      setError("Please enter a valid email address to continue.");
      return;
    }
    setError("");
    setStep("details");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleDetailsNext = () => {
    if (!gender) {
      setError("Please select your gender.");
      return;
    }
    if (attractedTo.length === 0) {
      setError("Please select at least one gender you're trying to attract.");
      return;
    }
    if (screenshots.length === 0 && !bio.trim()) {
      setError("Please upload a screenshot or type out the first thing written on your profile.");
      return;
    }
    if (!customTarget.trim()) {
      setError("Please describe in your own words who you're trying to attract.");
      return;
    }
    setError("");
    runAnalysis();
  };

  const platformInfo = PLATFORMS.find((p) => p.id === platform);
  const platformPrompts = PLATFORM_PROMPTS[platform] ?? null;


  if (step === "photos") {
    const leadPhoto = currentPhotos[0] ?? null;
    const otherPhotos = currentPhotos.slice(1);
    const CATEGORIES = [
      { key: "friends", label: "Full-body shots", hint: "Profiles hiding their body get 40%+ fewer matches", ref: friendsRef, photos: friendsPhotos, setter: setFriendsPhotos },
      { key: "selfies", label: "Activities & hobbies", hint: "Gets 3× more comments on Hinge than standard posed shots", ref: selfiesRef, photos: selfiePhotos, setter: setSelfiePhotos },
      { key: "family", label: "Travel & adventure", hint: "Outperforms gym selfies — shows an interesting life", ref: familyRef, photos: familyPhotos, setter: setFamilyPhotos },
      { key: "activities", label: "With friends", hint: "Social proof — 1 group shot max, never as your lead", ref: activitiesRef, photos: activitiesPhotos, setter: setActivitiesPhotos },
    ] as const;

    return (
      <div className="form-page">
        <div className="form-container">
          <div className="form-header">
            <h2>Your photos are everything.</h2>
            <p>The AI analyzes each photo — what it signals, what to fix, and what to swap in.</p>
          </div>

          <input id="lead-photo-input" ref={leadPhotoRef} type="file" accept="image/*,.heic,.heif" onChange={handleLeadPhotoSelect} style={{ display: "none" }} />
          <input id="other-photos-input" ref={currentPhotosRef} type="file" accept="image/*,.heic,.heif" multiple onChange={handleCurrentPhotos} style={{ display: "none" }} />
          <input ref={friendsRef} type="file" accept="image/*,.heic,.heif" multiple onChange={makeCategoryHandler(setFriendsPhotos, friendsPhotos, friendsRef)} style={{ display: "none" }} />
          <input ref={selfiesRef} type="file" accept="image/*,.heic,.heif" multiple onChange={makeCategoryHandler(setSelfiePhotos, selfiePhotos, selfiesRef)} style={{ display: "none" }} />
          <input ref={familyRef} type="file" accept="image/*,.heic,.heif" multiple onChange={makeCategoryHandler(setFamilyPhotos, familyPhotos, familyRef)} style={{ display: "none" }} />
          <input ref={activitiesRef} type="file" accept="image/*,.heic,.heif" multiple onChange={makeCategoryHandler(setActivitiesPhotos, activitiesPhotos, activitiesRef)} style={{ display: "none" }} />

          {/* Lead photo */}
          <div className="photos-section">
            <div className="form-label-row">
              <label className="form-label">Lead photo</label>
              <span className="photo-score-badge">60% of your score</span>
            </div>
            <p className="form-hint">The first photo on your profile. This is the one that gets you the swipe — or doesn't.</p>
            {leadPhoto ? (
              <div className="lead-photo-preview">
                <img src={leadPhoto.preview} alt="Lead photo" />
                <div className="photo-position-badge">1</div>
                <button type="button" className="screenshot-remove" onClick={() => removeCurrentPhoto(0)}><X size={14} /></button>
                <label htmlFor="lead-photo-input" className="change-lead-btn">Change</label>
              </div>
            ) : (
              <label htmlFor="lead-photo-input" className="lead-photo-dropzone">
                <ImagePlus size={32} strokeWidth={1.5} />
                <span className="photos-hero-title">Upload lead photo</span>
                <span className="photos-hero-hint">Screenshots work too · JPG, PNG, HEIC, WebP, AVIF & more</span>
              </label>
            )}
          </div>

          {/* Other profile photos */}
          <div className="photos-section">
            <label className="form-label">Other profile photos <span className="form-label-optional">in order</span></label>
            <p className="form-hint">Add the rest of your photos as they appear on your profile.</p>
            {otherPhotos.length > 0 && (
              <div className="photo-grid sortable" style={{ marginBottom: 12 }}>
                {otherPhotos.map((p, i) => (
                  <div
                    key={i}
                    className={`photo-card ${dragIndex === i + 1 ? "dragging" : ""} ${dragOverIndex === i + 1 ? "drag-over" : ""}`}
                    {...(!isTouchDevice ? {
                      draggable: true,
                      onDragStart: () => handleDragStart(i + 1),
                      onDragOver: (e: React.DragEvent) => handleDragOver(e, i + 1),
                      onDragEnd: handleDragEnd,
                    } : {})}
                  >
                    <div className="photo-card-img">
                      <img src={p.preview} alt={`Photo ${i + 2}`} />
                      <div className="photo-position-badge">{i + 2}</div>
                      <button type="button" className="screenshot-remove" onClick={() => removeCurrentPhoto(i + 1)}><X size={14} /></button>
                      <div className="drag-handle desktop-only"><GripVertical size={14} /></div>
                    </div>
                    {otherPhotos.length > 1 && (
                      <div className="mobile-reorder">
                        <button type="button" className="reorder-btn" onClick={() => movePhoto(i + 1, "up")} disabled={i === 0}><ChevronUp size={14} /></button>
                        <button type="button" className="reorder-btn" onClick={() => movePhoto(i + 1, "down")} disabled={i === otherPhotos.length - 1}><ChevronDown size={14} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <label htmlFor="other-photos-input" className="upload-btn">
              <Plus size={16} />
              <div className="upload-btn-text">
                <span className="upload-btn-title">{otherPhotos.length === 0 ? "Add other profile photos" : "Add more photos"}</span>
                <span className="upload-btn-hint">Screenshots work great · JPG, PNG, HEIC, WebP, AVIF & more</span>
              </div>
            </label>
          </div>

          {/* Specific additional photos */}
          <div className="photos-section photos-additional-section">
            <div className="form-label-row">
              <label className="form-label">Photos not on your profile yet</label>
              <span className="form-label-badge">optional · used in full report</span>
            </div>
            <p className="form-hint">Go through your favorites album and upload some that didn't make the cut the first time around.</p>
            <div className="category-photo-list">
              {CATEGORIES.map(({ key, label, hint, ref, photos, setter }) => (
                <div key={key} className="category-photo-row">
                  <div className="category-photo-header">
                    <div>
                      <span className="category-photo-label">{label}</span>
                      <span className="category-photo-hint">{hint}</span>
                    </div>
                    <button type="button" className="photos-add-more-btn" onClick={() => ref.current?.click()}>
                      <Plus size={13} /> Add
                    </button>
                  </div>
                  {photos.length > 0 && (
                    <div className="category-photo-thumbs">
                      {photos.map((p, i) => (
                        <div key={i} className="category-photo-thumb">
                          <img src={p.preview} alt={`${label} ${i + 1}`} />
                          <button type="button" className="category-photo-remove" onClick={() => removeCategoryPhoto(setter, i)}><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!userEmail && (
            <div className="form-section" style={{ marginTop: 24 }}>
              <label className="form-label">Your email</label>
              <p className="form-hint">We'll send your results here so you don't lose them.</p>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <button type="button" className="submit-btn" onClick={handlePhotosNext}>
            {currentPhotos.length > 0
              ? `Continue with ${currentPhotos.length} photo${currentPhotos.length !== 1 ? "s" : ""} →`
              : "Continue →"}
          </button>
          {onBack && (
            <button type="button" className="step-back-btn bottom" onClick={onBack}>
              ← Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "details") {
    return (
      <>
      <div className="form-page">
        <div className="form-container">
          <div className="form-header">
            <h2>Quick profile details</h2>
            <p>A few things to help the AI give you accurate, targeted feedback.</p>
          </div>

          <div className="form-section">
            <div className="form-label-row">
              <label className="form-label">Which app?</label>
              <span className="platform-limit-note">Pick one · <span className="platform-upgrade-link" onClick={() => setShowUpgradeModal(true)}>Upgrade for multi-app</span></span>
            </div>
            <div className="platform-select">
              {PLATFORMS.map((p) => (
                <button key={p.id} type="button" className={`platform-btn ${platform === p.id ? "active" : ""}`} onClick={() => setPlatform(p.id as PlatformId)}>
                  <span className="platform-btn-dot" style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Your gender</label>
            <div className="orientation-grid">
              {GENDER_OPTIONS.map((g) => (
                <button key={g.id} type="button" className={`orientation-btn ${gender === g.id ? "active" : ""}`} onClick={() => setGender(gender === g.id ? "" : g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Gender you're trying to attract <span className="form-label-optional">pick all that apply</span></label>
            <div className="orientation-grid">
              {PARTNER_PREFERENCES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`orientation-btn ${attractedTo.includes(p.id) ? "active" : ""}`}
                  onClick={() => setAttractedTo((prev) =>
                    prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">What's the first thing written on your profile?</label>
            <p className="form-hint">Could be your age, job, a prompt answer — whatever shows up first.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              style={{ display: "none" }}
              onChange={handleScreenshotSelect}
            />
            <div className="bio-screenshot-row">
              {screenshots.map((s, i) => (
                <div key={i} className="bio-screenshot-thumb">
                  <img src={s.preview} alt={`screenshot ${i + 1}`} />
                  <button type="button" className="bio-screenshot-remove" onClick={() => removeScreenshot(i)}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {screenshots.length < MAX_SCREENSHOTS && (
                <button type="button" className="bio-screenshot-add" onClick={() => fileInputRef.current?.click()}>
                  <Camera size={15} />
                  Upload screenshot of first prompt
                </button>
              )}
            </div>
            <label className="form-sublabel" style={{ marginTop: 12 }}>Or type it out</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="e.g. '28 · Designer · Boston' or paste your first prompt answer..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="form-section">
            <button type="button" className="context-toggle-btn" onClick={() => setBioOpen(!bioOpen)}>
              <span>Any bio or about section?</span>
              <span className="form-label-badge">optional</span>
              {bioOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <p className="form-hint" style={{ marginTop: 6 }}>Paste in your full bio or about me text — helps the AI give more targeted feedback.</p>
            {bioOpen && (
              <div className="context-toggle-body">
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Paste or type your bio / about section here..."
                  value={bioAbout}
                  onChange={(e) => setBioAbout(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="form-label-row">
              <label className="form-label">Who are you trying to attract?</label>
              <span className="form-label-optional">{targetQualities.length}/5 · optional</span>
            </div>
            <div className="tag-select-grid">
              {TARGET_QUALITIES.map((q) => {
                const selected = targetQualities.includes(q);
                const maxed = targetQualities.length >= 5 && !selected;
                return (
                  <button
                    key={q}
                    type="button"
                    className={`tag-select-btn ${selected ? "active" : ""} ${maxed ? "maxed" : ""}`}
                    onClick={() => {
                      if (selected) setTargetQualities((prev) => prev.filter((x) => x !== q));
                      else if (targetQualities.length < 5) setTargetQualities((prev) => [...prev, q]);
                    }}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="form-label" style={{ marginBottom: 6 }}>Describe in your own words</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Ambitious but laid-back, loves travel, has a weird sense of humor..."
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="button" className="submit-btn" onClick={handleDetailsNext} disabled={loading}>
            {loading ? <><Loader2 size={18} className="spin" /> Analyzing your profile…</> : "Continue →"}
          </button>
          <button type="button" className="step-back-btn bottom" onClick={() => { setStep("photos"); window.scrollTo({ top: 0, behavior: "instant" }); }}>
            ← Back to photos
          </button>
        </div>
      </div>

      {showUpgradeModal && (
        <div className="upgrade-modal-backdrop" onClick={() => setShowUpgradeModal(false)}>
          <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <button className="upgrade-modal-close" onClick={() => setShowUpgradeModal(false)}>
              <X size={18} />
            </button>
            <div className="upgrade-modal-icon">🔥</div>
            <h3 className="upgrade-modal-title">Multi-app analysis</h3>
            <p className="upgrade-modal-desc">
              Run a full analysis across multiple dating apps in one go — Tinder, Hinge, Bumble and more. See exactly how your profile performs on each platform and what to change per app.
            </p>
            <div className="upgrade-modal-pricing">
              <div className="upgrade-modal-price-row">
                <span className="upgrade-modal-plan">Profile Pack</span>
                <span className="upgrade-modal-amount">$10.99</span>
              </div>
              <p className="upgrade-modal-plan-desc">3 full reports — everything in the Full Report, for 3 separate dating app profiles</p>
            </div>
            <button className="upgrade-modal-cta" disabled>
              Coming soon — join the waitlist below
            </button>
          </div>
        </div>
      )}
      </>
    );
  }

  return null;
}
