# The Dating Profile Audit (Profile Reality Check)

A web app that analyzes and optimizes dating profiles for apps like Hinge, Tinder, and Bumble.

## Architecture

- **Frontend**: React + Vite (port 5000)
- **Backend**: Express + TypeScript (port 3001, proxied via Vite)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2, with vision for screenshots)
- **Payments**: Stripe via Replit Connectors (stripe-replit-sync for webhooks/DB sync)
- **Database**: PostgreSQL (Replit built-in, used for Stripe data sync)

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
  index.ts        - Express server (Stripe init, webhook, API routes)
  ai.ts           - OpenAI integration with vision support
  validation.ts   - Input validation
  stripeClient.ts - Stripe client via Replit Connectors
  webhookHandlers.ts - Stripe webhook processing
  seedProducts.ts - Script to create Stripe products/prices
shared/
  types.ts        - Shared TypeScript types
```

## Features

1. **Free Profile Analysis**: Score card with breakdown bars + witty roast + top 3 fixes with "biggest match killer" callout
2. **Match Targeting**: Choose who you want to attract (7 preset types + custom)
3. **Screenshot Upload**: Upload screenshots of dating profile instead of typing it out (uses OpenAI vision)
4. **Photo Upload**: Upload current profile photos (drag to reorder, up to 9) + additional candidate photos (up to 10) for AI photo evaluation
5. **Pricing Tiers** (Stripe):
   - Free: Score + roast + mistake identification
   - Profile Optimization ($19): Full bio rewrite, optimized prompts, photo strategy, tone adjustments, match targeting
   - Elite Optimization ($49): Everything in Pro + all apps, ongoing suggestions, priority support
6. **Shareable Results**: Copy roast for social sharing (viral loop)
7. **Before/After Examples**: Landing page shows transformation case study
8. **Success Page**: Post-payment confirmation with Stripe session verification

## Key Dependencies

- openai (via Replit AI Integrations - no API key needed)
- stripe, stripe-replit-sync (via Replit Connectors)
- pg (PostgreSQL client)
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
