# Backend Functions

Source lives in `backend/functions/src`. InsForge deploys one file per edge function, so `npm run build:functions` bundles each entrypoint into `backend/functions/dist/<slug>.ts`.

Deploy generated bundles only:

```bash
npx @insforge/cli functions deploy judge-claim --file backend/functions/dist/judge-claim.ts
```

The legacy root `functions/` directory is retained for reference while the generated bundles become the deployment source of truth. Database migrations stay in the repo-root `migrations/` directory because that is the InsForge CLI convention.

Required function env:

- `INSFORGE_API_URL`
- `INSFORGE_API_KEY`
- `YOUCOM_API_KEY`
- `OPENROUTER_API_KEY` or an InsForge AI gateway configured through `INSFORGE_API_URL` / `INSFORGE_API_KEY`

Optional function env:

- `INSFORGE_DATA_URL`
- `JUDGE_MODEL`
- `EXTRACT_MODEL`
- `SEARCH_COUNT`
- `YOUCOM_SEARCH_URL`
