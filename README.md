<div align="center">

<img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/wizards/wizard-purple.png" width="84" alt="Purple wizard" />
<img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/wizards/wizard-red.png" width="84" alt="Red wizard" />
<img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/wizards/wizard-green.png" width="84" alt="Green wizard" />
<img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/wizards/wizard-grey.png" width="84" alt="Grey wizard" />

# &#9876;&#65039; Debate the Wizard &#129497;

### A pixel, Game Boy style 1&#8209;vs&#8209;1 debate battle. No spells. Just arguments, grounded in live search.

<br/>

[![Play Now](https://img.shields.io/badge/%E2%96%B6%20PLAY%20NOW-live%20demo-8B5CF6?style=for-the-badge&logoColor=white)](https://atjgzcv9.insforge.site/)

<br/>

![Grounded by You.com](https://img.shields.io/badge/Grounded%20by-You.com-5A4FCF?style=flat-square)
![Backend on InsForge](https://img.shields.io/badge/Backend-InsForge-1A1A2E?style=flat-square)
![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Edge on Deno](https://img.shields.io/badge/Edge-Deno-000000?style=flat-square&logo=deno&logoColor=white)

</div>

---

You face an AI wizard and duel with **arguments instead of spells**. State a claim, then each turn you cast an argument. A Judge grounds it in fresh **You.com** search, shows the sources on screen, and rules your argument one of three ways:

| Verdict | What happens |
|:---:|:---|
| &#9989; **Supported** | Your claim strikes the enemy wizard |
| &#128165; **Misleading** | It backfires and you take the damage |
| &#128168; **Unsupported** | It fizzles, no damage either way |

The wizard argues back and gets fact&#8209;checked exactly the same way, so it can lose too. Drop the other side's HP to win.

## &#127918; How It Plays

1. **Pick your wizard** and choose a difficulty, from easy all the way to impossible.
2. **State a claim** (or hit `PICK FOR ME` and choose a side).
3. **FIGHT.** Type an argument. It gets searched on You.com and judged in real time.
4. **The wizard rebuts** with its own grounded argument and is judged the same way.
5. **First to drop the opponent's HP wins** (or the higher HP after the final round).

> Sign in with an email account to save progress. OAuth (Google or GitHub) is only needed to appear on the leaderboard.

## &#128293; Choose Your Challenge

<div align="center">

<table>
<tr>
<td align="center"><img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/staffs/staff-easy.png" width="60" alt="Easy staff" /><br/><b>Easy</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/staffs/staff-medium.png" width="60" alt="Medium staff" /><br/><b>Medium</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/staffs/staff-hard.png" width="60" alt="Hard staff" /><br/><b>Hard</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/EricFinland/debate-the-wizard/main/frontend/img/staffs/staff-impossible.png" width="60" alt="Impossible staff" /><br/><b>Impossible</b></td>
</tr>
</table>

</div>

## &#129504; Why Search Is Load&#8209;Bearing

- **You.com is the win condition.** Every claim, yours and the wizard's, is grounded in live You.com search, and the sources are shown on screen each turn. No search means no grounding, no verdict, no damage.
- **InsForge runs the whole backend.** Postgres, edge functions, the judge and wizard pipeline, the AI model gateway, auth, and the hosted deploy.

## &#127959;&#65039; Architecture

| Component | Built on | Job |
|---|---|---|
| Frontend | Vanilla JS, HTML, CSS | Pixel Game Boy UI, spell combat animations, citation side&#8209;panel |
| Game logic | InsForge Edge Functions (Deno) | `/submit-argument`, `/create-room`, `/record-match` |
| AI Workflow | TypeScript (`backend/agent-workflow`) | Claim extraction, research, fact checking, debate, and judging |
| Model Gateway | InsForge Model Gateway to Claude | Powers the AI workflow |
| Grounding | You.com Search API | Real&#8209;time, citation&#8209;backed snippets |
| Persistence | InsForge Postgres | rooms, players, claims, citations |

## &#128193; Repo Layout

```text
backend/migrations/          Postgres schema (InsForge CLI migrations)
backend/functions/           InsForge Edge Functions (create-room, submit-argument, etc.)
backend/agent-workflow/      Local TypeScript multi-agent debate workflow
frontend/                    The pixel Game Boy vanilla JS static frontend
docs/agent-workflow.md       Agent workflow diagram, responsibilities, and contracts
docs/backend-architecture.md Backend edge function contracts and API specs
tests/frontend/static/       Zero-dependency frontend regression checks
tests/smoke/                 Optional local/deployed smoke tests
SETUP.md                     Init, deploy, and test, step by step
```

## &#128640; Run Locally

The game is static. Serve the frontend folder and open it:

```bash
cd frontend
npm run dev
```

It talks to the live InsForge backend, so no local backend is needed. See **[SETUP.md](SETUP.md)** for InsForge login, schema, secrets, and backend deployment instructions.

## &#129514; Tests

Run the maintained local checks from the repo root:

```bash
npm test
```

Optional smoke tests need local secrets or a deployed backend:

```bash
npm run smoke:agent -- "The moon landing was fake because NASA admitted the footage was staged."
BASE=https://<PROJECT>.insforge.app npm run smoke:backend
```

## &#128295; Built With

<div align="center">

**[You.com](https://you.com)** &#183; **[InsForge](https://insforge.dev)** &#183; Deno Edge Functions &#183; Vanilla JS &#183; Vercel

<br/>

<sub>Made for the hackathon. Powered by real search and real fact&#8209;checking.</sub>

</div>
