import os
from dotenv import load_dotenv
from pokemontcgsdk import Card, RestClient

# Load environment variables
load_dotenv()

# Configure the API key
RestClient.configure(os.getenv('POKEMONTCG_IO_API_KEY'))

# Now make the query
cards = Card.where(q='subtypes:V set:swsh1', orderBy='-set.releaseDate')

# Convert to list and print results
card_list = list(cards)
print(f"Found {len(card_list)} cards:\n")
for card in card_list:
    print(f"- {card.name} ({card.id})")