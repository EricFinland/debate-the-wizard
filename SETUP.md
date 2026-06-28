# Setup & Deploy — backend skeleton

This covers step 1 of the build order: **InsForge init → tables → `/judge-claim` → test with curl.**
Everything here is run from the repo root. The interactive/secret steps (login, keys) only you can do.

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

The schema lives in [`migrations/20260628120000_init.sql`](migrations/20260628120000_init.sql).

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

> If `npx @insforge/cli metadata` shows the gateway URL/key are auto-injected into
> functions, you can drop `INSFORGE_API_URL` / `INSFORGE_API_KEY` and read the
> injected names instead — adjust `env(...)` calls in the function accordingly.

## 4. Deploy the judge function

```bash
npx @insforge/cli functions deploy judge-claim \
  --file functions/judge-claim/index.ts \
  --name "Judge a claim" \
  --description "Grounds a debate claim in You.com results and rules supported/unsupported/misleading"

npx @insforge/cli functions list
```

It will be live at: `https://<PROJECT>.insforge.dev/functions/judge-claim`

## 5. Test with curl — the step-1 success gate

```bash
FUNCTION_URL=https://<PROJECT>.insforge.dev/functions/judge-claim ./scripts/test-judge.sh
```

Expected: a `supported` verdict with real citations on the first claim, and
`unsupported`/`misleading` on the made-up one. **If this works, the whole game works.**

Debug with: `npx @insforge/cli logs function.logs`

## What's next (later sessions)

- `/wizard-turn` edge fn (reuses this exact search+judge pipeline)
- Realtime channel per room + score/verdict broadcast
- Persist claims + citations to Postgres (currently the function is stateless)
- React arena frontend, then deploy via `npx @insforge/cli deployments`
