import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
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
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "./stripeClient.js";
import { WebhookHandlers } from "./webhookHandlers.js";
import { runMigrations } from "stripe-replit-sync";
import type { Request, Response, NextFunction } from "express";
import type {
  ProfileInput,
  AnalysisRecord,
  DashboardData,
} from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors());

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

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
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
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
  } catch (err) {
    console.error("Failed to create audit tracking table:", err);
  }
}

await initAuditTracking();

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set — skipping Stripe init');
    return;
  }
  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    console.log('Stripe webhook configured');

    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Stripe backfill error:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

await initStripe();

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

interface AuthRequest extends Request {
  user?: { userId: number; email: string };
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

app.get('/api/stripe/publishable-key', async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (error) {
    console.error('Error fetching publishable key:', error);
    res.status(500).json({ error: 'Failed to load payment config' });
  }
});

app.get('/api/stripe/prices', async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({ active: true, expand: ['data.product'] });
    res.json({ data: prices.data });
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

app.post('/api/checkout', authenticateOptional, async (req: AuthRequest, res: Response) => {
  try {
    const { priceId } = req.body;
    if (!priceId) {
      res.status(400).json({ error: 'priceId required' });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

    const sessionParams: any = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${baseUrl}/?payment=success`,
      cancel_url: `${baseUrl}/?payment=cancelled`,
    };

    if (req.user?.email) {
      const userRow = await pool.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [req.user.userId]
      );
      let customerId = userRow.rows[0]?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          metadata: { userId: String(req.user.userId) },
        });
        customerId = customer.id;
        await pool.query(
          'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
          [customerId, req.user.userId]
        );
      }
      sessionParams.customer = customerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

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
        `SELECT id, user_email, platform, overall_score, photo_quality, attraction_signals,
              personality_signals, match_targeting, first_impression, roast, mistakes,
              profile_type, profile_type_explanation, created_at
       FROM analyses WHERE user_email = $1 ORDER BY created_at DESC`,
        [email],
      );

      const analyses: AnalysisRecord[] = result.rows.map((r: any) => ({
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
        created_at: r.created_at,
      }));

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

      const allPlatforms = ["hinge", "tinder", "bumble"];
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

function filesToBase64Strings(files: Express.Multer.File[]): string[] {
  return files.map((f) => {
    const data = f.buffer.toString("base64");
    const mimeType = f.mimetype || "image/jpeg";
    return JSON.stringify({ data, mimeType });
  });
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
    try {
      const files = req.files as
        | Record<string, Express.Multer.File[]>
        | undefined;
      const body = req.body;

      const platform = body.platform;
      const email = (req.user?.email || body.email || "").toLowerCase().trim();
      const bio = body.bio || "";
      const prompts = body.prompts
        ? Array.isArray(body.prompts)
          ? body.prompts
          : [body.prompts]
        : [];
      const photoDescriptions = body.photoDescriptions
        ? Array.isArray(body.photoDescriptions)
          ? body.photoDescriptions
          : [body.photoDescriptions]
        : [];
      const targetQualities = body.targetQualities
        ? Array.isArray(body.targetQualities) ? body.targetQualities : [body.targetQualities]
        : [];
      const targetType = targetQualities.length > 0 ? targetQualities.join(", ") : (body.targetType || "");
      const customTarget = body.customTarget;
      const gender = body.gender || "";
      const sexualOrientation = body.sexualOrientation || "";
      const partnerPreferences = body.partnerPreferences
        ? Array.isArray(body.partnerPreferences)
          ? body.partnerPreferences
          : [body.partnerPreferences]
        : [];
      const photoTasteSelections = body.photoTasteSelections
        ? Array.isArray(body.photoTasteSelections)
          ? body.photoTasteSelections
          : [body.photoTasteSelections]
        : [];
      const screenshotLabels = body.screenshotLabels
        ? Array.isArray(body.screenshotLabels)
          ? body.screenshotLabels
          : [body.screenshotLabels]
        : [];
      const additionalPhotoLabels: string[] = body.additionalPhotoLabels
        ? Array.isArray(body.additionalPhotoLabels)
          ? body.additionalPhotoLabels
          : [body.additionalPhotoLabels]
        : [];

      const validPlatforms = ["hinge","tinder","bumble","okcupid","coffee-meets-bagel","match","happn","the-league","feeld","hily","plenty-of-fish","zoosk","grindr","badoo","blk","her","other"];
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

      const screenshotStrings = screenshotFiles.map((f, i) => {
        const data = f.buffer.toString("base64");
        const mimeType = f.mimetype || "image/jpeg";
        const label = screenshotLabels[i] || "";
        return JSON.stringify({ data, mimeType, label });
      });

      const profileInput: ProfileInput = {
        platform: platform as ProfileInput["platform"],
        email,
        bio,
        prompts: prompts.filter((p: string) => typeof p === "string"),
        photoDescriptions: photoDescriptions.filter(
          (p: string) => typeof p === "string",
        ),
        screenshots: screenshotStrings,
        currentPhotos: filesToBase64Strings(currentPhotoFiles),
        additionalPhotos: additionalPhotoFiles.map((f, i) => {
          const data = f.buffer.toString("base64");
          const mimeType = f.mimetype || "image/jpeg";
          const label = additionalPhotoLabels[i] || "";
          return JSON.stringify({ data, mimeType, label });
        }),
        targetType,
        customTarget,
        gender: gender || undefined,
        sexualOrientation: sexualOrientation || undefined,
        partnerPreferences: partnerPreferences.length > 0 ? partnerPreferences : undefined,
        photoTasteSelections: photoTasteSelections.length > 0 ? photoTasteSelections : undefined,
        relationshipIntent: relationshipIntent || undefined,
        interests: interests.length > 0 ? interests : undefined,
        partnerNonNegotiables: partnerNonNegotiables.length > 0 ? partnerNonNegotiables : undefined,
        idealPartnerDescription: idealPartnerDescription || undefined,
        datingHistory: datingHistory || undefined,
        datingStruggle: datingStruggle || undefined,
        additionalContext: additionalContext || undefined,
      };

      const isAuthenticated = !!req.user;

      if (!isAuthenticated) {
        const existing = await pool.query(
          "SELECT platform FROM free_audits WHERE email = $1",
          [email],
        );
        if (existing.rows.length > 0) {
          const usedPlatform = existing.rows[0].platform;
          if (
            existing.rows.some(
              (r: { platform: string }) => r.platform === platform,
            )
          ) {
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

      const result = await analyzeProfile(profileInput);

      if (!isAuthenticated) {
        await pool.query(
          "INSERT INTO free_audits (email, platform) VALUES ($1, $2) ON CONFLICT (email, platform) DO NOTHING",
          [email, platform],
        );
      }

      const ownerEmail = req.user?.email || email;
      await pool.query(
        `INSERT INTO analyses (user_email, platform, overall_score, photo_quality, attraction_signals, personality_signals, match_targeting, first_impression, roast, mistakes, profile_type, profile_type_explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          ownerEmail,
          platform,
          result.score.overall,
          result.score.photoQuality,
          result.score.attractionSignals,
          result.score.personalitySignals,
          result.score.matchTargeting,
          result.score.firstImpression,
          result.feedback.roast,
          JSON.stringify(result.feedback.mistakes),
          result.feedback.profileType,
          result.feedback.profileTypeExplanation,
        ],
      );
      res.json(result);
    } catch (error: any) {
      console.error("Analysis error:", error);
      const msg =
        error?.status === 413
          ? "Your photos are too large. Please try with fewer or smaller images."
          : error?.status === 400 &&
              error?.error?.message?.includes("internal error")
            ? "The AI service is temporarily busy. Please wait a moment and try again."
            : error?.status === 400 && error?.error?.message?.includes("image")
              ? "One or more images couldn't be processed. Please use JPG, PNG, GIF, WebP, or HEIC format."
              : error?.status === 429
                ? "Too many requests. Please wait a minute and try again."
                : "Failed to analyze profile. Please try again.";
      res.status(500).json({ error: msg });
    }
  },
);

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

    const spreadsheetId = process.env.FEEDBACK_SPREADSHEET_ID;
    if (!spreadsheetId) {
      console.error("FEEDBACK_SPREADSHEET_ID not set");
      res.status(500).json({ error: "Feedback not configured" });
      return;
    }

    const sheets = await getUncachableGoogleSheetClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Feedback!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            rating,
            wouldRecommend ?? "",
            biggestImprovement ?? "",
            openFeedback ?? "",
            page ?? "",
            platform ?? "",
            magnetScore ?? "",
            email ?? "",
          ],
        ],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
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
