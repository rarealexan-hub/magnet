import test from "node:test";
import assert from "node:assert/strict";
import { PLATFORMS, PLATFORM_AUDIT_FOCUS, PLATFORM_PROMPTS, type ProfileInput } from "../shared/types.js";
import { buildUserContent } from "./ai.js";

test("every supported dating app has platform-specific audit guidance and profile sections", () => {
  for (const { id, label } of PLATFORMS) {
    assert.ok(PLATFORM_AUDIT_FOCUS[id], `${label} is missing platform-specific audit guidance`);
    assert.ok(PLATFORM_PROMPTS[id]?.length, `${label} is missing platform-specific profile sections`);
  }
});

test("screenshot labels are included beside the screenshots sent for analysis", async () => {
  const input: ProfileInput = {
    platform: "hinge",
    email: "person@example.test",
    bio: "",
    prompts: [],
    photoDescriptions: [],
    screenshots: [JSON.stringify({
      data: Buffer.from("not-an-image").toString("base64"),
      mimeType: "image/png",
      label: "Prompt and answer",
    })],
    currentPhotos: [],
    additionalPhotos: [],
    targetType: "",
  };

  const content = await buildUserContent(input, "Analyze this profile.");
  const text = content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");

  assert.match(text, /\[Profile screenshot — Prompt and answer\]/);
});