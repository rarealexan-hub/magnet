import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { analyzeProfile } from "./ai.js";
import { validateProfileInput } from "./validation.js";
import { hashPassword, comparePassword, generateToken, verifyToken } from "./auth.js";
import type { Request, Response, NextFunction } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors());

async function initAuditTracking() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS free_audits (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      ALTER TABLE free_audits ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'unknown'
    `);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'free_audits_email_platform_unique'
        ) THEN
          ALTER TABLE free_audits DROP CONSTRAINT IF EXISTS free_audits_email_unique;
          ALTER TABLE free_audits ADD CONSTRAINT free_audits_email_platform_unique UNIQUE (email, platform);
        END IF;
      END $$;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error("Failed to create audit tracking table:", err);
  }
}

await initAuditTracking();

app.use(express.json({ limit: "50mb" }));

interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

function authenticateOptional(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: "Please provide a valid email address" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [normalizedEmail, passwordHash]
    );
    const user = result.rows[0];
    const token = generateToken({ userId: user.id, email: user.email });
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();

    const result = await pool.query("SELECT id, email, password_hash FROM users WHERE email = $1", [normalizedEmail]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = result.rows[0];
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

app.get("/api/auth/me", async (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  res.json({ user: { id: payload.userId, email: payload.email } });
});

app.post("/api/analyze", authenticateOptional, async (req: AuthRequest, res) => {
  try {
    const input = validateProfileInput(req.body);
    if (!input.success) {
      res.status(400).json({ error: input.error });
      return;
    }

    const email = (req.user?.email || input.data.email).toLowerCase().trim();
    const platform = input.data.platform;
    const existing = await pool.query(
      "SELECT platform FROM free_audits WHERE email = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      const usedPlatform = existing.rows[0].platform;
      if (existing.rows.some((r: { platform: string }) => r.platform === platform)) {
        res.status(403).json({
          error: `You've already used your free Magnet analysis for ${platform}.`,
          code: "AUDIT_LIMIT_REACHED",
        });
        return;
      }
      res.status(403).json({
        error: `Your free analysis was already used for ${usedPlatform}. Each email gets one free analysis.`,
        code: "AUDIT_LIMIT_REACHED",
      });
      return;
    }

    const result = await analyzeProfile(input.data);
    await pool.query(
      "INSERT INTO free_audits (email, platform) VALUES ($1, $2) ON CONFLICT (email, platform) DO NOTHING",
      [email, platform]
    );
    res.json(result);
  } catch (error: any) {
    console.error("Analysis error:", error);
    const msg =
      error?.status === 413
        ? "Your photos are too large. Please try with fewer or smaller images."
        : error?.status === 400 && error?.error?.message?.includes("image")
          ? "One or more images couldn't be processed. Please use JPG, PNG, GIF, WebP, or HEIC format."
          : "Failed to analyze profile. Please try again.";
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
