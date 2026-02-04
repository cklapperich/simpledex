#!/usr/bin/env python3
"""
Build embeddings database from local card images using GPU acceleration.
Uses the same Xenova/mobileclip_s2 ONNX model as the browser for compatibility.

Usage:
    pip install torch onnxruntime-gpu huggingface_hub pillow tqdm
    python scripts/build-embeddings.py
    python scripts/build-embeddings.py --batch-size 32
"""
import os
import sys
import json
import struct
import argparse
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np

# Check for required packages
try:
    import torch
    from PIL import Image
    from huggingface_hub import hf_hub_download
    from tqdm import tqdm
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("\nInstall with:")
    print("  pip install torch huggingface_hub pillow tqdm")
    print("  pip install onnxruntime-gpu  # For NVIDIA GPU")
    print("  # OR: pip install onnxruntime  # For CPU only")
    sys.exit(1)

# Try GPU runtime first, fall back to CPU
try:
    import onnxruntime as ort
    providers = ort.get_available_providers()
    if 'CUDAExecutionProvider' in providers:
        EXECUTION_PROVIDERS = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        print("ONNX Runtime: CUDA available")
    else:
        EXECUTION_PROVIDERS = ['CPUExecutionProvider']
        print("ONNX Runtime: CPU only (install onnxruntime-gpu for CUDA)")
except ImportError:
    print("ERROR: onnxruntime not installed")
    print("  pip install onnxruntime-gpu  # For NVIDIA GPU")
    print("  pip install onnxruntime      # For CPU only")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).parent.parent
CARD_IMAGES_DIR = PROJECT_ROOT / "card-images"
OUTPUT_FILE = PROJECT_ROOT / "public" / "embeddings.bin"
CHECKPOINT_FILE = PROJECT_ROOT / "embeddings-checkpoint.json"

# Must match TypeScript: Xenova/mobileclip_s2 with fp32
MODEL_REPO = "Xenova/mobileclip_s2"
MODEL_FILE = "onnx/vision_model.onnx"  # fp32 vision encoder
EMBEDDING_DIM = 512
IMAGE_SIZE = 256  # MobileCLIP-S2 input size

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Filesystem character mapping (must match cardIdUtils.ts)
FILESYSTEM_REVERSE_MAP = {
    "_excl_": "!",
    "_qmark_": "?",
    "_star_": "*",
    "_lt_": "<",
    "_gt_": ">",
    "_quot_": '"',
    "_pipe_": "|",
    "_bslash_": "\\",
    "_slash_": "/",
    "_colon_": ":",
    "_pct_": "%",
}


def filename_to_card_id(filename: str) -> str:
    """Convert filesystem filename back to card ID."""
    result = filename
    for replacement, char in FILESYSTEM_REVERSE_MAP.items():
        result = result.replace(replacement, char)
    return result


def scan_card_images() -> List[Tuple[str, Path]]:
    """Scan card-images directory for all image files."""
    if not CARD_IMAGES_DIR.exists():
        raise FileNotFoundError(f"Card images directory not found: {CARD_IMAGES_DIR}")

    images = []
    for file in CARD_IMAGES_DIR.iterdir():
        if file.suffix.lower() in SUPPORTED_EXTENSIONS:
            card_id = filename_to_card_id(file.stem)
            images.append((card_id, file))

    return images


def load_checkpoint() -> Dict[str, List[float]]:
    """Load checkpoint if it exists."""
    if CHECKPOINT_FILE.exists():
        print("Loading checkpoint...")
        with open(CHECKPOINT_FILE, "r") as f:
            data = json.load(f)
        print(f"Loaded {len(data)} embeddings from checkpoint")
        return data
    return {}


def save_checkpoint(embeddings: Dict[str, List[float]]) -> None:
    """Save checkpoint to JSON file."""
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(embeddings, f)
    print(f"Checkpoint saved: {len(embeddings)} cards")


def write_binary_embeddings(embeddings: Dict[str, List[float]], output_path: Path) -> None:
    """Write embeddings to binary file (same format as TypeScript)."""
    card_ids = []
    for card_id in embeddings.keys():
        card_id_bytes = card_id.encode("utf-8")
        if len(card_id_bytes) > 255:
            print(f"Warning: Card ID too long, skipping: {card_id}")
            continue
        card_ids.append(card_id)

    total_size = 8
    for card_id in card_ids:
        card_id_bytes = len(card_id.encode("utf-8"))
        total_size += 1 + card_id_bytes + (EMBEDDING_DIM * 4)

    with open(output_path, "wb") as f:
        f.write(struct.pack("<I", len(card_ids)))
        f.write(struct.pack("<I", EMBEDDING_DIM))

        for card_id in card_ids:
            embedding = embeddings[card_id]
            card_id_bytes = card_id.encode("utf-8")
            f.write(struct.pack("<B", len(card_id_bytes)))
            f.write(card_id_bytes)
            for val in embedding:
                f.write(struct.pack("<f", val))

    size_mb = total_size / 1024 / 1024
    print(f"Wrote {output_path}: {size_mb:.2f} MB ({len(card_ids)} cards)")


