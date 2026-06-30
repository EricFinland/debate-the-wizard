#!/usr/bin/env bash
# Smoke-test the local agent-workflow module.
# Usage:
#   npm run smoke:agent
#   npm run smoke:agent -- "Your debate argument here"
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${INSFORGE_API_URL:?Set INSFORGE_API_URL in .env or your shell.}"
: "${INSFORGE_API_KEY:?Set INSFORGE_API_KEY in .env or your shell.}"
: "${YOUCOM_API_KEY:?Set YOUCOM_API_KEY in .env or your shell.}"

ARGUMENT="${1:-Nuclear power is bad for the climate because it creates dangerous waste and takes too long to build.}"

TEST_ARGUMENT="$ARGUMENT" npx --yes tsx -e '
import { runAgentWorkflow } from "./backend/agent-workflow/index.ts";

async function main() {
  const result = await runAgentWorkflow({
    user_argument: process.env.TEST_ARGUMENT ?? "",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
'
