import OpenAI from "openai";
import sharp from "sharp";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { ProfileInput, ProfileResult } from "../shared/types.js";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MAX_IMAGE_DIM = 1024;
const JPEG_QUALITY = 70;

async function compressImage(base64Data: string): Promise<{ data: string; mimeType: string }> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const compressed = await sharp(buffer)
      .resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return { data: compressed.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    return { data: base64Data, mimeType: "image/jpeg" };
  }
}

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

async function buildUserContent(input: ProfileInput, promptText: string): Promise<ChatCompletionContentPart[]> {
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
    for (const raw of input.screenshots) {
      const s = parseImagePayload(raw);
      if (!s) continue;
      const img = await compressImage(s.data);
      parts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "high" },
      });
    }
  }

  if (hasCurrentPhotos) {
    parts.push({ type: "text", text: "\n[Current Profile Photos — in order:]" });
    for (let i = 0; i < input.currentPhotos.length; i++) {
      const raw = parseImagePayload(input.currentPhotos[i]);
      if (!raw) continue;
      const img = await compressImage(raw.data);
      parts.push({ type: "text", text: `Photo #${i + 1}:` });
      parts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "auto" },
      });
    }
  }

  if (hasAdditionalPhotos) {
    parts.push({ type: "text", text: "\n[Additional Candidate Photos:]" });
    for (let i = 0; i < input.additionalPhotos.length; i++) {
      const raw = parseImagePayload(input.additionalPhotos[i]);
      if (!raw) continue;
      const img = await compressImage(raw.data);
      parts.push({ type: "text", text: `Extra Photo ${String.fromCharCode(65 + i)}:` });
      parts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "auto" },
      });
    }
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

  if (input.gender && input.gender !== "prefer-not-to-say") {
    message += `\nUser's gender: ${input.gender}\n`;
  }

  if (input.sexualOrientation && input.sexualOrientation !== "prefer-not-to-say") {
    message += `\nUser's sexual orientation: ${input.sexualOrientation}\n`;
  }

  if (input.partnerPreferences && input.partnerPreferences.length > 0) {
    message += `\nUser is attracted to: ${input.partnerPreferences.join(", ")}\n`;
  }

  if (input.photoTasteSelections && input.photoTasteSelections.length > 0) {
    if (input.photoTasteSelections.includes("none")) {
      message += `\nPhoto aesthetic preference: The user explicitly indicated that none of the provided photo style options appealed to them. Do NOT assume any particular aesthetic preference. Instead, base all photo quality scoring and swap/order recommendations purely on their gender, sexual orientation, partner preferences, and target audience — optimising for what THEIR audience responds to, not a generic vibe.\n`;
    } else {
      const VIBE_MAP: Record<string, string> = {
        adventurous: "adventurous & active (outdoors, travel, high-energy)",
        sophisticated: "polished & confident (stylish, refined, well-dressed)",
        candid: "natural & authentic (candid moments, genuine smiles, unposed)",
        playful: "fun & playful (lighthearted, expressive, laughing)",
      };
      const vibeLabels = input.photoTasteSelections.map((v) => VIBE_MAP[v] || v);
      message += `\nUser's photo aesthetic preferences (what they find attractive): ${vibeLabels.join(" and ")}.\n`;
      message += `Use this to calibrate photo recommendations — advise photo styles that align with what this person finds visually compelling.\n`;
    }
  }

  if (input.targetType) {
    message += `\nTarget match type: ${input.customTarget || input.targetType}\n`;
  }

  return message;
}

