#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('POKEMONTCG_IO_API_KEY')

url = "https://api.pokemontcg.io/v2/cards"
params = {"page": 1, "pageSize": 2}
headers = {"X-Api-Key": api_key}

print(f"Testing API directly...")
print(f"URL: {url}")
print(f"API Key: {api_key[:10]}...")

try:
    response = requests.get(url, params=params, headers=headers, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Response length: {len(response.text)} bytes")

    data = response.json()
    print(f"Cards found: {len(data.get('data', []))}")

    for card in data.get('data', []):
        print(f"  - {card['name']} ({card['id']})")

except requests.Timeout:
    print("ERROR: Request timed out!")
except Exception as e:
    print(f"ERROR: {e}")
