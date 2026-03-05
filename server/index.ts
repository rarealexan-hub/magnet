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
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze profile. Please try again." });
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
  } catch (error) {
    console.error("Optimization error:", error);
    res.status(500).json({ error: "Failed to optimize profile. Please try again." });
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
