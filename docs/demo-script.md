# Demo script — Debate the Wizard (3 minutes to win)

Live debate game: you argue one side of a real topic, an AI wizard argues the other.
Every claim either side makes is grounded in fresh **You.com** search and fact-checked
by a **Judge** model. Get caught making a misleading claim and you lose the round. The
whole backend (Postgres, edge functions, model gateway, realtime, deploy) is one
platform: **InsForge**, fully agent-operated.

This runbook is tuned to land both sponsor prizes on camera and end on the money shot:
**the wizard makes a misleading claim and the Judge catches it with a real You.com citation.**

---

## 30-second elevator pitch (say this first)

> "This is Debate the Wizard. You pick a side of a real debate, an AI wizard takes the
> other. The twist: nobody gets to just assert things. Every single claim, yours and the
> wizard's, gets run through live You.com search and fact-checked by a Judge model. Say
> something true and sourced, you score. Say something misleading, the Judge catches it
> with a real citation and you lose the round. Search isn't decoration here, it's the win
> condition. And the entire backend, Postgres, the edge functions, the model gateway, the
> realtime layer, the deploy, is one platform, InsForge, stood up entirely by agents. Let
> me show you the wizard get caught lying."

Then go straight into the click-path.

---

## Before you start (pre-flight, do this off-camera)

1. Open the deployed app. Confirm it loads to the topic / side picker.
2. Hit the health check once so you know the wires are hot:
   `curl https://<project>.insforge.dev/functions/health` should return
   `{ ok: true, ... config: { gateway: true, db: true, youcom: true } }`.
   All three `true` means the model gateway, Postgres, and the You.com key are live.
3. Have the **fallback recording** (see bottom) queued in a second tab in case wifi dies.
4. Pick a 3-round match so the demo fits in 3 minutes (rounds_total: 3).

---

## The exact click-path

### 0:00 — Pitch + pick the trap topic
- Deliver the elevator pitch above.
- On the topic picker, select the seed topic **`nuclear-climate`**:
  *"Nuclear energy is the best tool we have for fighting climate change."*
- You take **SIDE A (human)**: **FOR, nuclear is essential**.
  The wizard auto-takes **SIDE B**: **AGAINST, renewables are the better bet**.
- Why this topic: it ships with a built-in factual trap. The tempting-but-false claim
  is *"nuclear plants emit more CO2 over their lifecycle than coal."* You.com sources
  flatly contradict it, which sets up the money shot when the wizard reaches for it.

Say: *"I'll argue nuclear is essential. Watch what happens when either of us says
something that doesn't survive a fact-check."*

### 0:25 — Round 1: you make a clean, sourced argument
- Type a strong, true claim, e.g.:
  *"Nuclear has one of the lowest lifecycle CO2 footprints of any energy source, on par
  with wind, and it delivers steady baseload power that solar and wind can't match alone."*
- Submit. While it runs, narrate the pipeline:
  *"This is going out to You.com right now, real search, and the Judge is reading the
  snippets to decide if my claim actually holds up."*

**What appears (point at each):**
- A **verdict badge**: `SUPPORTED` (green) with **+10**.
- The **You.com citation panel**, sourced snippets with titles and clickable links. Put
  your cursor on it: *"These are live You.com results. This is the source the Judge relied
  on to score me. Search is the win condition, no search, no grounding, no points."*
- The **scorecard**: factual accuracy / logic / evidence / persuasiveness (0-10 each),
  plus any fallacies flagged. *"One Judge call gives a verdict, a four-dimension
  scorecard, and fallacy detection."*

### 1:05 — Trigger the wizard (the setup)
- Hit **Advance / Wizard's turn**.
- Narrate: *"Now the wizard argues the other side. Same pipeline. It gets the same You.com
  grounding and the same Judge. Which means the wizard can get fact-checked too, and it can
  lose."*

