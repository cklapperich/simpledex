-- Create user_share_codes table
CREATE TABLE IF NOT EXISTS public.user_share_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast share code lookups (primary access pattern)
CREATE UNIQUE INDEX IF NOT EXISTS user_share_codes_share_code_idx
  ON public.user_share_codes(share_code);

-- Enable RLS
ALTER TABLE public.user_share_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read share codes (needed to resolve share_code → user_id)
CREATE POLICY "Anyone can view share codes"
  ON public.user_share_codes
  FOR SELECT
  USING (true);

-- Only authenticated users can create their own share code
CREATE POLICY "Users can create their own share code"
  ON public.user_share_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add policy to allow public viewing of collections via share codes
CREATE POLICY "Anyone can view shared collections"
  ON public.collections
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM public.user_share_codes
    )
  );

-- Add policy to allow public viewing of wishlists via share codes
CREATE POLICY "Anyone can view shared wishlists"
  ON public.wishlists
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM public.user_share_codes
    )
  );
