// Import the SDK in ESM/TypeScript
import TCGdex, { Query } from '@tcgdex/sdk'

// Instantiate the SDK with your preferred language
const tcgdex = new TCGdex('en');

// Search for any set
(async () => {
  // Retrieve Furret from the Darkness Ablaze Set
    const card = await tcgdex.card.list();
    // filter, sort & paginate the result (ex: find card where name is equal to furret)
    const cards = await tcgdex.card.list(new Query().equal('name', 'Furret'));
    console.log(cards);
})();

/*
//Sample Response
[
  {
    "id": "base4-1",
    "localId": "1",
    "name": "Alakazam",
    "image": "https://assets.tcgdex.net/en/base/base4/1"
  },
  // ...
  {
    "id": "xyp-XY99",
    "localId": "XY99",
    "name": "Aerodactyl Spirit Link",
    "image": "https://assets.tcgdex.net/en/xy/xyp/XY99"
  }
]
*/

const set = await tcgdex.fetch('sets', 'swsh3');
console.log(set);
/*
// Sample response
{
  "cardCount": {
    "firstEd": 0,
    "holo": 64,
    "normal": 137,
    "official": 189,
    "reverse": 155,
    "total": 201
  },
  "cards": [
    {
      "id": "swsh3-1",
      "image": "https://assets.tcgdex.net/en/swsh/swsh3/1",
      "localId": "1",
      "name": "Butterfree V"
    },
    // ...
    {
      "id": "swsh3-136",
      "image": "https://assets.tcgdex.net/en/swsh/swsh3/136",
      "localId": "136",
      "name": "Furret"
    },
    // ...
    {
      "id": "swsh3-201",
      "image": "https://assets.tcgdex.net/en/swsh/swsh3/201",
      "localId": "201",
      "name": "Capture Energy"
    }
  ],
  "id": "swsh3",
  "legal": {
    "expanded": true,
    "standard": false
  },
  "logo": "https://assets.tcgdex.net/en/swsh/swsh3/logo",
  "name": "Darkness Ablaze",
  "releaseDate": "2020-08-14",
  "serie": {
    "id": "swsh",
    "name": "Sword & Shield"
  },
  "symbol": "https://assets.tcgdex.net/univ/swsh/swsh3/symbol"
}
*/
