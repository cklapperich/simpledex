#!/usr/bin/env python3
"""
Fine-tune MobileClip for Pokemon card recognition.

This script uses contrastive learning with hard negative sampling to improve
the model's ability to distinguish between different cards of the same Pokemon.

Features:
  - Groups cards by Pokemon name for hard negative mining
  - Filters out duplicate artwork (reprints, language variants) using perceptual hashing
  - Removes Pokemon with only 1 unique artwork (no hard negatives)

Prerequisites:
  - Run `npx tsx download-all-cards.ts` first to download card images to ./card-images/
  - Install: pip install torch torchvision mobileclip pillow imagehash
"""

import json
import random
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote

import torch
import torch.nn.functional as F
import torchvision.transforms as T
from PIL import Image
from torch.utils.data import DataLoader, Dataset

# Try to import mobileclip - provide helpful error if missing
try:
    from mobileclip import create_model_and_transforms
except ImportError:
    print("Error: mobileclip not installed. Install with: pip install mobileclip")
    raise

# For duplicate artwork detection
try:
    import imagehash
    IMAGEHASH_AVAILABLE = True
except ImportError:
    IMAGEHASH_AVAILABLE = False
    print("Warning: imagehash not installed. Duplicate detection disabled.")
    print("         Install with: pip install imagehash")

# =============================================================================
# Paths (relative to project root)
# =============================================================================
PROJECT_ROOT = Path(__file__).parent.parent
CARDS_JSON = PROJECT_ROOT / "public" / "cards-western.json"
IMAGES_DIR = PROJECT_ROOT / "card-images"
OUTPUT_MODEL = PROJECT_ROOT / "mobileclip_pokemon_cards.pt"

# =============================================================================
# Filename <-> Card ID conversion
# Mirrors src/utils/cardIdUtils.ts
# =============================================================================

# Mapping for filesystem-safe conversions (matches TypeScript version)
FILESYSTEM_CHAR_MAP = {
    '!': '_excl_',
    '?': '_qmark_',
    '*': '_star_',
    '<': '_lt_',
    '>': '_gt_',
    '"': '_quot_',
    '|': '_pipe_',
    '\\': '_bslash_',
    '/': '_slash_',
    ':': '_colon_',
    '%': '_pct_',
}

FILESYSTEM_REVERSE_MAP = {v: k for k, v in FILESYSTEM_CHAR_MAP.items()}


def card_id_to_filename(card_id: str) -> str:
    """
    Convert a card ID to a filesystem-safe filename (without extension).
    ex10-! -> ex10-_excl_
    ex10-? -> ex10-_qmark_
    exu-%3F -> exu-_qmark_ (URL-decodes first)
    """
    # URL-decode first (handles %3F -> ?, %21 -> !, etc.)
    try:
        result = unquote(card_id)
    except Exception:
        result = card_id

    for char, replacement in FILESYSTEM_CHAR_MAP.items():
        result = result.replace(char, replacement)
    return result


def filename_to_card_id(filename: str) -> str:
    """
    Convert a filesystem filename back to a card ID.
    ex10-_excl_ -> ex10-!
    ex10-_qmark_ -> ex10-?
    """
    result = filename
    for replacement, char in FILESYSTEM_REVERSE_MAP.items():
        result = result.replace(replacement, char)
    return result


# =============================================================================
# Card Database
# =============================================================================

def load_card_database() -> dict:
    """
    Load cards-western.json and build a lookup by card ID.
    Returns dict: card_id -> card object
    """
    if not CARDS_JSON.exists():
        raise FileNotFoundError(
            f"Card database not found: {CARDS_JSON}\n"
            f"Make sure you're running from the project root."
        )

    with open(CARDS_JSON, 'r', encoding='utf-8') as f:
        cards = json.load(f)

    # Build lookup by ID
    return {card['id']: card for card in cards}


def get_pokemon_name(card: dict) -> str | None:
    """
    Get the English name of a Pokemon card.
    Returns None for non-Pokemon cards (Trainer, Energy).
    """
    if card.get('supertype') != 'Pokemon':
        return None
    names = card.get('names', {})
    return names.get('en')


# =============================================================================
# Duplicate Artwork Detection
# =============================================================================

# Threshold for dhash - images with distance <= this are considered duplicates
# Based on testing: same artwork = 0-4, different artwork = 11+
DUPLICATE_HASH_THRESHOLD = 8


def compute_image_hash(img_path: Path):
    """Compute dhash for an image. Returns None if imagehash unavailable."""
    if not IMAGEHASH_AVAILABLE:
        return None
    try:
        img = Image.open(img_path).convert('RGB')
        return imagehash.dhash(img)
    except Exception:
        return None


