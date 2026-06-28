# Debate the Wizard — Web

The frontend for Debate the Wizard: a live, fact-checked debate duel against an
arcane AI. Every claim (yours and the wizard's) is grounded in real-time
You.com search, judged, and scored on screen.

Next.js 14 (App Router) + TypeScript + Tailwind CSS + framer-motion.

## Run it locally

1. Copy the env example and set your InsForge project URL and anon key:

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local`:

   ```
   NEXT_PUBLIC_INSFORGE_URL=https://YOUR-PROJECT.us-east.insforge.app
   NEXT_PUBLIC_INSFORGE_ANON_KEY=YOUR-ANON-KEY
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Build for production

```bash
npm run build
npm run start
```

## How it fits together

- `app/page.tsx` — single-page client app. Switches between `picker`, `arena`,
  and `recap` views driven by the `useDebate` hook. No dynamic routes.
- `hooks/useDebate.ts` — the game state machine. Creates a debate client,
  drives the round flow (player turn → wizard rebuttal → verdict reveals →
  next round → recap), and exposes state + actions to the UI.
- `lib/debate-client.ts` — self-contained typed client for the InsForge edge
  functions, plus all shared types. Reads the base URL from
  `NEXT_PUBLIC_INSFORGE_URL`.
- `lib/insforge-auth.ts` — browser SDK singleton for auth and realtime. Reads
  `NEXT_PUBLIC_INSFORGE_URL` and `NEXT_PUBLIC_INSFORGE_ANON_KEY`.
- `lib/ui.ts` — shared UI helpers: `verdictStyles`, `cn`, `domainOf`.
- `lib/seed-topics.ts` — the built-in debate topics.
- `components/*` — presentational components (rendered from props, no data
  fetching inside).

## Design

Dark "arcane arena / wizard duel" theme: deep indigo/violet night, rune-gold
accents for the human, arcane-violet for the wizard, and emerald / rose / zinc
verdict colors. You.com citations are deliberately prominent. Theme tokens live
in `tailwind.config.ts` and `app/globals.css`.
