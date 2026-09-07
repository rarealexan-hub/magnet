import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, X, Loader2, Upload, GripVertical, ImagePlus, ChevronUp, ChevronDown, Camera } from "lucide-react";
import heic2any from "heic2any";
import { TARGET_QUALITIES, GENDER_OPTIONS, PARTNER_PREFERENCES, PLATFORMS, PLATFORM_PROMPTS } from "@shared/types";
import type { ProfileInput, ProfileResult, PlatformId } from "@shared/types";
import { trackAnalysisStarted, trackAnalysisComplete } from "../lib/analytics";

interface Props {
  onResult: (data: ProfileResult, input: ProfileInput) => void;
  onBack?: () => void;
  userEmail?: string;
  preselectedPlatform?: string;
}

type Step = "photos" | "details" | "calibration";

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
const HIDDEN_PLATFORM_OPTIONS = new Set([
  "okcupid",
  "coffee-meets-bagel",
  "plenty-of-fish",
  "zoosk",
  "badoo",
]);
const SELECTABLE_PLATFORMS = PLATFORMS.filter((platform) => !HIDDEN_PLATFORM_OPTIONS.has(platform.id));

const CALIBRATION_EXAMPLES = [
  { id: "clear-solo", label: "Clear solo portrait", detail: "Face-forward, relaxed, easy to read", tone: "sand" },
  { id: "active-outdoors", label: "Active outdoors", detail: "A real setting with something going on", tone: "pine" },
  { id: "social-context", label: "Social context", detail: "You with friends, still easy to identify", tone: "blue" },
  { id: "personal-style", label: "Personal style", detail: "A look that says something specific", tone: "plum" },
  { id: "creative-hobby", label: "Creative hobby", detail: "A detail that opens a conversation", tone: "gold" },
  { id: "quiet-candid", label: "Quiet candid", detail: "Natural expression, no heavy posing", tone: "rose" },
] as const;

type CalibrationAudience = "men" | "women" | "diverse";

