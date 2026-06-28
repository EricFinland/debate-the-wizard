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

The schema lives in [`backend/migrations/20260628120000_init.sql`](backend/migrations/20260628120000_init.sql).

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

## 4. Deploy the functions

The core pipeline (agent-pipeline track):

```bash
npx @insforge/cli functions deploy judge-claim \
  --file backend/functions/judge-claim/index.ts \
  --name "Judge a claim" \
  --description "Grounds a debate claim in You.com results and rules supported/unsupported/misleading"
```

The orchestration / infra functions ("the rest" track):

```bash
npx @insforge/cli functions deploy create-room     --file backend/functions/create-room/index.ts     --name "Create room"
npx @insforge/cli functions deploy submit-argument --file backend/functions/submit-argument/index.ts --name "Submit argument"
npx @insforge/cli functions deploy advance-wizard  --file backend/functions/advance-wizard/index.ts  --name "Advance wizard"
npx @insforge/cli functions deploy get-room        --file backend/functions/get-room/index.ts        --name "Get room"
npx @insforge/cli functions deploy leaderboard     --file backend/functions/leaderboard/index.ts     --name "Leaderboard"
npx @insforge/cli functions deploy health          --file backend/functions/health/index.ts          --name "Health"

npx @insforge/cli functions list
```

`wizard-turn` is owned by the agent-pipeline branch; deploy it once that's ready
(`advance-wizard` returns a clear 503 until then).

Each is live at `https://<PROJECT>.insforge.dev/functions/<slug>`. Quick check:

```bash
curl https://<PROJECT>.insforge.dev/functions/health
```

## 5. Test with curl — the step-1 success gate

```bash
FUNCTION_URL=https://<PROJECT>.insforge.dev/functions/judge-claim ./scripts/test-judge.sh
```

Expected: a `supported` verdict with real citations on the first claim, and
`unsupported`/`misleading` on the made-up one. **If this works, the whole game works.**

Debug with: `npx @insforge/cli logs function.logs`

## 6. Realtime (frontend)

UI updates come from subscribing to row-change events on `claims` / `players`
filtered by `room_id` — no server-side publishing needed. Confirm the exact event
names with `npx @insforge/cli metadata` and see the client pattern in
[docs/backend-architecture.md](docs/backend-architecture.md). If table-change
subscriptions need enabling, do it there.

## What's next

- `wizard-turn` edge fn (agent-pipeline track; reuses the search+judge pipeline)
- React arena frontend (frontend track), then deploy via `npx @insforge/cli deployments`
