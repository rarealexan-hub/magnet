import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeProfile, optimizeProfile } from "./ai.js";
import { validateProfileInput } from "./validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.post("/api/analyze", async (req, res) => {
  try {
    const input = validateProfileInput(req.body);
    if (!input.success) {
      res.status(400).json({ error: input.error });
      return;
    }
    const result = await analyzeProfile(input.data);
    res.json(result);
  } catch (error: any) {
    console.error("Analysis error:", error);
    const msg = error?.status === 400 && error?.error?.message?.includes("image")
      ? "One or more images couldn't be processed. Please use JPG, PNG, GIF, or WebP format."
      : "Failed to analyze profile. Please try again.";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/optimize", async (req, res) => {
  try {
    const input = validateProfileInput(req.body);
    if (!input.success) {
      res.status(400).json({ error: input.error });
      return;
    }
    const result = await optimizeProfile(input.data);
    res.json(result);
  } catch (error: any) {
    console.error("Optimization error:", error);
    const msg = error?.status === 400 && error?.error?.message?.includes("image")
      ? "One or more images couldn't be processed. Please use JPG, PNG, GIF, or WebP format."
      : "Failed to optimize profile. Please try again.";
    res.status(500).json({ error: msg });
  }
});

const distPath = path.resolve(__dirname, "../dist/public");
app.use(express.static(distPath));
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
