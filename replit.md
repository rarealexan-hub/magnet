# The Dating Profile Audit (Profile Reality Check)

A web app that analyzes and optimizes dating profiles for apps like Hinge, Tinder, and Bumble.

## Architecture

- **Frontend**: React + Vite (port 5000)
- **Backend**: Express + TypeScript (port 3001, proxied via Vite)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2, with vision for screenshots)
- **Payments**: Stripe via Replit Connectors (stripe-replit-sync for webhooks/DB sync)
- **Database**: PostgreSQL (Replit built-in, used for Stripe data sync + free audit tracking)

## Project Structure

```
client/           - React frontend
  src/
    components/   - Landing, ProfileForm, Results, ScoreRing, Success
    App.tsx       - Main app with view routing (landing/form/results/success)
    styles.css    - Full app styles
  index.html
  public/
    favicon.svg
server/
  index.ts        - Express server (Stripe init, webhook, API routes, audit tracking)
  ai.ts           - OpenAI integration with vision support
  validation.ts   - Input validation (email required)
  stripeClient.ts - Stripe client via Replit Connectors
  webhookHandlers.ts - Stripe webhook processing
  seedProducts.ts - Script to create Stripe products/prices
shared/
  types.ts        - Shared TypeScript types
```

## Features

1. **Free Profile Analysis**: Score card with 5-category breakdown (Photo Quality, Attraction Signals, Personality Signals, Match Targeting, First Impression) + witty roast + top 3 fixes with "biggest match killer" callout
2. **One Free Audit Per Email (Per Platform)**: Server-side enforcement via `free_audits` table — each email gets one free analysis for one dating platform, then must upgrade for additional platforms or re-audits
3. **Match Targeting**: Choose who you want to attract (7 preset types + custom)
4. **Screenshot Upload**: Upload screenshots of dating profile instead of typing it out (uses OpenAI vision)
5. **Photo Upload**: Upload current profile photos (drag to reorder, up to 9) + additional candidate photos (up to 10) for AI photo evaluation
6. **Email Collection**: Required email field on form, passed to Stripe checkout as customer_email
7. **Pricing Tiers** (Stripe):
   - Free: Score + roast + mistake identification (one per email)
   - Profile Optimization ($19): Full bio rewrite, optimized prompts, photo strategy, tone adjustments, match targeting
   - Elite Optimization ($49): Everything in Pro + all apps, ongoing suggestions, priority support
8. **Shareable Results**: Copy roast for social sharing (viral loop)
9. **Before/After Examples**: Landing page shows transformation case study
10. **Success Page**: Post-payment confirmation with Stripe session verification

## Database Tables

- `free_audits` — tracks which emails have used their free audit per platform (id, email, platform, created_at; UNIQUE on email+platform)
- `stripe.*` — managed by stripe-replit-sync (products, prices, sessions, etc.)

## Key Dependencies

- openai (via Replit AI Integrations - no API key needed)
- stripe, stripe-replit-sync (via Replit Connectors)
- pg, @types/pg (PostgreSQL client)
- express, cors
- react, react-dom, vite
- lucide-react (icons)
- concurrently (dev server)

## Stripe Setup

- Products created via `npx tsx server/seedProducts.ts`
- Stripe schema auto-managed by stripe-replit-sync (DO NOT manually modify stripe.* tables)
- Webhook route registered BEFORE express.json() middleware
- Products fetched from stripe.products/stripe.prices tables via /api/products endpoint

## Running

`npm run dev` starts both the Express server (port 3001) and Vite dev server (port 5000).
