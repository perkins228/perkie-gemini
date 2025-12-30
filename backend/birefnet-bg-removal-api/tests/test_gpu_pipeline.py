#!/usr/bin/env python3
"""
Quick test to verify GPU pipeline imports and CPU fallback
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_imports():
    """Test that all GPU modules import correctly"""
    print("=" * 60)
    print("Test 1: GPU Pipeline Imports")
    print("=" * 60)

    try:
        from effects import (
            EnhancedBlackWhitePipelineGPU,
            apply_enhanced_blackwhite_gpu,
            get_gpu_processor,
            apply_blackwhite_effect
        )
        print("[OK] All GPU imports successful")
        print(f"  - EnhancedBlackWhitePipelineGPU: {EnhancedBlackWhitePipelineGPU}")
        print(f"  - apply_enhanced_blackwhite_gpu: {apply_enhanced_blackwhite_gpu}")
        print(f"  - get_gpu_processor: {get_gpu_processor}")
        print(f"  - apply_blackwhite_effect: {apply_blackwhite_effect}")
        return True
    except Exception as e:
        print(f"[FAIL] Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_gpu_availability():
    """Test GPU availability detection"""
    print("\n" + "=" * 60)
    print("Test 2: GPU Availability Detection")
    print("=" * 60)

    try:
        from effects.enhanced_blackwhite_gpu import CUPY_AVAILABLE
        print(f"CuPy available: {CUPY_AVAILABLE}")

        if CUPY_AVAILABLE:
            import cupy as cp
            print(f"[OK] CuPy installed: {cp.__version__}")
            print(f"  CUDA available: {cp.cuda.is_available()}")
            if cp.cuda.is_available():
                print(f"  CUDA devices: {cp.cuda.runtime.getDeviceCount()}")
        else:
            print("[WARN] CuPy not available - CPU fallback will be used")

        return True
    except Exception as e:
        print(f"[FAIL] GPU check failed: {e}")
        return False


def test_processor_initialization():
    """Test GPU processor initialization"""
    print("\n" + "=" * 60)
    print("Test 3: Processor Initialization")
    print("=" * 60)

    try:
        from effects import get_gpu_processor

        processor = get_gpu_processor()
        print(f"[OK] GPU processor created: {processor}")
        print(f"  GPU enabled: {processor.gpu_available}")
        print(f"  Parameters: {processor.params}")

        return True
    except Exception as e:
        print(f"[FAIL] Processor initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_simple_processing():
    """Test simple image processing with CPU fallback"""
    print("\n" + "=" * 60)
    print("Test 4: Simple Image Processing")
    print("=" * 60)

    try:
        from PIL import Image
        import numpy as np
        from effects import get_gpu_processor

        # Create a simple test image (100x100 RGB)
        print("Creating test image (100x100)...")
        img_array = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        img = Image.fromarray(img_array)

        # Process with GPU pipeline (will use CPU fallback if no GPU)
        print("Processing with GPU pipeline...")
        processor = get_gpu_processor()
        result = processor.process_pil(img)

        print(f"[OK] Processing successful")
        print(f"  Input: {img.size} {img.mode}")
        print(f"  Output: {result.size} {result.mode}")

        return True
    except Exception as e:
        print(f"[FAIL] Processing failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_cleanup_import():
    """Test ESRGAN cleanup module import"""
    print("\n" + "=" * 60)
    print("Test 5: ESRGAN Cleanup Import")
    print("=" * 60)

    try:
        from cleanup import get_cleanup, CleanupProcessor
        print("[OK] ESRGAN cleanup imports successful")
        print(f"  - CleanupProcessor: {CleanupProcessor}")
        print(f"  - get_cleanup: {get_cleanup}")

        # Try to get processor (will initialize)
        print("\nInitializing cleanup processor...")
        cleanup = get_cleanup()
        print(f"[OK] Cleanup processor initialized")
        print(f"  Device: {cleanup.device}")
        print(f"  Model: {cleanup.model_name}")

        return True
    except Exception as e:
        print(f"[FAIL] Cleanup import/init failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("GPU Pipeline Verification Tests")
    print("=" * 60)

    results = []

    results.append(("Imports", test_imports()))
    results.append(("GPU Availability", test_gpu_availability()))
    results.append(("Processor Init", test_processor_initialization()))
    results.append(("Image Processing", test_simple_processing()))
    results.append(("ESRGAN Cleanup", test_cleanup_import()))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    all_passed = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print("=" * 60)
    if all_passed:
        print("[OK] ALL TESTS PASSED")
        print("\nGPU pipeline is ready for deployment!")
        print("Note: If CuPy is not available, CPU fallback will be used automatically.")
    else:
        print("[FAIL] SOME TESTS FAILED")
        print("\nPlease fix the issues before deploying.")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