def filter_duplicate_artwork(paths: list[Path]) -> list[Path]:
    """
    Filter out images that share the same artwork (reprints, language variants).

    Within a group of cards with the same name, removes images whose dhash
    distance is <= DUPLICATE_HASH_THRESHOLD from an already-kept image.
    Keeps the first unique artwork encountered.
    """
    if not IMAGEHASH_AVAILABLE or len(paths) <= 1:
        return paths

    kept = []
    kept_hashes = []

    for path in paths:
        h = compute_image_hash(path)
        if h is None:
            # Can't hash, keep it to be safe
            kept.append(path)
            continue

        # Check if this is a duplicate of any kept image
        is_duplicate = False
        for kh in kept_hashes:
            if h - kh <= DUPLICATE_HASH_THRESHOLD:
                is_duplicate = True
                break

        if not is_duplicate:
            kept.append(path)
            kept_hashes.append(h)

    return kept


# =============================================================================
# Image Discovery
# =============================================================================

def discover_training_images(card_db: dict, dedupe: bool = True) -> tuple[list[Path], dict[str, list[int]]]:
    """
    Scan the card-images directory and group images by Pokemon name.

    Args:
        card_db: Card database lookup (card_id -> card object)
        dedupe: If True, filter out duplicate artwork within each Pokemon group

    Returns:
        all_paths: List of all image paths (for the Dataset)
        pokemon_to_indices: Dict mapping Pokemon name -> list of indices in all_paths
    """
    if not IMAGES_DIR.exists():
        raise FileNotFoundError(
            f"Images directory not found: {IMAGES_DIR}\n"
            f"Run `npx tsx download-all-cards.ts` first to download card images."
        )

    # Find all images and group by Pokemon name
    image_extensions = {'.webp', '.png', '.jpg', '.jpeg'}
    pokemon_to_paths = defaultdict(list)
    missing_in_db = 0
    non_pokemon = 0

    for img_path in IMAGES_DIR.iterdir():
        if img_path.suffix.lower() not in image_extensions:
            continue

        # Convert filename back to card ID
        card_id = filename_to_card_id(img_path.stem)

        # Look up in database
        card = card_db.get(card_id)
        if card is None:
            missing_in_db += 1
            continue

        # Get Pokemon name (skip non-Pokemon cards)
        pokemon_name = get_pokemon_name(card)
        if pokemon_name is None:
            non_pokemon += 1
            continue

        pokemon_to_paths[pokemon_name].append(img_path)

    total_before = sum(len(paths) for paths in pokemon_to_paths.values())
    print(f"Found {total_before} Pokemon card images")
    print(f"  {len(pokemon_to_paths)} unique Pokemon")
    print(f"  Skipped {non_pokemon} non-Pokemon cards (Trainer/Energy)")
    if missing_in_db > 0:
        print(f"  Warning: {missing_in_db} images not found in database")

    # Filter out duplicate artwork within each Pokemon group
    duplicates_removed = 0
    if dedupe and IMAGEHASH_AVAILABLE:
        print("\nFiltering duplicate artwork...")
        for pokemon_name in pokemon_to_paths:
            original = pokemon_to_paths[pokemon_name]
            filtered = filter_duplicate_artwork(original)
            duplicates_removed += len(original) - len(filtered)
            pokemon_to_paths[pokemon_name] = filtered
        print(f"  Removed {duplicates_removed} duplicate artworks")

    # Filter out Pokemon with only 1 card (no hard negatives possible)
    single_card_pokemon = [name for name, paths in pokemon_to_paths.items() if len(paths) < 2]
    for name in single_card_pokemon:
        del pokemon_to_paths[name]
    if single_card_pokemon:
        print(f"  Skipped {len(single_card_pokemon)} Pokemon with only 1 unique card")

    # Build flat list and index mapping
    all_paths = []
    pokemon_to_indices = {}

    for pokemon_name, paths in pokemon_to_paths.items():
        start_idx = len(all_paths)
        all_paths.extend(paths)
        pokemon_to_indices[pokemon_name] = list(range(start_idx, len(all_paths)))

    print(f"\nTraining set: {len(all_paths)} images, {len(pokemon_to_indices)} Pokemon")
    if 'Pikachu' in pokemon_to_indices:
        print(f"  Pikachu cards: {len(pokemon_to_indices['Pikachu'])}")

    return all_paths, pokemon_to_indices


# =============================================================================
# Data Augmentation
# =============================================================================

