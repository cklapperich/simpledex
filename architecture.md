## Pokemon TCG Collection Tracker

### Data
1. https://github.com/PokemonTCG/pokemon-tcg-data has already been copied to /pokemon-tcg-data
card data is s in cards/en/*.json as separate json files

2. Build script transforms to minimal JSON:
```json
[
  { "id": "base1-4", "name": "Charizard", "set": "Base", "number": "4", "image": "https://images.pokemontcg.io/base1/4.png" 
]
```
3. Bundle ships with app (~2-3MB)
4. Update manually when new sets release

### Tech Stack
- Svelte + TypeScript + Vite
- Vercel (free)
- localStorage
- No backend

### Pages
1. **Browse/Search** — search bar, grid of cards, double-click to add
2. **Collection** — same UI but filtered to owned cards, shows quantities, doesnt show checkmarks obviously

### Features
- Search filters bundled JSON client-side (instant)
- Images hotlinked from `images.pokemontcg.io`
- Double-click card → increment quantity in localStorage
- Collection stored as `{ "base1-4": 2, "sv1-25": 1 }`
- Export button → download as JSON or CSV
- caches images locally

### UI Design

Take inspiration from /sample_search_page for look and feel.
Double click an image to add
If an image is in collection: Checkmark inside a circle appears over it
the search page is the home page

### Other
use the svelte skill thats installed