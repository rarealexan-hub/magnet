import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { ProfileInput, ProfileResult } from "../shared/types.js";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are Magnet — the world's best dating profile analyst and advisor. Witty, slightly teasing, but genuinely helpful. You analyze profiles and give clear, actionable guidance on what to change. You don't rewrite things for people — you show them exactly what's wrong and what to do about it.

Key principles you follow:
1. HIGH-SIGNAL profiles perform best: specific interests, clear personality, good prompts that reveal thinking
2. GENERIC profiles underperform: "love traveling and good food" tells no one anything
3. The best profiles combine HIGH-SIGNAL + LIGHT HUMOR: personality + approachability + conversation hooks
4. People swipe when they think "I want to know more about this person" — curiosity > perfection
5. Profiles that feel human and specific beat profiles that try to look perfect

The 7 most common issues:
1. The "Generic Human" bio — everyone likes travel and food
2. Group photos where you can't tell who's who
3. Conflicting signals between photos
4. Prompts that don't create conversation
5. Low-energy first photo
6. Trying too hard to look perfect instead of authentic
7. No clear personality signal

Your feedback style:
- Instead of "Your bio lacks specificity" say "This bio could belong to 4.7 million people on this app"
- Be witty and slightly roasting but never mean
- Always constructive — every critique comes with clear guidance on what to change
- Sound like a clever friend giving real talk, not a corporate consultant
- Frame advice as guidance ("here's what to change") not automation ("here's your new bio")

Three profile types:
1. HIGH-SIGNAL (Best): Specific interests, clear vibe, candid photos, revealing prompts
2. SAFE/GENERIC (Most Common): Travel photos, group shots, neutral bios — underperforms
3. ENTERTAINMENT (Polarizing): Humor, bold statements — high match rate but divisive`;

function parseImagePayload(raw: string): { data: string; mimeType: string; label?: string } | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.data && parsed.mimeType) return parsed;
  } catch {}
  return null;
}

function buildUserContent(input: ProfileInput, promptText: string): ChatCompletionContentPart[] {
  const parts: ChatCompletionContentPart[] = [];
  const hasScreenshots = input.screenshots?.length > 0;
  const hasCurrentPhotos = input.currentPhotos?.length > 0;
  const hasAdditionalPhotos = input.additionalPhotos?.length > 0;

  let textContent = promptText + "\n\n";

  if (hasScreenshots) {
    textContent += "The user has uploaded screenshots of their dating profile. Analyze everything visible in the images — bio text, prompts, layout, everything.\n\n";
  }

  textContent += buildProfileText(input);

  if (hasCurrentPhotos) {
    textContent += `\n--- CURRENT PROFILE PHOTOS (in order, ${input.currentPhotos.length} total) ---\n`;
    textContent += "These are the photos currently on the user's profile, in the exact order they appear. ";
    textContent += "Evaluate each photo for: energy level, signal quality, first impression, and how it works with the other photos. ";
    textContent += "Consider lighting, expression, setting, and what personality signal each photo sends.\n\n";
  }

  if (hasAdditionalPhotos) {
    textContent += `\n--- ADDITIONAL CANDIDATE PHOTOS (${input.additionalPhotos.length} total) ---\n`;
    textContent += "These are extra photos the user has. Evaluate them and recommend which ones should replace current profile photos. ";
    textContent += "Consider: which photos are strongest, what order they should go in, and which current photos to swap out.\n\n";
  }

  parts.push({ type: "text", text: textContent });

  if (hasScreenshots) {
    input.screenshots.forEach((raw) => {
      const s = parseImagePayload(raw);
      if (!s) return;
      parts.push({
        type: "image_url",
        image_url: { url: `data:${s.mimeType};base64,${s.data}`, detail: "high" },
      });
    });
  }

  if (hasCurrentPhotos) {
    parts.push({ type: "text", text: "\n[Current Profile Photos — in order:]" });
    input.currentPhotos.forEach((raw, i) => {
      const img = parseImagePayload(raw);
      if (!img) return;
      parts.push({ type: "text", text: `Photo #${i + 1}:` });
      parts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "high" },
      });
    });
  }

  if (hasAdditionalPhotos) {
    parts.push({ type: "text", text: "\n[Additional Candidate Photos:]" });
    input.additionalPhotos.forEach((raw, i) => {
      const img = parseImagePayload(raw);
      if (!img) return;
      parts.push({ type: "text", text: `Extra Photo ${String.fromCharCode(65 + i)}:` });
      parts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "high" },
      });
    });
  }

  return parts;
}

