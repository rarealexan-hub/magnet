import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { isDeepStrictEqual } from "node:util";
import { Pool } from "pg";
import { OAuth2Client } from "google-auth-library";
import { analyzeProfile } from "./ai.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
} from "./auth.js";
import { getUncachableGoogleSheetClient } from "./googleSheets.js";
import type { Request, Response, NextFunction } from "express";
import type {
  ProfileInput,
  AnalysisRecord,
  DashboardData,
} from "../shared/types.js";
import type { HumanAuditStatus } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface AnalysisJob {
  status: "pending" | "done" | "error";
  result?: any;
  error?: string;
  createdAt: number;
}
const analysisJobs = new Map<string, AnalysisJob>();
function newJobId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of analysisJobs.entries()) {
    if (job.createdAt < cutoff) analysisJobs.delete(id);
  }
}, 5 * 60 * 1000);

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
        password_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`);
    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='password_hash'
          AND is_nullable='NO'
        ) THEN
          ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        END IF;
      END $$;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id SERIAL PRIMARY KEY,
        user_email TEXT NOT NULL,
        platform TEXT NOT NULL,
        overall_score INTEGER NOT NULL,
        photo_quality INTEGER NOT NULL,
        attraction_signals INTEGER NOT NULL,
        personality_signals INTEGER NOT NULL,
        match_targeting INTEGER NOT NULL,
        first_impression INTEGER NOT NULL,
        roast TEXT,
        mistakes JSONB DEFAULT '[]',
        profile_type TEXT,
        profile_type_explanation TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_email ON analyses (user_email)
    `);
    await pool.query(`
      ALTER TABLE analyses ADD COLUMN IF NOT EXISTS full_report_data JSONB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS human_audits (
        id BIGSERIAL PRIMARY KEY,
        access_token TEXT NOT NULL UNIQUE,
        user_id BIGINT,
        email TEXT NOT NULL,
        platform TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'intake_started',
        intake_data JSONB NOT NULL DEFAULT '{}',
        photo_calibration JSONB NOT NULL DEFAULT '{}',
        client_brief JSONB NOT NULL DEFAULT '{}',
        admin_notes TEXT,
        final_report_ready_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE human_audits ADD COLUMN IF NOT EXISTS analysis_id INTEGER REFERENCES analyses(id)`);
    await pool.query(`ALTER TABLE human_audits ADD COLUMN IF NOT EXISTS final_report JSONB`);
    await pool.query(`ALTER TABLE human_audits ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS human_audit_questions (
        id BIGSERIAL PRIMARY KEY,
        audit_id BIGINT NOT NULL REFERENCES human_audits(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        asked_by_user_id BIGINT,
        asked_by_email TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW(),
        answered_at TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS human_audit_answers (
        id BIGSERIAL PRIMARY KEY,
        question_id BIGINT NOT NULL REFERENCES human_audit_questions(id) ON DELETE CASCADE,
        answer TEXT NOT NULL,
        answered_by_user_id BIGINT,
        answered_by_email TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_submissions (
        id SERIAL PRIMARY KEY,
        email TEXT,
        rating INTEGER NOT NULL,
        would_recommend TEXT,
        biggest_improvement TEXT,
        open_feedback TEXT,
        page TEXT,
        platform TEXT,
        magnet_score INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile_progress (
        id SERIAL PRIMARY KEY,
        analysis_id INTEGER,
        user_email TEXT,
        outcome TEXT NOT NULL,
        notes TEXT,
        reported_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error("Failed to create audit tracking table:", err);
  }
}

await initAuditTracking();

app.use(express.json({ limit: "50mb" }));

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 25 },
  fileFilter: (_req, file, cb) => {
    if (
      ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      file.mimetype.startsWith("image/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const analyzeUpload = upload.fields([
  { name: "screenshots", maxCount: 6 },
  { name: "currentPhotos", maxCount: 9 },
  { name: "additionalPhotos", maxCount: 10 },
]);

function convertHeicBuffer(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const process = spawn("magick", [
      "heic:-",
      "-auto-orient",
      "-colorspace", "sRGB",
      "-quality", "95",
      "jpeg:-",
    ]);
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    process.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    process.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0 && output.length > 0) {
        resolve(Buffer.concat(output));
      } else {
        reject(new Error(Buffer.concat(errors).toString("utf8") || `Image conversion exited with code ${code}`));
      }
    });
    process.stdin.end(buffer);
  });
}

app.post("/api/convert-image", upload.single("image"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No image was uploaded." });
    return;
  }
  try {
    const isHeic = /image\/hei[cf]/i.test(req.file.mimetype || "") || /\.hei[cf]$/i.test(req.file.originalname || "");
    const output = isHeic
      ? await convertHeicBuffer(req.file.buffer)
      : req.file.buffer;
    res.type(isHeic ? "image/jpeg" : req.file.mimetype || "image/jpeg").send(output);
  } catch (error) {
    console.error("Preview image conversion error:", error);
    res.status(422).json({ error: "This HEIC photo could not be decoded." });
  }
});

interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

const HUMAN_AUDIT_STATUSES: HumanAuditStatus[] = [
  "intake_started",
  "intake_complete",
  "awaiting_admin_review",
  "followup_sent",
  "followup_complete",
  "final_report_ready",
];

function getAuditArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function auditToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function authenticateAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  authenticateRequired(req, res, () => {
    if (!adminEmails().has(req.user!.email.toLowerCase())) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

function mapAuditRow(row: any, questions: any[] = []) {
  return {
    id: Number(row.id),
    email: row.email,
    platform: row.platform,
    status: row.status,
    intakeData: row.intake_data || {},
    photoCalibration: row.photo_calibration || { selectedIds: [], rankedIds: [] },
    clientBrief: row.client_brief || null,
    finalReport: row.final_report || null,
    analysisId: row.analysis_id ? Number(row.analysis_id) : null,
    reviewedByEmail: row.reviewed_by_email || null,
    adminNotes: row.admin_notes || null,
    questions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalReportReadyAt: row.final_report_ready_at,
  };
}

async function getAuditWithQuestions(id: string) {
  const auditResult = await pool.query("SELECT * FROM human_audits WHERE id = $1", [id]);
  if (auditResult.rows.length === 0) return null;
  const questionsResult = await pool.query(
    `SELECT q.id, q.audit_id, q.question, q.status, q.created_at, q.answered_at,
            COALESCE(json_agg(
              json_build_object(
                'id', a.id, 'questionId', a.question_id, 'answer', a.answer,
                'answeredByEmail', a.answered_by_email, 'createdAt', a.created_at
              ) ORDER BY a.created_at
            ) FILTER (WHERE a.id IS NOT NULL), '[]') AS answers
     FROM human_audit_questions q
     LEFT JOIN human_audit_answers a ON a.question_id = q.id
     WHERE q.audit_id = $1
     GROUP BY q.id
     ORDER BY q.created_at`,
    [id],
  );
  return mapAuditRow(auditResult.rows[0], questionsResult.rows);
}

function authenticateOptional(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyToken(authHeader.slice(7));
    if (payload) req.user = payload;
  }
  next();
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);
    if (existing.rows.length > 0) {
      res
        .status(400)
        .json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase().trim(), passwordHash],
    );
    const user = result.rows[0];
    const token = generateToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const result = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
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

app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: "Google credential required" });
      return;
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ error: "Google sign-in is not configured" });
      return;
    }
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: "Invalid Google credential" });
      return;
    }
    const { email, sub: googleId } = payload;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await pool.query(
      "SELECT id, email FROM users WHERE email = $1 OR google_id = $2",
      [normalizedEmail, googleId]
    );
    let user: { id: number; email: string };
    if (existing.rows.length > 0) {
      user = existing.rows[0];
      await pool.query("UPDATE users SET google_id = $1 WHERE id = $2", [googleId, user.id]);
    } else {
      const result = await pool.query(
        "INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id, email",
        [normalizedEmail, googleId]
      );
      user = result.rows[0];
    }
    const token = generateToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Google sign-in failed. Please try again." });
  }
});

function authenticateRequired(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = payload;
  next();
}

app.get(
  "/api/dashboard",
  authenticateRequired,
  async (req: AuthRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const result = await pool.query(
        `SELECT a.id, a.user_email, a.platform, a.overall_score, a.photo_quality, a.attraction_signals,
              a.personality_signals, a.match_targeting, a.first_impression, a.roast, a.mistakes,
               a.profile_type, a.profile_type_explanation, a.created_at,
               ha.id AS audit_id, ha.status AS review_status
         FROM analyses a
         LEFT JOIN human_audits ha ON ha.analysis_id = a.id
         WHERE a.user_email = $1
         ORDER BY a.created_at DESC`,
        [email],
      );

      const analyses: AnalysisRecord[] = result.rows.map((r: any) => {
        return {
          id: r.id,
          email: r.user_email,
          platform: r.platform,
          score: {
            overall: r.overall_score,
            photoQuality: r.photo_quality,
            attractionSignals: r.attraction_signals,
            personalitySignals: r.personality_signals,
            matchTargeting: r.match_targeting,
            firstImpression: r.first_impression,
          },
          feedback: {
            roast: r.roast || "",
            mistakes: r.mistakes || [],
            profileType: r.profile_type || "generic",
            profileTypeExplanation: r.profile_type_explanation || "",
          },
          auditId: r.audit_id ? Number(r.audit_id) : null,
          reviewStatus: r.review_status || null,
          created_at: r.created_at,
        };
      });

      const platformMap = new Map<
        string,
        { latestScore: number; analysisCount: number; lastAnalyzed: string }
      >();
      for (const a of analyses) {
        if (!platformMap.has(a.platform)) {
          platformMap.set(a.platform, {
            latestScore: a.score.overall,
            analysisCount: 1,
            lastAnalyzed: a.created_at,
          });
        } else {
          const p = platformMap.get(a.platform)!;
          p.analysisCount++;
        }
      }

      const allPlatforms = ["hinge", "tinder", "bumble", "raya"];
      const platforms = allPlatforms.map((p) => {
        const data = platformMap.get(p);
        return {
          platform: p,
          latestScore: data?.latestScore ?? 0,
          analysisCount: data?.analysisCount ?? 0,
          lastAnalyzed: data?.lastAnalyzed ?? "",
        };
      });

      const dashboardData: DashboardData = { analyses, platforms };
      res.json(dashboardData);
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  },
);

async function fileToBase64String(file: Express.Multer.File, label?: string): Promise<string> {
  const isHeic = /image\/hei[cf]/i.test(file.mimetype || "") || /\.hei[cf]$/i.test(file.originalname || "");
  let buffer = file.buffer;
  let mimeType = file.mimetype || "image/jpeg";
  if (isHeic) {
    buffer = await convertHeicBuffer(file.buffer);
    mimeType = "image/jpeg";
  }
  return JSON.stringify({ data: buffer.toString("base64"), mimeType, ...(label ? { label } : {}) });
}

app.post(
  "/api/analyze",
  authenticateOptional,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log(
      "Analyze request received, content-type:",
      req.headers["content-type"],
      "content-length:",
      req.headers["content-length"],
    );
    analyzeUpload(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res
              .status(413)
              .json({
                error:
                  "One or more files are too large. Maximum 20MB per file.",
              });
            return;
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            res.status(400).json({ error: "Too many files uploaded." });
            return;
          }
          res
            .status(400)
            .json({ error: "File upload error. Please try again." });
          return;
        }
        res.status(400).json({ error: err.message || "Upload failed." });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const body = req.body;

    const platform = body.platform;
    const email = (req.user?.email || body.email || "").toLowerCase().trim();
    const bio = body.bio || "";
    const prompts = body.prompts
      ? Array.isArray(body.prompts) ? body.prompts : [body.prompts]
      : [];
    const photoDescriptions = body.photoDescriptions
      ? Array.isArray(body.photoDescriptions) ? body.photoDescriptions : [body.photoDescriptions]
      : [];
    const targetQualities = body.targetQualities
      ? Array.isArray(body.targetQualities) ? body.targetQualities : [body.targetQualities]
      : [];
    const targetType = targetQualities.length > 0 ? targetQualities.join(", ") : (body.targetType || "");
    const customTarget = body.customTarget;
    const gender = body.gender || "";
    const sexualOrientation = body.sexualOrientation || "";
    const locationMarket = body.locationMarket || "";
    const preferredTone = body.preferredTone || "";
    const partnerPreferences = body.partnerPreferences
      ? Array.isArray(body.partnerPreferences) ? body.partnerPreferences : [body.partnerPreferences]
      : [];
    const photoTasteSelections = body.photoTasteSelections
      ? Array.isArray(body.photoTasteSelections) ? body.photoTasteSelections : [body.photoTasteSelections]
      : [];
    const screenshotLabels = body.screenshotLabels
      ? Array.isArray(body.screenshotLabels) ? body.screenshotLabels : [body.screenshotLabels]
      : [];
    const additionalPhotoLabels: string[] = body.additionalPhotoLabels
      ? Array.isArray(body.additionalPhotoLabels) ? body.additionalPhotoLabels : [body.additionalPhotoLabels]
      : [];

    const validPlatforms = ["hinge","tinder","bumble","raya","okcupid","coffee-meets-bagel","match","happn","the-league","feeld","hily","plenty-of-fish","zoosk","grindr","badoo","blk","her","other"];
    if (!platform || !validPlatforms.includes(platform)) {
      res.status(400).json({ error: "Invalid platform" });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Please provide a valid email address" });
      return;
    }

    const screenshotFiles = files?.screenshots || [];
    const currentPhotoFiles = files?.currentPhotos || [];
    const additionalPhotoFiles = files?.additionalPhotos || [];

    const relationshipIntent = body.relationshipIntent || "";
    const interests = body.interests
      ? Array.isArray(body.interests) ? body.interests : [body.interests]
      : [];
    const partnerNonNegotiables = body.partnerNonNegotiables
      ? Array.isArray(body.partnerNonNegotiables) ? body.partnerNonNegotiables : [body.partnerNonNegotiables]
      : [];
    const idealPartnerDescription = body.idealPartnerDescription || "";
    const datingHistory = body.datingHistory || "";
    const datingStruggle = body.datingStruggle || "";
    const additionalContext = body.additionalContext || "";

    let screenshotStrings: string[];
    let currentPhotoStrings: string[];
    let additionalPhotoStrings: string[];
    try {
      [screenshotStrings, currentPhotoStrings, additionalPhotoStrings] = await Promise.all([
        Promise.all(screenshotFiles.map((file, index) => fileToBase64String(file, screenshotLabels[index] || undefined))),
        Promise.all(currentPhotoFiles.map((file) => fileToBase64String(file))),
        Promise.all(additionalPhotoFiles.map((file, index) => fileToBase64String(file, additionalPhotoLabels[index] || undefined))),
      ]);
    } catch (conversionError) {
      console.error("HEIC conversion error:", conversionError);
      res.status(400).json({ error: "One of the HEIC photos could not be decoded. Please export that image as JPG and try again." });
      return;
    }

    const profileInput: ProfileInput = {
      platform: platform as ProfileInput["platform"],
      email,
      bio,
      prompts: prompts.filter((p: string) => typeof p === "string"),
      photoDescriptions: photoDescriptions.filter((p: string) => typeof p === "string"),
      screenshots: screenshotStrings,
      currentPhotos: currentPhotoStrings,
      additionalPhotos: additionalPhotoStrings,
      targetType,
      customTarget,
      gender: gender || undefined,
      sexualOrientation: sexualOrientation || undefined,
      partnerPreferences: partnerPreferences.length > 0 ? partnerPreferences : undefined,
      photoTasteSelections: photoTasteSelections.length > 0 ? photoTasteSelections : undefined,
      relationshipIntent: relationshipIntent || undefined,
      locationMarket: locationMarket || undefined,
      preferredTone: preferredTone || undefined,
      interests: interests.length > 0 ? interests : undefined,
      partnerNonNegotiables: partnerNonNegotiables.length > 0 ? partnerNonNegotiables : undefined,
      idealPartnerDescription: idealPartnerDescription || undefined,
      datingHistory: datingHistory || undefined,
      datingStruggle: datingStruggle || undefined,
      additionalContext: additionalContext || undefined,
    };

    const isAuthenticated = !!req.user;
    const ownerEmail = req.user?.email || email;

    try {
      if (!isAuthenticated) {
        const existing = await pool.query(
          "SELECT platform FROM free_audits WHERE email = $1",
          [email],
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
      }
    } catch (dbErr) {
      console.error("DB audit check error:", dbErr);
      res.status(500).json({ error: "Failed to validate request. Please try again." });
      return;
    }

    const jobId = newJobId();
    analysisJobs.set(jobId, { status: "pending", createdAt: Date.now() });
    console.log(`Job ${jobId} started for ${email}`);
    res.json({ jobId });

    (async () => {
      try {
        const result = await analyzeProfile(profileInput);
        console.log(`Job ${jobId} analysis complete`);

        if (!isAuthenticated) {
          await pool.query(
            "INSERT INTO free_audits (email, platform) VALUES ($1, $2) ON CONFLICT (email, platform) DO NOTHING",
            [email, platform],
          ).catch((e: any) => console.error("free_audits insert error:", e));
        }

        const fullReportData = {
          categoryAnalysis: result.feedback.categoryAnalysis,
          promptRecommendations: result.feedback.promptRecommendations,
          photoSwapRecommendations: result.feedback.photoSwapRecommendations,
          photoOrderRecommendation: result.feedback.photoOrderRecommendation,
          sampleProfile: result.feedback.sampleProfile,
          matchPotential: result.feedback.matchPotential,
          potentialMatches: result.feedback.potentialMatches,
          betterLeadPhotoSuggestion: result.feedback.betterLeadPhotoSuggestion,
          personalitySignalsPromptRewrite: result.feedback.personalitySignalsPromptRewrite,
        };

        const insertResult = await pool.query(
          `INSERT INTO analyses (user_email, platform, overall_score, photo_quality, attraction_signals, personality_signals, match_targeting, first_impression, roast, mistakes, profile_type, profile_type_explanation, full_report_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [
            ownerEmail, platform,
            result.score.overall, result.score.photoQuality,
            result.score.attractionSignals, result.score.personalitySignals,
            result.score.matchTargeting, result.score.firstImpression,
            result.feedback.roast, JSON.stringify(result.feedback.mistakes),
            result.feedback.profileType, result.feedback.profileTypeExplanation,
            JSON.stringify(fullReportData),
          ],
        );
        const analysisId = insertResult.rows[0]?.id;
        const accessToken = auditToken();
        const intakeData = {
          platform,
          email,
          gender,
          sexualOrientation,
          locationMarket,
          relationshipIntent,
          datingStruggle,
          preferredTone,
          targetQualities,
          customTarget: customTarget || "",
          partnerPreferences,
          bio,
          prompts,
          screenshotCount: screenshotFiles.length,
          currentPhotoCount: currentPhotoFiles.length,
          additionalPhotoCount: additionalPhotoFiles.length,
          screenshotLabels,
          additionalPhotoLabels,
          reportPhotos: {
            currentPhotos: currentPhotoStrings,
            additionalPhotos: additionalPhotoStrings,
          },
        };
        const calibration = {
          selectedIds: photoTasteSelections,
          rankedIds: photoTasteSelections,
        };
        try {
          await pool.query(
            `INSERT INTO human_audits
              (access_token, user_id, email, platform, status, intake_data, photo_calibration, client_brief, analysis_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              accessToken,
              req.user?.userId || null,
              ownerEmail,
              platform,
              "awaiting_admin_review",
              JSON.stringify(intakeData),
              JSON.stringify(calibration),
              JSON.stringify(result),
              analysisId,
            ],
          );
        } catch (auditError) {
          console.error("Audit save error:", auditError);
          throw auditError;
        }
        const auditResult = await pool.query(
          "SELECT id FROM human_audits WHERE access_token = $1",
          [accessToken],
        );
        const auditId = auditResult.rows[0]?.id;
        const firstRead = {
          score: result.score,
          feedback: {
            roast: result.feedback.roast,
            mistakes: result.feedback.mistakes,
            profileType: result.feedback.profileType,
            profileTypeExplanation: result.feedback.profileTypeExplanation,
            leadPhotoTeaser: result.feedback.leadPhotoTeaser ?? null,
          },
          reportPhotos: {
            currentPhotos: currentPhotoStrings,
            additionalPhotos: additionalPhotoStrings,
          },
          analysisId,
          auditId,
          accessToken,
          reviewStatus: "awaiting_admin_review",
        };
        analysisJobs.set(jobId, {
          status: "done",
          result: firstRead,
          createdAt: Date.now(),
        });
      } catch (error: any) {
        console.error("Analysis error — status:", error?.status, "message:", error?.message, "error body:", JSON.stringify(error?.error));
        const msg =
          error?.status === 413
            ? "Your photos are too large. Please try with fewer or smaller images."
            : error?.status === 401
              ? "The AI service could not authenticate this request. Please check the configured AI integration and try again."
            : error?.status === 404
              ? "AI model unavailable. Please try again shortly."
              : error?.status === 400 && error?.error?.message?.includes("internal error")
                ? "The AI service is temporarily busy. Please wait a moment and try again."
                : error?.status === 400 && error?.error?.message?.includes("image")
                  ? "One or more images couldn't be processed. Please use JPG, PNG, GIF, WebP, or HEIC format."
                  : error?.status === 429
                    ? "Too many requests. Please wait a minute and try again."
                    : "Failed to analyze profile. Please try again.";
        analysisJobs.set(jobId, { status: "error", error: msg, createdAt: Date.now() });
      }
    })();
  },
);

app.get("/api/analyze/result/:jobId", (req: Request, res: Response) => {
  const job = analysisJobs.get(String(req.params.jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found or expired." });
    return;
  }
  if (job.status === "pending") {
    res.json({ status: "pending" });
    return;
  }
  if (job.status === "error") {
    res.status(500).json({ status: "error", error: job.error });
    return;
  }
  res.json({ status: "done", result: job.result });
});

app.get("/api/audits/:auditId", authenticateOptional, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM human_audits WHERE id = $1", [String(req.params.auditId)]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }
    const audit = result.rows[0];
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (token !== audit.access_token && req.user?.email?.toLowerCase() !== String(audit.email).toLowerCase()) {
      res.status(403).json({ error: "Not authorized to view this audit" });
      return;
    }
    const draft = audit.client_brief || {};
    const firstRead = {
      score: draft.score || {},
      feedback: {
        roast: draft.feedback?.roast || "",
        mistakes: draft.feedback?.mistakes || [],
        profileType: draft.feedback?.profileType || "generic",
        profileTypeExplanation: draft.feedback?.profileTypeExplanation || "",
        leadPhotoTeaser: draft.feedback?.leadPhotoTeaser ?? null,
      },
      reportPhotos: draft.reportPhotos || audit.intake_data?.reportPhotos || null,
      analysisId: audit.analysis_id ? Number(audit.analysis_id) : draft.analysisId || null,
      auditId: Number(audit.id),
      reviewStatus: audit.status,
    };
    res.json({
      ...firstRead,
      status: audit.status,
      report: audit.status === "final_report_ready" ? audit.final_report : null,
    });
  } catch (error) {
    console.error("Audit access error:", error);
    res.status(500).json({ error: "Failed to load audit" });
  }
});

app.post("/api/progress", async (req: Request, res: Response) => {
  try {
    const { analysisId, userEmail, outcome, notes } = req.body;
    if (!outcome || !["improved", "same", "worse"].includes(outcome)) {
      res.status(400).json({ error: "outcome must be improved, same, or worse" });
      return;
    }
    await pool.query(
      `INSERT INTO profile_progress (analysis_id, user_email, outcome, notes) VALUES ($1, $2, $3, $4)`,
      [analysisId || null, userEmail || null, outcome, notes || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Progress submission error:", error);
    res.status(500).json({ error: "Failed to save progress" });
  }
});

app.post("/api/feedback", async (req: Request, res: Response) => {
  try {
    const {
      rating,
      wouldRecommend,
      biggestImprovement,
      openFeedback,
      page,
      platform,
      magnetScore,
      email,
    } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating is required (1-5)" });
      return;
    }

    await pool.query(
      `INSERT INTO feedback_submissions
        (email, rating, would_recommend, biggest_improvement, open_feedback, page, platform, magnet_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        email || null,
        rating,
        wouldRecommend || null,
        biggestImprovement || null,
        openFeedback || null,
        page || null,
        platform || null,
        magnetScore || null,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

app.get(
  "/api/admin/human-audits",
  authenticateAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT a.id, a.email, a.platform, a.status, a.created_at, a.updated_at,
                COUNT(q.id)::int AS question_count,
                 COUNT(q.id) FILTER (WHERE q.status = 'open')::int AS open_question_count,
                 COUNT(*) FILTER (WHERE a.status = 'awaiting_admin_review') OVER ()::int AS awaiting_review_count
         FROM human_audits a
         LEFT JOIN human_audit_questions q ON q.audit_id = a.id
         GROUP BY a.id
          ORDER BY CASE WHEN a.status = 'awaiting_admin_review' THEN 0 ELSE 1 END, a.created_at DESC
         LIMIT 200`,
      );
      res.json({
        awaitingReviewCount: result.rows[0]?.awaiting_review_count || 0,
        count: result.rows[0]?.awaiting_review_count || 0,
        audits: result.rows.map((row) => ({
          id: Number(row.id),
          email: row.email,
          platform: row.platform,
          status: row.status,
          questionCount: row.question_count,
          openQuestionCount: row.open_question_count,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      console.error("Admin audit queue error:", error);
      res.status(500).json({ error: "Failed to load audit queue" });
    }
  },
);

app.get(
  "/api/admin/human-audits/:id",
  authenticateAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const audit = await getAuditWithQuestions(String(req.params.id));
      if (!audit) {
        res.status(404).json({ error: "Audit not found" });
        return;
      }
      res.json({ audit });
    } catch (error) {
      console.error("Admin audit detail error:", error);
      res.status(500).json({ error: "Failed to load audit" });
    }
  },
);

app.patch(
  "/api/admin/human-audits/:id",
  authenticateAdmin,
  async (req: AuthRequest, res: Response) => {
    const { status, adminNotes } = req.body || {};
    const finalReport = req.body?.finalReport ?? req.body?.final_report;
    if (status === "final_report_ready") {
      res.status(400).json({ error: "Use the release endpoint to approve an audit" });
      return;
    }
    if (status !== undefined && !HUMAN_AUDIT_STATUSES.includes(status)) {
      res.status(400).json({ error: "Invalid audit status" });
      return;
    }
    if (adminNotes !== undefined && typeof adminNotes !== "string") {
      res.status(400).json({ error: "Admin notes must be text" });
      return;
    }
    if (finalReport !== undefined && (typeof finalReport !== "object" || finalReport === null || Array.isArray(finalReport))) {
      res.status(400).json({ error: "Final report must be a JSON object" });
      return;
    }
    try {
      const result = await pool.query(
         `UPDATE human_audits
         SET status = COALESCE($1, status),
             admin_notes = COALESCE($2, admin_notes),
              final_report = COALESCE($3, final_report),
             updated_at = NOW()
          WHERE id = $4
         RETURNING *`,
        [status || null, adminNotes === undefined ? null : adminNotes, finalReport === undefined ? null : JSON.stringify(finalReport), String(req.params.id)],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Audit not found" });
        return;
      }
      const audit = await getAuditWithQuestions(String(req.params.id));
      res.json({ audit });
    } catch (error) {
      console.error("Admin audit update error:", error);
      res.status(500).json({ error: "Failed to update audit" });
    }
  },
);

app.post(
  "/api/admin/human-audits/:id/release",
  authenticateAdmin,
  async (req: AuthRequest, res: Response) => {
    const report = req.body?.finalReport ?? req.body?.final_report;
    const score = report?.score;
    const feedback = report?.feedback;
    if (
      !report || typeof report !== "object" ||
      typeof score?.overall !== "number" || score.overall < 0 || score.overall > 100 ||
      typeof feedback?.roast !== "string" ||
      !Array.isArray(feedback?.mistakes) ||
      typeof feedback?.profileType !== "string"
    ) {
      res.status(400).json({ error: "Final report must include a valid score.overall and feedback roast, mistakes, and profileType" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const auditResult = await client.query(
        "SELECT * FROM human_audits WHERE id = $1 FOR UPDATE",
        [String(req.params.id)],
      );
      if (auditResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Audit not found" });
        return;
      }
      const audit = auditResult.rows[0];
      if (isDeepStrictEqual(report, audit.client_brief)) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Edit the AI draft before approving and releasing it" });
        return;
      }
      if (!audit.analysis_id) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Audit is not linked to an analysis" });
        return;
      }
      await client.query(
        `UPDATE human_audits
         SET final_report = $1, status = 'final_report_ready',
             final_report_ready_at = NOW(), reviewed_by_email = $2, updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(report), req.user!.email, String(req.params.id)],
      );
      await client.query(
        `UPDATE analyses
         SET overall_score = $1, photo_quality = COALESCE($2, photo_quality),
             attraction_signals = COALESCE($3, attraction_signals),
             personality_signals = COALESCE($4, personality_signals),
             match_targeting = COALESCE($5, match_targeting),
             first_impression = COALESCE($6, first_impression),
             roast = $7, mistakes = $8, profile_type = $9,
             profile_type_explanation = COALESCE($10, profile_type_explanation)
         WHERE id = $11`,
        [
          score.overall, score.photoQuality, score.attractionSignals,
          score.personalitySignals, score.matchTargeting, score.firstImpression,
          feedback.roast, JSON.stringify(feedback.mistakes), feedback.profileType,
          feedback.profileTypeExplanation, audit.analysis_id,
        ],
      );
      await client.query("COMMIT");
      res.json({ audit: await getAuditWithQuestions(String(req.params.id)) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("Audit release error:", error);
      res.status(500).json({ error: "Failed to release audit" });
    } finally {
      client.release();
    }
  },
);

app.post(
  "/api/admin/human-audits/:id/questions",
  authenticateAdmin,
  async (req: AuthRequest, res: Response) => {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      res.status(400).json({ error: "Question is required" });
      return;
    }
    try {
      const audit = await getAuditWithQuestions(String(req.params.id));
      if (!audit) {
        res.status(404).json({ error: "Audit not found" });
        return;
      }
      await pool.query(
        `INSERT INTO human_audit_questions (audit_id, question, asked_by_user_id, asked_by_email, status)
         VALUES ($1, $2, $3, $4, 'open')`,
        [String(req.params.id), question, req.user!.userId, req.user!.email],
      );
      await pool.query(
        "UPDATE human_audits SET status = 'followup_sent', updated_at = NOW() WHERE id = $1",
        [String(req.params.id)],
      );
      res.json({ audit: await getAuditWithQuestions(String(req.params.id)) });
    } catch (error) {
      console.error("Admin audit question error:", error);
      res.status(500).json({ error: "Failed to add audit question" });
    }
  },
);

app.get("/api/admin/feedback", authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM feedback_submissions ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ submissions: result.rows });
  } catch (error) {
    console.error("Admin feedback fetch error:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res
        .status(413)
        .json({
          error: "One or more files are too large. Maximum 20MB per file.",
        });
      return;
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "Too many files uploaded." });
      return;
    }
    res.status(400).json({ error: "File upload error. Please try again." });
    return;
  }
  if (err?.message === "Only image files are allowed") {
    res
      .status(400)
      .json({
        error: "Only image files (JPG, PNG, GIF, WebP, HEIC) are allowed.",
      });
    return;
  }
  next(err);
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
