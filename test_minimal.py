#!/usr/bin/env python3
import sys
print("Step 1: Starting", flush=True)

import os
print("Step 2: os imported", flush=True)

from dotenv import load_dotenv
print("Step 3: dotenv imported", flush=True)

load_dotenv()
print("Step 4: .env loaded", flush=True)

api_key = os.getenv('POKEMONTCG_IO_API_KEY')
print(f"Step 5: API key = {api_key[:10] if api_key else 'NOT FOUND'}...", flush=True)

print("Step 6: About to import pokemontcgsdk", flush=True)
from pokemontcgsdk import RestClient
print("Step 7: RestClient imported", flush=True)

print("Step 8: Configuring RestClient...", flush=True)
RestClient.configure(api_key)
print("Step 9: RestClient configured", flush=True)

from pokemontcgsdk import Card
print("Step 10: Card imported", flush=True)

print("Step 11: About to call Card.where()...", flush=True)
sys.stdout.flush()
cards = Card.where(page=1, pageSize=1)
print("Step 12: Card.where() returned", flush=True)
