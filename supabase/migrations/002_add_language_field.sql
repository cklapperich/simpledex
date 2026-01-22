-- Add language column to collections table
ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

-- Add language column to wishlists table
ALTER TABLE public.wishlists
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

-- Drop old unique indexes
DROP INDEX IF EXISTS collections_user_card_variation_idx;
DROP INDEX IF EXISTS wishlists_user_card_variation_idx;

-- Create new unique indexes that include language
CREATE UNIQUE INDEX IF NOT EXISTS collections_user_card_variation_language_idx
  ON public.collections(user_id, card_id, variation, language);

CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user_card_variation_language_idx
  ON public.wishlists(user_id, card_id, variation, language);
