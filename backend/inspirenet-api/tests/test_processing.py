#!/usr/bin/env python3
"""
Test script for InSPyReNet image processing functionality
"""

import os
import sys
import time
import tempfile
from PIL import Image
import numpy as np

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from inspirenet_model import InSPyReNetProcessor

def create_test_image(size=(512, 512), color='red'):
    """Create a test image for processing"""
    image = Image.new('RGB', size, color)
    return image

def test_processor_initialization():
    """Test processor initialization"""
    print("Testing processor initialization...")
    
    try:
        processor = InSPyReNetProcessor(target_size=512)
        print("✓ Processor initialized successfully")
        return processor
    except Exception as e:
        print(f"✗ Processor initialization failed: {e}")
        return None

def test_image_preprocessing(processor):
    """Test image preprocessing"""
    print("Testing image preprocessing...")
    
    try:
        test_image = create_test_image()
        processed_tensor, processed_size = processor.preprocess_image(test_image)
        
        print(f"✓ Image preprocessed successfully")
        print(f"  Original size: {test_image.size}")
        print(f"  Processed tensor shape: {processed_tensor.shape}")
        print(f"  Processed size: {processed_size}")
        
        return True
    except Exception as e:
        print(f"✗ Image preprocessing failed: {e}")
        return False

def test_postprocessing(processor):
    """Test mask postprocessing"""
    print("Testing mask postprocessing...")
    
    try:
        # Create a dummy mask tensor
        import torch
        mask_tensor = torch.randn(1, 1, 512, 512)
        
        original_size = (256, 256)
        processed_size = (256, 256)
        
        mask_image = processor.postprocess_mask(mask_tensor, original_size, processed_size)
        
        print(f"✓ Mask postprocessing successful")
        print(f"  Mask image size: {mask_image.size}")
        print(f"  Mask image mode: {mask_image.mode}")
        
        return True
    except Exception as e:
        print(f"✗ Mask postprocessing failed: {e}")
        return False

def test_model_info(processor):
    """Test model info retrieval"""
    print("Testing model info retrieval...")
    
    try:
        info = processor.get_model_info()
        print(f"✓ Model info retrieved successfully")
        print(f"  Status: {info.get('status', 'unknown')}")
        print(f"  Device: {info.get('device', 'unknown')}")
        
        return True
    except Exception as e:
        print(f"✗ Model info retrieval failed: {e}")
        return False

def test_full_pipeline(processor):
    """Test full background removal pipeline"""
    print("Testing full background removal pipeline...")
    
    try:
        # Create test image
        test_image = create_test_image(size=(224, 224))
        
        # Process image (this will work even without trained weights)
        start_time = time.time()
        result_image = processor.remove_background(test_image)
        processing_time = time.time() - start_time
        
        print(f"✓ Full pipeline completed successfully")
        print(f"  Processing time: {processing_time:.2f} seconds")
        print(f"  Result image size: {result_image.size}")
        print(f"  Result image mode: {result_image.mode}")
        
        # Save test result
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            result_image.save(f.name)
            print(f"  Test result saved to: {f.name}")
        
        return True
    except Exception as e:
        print(f"✗ Full pipeline failed: {e}")
        return False

def run_performance_test(processor, num_images=5):
    """Run performance test with multiple images"""
    print(f"Running performance test with {num_images} images...")
    
    times = []
    
    for i in range(num_images):
        test_image = create_test_image(size=(224, 224))
        
        start_time = time.time()
        try:
            result_image = processor.remove_background(test_image)
            processing_time = time.time() - start_time
            times.append(processing_time)
            print(f"  Image {i+1}: {processing_time:.2f}s")
        except Exception as e:
            print(f"  Image {i+1}: Failed - {e}")
    
    if times:
        avg_time = sum(times) / len(times)
        print(f"✓ Performance test completed")
        print(f"  Average processing time: {avg_time:.2f}s")
        print(f"  Min time: {min(times):.2f}s")
        print(f"  Max time: {max(times):.2f}s")
    else:
        print("✗ Performance test failed - no successful processes")

def main():
    """Main test function"""
    print("=" * 60)
    print("InSPyReNet Background Removal - Test Suite")
    print("=" * 60)
    
    # Initialize processor
    processor = test_processor_initialization()
    if not processor:
        print("Exiting due to initialization failure")
        return
    
    print()
    
    # Run tests
    tests = [
        ("Image Preprocessing", lambda: test_image_preprocessing(processor)),
        ("Mask Postprocessing", lambda: test_postprocessing(processor)),
        ("Model Info", lambda: test_model_info(processor)),
        ("Full Pipeline", lambda: test_full_pipeline(processor)),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'-' * 40}")
        print(f"Running: {test_name}")
        print(f"{'-' * 40}")
        
        if test_func():
            passed += 1
    
    print(f"\n{'=' * 60}")
    print(f"TEST SUMMARY")
    print(f"{'=' * 60}")
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed!")
        
        # Run performance test
        print(f"\n{'-' * 40}")
        run_performance_test(processor)
        
    else:
        print("❌ Some tests failed")
    
    print("=" * 60)

if __name__ == "__main__":
    main() 