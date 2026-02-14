from pokemontcgsdk import Card
import signal
import sys

def timeout_handler(signum, frame):
    print("\n✗ API call timed out!")
    sys.exit(1)

# Set a 10 second alarm
signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(10)

print("Testing simple API call...")
try:
    # Try a simpler query - just get one card
    print("Calling Card.where() with page=1, pageSize=1...")
    cards = Card.where(page=1, pageSize=1)

    print(f"Got result, type: {type(cards)}")

    # Try to iterate
    card_list = list(cards)
    print(f"✓ Success! Got {len(card_list)} cards")

    if card_list:
        print(f"  Example: {card_list[0].name}")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    signal.alarm(0)  # Cancel the alarm