const ANALYZE_PROMPT = `Analyze this dating profile and give a Magnet Score with detailed, actionable analysis. Be specific, witty, and genuinely helpful — this analysis is the product.

Respond in this exact JSON format:
{
  "score": {
    "overall": <0-100>,
    "photoQuality": <0-100>,
    "attractionSignals": <0-100>,
    "personalitySignals": <0-100>,
    "matchTargeting": <0-100>,
    "firstImpression": <0-100>
  },
  "feedback": {
    "roast": "<2-3 sentence witty roast — entertaining, slightly teasing, shareable on TikTok>",
    "mistakes": ["<short punchy issue label>", "<issue 2>", "<issue 3>"],
    "profileType": "<high-signal | generic | entertainment>",
    "profileTypeExplanation": "<1-2 sentences>",
    "categoryAnalysis": {
      "photoQuality": "<2-3 sentences specifically about THIS person's photos — lighting, composition, variety, what's working and what isn't. Be specific to what you see, not generic.>",
      "attractionSignals": "<2-3 sentences about what attraction signals this profile sends — body language, lifestyle cues, eye contact, energy. Specific to their actual content.>",
      "personalitySignals": "<2-3 sentences about how clearly their personality comes through — what works, what's generic, what's missing. Reference their actual prompts/bio if provided.>",
      "matchTargeting": "<2-3 sentences about how well this profile speaks to their target type. Is there alignment between their content and who they want to attract?>",
      "firstImpression": "<2-3 sentences about the first 2 seconds of their profile — lead photo strength, opening hook. What's the first thing someone sees and what does it communicate?>"
    },
    "promptRecommendations": [
      {
        "promptIndex": <1-based index of the prompt>,
        "currentPrompt": "<quote their exact prompt text>",
        "issue": "<specific problem with this prompt — e.g. 'Too vague to start a conversation', 'Sounds like every other profile', 'Lists traits instead of showing personality'>",
        "suggestion": "<specific, actionable rewrite direction — e.g. 'Replace with a specific story or opinion. Instead of \"love traveling\" try describing your most unexpected trip moment.' Do NOT write the full prompt for them — give them the direction and a micro-example.>"
      }
    ],
    "photoSwapRecommendations": [
      {
        "action": "<swap | add | remove | reorder>",
        "currentPhoto": "<e.g. 'Photo #2' — reference by number>",
        "additionalPhoto": "<e.g. 'Extra Photo B' — reference by letter>",
        "reason": "<specific reason referencing what you see in both photos>"
      }
    ],
    "photoOrderRecommendation": {
      "suggestedOrder": ["<e.g. 'Photo #3'>", "<'Photo #1'>", "<'Extra Photo B'>", "<'Photo #2'>"],
      "reason": "<explain why this order works — what signal each position sends>"
    },
    "sampleProfile": {
      "headline": "<1 short punchy line describing who this upgraded profile now shows — e.g. 'Curious, grounded, and actually interesting'>",
      "bio": "<improved bio if they provided one — keep their voice but sharper. 2-4 sentences. Omit this field if no bio was given.>",
      "prompts": [
        {
          "question": "<their exact prompt question>",
          "answer": "<a sample answer implementing the coaching direction. Authentic voice, no clichés. 1-3 sentences. This inspires them, it's not a ghostwrite.>"
        }
      ],
      "summary": "<1-2 sentences: what this upgraded profile now signals to their target audience and why it works better than the original>"
    }
  }
}

RULES:

categoryAnalysis: Always include all 5 fields. Write about THIS specific profile — not generic advice. If no photos were uploaded, focus on what you can infer from bio/prompts.

USE GENDER, ORIENTATION, PREFERENCES, AND PHOTO TASTE TO CALIBRATE EVERYTHING — INCLUDING SCORES:

SCORES: All five score dimensions must be calibrated using the user's identity context:
- photoQuality: Score against what photos work for THIS person's gender presenting to THEIR target audience. A candid warm smile may be a 90 for a woman attracting men; the same photo may score lower for a man who needs to project status or lifestyle.
- attractionSignals: Score based on whether the profile sends the right signals for the user's gender and orientation. Gay men need to signal personality + physicality differently than straight men. Women attracting women need different cues than women attracting men.
- personalitySignals: Score against how well the personality shown matches what the target audience finds compelling. An emotionally expressive bio reads differently depending on who's reading it.
- matchTargeting: Score based on how well the profile content aligns with BOTH the stated target type AND the partner preferences. A profile targeting "ambitious professionals" should be scored for how well it speaks to that audience given the user's gender and orientation.
- firstImpression: Score the lead photo against what creates the strongest first impression for this specific person's gender presenting to their stated audience.

ANALYSIS TEXT: All categoryAnalysis fields must explicitly reference the user's gender and audience:
- Do not write generic advice. Write "As a man attracting women, your lead photo needs to…" or "For a gay man on Hinge, this prompt reads as…" — specific, identity-aware coaching.
- Partner preferences define the evaluator's lens. Always frame feedback from the perspective of who is actually swiping on this profile.
- If the user said none of the photo styles appealed to them, lean entirely on gender + orientation + partner preferences to calibrate recommendations. Do not invent a vibe preference.

PHOTO SWAP & ORDER: Lead photo selection and swap recommendations must reflect the user's gender, orientation, and audience — not generic "best photo" logic. What performs as a lead photo for a straight woman attracting men is fundamentally different from what works for a gay man or a non-binary person.

PROMPTS: Prompt coaching should reflect what the target audience finds engaging. A prompt that works for someone attracting adventurous women may fall flat for someone attracting intellectual men. Call this out specifically.

promptRecommendations: Only include prompts that were actually provided. If no prompts/bio were given, omit this field or return empty array. Give the direction, not the full rewrite — we want to coach, not ghostwrite. 1-3 sentences per suggestion max.

photoSwapRecommendations: Only include if additional candidate photos were provided. Reference exact photo numbers (Photo #1) and extra photo letters (Extra Photo A). Max 5 items. When choosing which extra photos to recommend, factor in gender context and what the target audience responds to.

photoOrderRecommendation: Only include if current profile photos were provided. Suggest the optimal order using the exact same photo references. If additional photos are available and should be included, reference them too. Lead photo selection should be heavily influenced by the user's gender, orientation, and who they're trying to attract.

mistakes: Short, punchy issue labels (3-6 words max). These show as "Issues detected" chips in the UI.

roast: Make someone want to share their score. Entertaining but never cruel.

sampleProfile: Always include this — it's the most exciting part of the paid report. It's a preview showing what their profile could look like after the coaching.
- headline: 1 punchy line capturing who the upgraded profile now presents as. Not generic ("Better version of you") — specific to their personality and content (e.g. "Quietly ambitious, weirdly funny, actually interesting").
- bio: Only if they gave a bio. Rewrite it with their voice intact but sharper — cut the fluff, lead with something specific, end with something that invites a reply. 2-4 sentences.
- prompts: Only include prompts they actually provided. Write a sample answer for each that implements the coaching direction. Keep their tone and personality — make it feel like a real person wrote it, not a robot. 1-3 sentences per answer. Avoid clichés.
- summary: 1-2 sentences explaining what the upgraded profile now signals compared to the original — be specific about the transformation and who it attracts.`;