function calibrationAudiences(preferences: string[]): CalibrationAudience[] {
  if (preferences.includes("any-gender")) return ["men", "women", "diverse"];

  const audiences: CalibrationAudience[] = [];
  if (preferences.some((value) => value === "men" || value === "trans-men")) audiences.push("men");
  if (preferences.some((value) => value === "women" || value === "trans-women")) audiences.push("women");
  if (preferences.some((value) => value === "non-binary" || value === "genderfluid")) audiences.push("diverse");
  return audiences.length > 0 ? audiences : ["diverse"];
}

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
  const [sexualOrientation, setSexualOrientation] = useState("");
  const [locationMarket, setLocationMarket] = useState("");
  const [relationshipIntent, setRelationshipIntent] = useState("");
  const [datingStruggle, setDatingStruggle] = useState("");
  const [preferredTone, setPreferredTone] = useState("");
  const [photoTasteSelections, setPhotoTasteSelections] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("photos");
  const [contextOpen, setContextOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState("");

  const LOADING_MESSAGES = [
    "Reading your photos...",
    "Scoring your first impression...",
    "Identifying what's working...",
    "Finding what's driving matches away...",
    "Analyzing your signals...",
    "Building your Magnet Score...",
    "Checking your photo order...",
    "Almost there...",
  ];

  useEffect(() => {
    if (!loading) { setLoadingMsgIndex(0); return; }
    const id = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [loading]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragUploadTarget, setDragUploadTarget] = useState<string | null>(null);
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

  const [additionalPromptEntries, setAdditionalPromptEntries] = useState<
    { screenshot: { file: File; preview: string } | null; text: string }[]
  >([]);
  const additionalPromptFileRef = useRef<HTMLInputElement>(null);
  const additionalPromptEditIndex = useRef<number>(-1);

  const handleAdditionalPromptScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = additionalPromptEditIndex.current;
    if (!file || idx < 0) return;
    const preview = URL.createObjectURL(file);
    setAdditionalPromptEntries((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], screenshot: { file, preview } };
      return updated;
    });
    e.target.value = "";
  };

  const addAdditionalPrompt = () => {
    setAdditionalPromptEntries((prev) => [...prev, { screenshot: null, text: "" }]);
  };

  const removeAdditionalPrompt = (i: number) => {
    setAdditionalPromptEntries((prev) => prev.filter((_, idx) => idx !== i));
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

  const processLeadPhoto = useCallback(async (file: File) => {
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
  }, []);

  const handleLeadPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (leadPhotoRef.current) leadPhotoRef.current.value = "";
    if (file) await processLeadPhoto(file);
  };

  const handleUploadDragOver = (e: React.DragEvent<HTMLElement>, target: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragUploadTarget(target);
  };

  const handleUploadDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragUploadTarget(null);
  };

  const handleLeadPhotoDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragUploadTarget(null);
    const file = e.dataTransfer.files?.[0];
    if (file) await processLeadPhoto(file);
  };

  const handlePhotoDrop = (
    e: React.DragEvent<HTMLElement>,
    setter: React.Dispatch<React.SetStateAction<UploadedPhoto[]>>,
    current: UploadedPhoto[],
    max: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragUploadTarget(null);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files, setter, current, max);
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
    if (sexualOrientation) fd.append("sexualOrientation", sexualOrientation);
    if (locationMarket.trim()) fd.append("locationMarket", locationMarket.trim());
    if (relationshipIntent) fd.append("relationshipIntent", relationshipIntent);
    if (datingStruggle.trim()) fd.append("datingStruggle", datingStruggle.trim());
    if (preferredTone) fd.append("preferredTone", preferredTone);
    photoTasteSelections.forEach((selection) => fd.append("photoTasteSelections", selection));
    attractedTo.forEach((p) => fd.append("partnerPreferences", p));
    selectedPrompts
      .filter((sp) => sp.answer.trim())
      .forEach((sp) => fd.append("prompts", `${sp.question}: ${sp.answer}`));
    additionalPromptEntries.forEach((entry, i) => {
      if (entry.screenshot) {
        fd.append("screenshots", entry.screenshot.file);
        fd.append("screenshotLabels", `Additional prompt ${i + 1}`);
      }
      if (entry.text.trim()) fd.append("prompts", entry.text.trim());
    });
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
    trackAnalysisStarted(platform);
    setLoading(true);
    setError("");
    try {
      const formData = buildFormData();
      const authToken = localStorage.getItem("magnet_token");
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const submitRes = await fetch("/api/analyze", { method: "POST", headers, body: formData });
      if (!submitRes.ok) {
        const errData = await submitRes.json().catch(() => null);
        if (errData?.code === "AUDIT_LIMIT_REACHED") {
          setError(errData.error || "You've already used your free Magnet analysis.");
          setStep("photos");
          return;
        }
        throw new Error(errData?.error || "Analysis failed");
      }
      const { jobId } = await submitRes.json();
      if (!jobId) throw new Error("Failed to start analysis. Please try again.");

      const deadline = Date.now() + 5 * 60 * 1000;
      await new Promise<void>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() > deadline) {
            reject(new Error("Analysis timed out. Please try with fewer photos or a stronger connection."));
            return;
          }
          try {
            const pollRes = await fetch(`/api/analyze/result/${jobId}`);
            const pollData = await pollRes.json();
            if (pollData.status === "done") {
              const input: ProfileInput = {
                platform, email: email.trim(), bio,
                prompts: selectedPrompts.filter((sp) => sp.answer.trim()).map((sp) => `${sp.question}: ${sp.answer}`),
                photoDescriptions: [],
                screenshots: [], currentPhotos: [], additionalPhotos: [],
                 targetType: targetQualities.join(", "),
                customTarget: customTarget || undefined,
                gender: gender || undefined,
                 sexualOrientation: sexualOrientation || undefined,
                 partnerPreferences: attractedTo,
                 relationshipIntent: relationshipIntent || undefined,
                 locationMarket: locationMarket || undefined,
                 datingStruggle: datingStruggle || undefined,
                 preferredTone: preferredTone || undefined,
                 photoTasteSelections,
              };
              trackAnalysisComplete(platform, pollData.result?.score?.overall ?? 0);
              onResult(pollData.result, input);
              resolve();
            } else if (pollData.status === "error") {
              reject(new Error(pollData.error || "Analysis failed. Please try again."));
            } else {
              setTimeout(poll, 3000);
            }
          } catch {
            setTimeout(poll, 3000);
          }
        };
        poll();
      });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotosNext = () => {
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
    setError("");
    setStep("calibration");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleCalibrationSubmit = () => {
    if (!userEmail && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      setError("Please enter a valid email address to continue.");
      return;
    }
    if (photoTasteSelections.length !== 3) {
      setError("Choose exactly three examples to continue.");
      return;
    }
    runAnalysis();
  };

  const platformInfo = PLATFORMS.find((p) => p.id === platform);
  const platformPrompts = PLATFORM_PROMPTS[platform] ?? null;


  if (loading) {
    return (
      <div className="analyzing-overlay">
        <div className="analyzing-inner">
          <div className="analyzing-logo">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0EA5E9" />
                  <stop offset="100%" stopColor="#00C9A7" />
                </linearGradient>
              </defs>
              <path d="M10 2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6z"/>
              <path d="M10 12 4 18"/>
              <path d="M14 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <h2 className="analyzing-title">Analyzing your profile</h2>
          <p className="analyzing-msg">{LOADING_MESSAGES[loadingMsgIndex]}</p>
          <div className="analyzing-bar-track">
            <div className="analyzing-bar-fill" />
          </div>
          <p className="analyzing-note">This usually takes 20–40 seconds</p>
        </div>
      </div>
    );
  }

  if (step === "photos") {
    const leadPhoto = currentPhotos[0] ?? null;
    const otherPhotos = currentPhotos.slice(1);
    const CATEGORIES = [
      { key: "friends", label: "Full-body shots", hint: "Profiles hiding their body get 40%+ fewer matches", ref: friendsRef, photos: friendsPhotos, setter: setFriendsPhotos },
      { key: "selfies", label: "Candid face shot", hint: "Face clearly visible, looking at camera — natural, not posed. Think candid headshot.", ref: selfiesRef, photos: selfiePhotos, setter: setSelfiePhotos },
      { key: "family", label: "Travel & adventure", hint: "Outperforms gym selfies — shows an interesting life", ref: familyRef, photos: familyPhotos, setter: setFamilyPhotos },
      { key: "activities", label: "With friends", hint: "Social proof — 1 group shot max, never as your lead", ref: activitiesRef, photos: activitiesPhotos, setter: setActivitiesPhotos },
    ] as const;

    return (
      <div className="form-page">
        <div className="form-container">
          <div className="form-header">
            <h2>Your photos are everything.</h2>
            <p>We analyze each photo — what it signals, what to fix, and what to swap in.</p>
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
              <label
                htmlFor="lead-photo-input"
                className={`lead-photo-dropzone ${dragUploadTarget === "lead" ? "is-dragging-files" : ""}`}
                onDragEnter={(e) => handleUploadDragOver(e, "lead")}
                onDragOver={(e) => handleUploadDragOver(e, "lead")}
                onDragLeave={handleUploadDragLeave}
                onDrop={handleLeadPhotoDrop}
              >
                <ImagePlus size={32} strokeWidth={1.5} />
                <span className="photos-hero-title">Upload lead photo</span>
                <span className="photos-hero-hint">Drop a photo here or tap to browse · JPG, PNG, HEIC, WebP, AVIF & more</span>
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
            <label
              htmlFor="other-photos-input"
              className={`upload-btn ${dragUploadTarget === "other" ? "is-dragging-files" : ""}`}
              onDragEnter={(e) => handleUploadDragOver(e, "other")}
              onDragOver={(e) => handleUploadDragOver(e, "other")}
              onDragLeave={handleUploadDragLeave}
              onDrop={(e) => handlePhotoDrop(e, setCurrentPhotos, currentPhotos, MAX_CURRENT_PHOTOS)}
            >
              <Plus size={16} />
              <div className="upload-btn-text">
                <span className="upload-btn-title">{otherPhotos.length === 0 ? "Add other profile photos" : "Add more photos"}</span>
                <span className="upload-btn-hint">Drop photos here or tap to browse · JPG, PNG, HEIC, WebP, AVIF & more</span>
              </div>
            </label>
          </div>

          {/* Specific additional photos */}
          <div className="photos-section photos-additional-section">
            <div className="form-label-row">
              <label className="form-label">Extra photos to consider</label>
              <span className="form-label-badge">Optional but suggested</span>
            </div>
            <p className="form-hint">Go through your favorites album and upload some that didn't make the cut the first time around.</p>
            <div className="category-photo-list">
              {CATEGORIES.map(({ key, label, hint, ref, photos, setter }) => (
                <div
                  key={key}
                  className={`category-photo-row ${dragUploadTarget === key ? "is-dragging-files" : ""}`}
                  onDragEnter={(e) => handleUploadDragOver(e, key)}
                  onDragOver={(e) => handleUploadDragOver(e, key)}
                  onDragLeave={handleUploadDragLeave}
                  onDrop={(e) => handlePhotoDrop(e, setter, photos, 5)}
                >
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
            <p>A few things to help us give you accurate, targeted feedback.</p>
          </div>

          <div className="form-section">
            <div className="form-label-row">
              <label className="form-label">Which app?</label>
              <span className="platform-limit-note">Pick one</span>
            </div>
            <div className="platform-select">
              {SELECTABLE_PLATFORMS.map((p) => (
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

          <div className="form-section">
            <label className="form-label">Your orientation <span className="form-label-optional">optional</span></label>
            <div className="orientation-grid">
              {[
                ["straight", "Straight"], ["gay", "Gay / Lesbian"], ["bisexual", "Bisexual"],
                ["pansexual", "Pansexual"], ["queer", "Queer"], ["prefer-not-to-say", "Prefer not to say"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`orientation-btn ${sexualOrientation === id ? "active" : ""}`} onClick={() => setSexualOrientation(sexualOrientation === id ? "" : id)}>
                  {label}
                </button>
              ))}
            </div>
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

          <div className="form-section audit-context-grid">
            <div>
              <label className="form-label">Where are you dating?</label>
              <p className="form-hint">City, region, or market type helps us calibrate the read.</p>
              <input className="form-input" placeholder="e.g. New York, college town, suburban market" value={locationMarket} onChange={(e) => setLocationMarket(e.target.value)} />
            </div>
            <div>
              <label className="form-label">What are you looking for?</label>
              <select className="form-input" value={relationshipIntent} onChange={(e) => setRelationshipIntent(e.target.value)}>
                <option value="">Choose one</option>
                <option value="long-term">Long-term relationship</option>
                <option value="short-term">Short-term / casual</option>
                <option value="open-to-both">Open to both</option>
                <option value="marriage-minded">Marriage-minded</option>
                <option value="figuring-it-out">Still figuring it out</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">What is not working right now? <span className="form-label-optional">optional</span></label>
            <textarea className="form-textarea" rows={3} placeholder="Tell us what you want this audit to solve — low matches, weak conversations, the wrong people, or something else." value={datingStruggle} onChange={(e) => setDatingStruggle(e.target.value)} />
          </div>

          <div className="form-section">
            <div className="form-label-row">
              <label className="form-label">What's the first thing written on your profile?</label>
              <span className="form-label-badge">optional</span>
            </div>
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
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="e.g. '28 · Designer · Boston' or paste your first prompt answer..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="form-section">
            <label className="form-label">What tone should your profile have?</label>
            <p className="form-hint">Pick the direction that feels most like you at your best.</p>
            <div className="tag-select-grid">
              {["Warm & approachable", "Funny & playful", "Confident & direct", "Thoughtful & intentional", "Dry & understated", "Adventurous & spontaneous"].map((tone) => (
                <button key={tone} type="button" className={`tag-select-btn ${preferredTone === tone ? "active" : ""}`} onClick={() => setPreferredTone(preferredTone === tone ? "" : tone)}>
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div className="form-label-row">
              <label className="form-label">Additional prompts</label>
              <span className="form-label-badge">optional</span>
            </div>
            <p className="form-hint">Add any other prompts from your profile so we can review them too.</p>
            <input
              ref={additionalPromptFileRef}
              type="file"
              accept="image/*,.heic,.heif"
              style={{ display: "none" }}
              onChange={handleAdditionalPromptScreenshot}
            />
            {additionalPromptEntries.map((entry, i) => (
              <div key={i} className="prompt-answer-item">
                <div className="prompt-answer-header">
                  <span className="prompt-answer-question" style={{ fontWeight: 500, fontSize: 13 }}>Prompt {i + 1}</span>
                  <button type="button" className="prompt-answer-remove" onClick={() => removeAdditionalPrompt(i)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="bio-screenshot-row" style={{ marginBottom: 8 }}>
                  {entry.screenshot && (
                    <div className="bio-screenshot-thumb">
                      <img src={entry.screenshot.preview} alt={`prompt ${i + 1} screenshot`} />
                      <button type="button" className="bio-screenshot-remove" onClick={() =>
                        setAdditionalPromptEntries((prev) => {
                          const updated = [...prev];
                          updated[i] = { ...updated[i], screenshot: null };
                          return updated;
                        })
                      }>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {!entry.screenshot && (
                    <button type="button" className="bio-screenshot-add" onClick={() => {
                      additionalPromptEditIndex.current = i;
                      additionalPromptFileRef.current?.click();
                    }}>
                      <Camera size={15} />
                      Upload screenshot
                    </button>
                  )}
                </div>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Or type the prompt and your answer…"
                  value={entry.text}
                  onChange={(e) => setAdditionalPromptEntries((prev) => {
                    const updated = [...prev];
                    updated[i] = { ...updated[i], text: e.target.value };
                    return updated;
                  })}
                />
              </div>
            ))}
            <button type="button" className="bio-screenshot-add" style={{ marginTop: 8 }} onClick={addAdditionalPrompt}>
              <Plus size={15} />
              Add prompt
            </button>
          </div>

          <div className="form-reminder">
            <span className="form-reminder-label">Reminder</span>
            The more you give us, the less we have to guess — and the more precisely we can fix you.
          </div>

          <div className="form-section">
            <button type="button" className="context-toggle-btn" onClick={() => setBioOpen(!bioOpen)}>
              <span>Any bio or about section?</span>
              <span className="form-label-badge">optional</span>
              {bioOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <p className="form-hint" style={{ marginTop: 6 }}>Paste in your full bio or about me text — helps us give more targeted feedback.</p>
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
              <div className="form-label-row" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Describe in your own words</label>
                <span className="form-label-badge">optional</span>
              </div>
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
            Continue to photo calibration →
          </button>
          <button type="button" className="step-back-btn bottom" onClick={() => { setStep("photos"); window.scrollTo({ top: 0, behavior: "instant" }); }}>
            ← Back to photos
          </button>
        </div>
      </div>

      </>
    );
  }

  if (step === "calibration") {
    const audiencePools = calibrationAudiences(attractedTo);
    const toggleCalibration = (id: string) => {
      setPhotoTasteSelections((current) => current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 3 ? [...current, id] : current);
    };

    return (
      <div className="form-page">
        <div className="form-container calibration-container">
          <div className="form-header">
            <p className="audit-eyebrow">Final step · 03 / 03</p>
            <h2>What makes a profile catch your eye?</h2>
            <p>These are artificial examples, not real people. Pick the three profile-photo directions you instinctively respond to most. Your choices help calibrate the audit to your taste.</p>
          </div>
          <div className="calibration-grid">
            {CALIBRATION_EXAMPLES.map((example, exampleIndex) => {
              const selectedIndex = photoTasteSelections.indexOf(example.id);
              const audience = audiencePools[exampleIndex % audiencePools.length];
              return (
                <button key={example.id} type="button" className={`calibration-card ${selectedIndex >= 0 ? "selected" : ""}`} onClick={() => toggleCalibration(example.id)}>
                  <span className="calibration-image">
                    <img
                      src={`/calibration/${audience}/${example.id}.jpg`}
                      alt={`${example.label} example`}
                    />
                  </span>
                  <span className="calibration-card-copy"><strong>{example.label}</strong><small>{example.detail}</small></span>
                  <span className="calibration-check">{selectedIndex >= 0 ? selectedIndex + 1 : ""}</span>
                </button>
              );
            })}
          </div>
          {!userEmail && (
            <div className="form-section calibration-email-section">
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
          <div className="calibration-footer">
            <span>{photoTasteSelections.length} of 3 selected</span>
            <div className="step-nav">
              <button type="button" className="step-back-btn" onClick={() => { setStep("details"); window.scrollTo({ top: 0, behavior: "instant" }); }}>Back</button>
              <button type="button" className="submit-btn step-continue-btn" onClick={handleCalibrationSubmit} disabled={loading || photoTasteSelections.length !== 3}>
                {loading ? <><Loader2 size={18} className="spin" /> Building your audit…</> : "Generate my Magnet Profile Audit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
