require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function mapCardToRow(card) {
  return {
    id:              card.id,
    set_name:        card.set,
    number:          card.number,
    set_number:      card.setNumber ?? null,
    release_date:    card.releaseDate,
    series:          card.series,
    supertype:       card.supertype,
    rarity:          card.rarity,
    hp:              card.hp ?? null,
    ptcgo_code:      card.ptcgoCode ?? null,
    evolve_from:     card.evolveFrom ?? null,
    flavor_text:     card.flavorText ?? null,
    regulation_mark: card.regulationMark ?? null,
    illustrator:     card.illustrator ?? null,
    subtypes:        card.subtypes ?? [],
    types:           card.types ?? [],
    retreat_cost:    card.retreatCost ?? [],
    rules:           card.rules ?? [],
    names:           card.names ?? {},
    attacks:         card.attacks ?? [],
    abilities:       card.abilities ?? [],
    weaknesses:      card.weaknesses ?? [],
    resistances:     card.resistances ?? [],
    images:          card.images ?? [],
    legalities:      card.legalities ?? {},
  };
}

async function main() {
  const cards = require('../public/cards-western.json');
  const BATCH = 500;
  let ok = 0, fail = 0;
  for (let i = 0; i < cards.length; i += BATCH) {
    const rows = cards.slice(i, i + BATCH).map(mapCardToRow);
    const { error } = await supabase.from('cards').upsert(rows, { onConflict: 'id' });
    if (error) { console.error(`Batch ${i/BATCH+1} failed:`, error.message); fail += rows.length; }
    else { process.stdout.write('.'); ok += rows.length; }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