async function callWithRetry(
  fn: () => Promise<any>,
  maxRetries = 3,
  baseDelay = 2000
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRetryable =
        err?.status === 400 && err?.message?.includes("internal error") ||
        err?.status === 429 ||
        err?.status === 500 ||
        err?.status === 502 ||
        err?.status === 503;

      if (!isRetryable || attempt === maxRetries) throw err;

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`AI call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function analyzeProfile(input: ProfileInput): Promise<ProfileResult> {
  const content = await buildUserContent(input, ANALYZE_PROMPT);

  const response = await callWithRetry(() =>
    openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    })
  );

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
      categoryAnalysis: parsed.feedback?.categoryAnalysis
        ? {
            photoQuality: parsed.feedback.categoryAnalysis.photoQuality ?? "",
            attractionSignals: parsed.feedback.categoryAnalysis.attractionSignals ?? "",
            personalitySignals: parsed.feedback.categoryAnalysis.personalitySignals ?? "",
            matchTargeting: parsed.feedback.categoryAnalysis.matchTargeting ?? "",
            firstImpression: parsed.feedback.categoryAnalysis.firstImpression ?? "",
          }
        : undefined,
      promptRecommendations: Array.isArray(parsed.feedback?.promptRecommendations)
        ? parsed.feedback.promptRecommendations.map((r: any) => ({
            promptIndex: r.promptIndex ?? 1,
            currentPrompt: r.currentPrompt ?? "",
            issue: r.issue ?? "",
            suggestion: r.suggestion ?? "",
          }))
        : undefined,
      photoSwapRecommendations: Array.isArray(parsed.feedback?.photoSwapRecommendations)
        ? parsed.feedback.photoSwapRecommendations.map((r: any) => ({
            action: ["swap", "add", "remove", "reorder"].includes(r.action) ? r.action : "swap",
            currentPhoto: r.currentPhoto ?? undefined,
            additionalPhoto: r.additionalPhoto ?? undefined,
            reason: r.reason ?? "",
          }))
        : undefined,
      photoOrderRecommendation: parsed.feedback?.photoOrderRecommendation?.suggestedOrder?.length
        ? {
            suggestedOrder: parsed.feedback.photoOrderRecommendation.suggestedOrder,
            reason: parsed.feedback.photoOrderRecommendation.reason ?? "",
          }
        : undefined,
      sampleProfile: parsed.feedback?.sampleProfile?.headline
        ? {
            headline: parsed.feedback.sampleProfile.headline ?? "",
            bio: parsed.feedback.sampleProfile.bio ?? undefined,
            prompts: Array.isArray(parsed.feedback.sampleProfile.prompts)
              ? parsed.feedback.sampleProfile.prompts.map((p: any) => ({
                  question: p.question ?? "",
                  answer: p.answer ?? "",
                }))
              : undefined,
            summary: parsed.feedback.sampleProfile.summary ?? "",
          }
        : undefined,
    },
  };
}
