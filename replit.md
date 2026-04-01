# Magnet — Dating Profile Analysis

A web app that analyzes and optimizes dating profiles for apps like Hinge, Tinder, and Bumble.

## Architecture

- **Frontend**: React + Vite (port 5000)
- **Backend**: Express + TypeScript (port 3001, proxied via Vite)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2, with vision for screenshots)
- **Database**: PostgreSQL (Replit built-in, used for free analysis tracking + user accounts)

## Project Structure

```
client/           - React frontend
  src/
    components/   - Landing, ProfileForm, Results, FullReport, Dashboard, ScoreRing, AuthModal, UserMenu
    hooks/        - useAuth (JWT auth state management)
    App.tsx       - Main app with view routing (landing/form/results/full-report/dashboard)
    styles.css    - Full app styles
  index.html
  public/
    favicon.svg
server/
  index.ts        - Express server (API routes, audit tracking, auth)
  ai.ts           - OpenAI integration with vision support
  validation.ts   - Input validation (email required)
  auth.ts         - JWT + bcrypt authentication utilities
shared/
  types.ts        - Shared TypeScript types
```

## Features

1. **Free Magnet Analysis**: Magnet Score with 5-category breakdown (Photo Quality, Attraction Signals, Personality Signals, Match Targeting, First Impression) + witty roast + issues detected with "biggest match killer" callout
2. **One Free Analysis Per Email (Per Platform)**: Server-side enforcement via `free_audits` table — each email gets one free analysis for one dating platform
3. **Match Targeting**: Choose who you want to attract (7 preset types + custom)
4. **Screenshot Upload**: Upload screenshots of dating profile instead of typing it out (uses OpenAI vision)
5. **Photo Upload**: Upload current profile photos (drag to reorder, up to 9) + additional candidate photos (up to 10) for AI photo evaluation
6. **Email Collection**: Required email field on form
7. **Shareable Results**: Copy Magnet Score roast for social sharing (viral loop)
8. **Before/After Examples**: Landing page shows transformation case study
9. **Pricing CTAs**: Results page shows $2.99 one-time Full Report and $12.99/mo Magnet Pro subscription options (no Stripe integration yet — buttons navigate to preview pages)
10. **Full Report Page**: Detailed per-category analysis with improvement suggestions and photo swap recommendations
11. **Dashboard Page**: Functional Magnet Pro dashboard — fetches real analysis history from DB, shows score trend chart, per-platform health status with re-analyze buttons, analysis history list with clickthrough to results. Accessible from user menu for logged-in users. Requires authentication.

## Database Tables

- `users` — user accounts (id SERIAL PK, email TEXT UNIQUE, password_hash TEXT, created_at)
- `free_audits` — tracks which emails have used their free Magnet analysis per platform (id, email, platform, created_at; UNIQUE on email+platform)
- `analyses` — persists every analysis result (id SERIAL PK, user_email TEXT, platform TEXT, overall_score INT, photo_quality INT, attraction_signals INT, personality_signals INT, match_targeting INT, first_impression INT, roast TEXT, mistakes JSONB, profile_type TEXT, profile_type_explanation TEXT, created_at TIMESTAMP); indexed on user_email

## Design System

- **Theme**: Dark & Tactical — `#0D1117` page background, white surface cards, electric blue `#0EA5E9` / teal `#00C9A7` accent gradient
- CSS custom property scoping: `:root` sets light text for dark bg; white card containers override to dark text via `--text: #0f172a`
- All CTA buttons, Sign In button, gradient text: `linear-gradient(135deg, #0EA5E9, #00C9A7)`

## Mobile Responsiveness

- Viewport meta tag with `width=device-width, initial-scale=1.0`
- iOS zoom prevention: all text inputs at 16px minimum font size
- 44px minimum tap targets on all interactive controls (buttons, remove icons, reorder arrows)
- Touch-friendly global CSS: `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, `-webkit-appearance: none`
- Mobile breakpoint at 640px with adapted layouts for all pages (landing, form, results)
- Photo reorder: desktop uses HTML5 drag-and-drop, mobile uses up/down arrow buttons (drag disabled on touch devices via `pointer: coarse` media query)
- Responsive grids: features auto-fit, photos 3-col on mobile, screenshots 2-col on mobile
- CTA button goes full-width on mobile
- Mode toggle (type/screenshot) stacks vertically on mobile
- Score breakdown, roast cards all reduce padding on mobile

## Authentication

- Email + password auth with bcrypt hashing (12 rounds) and JWT tokens (30-day expiry)
- JWT secret stored in `JWT_SECRET` env var
- Server routes: POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`
- `authenticateOptional` middleware on analyze route extracts user from JWT if present
- Client: `useAuth` hook manages state via localStorage (`magnet_token`), checks `/api/auth/me` on mount
- UI: `AuthModal` (login/register tabs) + `UserMenu` (avatar dropdown with sign out) in fixed header
- Logged-in users get email auto-filled and read-only in ProfileForm
- Auth is optional — app works fully without an account

## Upload Architecture

- Client sends photos as `FormData` (multipart upload) — no base64-in-JSON, works reliably on mobile
- Server uses `multer` for multipart parsing (memory storage, 20MB per file, 25 files max)
- Server uses `sharp` to compress all images to 1024px max / JPEG 70% quality before sending to OpenAI
- HEIC/HEIF files converted client-side via `heic2any` before upload

## Key Dependencies

- openai (via Replit AI Integrations - no API key needed)
- pg, @types/pg (PostgreSQL client)
- express, cors, multer (multipart file uploads)
- sharp (server-side image compression)
- react, react-dom, vite
- lucide-react (icons)
- heic2any (HEIC/HEIF to JPEG conversion for iPhone photos)
- bcryptjs, jsonwebtoken (auth)
- concurrently (dev server)

## Running

`npm run dev` starts both the Express server (port 3001) and Vite dev server (port 5000).
