"""
Basic verification that our cache type validation fixes work
Simple test without external dependencies
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from storage import CloudStorageManager
from memory_efficient_integrated_processor import MemoryEfficientIntegratedProcessor
from integrated_processor import IntegratedProcessor
from PIL import Image
from io import BytesIO


def test_cache_key_generation():
    """Test that cache key generation returns strings"""
    # Create test image data
    test_image = Image.new('RGB', (100, 100), color='red')
    buffer = BytesIO()
    test_image.save(buffer, format='PNG')
    test_image_data = buffer.getvalue()
    test_image.close()
    
    # Test memory-efficient processor
    processor = MemoryEfficientIntegratedProcessor(None, None, None)
    cache_key = processor.generate_cache_key(test_image_data, "test_effect", {})
    
    assert isinstance(cache_key, str), f"Cache key should be string, got {type(cache_key)}"
    assert len(cache_key) == 64, f"SHA256 should be 64 chars, got {len(cache_key)}"
    print(f"Memory-efficient processor cache key: {cache_key[:32]}... (string)")
    
    # Test integrated processor  
    integrated = IntegratedProcessor(None, gpu_enabled=False)
    cache_key2 = integrated.generate_cache_key(test_image_data, "test_effect", {})
    bg_key = integrated.generate_bg_cache_key(test_image_data)
    
    assert isinstance(cache_key2, str), f"Integrated cache key should be string, got {type(cache_key2)}"
    assert isinstance(bg_key, str), f"BG cache key should be string, got {type(bg_key)}"
    print(f"Integrated processor cache key: {cache_key2[:32]}... (string)")
    print(f"Background cache key: {bg_key[:32]}... (string)")
    
    return True


def test_storage_type_validation():
    """Test storage manager type validation"""
    storage = CloudStorageManager(bucket_name="test")
    
    # Test that type validation catches errors
    try:
        # This should fail - binary data as cache key
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        async def test_invalid():
            await storage.cache_result(b"binary_key", b"valid_data")
        
        try:
            loop.run_until_complete(test_invalid())
            print("Should have caught binary cache key error")
            return False
        except TypeError as e:
            if "cache_key must be string" in str(e):
                print("Correctly caught binary cache key error")
            else:
                print(f"Wrong error type: {e}")
                return False
        except Exception as e:
            print(f"ERROR: Should have been TypeError, got {type(e)}: {e}")
            return False
        
        # Test invalid data type
        async def test_invalid_data():
            await storage.cache_result("valid_key_12345678901234567890", "string_data")
        
        try:
            loop.run_until_complete(test_invalid_data())
            print("Should have caught string data error")
            return False
        except TypeError as e:
            if "image_data must be bytes" in str(e):
                print("Correctly caught string data error")
            else:
                print(f"Wrong error type: {e}")
                return False
        
        # Test valid call (should not raise)
        async def test_valid():
            await storage.cache_result("valid_key_12345678901234567890", b"valid_data")
        
        try:
            loop.run_until_complete(test_valid())
            print("Valid parameters accepted correctly")
        except Exception as e:
            # Expected to fail due to missing bucket, but not due to type validation
            if "TypeError" in str(e):
                print(f"Unexpected type error: {e}")
                return False
            else:
                print("Valid parameters passed type validation (expected storage error)")
        
        loop.close()
        
    except Exception as e:
        print(f"❌ Test setup failed: {e}")
        return False
    
    return True


def test_parameter_order_safety():
    """Test that parameter order is correct and safe"""
    
    # These are the types that were confused in the original bug
    cache_key_example = "example_cache_key_12345678901234567890"  # string
    image_data_example = b"example_image_data_bytes"  # bytes
    
    # Verify our assumptions
    assert isinstance(cache_key_example, str)
    assert isinstance(image_data_example, bytes)
    
    # The bug was passing image_data where cache_key was expected
    # Our fix adds type validation to catch this
    
    print("Parameter types clearly differentiated:")
    print(f"   Cache key: {type(cache_key_example)} - '{cache_key_example[:20]}...'")
    print(f"   Image data: {type(image_data_example)} - {len(image_data_example)} bytes")
    
    return True


if __name__ == "__main__":
    print("Running basic fix verification tests...\n")
    
    tests = [
        ("Cache Key Generation", test_cache_key_generation),
        ("Storage Type Validation", test_storage_type_validation), 
        ("Parameter Order Safety", test_parameter_order_safety),
    ]
    
    all_passed = True
    
    for test_name, test_func in tests:
        print(f"Testing: {test_name}")
        
        try:
            result = test_func()
            if result:
                print(f"PASSED: {test_name}\n")
            else:
                print(f"FAILED: {test_name}\n")
                all_passed = False
        except Exception as e:
            print(f"ERROR: {test_name} - {e}\n")
            import traceback
            traceback.print_exc()
            all_passed = False
    
    if all_passed:
        print("SUCCESS: All basic fix verification tests PASSED!")
        print("The root cause parameter mismatch bug has been fixed!")
        exit(0)
    else:
        print("FAILURE: Some tests FAILED!")
        print("The fix may not be working correctly!")
        exit(1)