### 1:25 — THE MONEY SHOT: the wizard gets caught
- The wizard reaches for the trap: a misleading anti-nuclear claim (the lifecycle-CO2
  line, or a similarly tempting overstatement).
- The Judge rules **`MISLEADING`** (rose/red), **-5**, and the **You.com citation panel
  shows the exact source that contradicts the wizard.**

Stop and sell it:
> *"There it is. The wizard just made a claim that sounds plausible, and the Judge caught
> it, with a real You.com source that contradicts it, right there on screen. The wizard
> just LOST that round to a fact-check. The AI doesn't get to lie either."*

- Point at the score swing: your **+10** vs the wizard's **-5**. *"That's a 15-point swing,
  decided entirely by live search."*

### 2:05 — One more quick exchange (optional, if time)
- Run round 2 fast to show it's a real loop, not a one-off. Player argues, wizard argues,
  both judged, scores update live.
- Mention realtime: *"Scores and verdicts update live, the UI subscribes to InsForge
  realtime database-change events, so the arena stays in sync without me refreshing."*

### 2:35 — The recap: the citation trail
- End the match (or jump to recap). Show the **winner reveal** and the **full citation
  trail**: every claim from both sides with its You.com sources attached.
- Close: *"Every point in this game traces back to a real source. That's the citation
  trail, the receipts for the entire debate. You.com made the scoring possible; InsForge
  ran the whole thing, schema, functions, model gateway, realtime, and deploy, on one
  platform, all stood up by agents."*

### 2:55 — Land the two prizes explicitly
> *"You.com: search is the win condition and every citation is on screen. InsForge: the
> entire backend is one platform, agent-built. Thanks."*

---

## Hammer the sponsor prizes (work these lines in)

**You.com (search is the win condition):**
- "No search means no grounding, no grounding means no scoring, no scoring means no game."
- Always have the citation panel visible when a verdict lands. Hover a link.
- The money shot IS a You.com moment: a misleading claim caught by a real You.com source.

**InsForge (one platform, agent-operated):**
- Postgres (rooms, players, claims, citations) + edge functions (`create-room`,
  `submit-argument`, `advance-wizard`, `judge-claim`, `get-room`, `leaderboard`, `health`)
  + model gateway (Claude, via one OpenAI-compatible endpoint) + realtime (DB-change
  subscriptions) + deploy, all on InsForge.
- "The Judge and the wizard both reach Claude through InsForge's model gateway, one
  bearer token, one endpoint. The same search+judge pipeline is built once and called
  twice, for the player and the wizard."

---

## Fallback plan (if wifi is flaky)

1. **Health first.** If the pre-flight `health` call shows any of
   `gateway/db/youcom` false, fix that secret before you present, don't debug on stage.
2. **Pre-created room.** Create a `nuclear-climate` room a few minutes early so room
   creation isn't on the critical path. Keep the `room_id`.
3. **Replay via get-room.** If live calls stall, `get-room { room_id }` returns full
   state, claims, citations, scores, and winner, for any room you ran earlier. Walk the
   recap from a room you already completed; the citation trail is just as strong.
4. **Recorded money shot.** Keep a 30-second screen recording of the wizard getting caught
   with the You.com citation. If the network dies mid-demo, cut to it and keep narrating.
5. **Slow-network narration.** A judge call does extract -> You.com search -> Judge, two
   model hops plus a live search, so it can take a few seconds. Narrate the pipeline while
   it runs; the wait sells that the search and fact-check are real, not canned.
6. **Graceful by design.** If You.com returns nothing for a claim, the Judge rules
   `unsupported` (+0) instead of erroring, so the demo never hard-crashes on stage.

---

## One-line cheat sheet

`nuclear-climate` -> argue FOR (clean, sourced, +10) -> trigger wizard -> wizard hits the
trap -> Judge rules MISLEADING -5 with a You.com citation -> recap the full citation trail
-> name both prizes.