def preprocess_image(image_path: Path) -> np.ndarray:
    """
    Preprocess image for MobileCLIP.
    Must match transformers.js preprocessing.
    """
    img = Image.open(image_path).convert("RGB")

    # Resize to 256x256 (MobileCLIP-S2 input size)
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BILINEAR)

    # Convert to numpy and normalize to [0, 1]
    img_array = np.array(img, dtype=np.float32) / 255.0

    # Normalize with ImageNet mean/std (CLIP standard)
    mean = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
    std = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
    img_array = (img_array - mean) / std

    # Convert to NCHW format (batch, channels, height, width)
    img_array = img_array.transpose(2, 0, 1)
    img_array = np.expand_dims(img_array, axis=0)

    return img_array


def download_model() -> str:
    """Download the ONNX model from HuggingFace."""
    print(f"Downloading model: {MODEL_REPO}/{MODEL_FILE}...")
    model_path = hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_FILE)
    print(f"Model downloaded to: {model_path}")
    return model_path


def main():
    parser = argparse.ArgumentParser(description="Build embeddings with GPU acceleration")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for processing")
    parser.add_argument("--checkpoint-interval", type=int, default=500, help="Save checkpoint every N images")
    args = parser.parse_args()

    print("=== Embeddings Build Script (ONNX) ===\n")
    print(f"Model: {MODEL_REPO} (fp32)")
    print(f"Providers: {EXECUTION_PROVIDERS}\n")

    # Scan for images
    print("Scanning for card images...")
    all_cards = scan_card_images()
    print(f"Found {len(all_cards)} card images\n")

    if not all_cards:
        print("No card images found. Run download-all-cards.ts first.")
        sys.exit(1)

    # Load checkpoint
    embeddings = load_checkpoint()
    processed_ids = set(embeddings.keys())

    # Filter to unprocessed
    to_process = [(cid, path) for cid, path in all_cards if cid not in processed_ids]
    print(f"Already processed: {len(processed_ids)}")
    print(f"To process: {len(to_process)}\n")

    if not to_process:
        print("All cards already processed!")
    else:
        # Download and load model
        model_path = download_model()

        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        session = ort.InferenceSession(
            model_path,
            sess_options=sess_options,
            providers=EXECUTION_PROVIDERS
        )

        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        print(f"Model loaded. Input: {input_name}, Output: {output_name}\n")

        # Process images
        batch_size = args.batch_size
        failed = 0
        checkpoint_counter = 0

        for i in tqdm(range(0, len(to_process), batch_size), desc="Processing"):
            batch = to_process[i : i + batch_size]

            # Preprocess batch
            batch_images = []
            valid_cards = []
            for card_id, path in batch:
                try:
                    img = preprocess_image(path)
                    batch_images.append(img)
                    valid_cards.append(card_id)
                except Exception as e:
                    print(f"\nFailed to load {card_id}: {e}")
                    failed += 1

            if not batch_images:
                continue

            # Stack into batch
            batch_array = np.vstack(batch_images)

            try:
                # Run inference
                outputs = session.run([output_name], {input_name: batch_array})[0]

                # Normalize embeddings (L2 norm)
                norms = np.linalg.norm(outputs, axis=1, keepdims=True)
                outputs = outputs / norms

                # Store results
                for j, card_id in enumerate(valid_cards):
                    embeddings[card_id] = outputs[j].tolist()

            except Exception as e:
                print(f"\nBatch inference failed: {e}")
                failed += len(valid_cards)

            # Checkpoint
            checkpoint_counter += len(valid_cards)
            if checkpoint_counter >= args.checkpoint_interval:
                save_checkpoint(embeddings)
                checkpoint_counter = 0

        print(f"\nProcessed: {len(to_process) - failed}")
        print(f"Failed: {failed}")

    # Write binary output
    print("\nWriting binary embeddings file...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    write_binary_embeddings(embeddings, OUTPUT_FILE)

    # Cleanup checkpoint
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print("Checkpoint file removed.")

    print("\nDone!")


if __name__ == "__main__":
    main()
