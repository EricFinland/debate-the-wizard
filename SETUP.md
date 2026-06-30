# Setup & Deploy

This guide covers how to deploy the Debate the Wizard backend to InsForge and run the frontend locally.
Everything here is run from the repo root.

## 0. Prereqs

- Node 18+ (`node --version`)
- An InsForge account (https://insforge.dev) and a You.com Search API key (https://api.you.com)
- `jq` for the curl test (optional but nice)

## 1. Create + link the InsForge project

```bash
npx @insforge/cli login                       # opens browser auth
npx @insforge/cli create --name debate-the-wizard --template empty
# ...or create it in the dashboard and copy the project id from the URL:
#   https://insforge.dev/dashboard/project/<PROJECT_ID>
npx @insforge/cli link --project-id <PROJECT_ID>
npx @insforge/cli current                      # confirm user/org/project
```

Note your project URL: `https://<PROJECT>.insforge.dev` (you'll need it below).

## 2. Apply the database schema

```bash
npx @insforge/cli db migrations up --all
npx @insforge/cli db tables                     # verify: rooms, players, claims, citations
```

The schema lives in `backend/migrations/`.

## 3. Store the secrets

Keys live in InsForge Secret Manager — never in the repo or the browser.

```bash
npx @insforge/cli secrets add YOUCOM_API_KEY   "<your-you.com-key>"
npx @insforge/cli secrets add INSFORGE_API_URL "https://<PROJECT>.insforge.dev"
npx @insforge/cli secrets add INSFORGE_API_KEY "<your-insforge-project-key>"
# optional overrides:
# npx @insforge/cli secrets add JUDGE_MODEL   "anthropic/claude-3.5-sonnet"
# npx @insforge/cli secrets add EXTRACT_MODEL "anthropic/claude-3.5-haiku"
npx @insforge/cli secrets list
```

For local frontend runs, keep the same `INSFORGE_API_URL` in the repo-root
`.env`. If you use auth/account features, also set the browser-safe
`INSFORGE_ANON_KEY`. Do not put `INSFORGE_API_KEY` in browser config.

## 4. Deploy the functions

Deploy all the orchestration / infra functions from the `backend/functions` directory:

```bash
npx @insforge/cli functions deploy create-room     --file backend/functions/create-room/index.ts     --name "Create room"
npx @insforge/cli functions deploy submit-argument --file backend/functions/submit-argument/index.ts --name "Submit argument"
npx @insforge/cli functions deploy get-room        --file backend/functions/get-room/index.ts        --name "Get room"
npx @insforge/cli functions deploy leaderboard     --file backend/functions/leaderboard/index.ts     --name "Leaderboard"
npx @insforge/cli functions deploy record-match    --file backend/functions/record-match/index.ts    --name "Record match"
npx @insforge/cli functions deploy health          --file backend/functions/health/index.ts          --name "Health"

npx @insforge/cli functions list
```

Each is live at `https://<PROJECT>.insforge.dev/functions/<slug>`. Quick check:

```bash
curl https://<PROJECT>.insforge.dev/functions/health
```

## 5. Test with curl

We include a local script to smoke test the AI workflow locally before hitting the live endpoints:

```bash
# Provide environment variables locally
export INSFORGE_API_URL="..."
export INSFORGE_API_KEY="..."
export YOUCOM_API_KEY="..."
export YOUCOM_SEARCH_URL="https://ydc-index.io/v1/search"
export SEARCH_COUNT="6"

./scripts/test-agent-workflow.sh "The moon landing was fake because NASA admitted the footage was staged."
```

Expected: The workflow should extract the claims, search You.com, evaluate the reasoning, generate the AI rebuttal, and finally score both sides.

## 6. Running the Frontend

The pixel-art Vanilla JS frontend does not require a build step. It communicates directly with the functions via `frontend/js/services/api.js`.

To run it locally:
```bash
cd frontend
npm run dev
```
Open `http://localhost:3000` to play!

The dev/build scripts generate `frontend/js/env.js` from repo-root `.env.local`,
`.env`, and deployment environment variables. The generated file is ignored by
git and is loaded before `frontend/js/config.js`.
