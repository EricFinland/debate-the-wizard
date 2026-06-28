#!/usr/bin/env bash
# Smoke-test the deployed judge-claim function.
# Usage: FUNCTION_URL=https://<project>.insforge.dev/functions/judge-claim ./scripts/test-judge.sh
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${FUNCTION_URL:-}" && -n "${INSFORGE_API_URL:-}" ]]; then
  FUNCTION_URL="${INSFORGE_API_URL%/}/functions/judge-claim"
fi

URL="${FUNCTION_URL:?Set FUNCTION_URL or INSFORGE_API_URL to your deployed judge-claim endpoint}"

if [[ "$URL" == *"YOUR-PROJECT"* || "$URL" == *"<PROJECT>"* ]]; then
  echo "Set FUNCTION_URL or replace INSFORGE_API_URL in .env with your deployed InsForge project URL." >&2
  exit 1
fi

echo "== A claim that should be SUPPORTED =="
curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{"topic":"Is nuclear energy good for the climate?","argument":"Nuclear power emits almost no CO2 during operation, far less than coal or gas per unit of electricity."}' | jq .

echo
echo "== A made-up claim that should be UNSUPPORTED/MISLEADING =="
curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{"topic":"Is nuclear energy good for the climate?","argument":"Nuclear plants release more CO2 than coal plants over their lifetime."}' | jq .
