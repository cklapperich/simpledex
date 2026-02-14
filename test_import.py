import sys
print("Python version:", sys.version)

print("Importing pokemontcgsdk...")
try:
    import pokemontcgsdk
    print("✓ pokemontcgsdk imported")

    print("Importing Card...")
    from pokemontcgsdk import Card
    print("✓ Card imported")

    print("All imports successful!")
except Exception as e:
    print(f"✗ Import failed: {e}")
    import traceback
    traceback.print_exc()
