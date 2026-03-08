CREATE TABLE IF NOT EXISTS public.cards (
  id              TEXT PRIMARY KEY,
  set_name        TEXT NOT NULL,
  number          TEXT NOT NULL,
  set_number      TEXT,
  release_date    TEXT NOT NULL,
  series          TEXT NOT NULL,
  supertype       TEXT NOT NULL,
  rarity          TEXT NOT NULL,
  hp              INTEGER,
  ptcgo_code      TEXT,
  evolve_from     TEXT,
  flavor_text     TEXT,
  regulation_mark TEXT,
  illustrator     TEXT,
  subtypes        TEXT[] NOT NULL DEFAULT '{}',
  types           TEXT[] NOT NULL DEFAULT '{}',
  retreat_cost    TEXT[] NOT NULL DEFAULT '{}',
  rules           TEXT[] NOT NULL DEFAULT '{}',
  names           JSONB NOT NULL DEFAULT '{}',
  attacks         JSONB NOT NULL DEFAULT '[]',
  abilities       JSONB NOT NULL DEFAULT '[]',
  weaknesses      JSONB NOT NULL DEFAULT '[]',
  resistances     JSONB NOT NULL DEFAULT '[]',
  images          JSONB NOT NULL DEFAULT '[]',
  legalities      JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS cards_set_name_idx  ON public.cards(set_name);
CREATE INDEX IF NOT EXISTS cards_supertype_idx ON public.cards(supertype);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Public read: anon can SELECT all cards
CREATE POLICY "Anyone can read cards"
  ON public.cards FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE policies — service role bypasses RLS automatically
