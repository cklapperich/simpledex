import os
from dotenv import load_dotenv
from pokemontcgsdk import Card, RestClient

# Load environment variables
load_dotenv()

api_key = os.getenv('POKEMONTCG_IO_API_KEY')
print(f"API Key loaded: {api_key[:10]}..." if api_key else "API Key not found!")

# Configure the API key
RestClient.configure(api_key)
print("RestClient configured")

# Try a very simple query
print("Making API call...")
try:
    cards = Card.where(page=1, pageSize=2)
    print(f"Response type: {type(cards)}")

    card_list = list(cards)
    print(f"Success! Got {len(card_list)} cards")

    for card in card_list:
        print(f"  - {card.name}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
