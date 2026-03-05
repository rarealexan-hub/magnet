import type { ProfileInput } from "../shared/types.js";

type ValidationResult =
  | { success: true; data: ProfileInput }
  | { success: false; error: string };

export function validateProfileInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Invalid request body" };
  }

  const b = body as Record<string, unknown>;

  const validPlatforms = ["hinge", "tinder", "bumble", "other"];
  if (!b.platform || !validPlatforms.includes(b.platform as string)) {
    return { success: false, error: "Invalid platform" };
  }

  const bio = typeof b.bio === "string" ? b.bio : "";
  const prompts = Array.isArray(b.prompts)
    ? b.prompts.filter((p): p is string => typeof p === "string")
    : [];
  const photoDescriptions = Array.isArray(b.photoDescriptions)
    ? b.photoDescriptions.filter((p): p is string => typeof p === "string")
    : [];

  if (!bio.trim() && prompts.every((p) => !p.trim())) {
    return { success: false, error: "Please provide at least a bio or one prompt" };
  }

  if (typeof b.targetType !== "string" || !b.targetType.trim()) {
    return { success: false, error: "Please select a target match type" };
  }

  return {
    success: true,
    data: {
      platform: b.platform as ProfileInput["platform"],
      bio,
      prompts,
      photoDescriptions,
      targetType: b.targetType as string,
      customTarget: typeof b.customTarget === "string" ? b.customTarget : undefined,
    },
  };
}
