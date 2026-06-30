#!/usr/bin/env bash
# End-to-end smoke test for the deployed InsForge edge functions.
# Usage: BASE=https://<project>.insforge.app npm run smoke:backend
set -euo pipefail

BASE="${BASE:?Set BASE to your InsForge project URL, e.g. https://yourproj.us-east.insforge.app}"
BASE="${BASE%/}"

fn() {
  echo "$BASE/functions/$1"
}

echo "== health =="
curl -sS "$(fn health)" | jq .

echo
echo "== create-room (seed topic) =="
ROOM=$(curl -sS -X POST "$(fn create-room)" -H "Content-Type: application/json" \
  -d '{"topic_id":"nuclear-climate","rounds_total":1,"difficulty":"novice"}')
echo "$ROOM" | jq .
ROOM_ID=$(echo "$ROOM" | jq -r '.room.id')

if [[ -z "$ROOM_ID" || "$ROOM_ID" == "null" ]]; then
  echo "create-room did not return .room.id" >&2
  exit 1
fi

echo
echo "== submit-argument (full round) =="
TURN=$(curl -sS -X POST "$(fn submit-argument)" -H "Content-Type: application/json" \
  -d "{\"room_id\":\"$ROOM_ID\",\"round_no\":1,\"argument\":\"Nuclear power emits almost no CO2 during operation, far less than coal per kWh.\"}")
echo "$TURN" | jq .
echo "$TURN" | jq -e '.player_claim and .wizard_claim and (.player_score | type == "number") and (.wizard_score | type == "number")' >/dev/null

echo
echo "== get-room (state / recap) =="
curl -sS -X POST "$(fn get-room)" -H "Content-Type: application/json" \
  -d "{\"room_id\":\"$ROOM_ID\"}" | jq .

echo
echo "== leaderboard =="
curl -sS "$(fn leaderboard)" | jq .
