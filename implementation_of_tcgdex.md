on page load or login: 1 single query (rest or graphql?)
that retreives all cards in the users collection with all extra metadata

on search: retreives all cards with the matching name or set with all extra metadata (attacks, hp, element, etc)

cache this somehow (if its a recent search or the users collection hasnt changed since their last access). maybe just cache the collection and the last N search results in the frontend?

then when they add cards to collection and clickon collection, we could re-query the entire collection OR do an incremental query and merge the data (maybe too complicated)

Images: same thing, grab low quality images, cache locally in browser. Need a caching strategy, discuss/brainstorm options on how best to do this

supabase only stores card id as it does now and language. need to update the migration .sql file to include language.

remove build-cards.ts
remove from package.json
remove flexsearch
remove index

brainstorm a way to maintain the existing typo-resiliency. maybe we DO keep flexsearch against a local list of all pokemon names and set names? flexsearch finds the closest match then we search?

NOTE: Api is case-sensitive. user types furret--> Api must receive Furret