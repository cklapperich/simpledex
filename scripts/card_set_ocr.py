#!/usr/bin/env python3
"""
Prototype: Extract Pokemon card set numbers using EasyOCR.

Crops to the bottom 2/7 of the card image (where set info is located)
and uses OCR to find the set number and card count.

Prerequisites:
    pip install easyocr pillow

Usage:
    python scripts/card_set_ocr.py path/to/card.png
    python scripts/card_set_ocr.py  # runs on test images
"""

import re
import sys
from pathlib import Path

import easyocr
import numpy as np
from PIL import Image

# Initialize EasyOCR reader (downloads model on first run)
# Using English only for Pokemon card set numbers
reader = None


def get_reader():
    """Lazy-load EasyOCR reader."""
    global reader
    if reader is None:
        print("Loading EasyOCR model...")
        reader = easyocr.Reader(['en'], gpu=True)
    return reader


def crop_bottom_region(image_path: Path, fraction: float = 2/7) -> Image.Image:
    """
    Crop the bottom portion of a card image where set info is located.

    Args:
        image_path: Path to the card image
        fraction: Fraction of image height to keep from bottom (default 2/7)

    Returns:
        Cropped PIL Image
    """
    img = Image.open(image_path).convert('RGB')
    width, height = img.size

    # Calculate crop region (bottom portion)
    top = int(height * (1 - fraction))
    crop_box = (0, top, width, height)

    return img.crop(crop_box)


def run_ocr_on_image(image: Image.Image) -> list:
    """Run OCR on a PIL Image and return results."""
    ocr = get_reader()
    image_array = np.array(image)
    return ocr.readtext(
        image=image_array,
        detail=1,
        paragraph=False,
    )


def extract_set_info(image_path: Path) -> dict:
    """
    Extract set number and card count from a Pokemon card image.

    Args:
        image_path: Path to the card image

    Returns:
        Dictionary with:
        - raw_text: All OCR text found
        - set_number: Extracted card number in set (e.g., "25")
        - set_total: Total cards in set if found (e.g., "102")
        - set_id: Set identifier if found (e.g., "SV01", "base1")
        - confidence: OCR confidence score
    """
    # Crop bottom 2/7 of card where set info is located
    cropped = crop_bottom_region(image_path)
    results = run_ocr_on_image(cropped)

    # Extract all text and confidences
    texts = []
    confidences = []
    for bbox, text, conf in results:
        texts.append(text)
        confidences.append(conf)

    raw_text = ' '.join(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

    # Parse set number - get the number before the slash
    # Filter to matches where the total (after slash) looks valid (10-500)
    set_number = None

    def is_valid_total(total_str: str) -> bool:
        """Check if total looks like a valid set size (10-500), handling OCR errors."""
        total = int(total_str.lstrip('0') or '0')
        if 10 <= total <= 500:
            return True
        # Handle dropped leading digit: "02" -> "102"
        if len(total_str) == 2 and total_str.startswith('0'):
            expanded = int('1' + total_str)
            if 10 <= expanded <= 500:
                return True
        return False

    # Look for "XX/YYY" pattern where YYY is a valid set size
    pattern = r'(\d{1,3})\s*[/\[\]|l\\{]\s*(\d{2,3})'

    # Check individual detections first
    for _, text, conf in results:
        match = re.search(pattern, text.strip())
        if match and is_valid_total(match.group(2)):
            set_number = match.group(1).lstrip('0') or '0'
            break

    # Fallback: search in raw text
    if set_number is None:
        for match in re.finditer(pattern, raw_text):
            if is_valid_total(match.group(2)):
                set_number = match.group(1).lstrip('0') or '0'
                break

    # Promo cards: look for patterns like "DP16", "SWSH123"
    if set_number is None:
        for _, text, conf in results:
            promo_match = re.search(r'^([A-Z]{2,4})(\d{1,3})$', text.strip(), re.IGNORECASE)
            if promo_match:
                set_number = f"{promo_match.group(1).upper()}{promo_match.group(2)}"
                break

    return {
        'raw_text': raw_text,
        'set_number': set_number,
        'confidence': round(avg_confidence, 3),
        'all_detections': [(text, round(conf, 3)) for _, text, conf in results]
    }


def process_card(image_path: str | Path) -> dict:
    """
    Process a single card image and return set information.

    Args:
        image_path: Path to the card image

    Returns:
        Dictionary with extracted set information
    """
    path = Path(image_path)
    if not path.exists():
        return {'error': f'File not found: {path}'}

    try:
        result = extract_set_info(path)
        result['file'] = str(path.name)
        return result
    except Exception as e:
        return {'file': str(path.name), 'error': str(e)}


def main():
    """Main entry point for testing."""
    project_root = Path(__file__).parent.parent
    images_dir = project_root / 'card-images'

    # If specific files provided, process those
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            result = process_card(arg)
            print_result(result)
        return

    # Otherwise, run on sample test images
    if not images_dir.exists():
        print(f"Card images directory not found: {images_dir}")
        print("Provide a card image path as argument, or run download-all-cards.ts first.")
        return

    # Test on a few sample cards
    test_files = list(images_dir.glob('*.png'))[:5]
    if not test_files:
        test_files = list(images_dir.glob('*.webp'))[:5]

    if not test_files:
        print("No card images found in card-images/")
        return

    print(f"Testing OCR on {len(test_files)} sample cards...\n")
    print("=" * 60)

    for img_path in test_files:
        result = process_card(img_path)
        print_result(result)
        print("-" * 60)


def print_result(result: dict):
    """Pretty print a result dictionary."""
    if 'error' in result:
        print(f"Error: {result['error']}")
        return

    print(f"File: {result.get('file', 'unknown')}")
    print(f"Set number: {result['set_number']}")
    print(f"Raw OCR: {result['raw_text'][:80]}...")


if __name__ == '__main__':
    main()
