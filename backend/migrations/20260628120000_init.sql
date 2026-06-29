-- Debate the Wizard - initial schema
-- Applied with: npx @insforge/cli db migrations up --all
-- Note: no BEGIN/COMMIT here; the CLI wraps each migration in its own transaction.

-- gen_random_uuid() is built in on modern Postgres; this is harmless insurance.
create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  topic         text not null,
  status        text not null default 'lobby'
                  check (status in ('lobby', 'active', 'finished')),
  rounds_total  int  not null default 5,
  created_at    timestamptz not null default now()
);

create table if not exists public.players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms(id) on delete cascade,
  side      text not null check (side in ('A', 'B')),  -- A = human, B = wizard
  score     int  not null default 0
);

create table if not exists public.claims (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  round_no   int  not null,
  author     text not null check (author in ('player', 'wizard')),
  argument   text not null,                              -- full submitted text
  key_claim  text,                                       -- the testable claim the Judge extracted
  verdict    text check (verdict in ('supported', 'unsupported', 'misleading')),
  rationale  text,                                       -- Judge's one-liner
  points     int  not null default 0,
  scores     jsonb,                                      -- {factual_accuracy, logic, evidence, persuasiveness} 0-10 each
  fallacies  jsonb not null default '[]'::jsonb,         -- ["straw man", ...]
  created_at timestamptz not null default now()
);

create table if not exists public.citations (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references public.claims(id) on delete cascade,
  title      text,
  url        text,
  snippet    text                                        -- exact passage that grounded/contradicted the claim
);

create index if not exists idx_players_room   on public.players(room_id);
create index if not exists idx_claims_room     on public.claims(room_id);
create index if not exists idx_claims_room_rnd on public.claims(room_id, round_no);
create index if not exists idx_citations_claim on public.citations(claim_id);
