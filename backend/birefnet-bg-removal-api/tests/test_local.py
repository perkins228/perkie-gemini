#!/usr/bin/env python3
"""
Local test script for BiRefNet Background Removal API

Usage:
    pip install rembg[gpu] Pillow requests
    python test_local.py

Or test with a specific image:
    python test_local.py --image /path/to/pet-photo.jpg
"""

import os
import sys
import time
import argparse
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_processor_initialization():
    """Test BiRefNet processor initialization"""
    print("\n" + "="*50)
    print("Test 1: Processor Initialization")
    print("="*50)

    try:
        from birefnet_processor import BiRefNetProcessor

        processor = BiRefNetProcessor(model_variant="birefnet-general")
        print(f"  Processor created successfully")
        print(f"  Model variant: {processor.model_variant}")
        print(f"  Max dimension: {processor.max_dimension}")

        return processor
    except Exception as e:
        print(f"  FAILED: {e}")
        return None


def test_model_loading(processor):
    """Test model loading"""
    print("\n" + "="*50)
    print("Test 2: Model Loading")
    print("="*50)

    try:
        start = time.time()
        processor.load_model()
        load_time = time.time() - start

        print(f"  Model loaded successfully in {load_time:.2f}s")
        print(f"  Model ready: {processor.is_model_ready()}")

        return True
    except Exception as e:
        print(f"  FAILED: {e}")
        return False


def test_warmup(processor):
    """Test warmup functionality"""
    print("\n" + "="*50)
    print("Test 3: Warmup")
    print("="*50)

    try:
        result = processor.warmup()
        print(f"  Status: {result['status']}")
        print(f"  Total time: {result['total_time']:.2f}s")
        print(f"  Model ready: {result.get('model_ready', False)}")

        return result['status'] == 'success'
    except Exception as e:
        print(f"  FAILED: {e}")
        return False


def test_background_removal(processor, image_path=None):
    """Test background removal"""
    print("\n" + "="*50)
    print("Test 4: Background Removal")
    print("="*50)

    from PIL import Image

    try:
        if image_path and Path(image_path).exists():
            print(f"  Loading image: {image_path}")
            image = Image.open(image_path).convert('RGB')
        else:
            print("  Creating synthetic test image (256x256)")
            # Create a simple test pattern
            import numpy as np
            arr = np.zeros((256, 256, 3), dtype=np.uint8)
            arr[64:192, 64:192] = [255, 128, 0]  # Orange square
            image = Image.fromarray(arr)

        print(f"  Input size: {image.size}")

        start = time.time()
        result = processor.remove_background(image)
        process_time = time.time() - start

        print(f"  Processing completed in {process_time:.2f}s")
        print(f"  Inference time: {result.inference_time_ms:.0f}ms")
        print(f"  Output size: {result.output_size}")
        print(f"  Output mode: {result.image.mode}")

        # Save result
        output_path = Path(__file__).parent / "test_output.png"
        result.image.save(output_path)
        print(f"  Saved result to: {output_path}")

        return True
    except Exception as e:
        print(f"  FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_model_info(processor):
    """Test model info endpoint"""
    print("\n" + "="*50)
    print("Test 5: Model Info")
    print("="*50)

    try:
        info = processor.get_model_info()
        for key, value in info.items():
            print(f"  {key}: {value}")
        return True
    except Exception as e:
        print(f"  FAILED: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Test BiRefNet processor locally')
    parser.add_argument('--image', type=str, help='Path to test image')
    parser.add_argument('--variant', type=str, default='birefnet-general',
                       help='Model variant to test')
    args = parser.parse_args()

    print("="*50)
    print("BiRefNet Background Removal - Local Tests")
    print("="*50)

    # Run tests
    results = []

    processor = test_processor_initialization()
    results.append(("Initialization", processor is not None))

    if processor:
        results.append(("Model Loading", test_model_loading(processor)))
        results.append(("Warmup", test_warmup(processor)))
        results.append(("Background Removal", test_background_removal(processor, args.image)))
        results.append(("Model Info", test_model_info(processor)))

    # Summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)

    all_passed = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print("="*50)
    print(f"Overall: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