function buildProfileText(input: ProfileInput): string {
  let message = `Platform: ${input.platform}\n`;

  if (input.bio) {
    message += `\nBio:\n"${input.bio}"\n`;
  }

  if (input.prompts?.length > 0) {
    const filled = input.prompts.filter((p) => p.trim());
    if (filled.length > 0) {
      message += `\nPrompts/Answers:\n`;
      filled.forEach((p, i) => {
        message += `${i + 1}. "${p}"\n`;
      });
    }
  }

  if (input.photoDescriptions?.length > 0) {
    const filled = input.photoDescriptions.filter((p) => p.trim());
    if (filled.length > 0) {
      message += `\nPhoto Descriptions:\n`;
      filled.forEach((p, i) => {
        message += `${i + 1}. ${p}\n`;
      });
    }
  }

  if (input.targetType) {
    message += `\nTarget match type: ${input.customTarget || input.targetType}\n`;
  }

  return message;
}

const ANALYZE_PROMPT = `Analyze this dating profile and give a Magnet Score with analysis. Be entertaining and shareable — this is the viral hook.

If the user uploaded photos, evaluate them as part of the analysis. Consider photo quality, order, energy, and signals.

Respond in this exact JSON format:
{
  "score": {
    "overall": <0-100>,
    "photoQuality": <0-100 how good the photos are — lighting, energy, variety, attractiveness>,
    "attractionSignals": <0-100 how many signals of desirability and lifestyle the profile sends>,
    "personalitySignals": <0-100 how clearly the personality comes through — specificity, authenticity, humor>,
    "matchTargeting": <0-100 how well the profile attracts the right type of person>,
    "firstImpression": <0-100 how strong the first 3 seconds are — lead photo + opening line>
  },
  "feedback": {
    "roast": "<2-3 sentence witty roast of the profile that's entertaining but not mean — make it shareable on TikTok>",
    "mistakes": ["<specific issue detected — e.g. 'Weak first photo', 'Low social proof', 'Missing lifestyle signal'>", "<issue 2>", "<issue 3>"],
    "profileType": "<high-signal | generic | entertainment>",
    "profileTypeExplanation": "<1-2 sentences explaining why they fall in this category>"
  }
}

IMPORTANT: Format the "mistakes" as short, punchy issue labels (e.g. "Weak first photo", "Low social proof", "Missing lifestyle signal", "Generic bio", "No conversation hooks"). These show up as "Issues detected" in the UI.

Remember: The roast should make someone want to share their Magnet Score. Think "this bio could belong to 4.7 million people" energy.`;

export async function analyzeProfile(input: ProfileInput): Promise<ProfileResult> {
  const content = buildUserContent(input, ANALYZE_PROMPT);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  return {
    score: {
      overall: parsed.score?.overall ?? 50,
      photoQuality: parsed.score?.photoQuality ?? 50,
      attractionSignals: parsed.score?.attractionSignals ?? 50,
      personalitySignals: parsed.score?.personalitySignals ?? 50,
      matchTargeting: parsed.score?.matchTargeting ?? 50,
      firstImpression: parsed.score?.firstImpression ?? 50,
    },
    feedback: {
      roast: parsed.feedback?.roast ?? "Your profile needs some work.",
      mistakes: Array.isArray(parsed.feedback?.mistakes) ? parsed.feedback.mistakes : [],
      profileType: ["high-signal", "generic", "entertainment"].includes(parsed.feedback?.profileType)
        ? parsed.feedback.profileType
        : "generic",
      profileTypeExplanation: parsed.feedback?.profileTypeExplanation ?? "",
    },
  };
}
