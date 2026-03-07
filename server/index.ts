import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { runMigrations } from "stripe-replit-sync";
import { analyzeProfile, optimizeProfile } from "./ai.js";
import { validateProfileInput } from "./validation.js";
import { getStripeSync, getUncachableStripeClient, getStripePublishableKey } from "./stripeClient.js";
import { WebhookHandlers } from "./webhookHandlers.js";

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
  } catch (err) {
    console.error("Failed to create audit tracking table:", err);
  }
}

await initAuditTracking();

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set — Stripe integration disabled");
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      const webhookBaseUrl = `https://${domain}`;
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log("Webhook configured:", result?.webhook?.url || "setup complete");
    } else {
      console.log("No REPLIT_DOMAINS — skipping webhook setup");
    }

    stripeSync
      .syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: Error) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

await initStripe();

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing signature" });

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use(express.json({ limit: "50mb" }));

app.post("/api/analyze", async (req, res) => {
  try {
    const input = validateProfileInput(req.body);
    if (!input.success) {
      res.status(400).json({ error: input.error });
      return;
    }

    const email = input.data.email.toLowerCase().trim();
    const platform = input.data.platform;
    const existing = await pool.query(
      "SELECT platform FROM free_audits WHERE email = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      const usedPlatform = existing.rows[0].platform;
      if (existing.rows.some((r: { platform: string }) => r.platform === platform)) {
        res.status(403).json({
          error: `You've already used your free audit for ${platform}. Upgrade to Pro for unlimited optimizations across all apps.`,
          code: "AUDIT_LIMIT_REACHED",
        });
        return;
      }
      res.status(403).json({
        error: `Your free audit was used for ${usedPlatform}. Upgrade to Pro to audit your ${platform} profile and get unlimited optimizations.`,
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
      error?.status === 400 && error?.error?.message?.includes("image")
        ? "One or more images couldn't be processed. Please use JPG, PNG, GIF, WebP, or HEIC format."
        : "Failed to analyze profile. Please try again.";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/optimize", async (req, res) => {
  try {
    const { sessionId, ...profileData } = req.body;
    if (!sessionId) {
      res.status(403).json({ error: "Payment required" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      res.status(403).json({ error: "Payment not completed" });
      return;
    }

    const input = validateProfileInput(profileData);
    if (!input.success) {
      res.status(400).json({ error: input.error });
      return;
    }
    const result = await optimizeProfile(input.data);
    res.json(result);
  } catch (error: any) {
    console.error("Optimization error:", error);
    const msg =
      error?.status === 400 && error?.error?.message?.includes("image")
        ? "One or more images couldn't be processed. Please use JPG, PNG, GIF, WebP, or HEIC format."
        : "Failed to optimize profile. Please try again.";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/stripe/publishable-key", async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (error) {
    console.error("Error getting publishable key:", error);
    res.status(500).json({ error: "Failed to get Stripe config" });
  }
});

app.get("/api/products", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC
    `);

    const productsMap = new Map();
    for (const row of result.rows) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
        });
      }
    }

    res.json({ products: Array.from(productsMap.values()) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/checkout", async (req, res) => {
  try {
    const { priceId, profileInput } = req.body;
    if (!priceId) {
      res.status(400).json({ error: "Missing priceId" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const sessionParams: any = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}/`,
    };

    if (profileInput?.email) {
      sessionParams.customer_email = profileInput.email;
    }

    if (profileInput) {
      sessionParams.metadata = {
        profileInput: JSON.stringify(profileInput).substring(0, 500),
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

app.get("/api/checkout/session/:sessionId", async (req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_details?.email,
    });
  } catch (error) {
    console.error("Session retrieval error:", error);
    res.status(500).json({ error: "Failed to retrieve session" });
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