# Augmentations simulating phone photos of physical cards
augment = T.Compose([
    T.RandomResizedCrop(224, scale=(0.85, 1.0)),
    T.RandomRotation(15),
    T.RandomPerspective(distortion_scale=0.2, p=0.7),
    T.ColorJitter(brightness=0.25, contrast=0.2, saturation=0.15),
    T.GaussianBlur(kernel_size=5, sigma=(0.1, 1.5)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Clean transform for reference database embeddings
clean_transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])


# =============================================================================
# Dataset and Sampler
# =============================================================================

class CardDataset(Dataset):
    """Dataset that returns two augmented views of each card image."""

    def __init__(self, paths: list[Path], transform=augment):
        self.paths = paths
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = Image.open(self.paths[idx]).convert('RGB')
        # Return two different augmented views for contrastive learning
        return self.transform(img), self.transform(img)


class HardNegativeBatchSampler:
    """
    Batch sampler that groups cards by Pokemon for hard negative mining.

    Each batch contains multiple cards from the same Pokemon (hard negatives)
    mixed with cards from other Pokemon (easy negatives).
    """

    def __init__(
        self,
        pokemon_to_indices: dict[str, list[int]],
        batch_size: int = 128,
        cards_per_pokemon: int = 4
    ):
        self.pokemon_to_indices = pokemon_to_indices
        self.batch_size = batch_size
        self.cards_per_pokemon = cards_per_pokemon
        self.pokemon_list = list(pokemon_to_indices.keys())

    def __iter__(self):
        random.shuffle(self.pokemon_list)
        batch = []

        for pokemon in self.pokemon_list:
            indices = self.pokemon_to_indices[pokemon]
            k = min(self.cards_per_pokemon, len(indices))
            sampled = random.sample(indices, k)

            batch.extend(sampled)

            # Yield complete batches
            while len(batch) >= self.batch_size:
                yield batch[:self.batch_size]
                batch = batch[self.batch_size:]

        # Yield remaining samples (if substantial)
        if len(batch) > self.cards_per_pokemon:
            yield batch

    def __len__(self):
        total = sum(len(v) for v in self.pokemon_to_indices.values())
        return total // self.batch_size


# =============================================================================
# Training
# =============================================================================

def train(
    epochs: int = 3,
    batch_size: int = 128,
    cards_per_pokemon: int = 4,
    learning_rate: float = 1e-6,
    temperature: float = 0.07
):
    """Main training loop."""

    print("=" * 60)
    print("Pokemon Card Fine-tuning with MobileClip")
    print("=" * 60)

    # Check for GPU
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"\nDevice: {device}")
    if device == 'cpu':
        print("Warning: Training on CPU will be slow. GPU recommended.")

    # Load card database
    print("\nLoading card database...")
    card_db = load_card_database()
    print(f"  {len(card_db)} cards in database")

    # Discover training images
    print("\nScanning for training images...")
    all_paths, pokemon_to_indices = discover_training_images(card_db)

    if len(all_paths) == 0:
        raise RuntimeError("No training images found!")

    # Create dataset and dataloader
    dataset = CardDataset(all_paths)
    sampler = HardNegativeBatchSampler(
        pokemon_to_indices,
        batch_size=batch_size,
        cards_per_pokemon=cards_per_pokemon
    )
    dataloader = DataLoader(
        dataset,
        batch_sampler=sampler,
        num_workers=4,
        pin_memory=(device == 'cuda')
    )

    print(f"\nDataset: {len(dataset)} images, ~{len(sampler)} batches per epoch")

    # Load model
    print("\nLoading MobileClip model...")
    model, _, _ = create_model_and_transforms('mobileclip_s2', pretrained='datacompdr')
    model = model.to(device)
    model.train()

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=learning_rate,
        weight_decay=0.1
    )

    # Training loop
    print(f"\nTraining for {epochs} epochs...")
    print("-" * 60)

    for epoch in range(epochs):
        total_loss = 0
        num_batches = 0

        for view1, view2 in dataloader:
            view1 = view1.to(device)
            view2 = view2.to(device)

            # Get normalized embeddings
            emb1 = F.normalize(model.encode_image(view1), dim=-1)
            emb2 = F.normalize(model.encode_image(view2), dim=-1)

            # Contrastive loss (InfoNCE)
            logits = emb1 @ emb2.t() / temperature
            labels = torch.arange(len(view1), device=device)
            loss = F.cross_entropy(logits, labels)

            # Backprop
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            num_batches += 1

        avg_loss = total_loss / max(num_batches, 1)
        print(f"Epoch {epoch + 1}/{epochs}: loss = {avg_loss:.4f}")

    # Save model
    print("-" * 60)
    print(f"\nSaving model to {OUTPUT_MODEL}...")
    torch.save(model.state_dict(), OUTPUT_MODEL)
    print("Done!")


# =============================================================================
# Main
# =============================================================================

if __name__ == '__main__':
    train()
