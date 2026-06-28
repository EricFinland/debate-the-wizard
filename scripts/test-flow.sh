#!/usr/bin/env bash
# End-to-end smoke test for the orchestration functions.
# Usage: BASE=https://<project>.insforge.dev ./scripts/test-flow.sh
set -euo pipefail
BASE="${BASE:?Set BASE to your InsForge project URL, e.g. https://yourproj.insforge.dev}"
fn() { echo "$BASE/functions/$1"; }

echo "== health =="
curl -sS "$(fn health)" | jq .

echo; echo "== create-room (seed topic) =="
ROOM=$(curl -sS -X POST "$(fn create-room)" -H "Content-Type: application/json" \
  -d '{"topic_id":"nuclear-climate","rounds_total":3}')
echo "$ROOM" | jq .
ROOM_ID=$(echo "$ROOM" | jq -r '.room.id')

echo; echo "== submit-argument (round 1) =="
curl -sS -X POST "$(fn submit-argument)" -H "Content-Type: application/json" \
  -d "{\"room_id\":\"$ROOM_ID\",\"round_no\":1,\"argument\":\"Nuclear power emits almost no CO2 during operation, far less than coal per kWh.\"}" | jq .

echo; echo "== advance-wizard (round 1) =="
echo "(requires wizard-turn deployed; expect a 503 message until then)"
curl -sS -X POST "$(fn advance-wizard)" -H "Content-Type: application/json" \
  -d "{\"room_id\":\"$ROOM_ID\",\"round_no\":1}" | jq .

echo; echo "== get-room (state / recap) =="
curl -sS -X POST "$(fn get-room)" -H "Content-Type: application/json" \
  -d "{\"room_id\":\"$ROOM_ID\"}" | jq .

echo; echo "== leaderboard =="
curl -sS "$(fn leaderboard)" | jq .
