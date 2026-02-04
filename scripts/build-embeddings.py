#!/usr/bin/env python3
"""
Build embeddings database from local card images using GPU acceleration.
Uses the same Xenova/mobileclip_s2 ONNX model as the browser for compatibility.

IMPORTANT: This script reads settings from src/config/model-config.json to ensure
preprocessing and inference match the browser transformers.js pipeline exactly.

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
CONFIG_FILE = PROJECT_ROOT / "src" / "config" / "model-config.json"
CARD_IMAGES_DIR = PROJECT_ROOT / "card-images"
CHECKPOINT_FILE = PROJECT_ROOT / "embeddings-checkpoint.json"

# Load configuration from shared JSON file
def load_config() -> dict:
    """Load model configuration from shared JSON file."""
    if not CONFIG_FILE.exists():
        print(f"ERROR: Config file not found: {CONFIG_FILE}")
        print("Please ensure src/config/model-config.json exists.")
        sys.exit(1)

    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)

    print(f"Loaded config from: {CONFIG_FILE}")
    return config


# Load config at module level
MODEL_CONFIG = load_config()

# Extract settings from config
MODEL_REPO = MODEL_CONFIG["modelId"]
MODEL_FILE = MODEL_CONFIG["onnxModel"]
EMBEDDING_DIM = MODEL_CONFIG["embeddingDim"]
IMAGE_SIZE = MODEL_CONFIG["preprocessing"]["imageSize"]
IMAGE_MEAN = np.array(MODEL_CONFIG["preprocessing"]["mean"], dtype=np.float32)
IMAGE_STD = np.array(MODEL_CONFIG["preprocessing"]["std"], dtype=np.float32)
CROP_METHOD = MODEL_CONFIG["preprocessing"].get("cropMethod", "center")
POOLING = MODEL_CONFIG["inference"]["pooling"]
NORMALIZE = MODEL_CONFIG["inference"]["normalize"]
OUTPUT_FILE = PROJECT_ROOT / MODEL_CONFIG["output"]["embeddingsFile"]

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
    Settings are read from model-config.json to match browser preprocessing.

    Preprocessing steps:
    1. Crop to square (using configured crop method: top, center, or none)
    2. Resize to model input size (256x256)
    3. Normalize with ImageNet mean/std
    """
    img = Image.open(image_path).convert("RGB")
    width, height = img.size

    # Step 1: Crop to square based on configured method
    if CROP_METHOD == "top":
        # Top-crop: take square from top of image (captures card artwork)
        square_size = min(width, height)
        left = (width - square_size) // 2  # Center horizontally
        top = 0  # Start from top
        img = img.crop((left, top, left + square_size, top + square_size))
    elif CROP_METHOD == "center":
        # Center-crop: take square from center of image
        square_size = min(width, height)
        left = (width - square_size) // 2
        top = (height - square_size) // 2
        img = img.crop((left, top, left + square_size, top + square_size))
    # else: no crop, will stretch to square

    # Step 2: Resize to model input size (256x256)
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BILINEAR)

    # Step 3: Convert to numpy and normalize to [0, 1]
    img_array = np.array(img, dtype=np.float32) / 255.0

    # Step 4: Normalize with ImageNet mean/std (from config)
    img_array = (img_array - IMAGE_MEAN) / IMAGE_STD

    # Convert to NCHW format (batch, channels, height, width)
    img_array = img_array.transpose(2, 0, 1)
    img_array = np.expand_dims(img_array, axis=0)

    return img_array


def apply_pooling(outputs: np.ndarray, pooling: str) -> np.ndarray:
    """
    Apply pooling to model outputs to match transformers.js behavior.

    transformers.js with pooling='mean' performs mean pooling across the
    sequence dimension (axis=1) when output shape is (batch, seq_len, dim).

    Args:
        outputs: Raw model output, shape (batch, dim) or (batch, seq_len, dim)
        pooling: Pooling strategy ('mean' or 'none')

    Returns:
        Pooled output with shape (batch, dim)
    """
    if pooling == "mean" and len(outputs.shape) == 3:
        # Shape is (batch, seq_len, dim) - apply mean pooling across sequence
        outputs = outputs.mean(axis=1)
        print(f"  Applied mean pooling: {outputs.shape}")
    elif len(outputs.shape) == 3:
        # No pooling requested but have 3D output - just take first token (CLS)
        outputs = outputs[:, 0, :]
        print(f"  Took CLS token: {outputs.shape}")
    # If shape is already (batch, dim), no pooling needed

    return outputs


def apply_normalization(outputs: np.ndarray, normalize: bool) -> np.ndarray:
    """
    Apply L2 normalization to embeddings.

    Args:
        outputs: Embeddings with shape (batch, dim)
        normalize: Whether to apply L2 normalization

    Returns:
        Normalized embeddings
    """
    if normalize:
        norms = np.linalg.norm(outputs, axis=1, keepdims=True)
        # Avoid division by zero
        norms = np.maximum(norms, 1e-12)
        outputs = outputs / norms

    return outputs


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
    print(f"Model: {MODEL_REPO} ({MODEL_CONFIG['dtype']})")
    print(f"Image size: {IMAGE_SIZE}x{IMAGE_SIZE}")
    print(f"Crop method: {CROP_METHOD}")
    print(f"Pooling: {POOLING}")
    print(f"Normalize: {NORMALIZE}")
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

        # Try to create session with preferred providers, fall back to CPU if needed
        providers_to_use = EXECUTION_PROVIDERS
        try:
            session = ort.InferenceSession(
                model_path,
                sess_options=sess_options,
                providers=providers_to_use
            )
        except Exception as e:
            if 'CUDA' in str(e) or 'cuda' in str(e):
                print(f"\n*************** EP Error ***************")
                print(f"CUDA initialization failed: {e}")
                print(f"\nFalling back to ['CPUExecutionProvider'] and retrying.\n")
                providers_to_use = ['CPUExecutionProvider']
                session = ort.InferenceSession(
                    model_path,
                    sess_options=sess_options,
                    providers=providers_to_use
                )
            else:
                raise

        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        print(f"Model loaded. Input: {input_name}, Output: {output_name}\n")

        # Process images
        batch_size = args.batch_size
        failed = 0
        checkpoint_counter = 0
        shape_logged = False

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

                # Log output shape once for debugging
                if not shape_logged:
                    print(f"\nRaw model output shape: {outputs.shape}")
                    shape_logged = True

                # Apply pooling to match transformers.js behavior
                # This is the KEY FIX: transformers.js does mean pooling before normalization
                outputs = apply_pooling(outputs, POOLING)

                # Apply L2 normalization (after pooling, matching transformers.js)
                outputs = apply_normalization(outputs, NORMALIZE)

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
