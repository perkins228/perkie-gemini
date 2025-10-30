"""
Test to verify the parameter order fix for upload_processed_image
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from storage import CloudStorageManager
from memory_efficient_integrated_processor import MemoryEfficientIntegratedProcessor


class TestParameterFix:
    """Test suite to verify parameter ordering is correct"""
    
    @pytest.mark.asyncio
    async def test_upload_processed_image_parameter_validation(self):
        """Test that upload_processed_image validates parameter types"""
        storage = CloudStorageManager(enabled=True)
        
        # Test with swapped parameters (bytes as cache_key)
        with pytest.raises(TypeError) as exc_info:
            await storage.upload_processed_image(
                b"image_data_bytes",  # Wrong: bytes as cache_key
                "proper_cache_key"    # Wrong: string as image_data
            )
        assert "cache_key must be a string" in str(exc_info.value)
        
        # Test with correct parameters
        with patch.object(storage, 'bucket') as mock_bucket:
            mock_blob = Mock()
            mock_bucket.blob.return_value = mock_blob
            mock_blob.upload_from_string = Mock()
            
            # This should work without errors
            result = await storage.upload_processed_image(
                "proper_cache_key",   # Correct: string as cache_key
                b"image_data_bytes"   # Correct: bytes as image_data
            )
            # Should return True on success
            assert result is True
    
    @pytest.mark.asyncio
    async def test_memory_efficient_processor_calls_correctly(self):
        """Test that memory efficient processor calls upload with correct parameter order"""
        # Mock dependencies
        mock_model = Mock()
        mock_storage = AsyncMock()
        mock_effects = Mock()
        
        # Create processor
        processor = MemoryEfficientIntegratedProcessor(
            mock_model, mock_storage, mock_effects
        )
        processor.enable_streaming = True
        
        # Mock the upload method to capture how it's called
        upload_calls = []
        async def capture_upload_call(*args, **kwargs):
            upload_calls.append((args, kwargs))
            return "https://example.com/uploaded.png"
        
        mock_storage.upload_processed_image = capture_upload_call
        
        # Mock effects processing
        mock_effects.apply_effect = Mock(return_value=Mock(
            save=Mock(side_effect=lambda buffer, **kwargs: buffer.write(b"fake_image_data"))
        ))
        
        # Process an effect
        effect_result = await processor._process_single_effect(
            Mock(),  # bg_removed_cv
            "test_effect",
            {},
            "test_session"
        )
        
        # Verify upload was called with correct parameter order
        assert len(upload_calls) == 1
        args, kwargs = upload_calls[0]
        
        # First parameter should be string (cache key)
        assert isinstance(args[0], str)
        assert args[0].startswith("effects/test_session/test_effect_")
        
        # Second parameter should be bytes (image data)
        assert isinstance(args[1], bytes)
        assert args[1] == b"fake_image_data"
    
    @pytest.mark.asyncio
    async def test_cache_result_parameter_validation(self):
        """Test that cache_result validates parameter types"""
        storage = CloudStorageManager(enabled=True)
        
        # Test with wrong types
        with pytest.raises(TypeError) as exc_info:
            await storage.cache_result(
                b"binary_data",  # Wrong: bytes as cache_key
                "string_data"    # Wrong: string as image_data
            )
        assert "cache_key must be" in str(exc_info.value)
    
    def test_blob_name_generation_validation(self):
        """Test that _get_blob_name validates cache key"""
        storage = CloudStorageManager(enabled=True)
        
        # Test with non-string
        with pytest.raises(TypeError) as exc_info:
            storage._get_blob_name(b"binary_data")
        assert "cache_key must be a string" in str(exc_info.value)
        
        # Test with too short string
        with pytest.raises(ValueError) as exc_info:
            storage._get_blob_name("a")
        assert "cache_key too short" in str(exc_info.value)
        
        # Test with valid cache key
        blob_name = storage._get_blob_name("abc123def456")
        assert blob_name == "inspirenet-cache/ab/abc123def456.png"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])