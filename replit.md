# The Dating Profile Audit

A web app that analyzes and optimizes dating profiles for apps like Hinge, Tinder, and Bumble.

## Architecture

- **Frontend**: React + Vite (port 5000)
- **Backend**: Express + TypeScript (port 3001, proxied via Vite)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2, with vision for screenshots)

## Project Structure

```
client/           - React frontend
  src/
    components/   - Landing, ProfileForm, Results, ScoreRing
    App.tsx       - Main app with view routing
    styles.css    - Full app styles
  index.html
server/
  index.ts        - Express server (50MB body limit for screenshots)
  ai.ts           - OpenAI integration with vision support
  validation.ts   - Input validation
shared/
  types.ts        - Shared TypeScript types
```

## Features

1. **Free Profile Analysis**: Score + witty roast + mistake identification
2. **Match Targeting**: Choose who you want to attract (7 preset types + custom)
3. **Screenshot Upload**: Upload screenshots of dating profile instead of typing it out (uses OpenAI vision)
4. **Photo Upload**: Upload current profile photos (drag to reorder, up to 9) + additional candidate photos (up to 10) for AI photo evaluation
5. **Full Optimization** ($19): Rewritten bio, optimized prompts, photo advice with swap recommendations, tone adjustments
5. **Shareable Results**: Copy roast for social sharing (viral loop)

## Key Dependencies

- openai (via Replit AI Integrations - no API key needed)
- express, cors
- react, react-dom, vite
- lucide-react (icons)
- concurrently (dev server)

## Running

`npm run dev` starts both the Express server (port 3001) and Vite dev server (port 5000).
