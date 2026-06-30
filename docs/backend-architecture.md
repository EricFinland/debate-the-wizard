# Backend architecture & team contracts

Everything runs on **InsForge**: Postgres + edge functions (Deno) + realtime + the model gateway.
Edge functions deploy one file each (`npx @insforge/cli functions deploy <slug> --file <path>`), so each function is self-contained.

## Architecture Core

The entire AI logic (debating, research, logic checking, scoring) lives in `backend/agent-workflow`.
This workflow is stateful (receives debate history) and is the core "brain" of the game.

The edge functions in `backend/functions` act as orchestration glue: they fetch the DB state, pass it to the `agent-workflow`, and save the result.

Because the `agent-workflow` evaluates both the player and the wizard in a single pass, the debate round is processed simultaneously.

## Edge function inventory

- **`create-room`** — `POST { topic, rounds_total?, difficulty?, host_user_id? }` → `{ room, players[A,B] }`. Creates the room + both players.
- **`submit-argument`** — `POST { room_id, round_no, argument }` → `{ player_claim, wizard_claim, player_score, wizard_score, room, winner, explanation }`. Runs the core `agent-workflow` with history, evaluating the player's argument and synthesizing the wizard's rebuttal simultaneously. Persists both claims and updates scores.
- **`get-room`** — `POST { room_id }` → `{ room, players, scores{A,B}, claims[](each with citations[]), winner }`. State for reconnect, spectating, and the recap.
- **`leaderboard`** — `GET` → `{ leaderboard[] }`. Top human (side-A) scores with their topic.
- **`health`** — `GET` → `{ ok, service, time, config{gateway,db,youcom} }`. Liveness + secret-presence (booleans only).

## Realtime & State

The new pixel-art frontend does **not** use WebSocket or Realtime subscriptions. Instead, it relies directly on the HTTP responses from the edge functions. Because `submit-argument` now processes the entire round in a single blocking call, the frontend simply awaits that response to get the player verdict, wizard rebuttal, and updated scores simultaneously.

## Full game loop (sequence)

```
create-room (topic, sides)            -> room_id, players
loop rounds 1..N:
  player types argument
    -> submit-argument(room_id, round, argument)   [runs agent-workflow -> persists both claims -> updates scores]
    -> returns player_claim, wizard_claim, scores
get-room(room_id)                      -> final scores, winner, full citation trail (recap)
```

## Integrity guards (orchestration functions)

- **One turn per round** — duplicate `submit-argument` for the same `(room_id, round_no)` returns `409`.
- **Finished rooms are read-only** — turns on a `finished` room return `409`.
- **Round bounds** — `round_no > rounds_total` returns `400`.
- **Idempotent scoring** — scores are *recomputed* as the sum of that player/wizard's `claims.points` on every turn, never incremented in place. Safe under retries/races and self-healing.

## JavaScript API Client

The frontend uses a vanilla JavaScript client located in `frontend/js/services/api.js`. It wraps all edge functions and uses a static `window.Api` global. It does not use TypeScript or generated types.

```js
// Usage from the frontend:
const data = await Api.createRoom({ topic: "Nuclear energy", difficulty: "adept" });
const result = await Api.submitArgument(roomId, roundNo, argument);
```
