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
    # Crop to bottom 2/7 of card
    cropped = crop_bottom_region(image_path)

    # Run OCR
    ocr = get_reader()
    results = ocr.readtext(
        # Convert PIL Image to numpy array for EasyOCR
        image=cropped,
        detail=1,  # Return bounding boxes and confidence
        paragraph=False,  # Keep individual text blocks
    )

    # Extract all text and confidences
    texts = []
    confidences = []
    for bbox, text, conf in results:
        texts.append(text)
        confidences.append(conf)

    raw_text = ' '.join(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

    # Parse set information
    set_number = None
    set_total = None
    set_id = None

    # Pattern 1: "123/456" format (card number / total in set)
    # Common formats: "25/102", "001/165", "SV001/SV102"
    number_pattern = r'(\d{1,3})\s*/\s*(\d{1,3})'
    match = re.search(number_pattern, raw_text)
    if match:
        set_number = match.group(1).lstrip('0') or '0'
        set_total = match.group(2).lstrip('0') or '0'

    # Pattern 2: Set ID codes (e.g., "SV01", "XY12", "SM11")
    # Usually 2-4 letters followed by 1-3 digits
    set_id_pattern = r'\b([A-Z]{2,4})[\s-]*(\d{1,3})\b'
    id_match = re.search(set_id_pattern, raw_text, re.IGNORECASE)
    if id_match:
        set_id = f"{id_match.group(1).upper()}{id_match.group(2)}"

    # Pattern 3: Just a standalone number if no slash found
    # (some promo cards just have a number)
    if set_number is None:
        standalone_pattern = r'\b(\d{1,3})\b'
        standalone_matches = re.findall(standalone_pattern, raw_text)
        if standalone_matches:
            # Take the largest reasonable number as the card number
            candidates = [int(m) for m in standalone_matches if 1 <= int(m) <= 999]
            if candidates:
                set_number = str(max(candidates))

    return {
        'raw_text': raw_text,
        'set_number': set_number,
        'set_total': set_total,
        'set_id': set_id,
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
    print(f"Raw OCR text: {result['raw_text']}")
    print(f"Set number: {result['set_number']}")
    print(f"Set total: {result['set_total']}")
    print(f"Set ID: {result['set_id']}")
    print(f"Confidence: {result['confidence']}")
    print(f"All detections: {result['all_detections']}")


if __name__ == '__main__':
    main()
