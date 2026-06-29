-- Haul migration: difficulty, host attribution, taunts, search queries, profiles, indexes

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'adept' CHECK (difficulty IN ('novice','adept','archmage'));
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_user_id text;

ALTER TABLE claims ADD COLUMN IF NOT EXISTS taunt text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS search_query text;

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id text primary key,
  display_name text,
  avatar_url text,
  wins int not null default 0,
  losses int not null default 0,
  ties int not null default 0,
  total_score int not null default 0,
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_total_score ON public.profiles (total_score DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);
