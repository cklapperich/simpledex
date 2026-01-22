-- Create collections table
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  variation TEXT NOT NULL DEFAULT 'normal',
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index to prevent duplicate entries for same user/card/variation
CREATE UNIQUE INDEX IF NOT EXISTS collections_user_card_variation_idx
  ON public.collections(user_id, card_id, variation);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS collections_user_id_idx ON public.collections(user_id);

-- Enable Row Level Security
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own collections
CREATE POLICY "Users can view their own collections"
  ON public.collections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own collections
CREATE POLICY "Users can insert their own collections"
  ON public.collections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own collections
CREATE POLICY "Users can update their own collections"
  ON public.collections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own collections
CREATE POLICY "Users can delete their own collections"
  ON public.collections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create wishlists table (mirrors collections but without quantity)
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  variation TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate wishlist entries
CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user_card_variation_idx
  ON public.wishlists(user_id, card_id, variation);

-- Faster lookups
CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON public.wishlists(user_id);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same pattern as collections)
CREATE POLICY "Users can view their own wishlists"
  ON public.wishlists FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wishlists"
  ON public.wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wishlists"
  ON public.wishlists FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wishlists"
  ON public.wishlists FOR DELETE USING (auth.uid() = user_id);

-- Reuse existing trigger for updated_at
CREATE TRIGGER update_wishlists_updated_at
  BEFORE UPDATE ON public.wishlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
