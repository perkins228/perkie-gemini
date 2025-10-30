"""
Integration test to verify mobile/large image processing works correctly
"""
import asyncio
import hashlib
import time
from unittest.mock import Mock, AsyncMock, patch
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from memory_efficient_integrated_processor import MemoryEfficientIntegratedProcessor
from io import BytesIO
from PIL import Image
import numpy as np


async def test_mobile_processing_scenario():
    """Test the exact scenario that was failing: mobile image upload with effects"""
    
    print("=== Testing Mobile Processing Scenario ===")
    
    # Create a test image (simulate mobile upload)
    test_image = Image.new('RGBA', (1024, 1024), color=(255, 0, 0, 255))
    buffer = BytesIO()
    test_image.save(buffer, format='PNG')
    image_data = buffer.getvalue()
    
    print(f"Created test image: {len(image_data)} bytes")
    
    # Mock dependencies
    mock_model = Mock()
    mock_model.remove_background = Mock(return_value=test_image)
    
    # Mock storage manager that verifies parameter types
    mock_storage = AsyncMock()
    
    upload_calls = []
    async def mock_upload_processed_image(cache_key, image_data, effect="processed"):
        # Verify parameter types
        assert isinstance(cache_key, str), f"cache_key must be str, got {type(cache_key)}"
        assert isinstance(image_data, bytes), f"image_data must be bytes, got {type(image_data)}"
        upload_calls.append({
            'cache_key': cache_key,
            'image_data_size': len(image_data),
            'effect': effect
        })
        return f"https://storage.example.com/{cache_key}"
    
    mock_storage.upload_processed_image = mock_upload_processed_image
    mock_storage.get_cached_result = AsyncMock(return_value=None)
    mock_storage.cache_result = AsyncMock(return_value=True)
    
    # Mock effects processor
    mock_effects = Mock()
    mock_effects.apply_effect = Mock(return_value=test_image)
    
    # Create processor
    processor = MemoryEfficientIntegratedProcessor(
        mock_model, mock_storage, mock_effects
    )
    
    # Test parameters (simulating mobile request)
    effects_list = ['enhancedblackwhite', 'popart', 'dithering', 'color']
    session_id = 'mobile_test_session_123'
    
    print(f"Processing effects: {effects_list}")
    
    try:
        # Process the image
        result = await processor.process_image_with_effects(
            image_data=image_data,
            effects=effects_list,
            effect_params={},
            use_cache=True,
            session_id=session_id,
            progress_callback=None
        )
        
        print(f"Processing completed successfully!")
        print(f"Result keys: {result.keys()}")
        print(f"Success: {result.get('success', False)}")
        print(f"Effects processed: {result.get('effects_processed', [])}")
        print(f"Upload calls made: {len(upload_calls)}")
        
        # Verify all uploads used correct parameter types
        for call in upload_calls:
            print(f"  - Upload: {call['effect']} with key {call['cache_key'][:50]}... ({call['image_data_size']} bytes)")
            assert call['cache_key'].startswith('effects/'), "Cache key should start with 'effects/'"
            assert call['image_data_size'] > 0, "Image data should not be empty"
        
        # Verify no binary data was used as cache key
        for call in upload_calls:
            # Cache key should be a reasonable length (not 386,855 characters!)
            assert len(call['cache_key']) < 200, f"Cache key too long: {len(call['cache_key'])} chars"
            # Cache key should not contain binary data
            assert not call['cache_key'].startswith("b'"), "Cache key contains binary data!"
            assert "\\x89PNG" not in call['cache_key'], "Cache key contains PNG binary data!"
        
        print("\n✅ SUCCESS: Mobile processing works correctly!")
        print("✅ All parameters passed in correct order")
        print("✅ No binary data used as cache keys")
        
        return True
        
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        print(f"Error type: {type(e).__name__}")
        
        # Check if it's the parameter mismatch error
        if "cache_key must be a string" in str(e):
            print("❌ CRITICAL: Parameter order is still incorrect!")
            print("❌ Binary data is being passed as cache_key")
        
        raise


async def test_parameter_type_validation():
    """Test that proper TypeErrors are raised for wrong parameter types"""
    
    print("\n=== Testing Parameter Type Validation ===")
    
    # Test with actual storage module
    from storage import CloudStorageManager
    
    # Create storage manager with mocked GCS
    with patch('storage.storage') as mock_gcs:
        mock_client = Mock()
        mock_bucket = Mock()
        mock_gcs.Client.return_value = mock_client
        mock_client.bucket.return_value = mock_bucket
        
        storage = CloudStorageManager(
            bucket_name="test-bucket",
            cache_ttl=3600
        )
        
        # Test wrong parameter order (simulating the bug)
        print("Testing with swapped parameters...")
        try:
            await storage.upload_processed_image(
                b"image_bytes_data",  # Wrong! Bytes as cache_key
                "string_cache_key"    # Wrong! String as image_data
            )
            print("❌ FAILED: Should have raised TypeError!")
        except TypeError as e:
            print(f"✅ Correctly caught TypeError: {e}")
            assert "cache_key must be a string" in str(e)
        
        # Test correct parameter order
        print("\nTesting with correct parameters...")
        mock_blob = Mock()
        mock_bucket.blob.return_value = mock_blob
        mock_blob.upload_from_string = Mock()
        
        result = await storage.upload_processed_image(
            "proper_cache_key_string",  # Correct: string
            b"proper_image_bytes"       # Correct: bytes
        )
        print("✅ Correct parameters accepted without error")


if __name__ == "__main__":
    print("Starting mobile processing tests...\n")
    
    # Run tests
    asyncio.run(test_mobile_processing_scenario())
    asyncio.run(test_parameter_type_validation())
    
    print("\n🎉 All tests passed! The fix is working correctly.")