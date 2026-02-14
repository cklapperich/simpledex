from pokemontcgsdk import Card
import time

print("Starting query...")
start = time.time()

try:
    cards = Card.where(q='subtypes:V set:swsh1', orderBy='-set.releaseDate')
    print(f"Query returned in {time.time() - start:.2f}s")
    print(f"Type of cards object: {type(cards)}")

    # Try to consume the iterator
    print("Attempting to fetch cards...")
    card_list = list(cards)
    print(f"Fetched {len(card_list)} cards in {time.time() - start:.2f}s total")

    for card in card_list[:5]:  # Print first 5
        print(f"- {card.name} ({card.id})")

except Exception as e:
    print(f"Error after {time.time() - start:.2f}s: {e}")
