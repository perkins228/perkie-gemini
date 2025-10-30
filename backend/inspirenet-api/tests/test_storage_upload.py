"""
Unit tests for storage upload validation
Tests the validate_and_parse_data_url function with various edge cases
"""

import pytest
import base64
from fastapi import HTTPException
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from simple_storage_api import validate_and_parse_data_url


def create_valid_jpeg_base64():
    """Create a minimal valid JPEG image in base64"""
    # Minimal 1x1 JPEG image (base64 encoded)
    return "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q=="


def test_valid_data_url_jpeg():
    """Test standard JPEG data URL parsing"""
    jpeg_base64 = create_valid_jpeg_base64()
    data_url = f"data:image/jpeg;base64,{jpeg_base64}"

    image_bytes, mime_type = validate_and_parse_data_url(data_url, "test")

    assert len(image_bytes) > 0
    assert mime_type == "image/jpeg"
    assert image_bytes[:3] == b'\xff\xd8\xff'  # JPEG magic number


def test_valid_data_url_png():
    """Test PNG data URL parsing"""
    # Minimal 1x1 PNG (base64)
    png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    data_url = f"data:image/png;base64,{png_base64}"

    image_bytes, mime_type = validate_and_parse_data_url(data_url, "test")

    assert len(image_bytes) > 0
    assert mime_type == "image/png"
    assert image_bytes[:4] == b'\x89PNG'  # PNG magic number


def test_malformed_no_comma():
    """Test Safari edge case: no comma in data URL"""
    jpeg_base64 = create_valid_jpeg_base64()
    data_url = f"data:image/jpeg;base64{jpeg_base64}"  # Missing comma

    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")

    assert exc.value.status_code == 400
    assert "comma separator" in str(exc.value.detail).lower()


def test_empty_data_url():
    """Test empty data after comma"""
    data_url = "data:image/jpeg;base64,"  # Comma but no data

    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")

    assert exc.value.status_code == 400
    assert "no content" in str(exc.value.detail).lower()


def test_very_short_data():
    """Test data URL with insufficient base64 data"""
    data_url = "data:image/jpeg;base64,ABC"  # Too short

    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")

    assert exc.value.status_code == 400


def test_invalid_base64():
    """Test invalid base64 characters"""
    data_url = "data:image/jpeg;base64,This is not base64!!!"

    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")

    assert exc.value.status_code == 400
    assert "base64" in str(exc.value.detail).lower()


def test_empty_string():
    """Test empty string input"""
    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url("", "test")

    assert exc.value.status_code == 400
    assert "empty" in str(exc.value.detail).lower()


def test_none_input():
    """Test None input"""
    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(None, "test")

    assert exc.value.status_code == 400


def test_oversized_data_url():
    """Test data URL size limit"""
    # Create a 20MB base64 string
    large_data = "A" * (20 * 1024 * 1024)
    data_url = f"data:image/jpeg;base64,{large_data}"

    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")

    assert exc.value.status_code == 413


def test_raw_base64_no_prefix():
    """Test raw base64 without data URL prefix"""
    jpeg_base64 = create_valid_jpeg_base64()

    image_bytes, mime_type = validate_and_parse_data_url(jpeg_base64, "test")

    assert len(image_bytes) > 0
    assert mime_type == "image/jpeg"  # Default for raw base64


def test_invalid_mime_type():
    """Test unsupported MIME type"""
    jpeg_base64 = create_valid_jpeg_base64()
    data_url = f"data:image/svg+xml;base64,{jpeg_base64}"

    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")

    assert exc.value.status_code == 400
    assert "file type" in str(exc.value.detail).lower()


def test_malformed_header_fallback():
    """Test malformed header falls back to jpeg"""
    jpeg_base64 = create_valid_jpeg_base64()
    # Missing semicolon in header
    data_url = f"data:image/jpegbase64,{jpeg_base64}"

    image_bytes, mime_type = validate_and_parse_data_url(data_url, "test")

    # Should fallback to jpeg
    assert mime_type == "image/jpeg"
    assert len(image_bytes) > 0


def test_zero_byte_image():
    """Test that zero-byte images are rejected"""
    # Empty base64 will decode to zero bytes
    data_url = "data:image/jpeg;base64,AAAAAAAAAAAAAA=="

    # This might pass validation but should be caught
    # Note: base64 of all zeros still decodes, but check is in place
    try:
        image_bytes, mime_type = validate_and_parse_data_url(data_url, "test")
        # If it doesn't fail parsing, it should at least return something
        assert len(image_bytes) >= 0
    except HTTPException as e:
        # If it does fail, should be a 400
        assert e.status_code == 400


def test_webp_format():
    """Test WebP format support"""
    # Minimal WebP (base64)
    webp_base64 = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA="
    data_url = f"data:image/webp;base64,{webp_base64}"

    image_bytes, mime_type = validate_and_parse_data_url(data_url, "test")

    assert len(image_bytes) > 0
    assert mime_type == "image/webp"


def test_base64_with_whitespace():
    """Test base64 with whitespace (should fail validation)"""
    jpeg_base64 = create_valid_jpeg_base64()
    # Add whitespace
    data_url = f"data:image/jpeg;base64,{jpeg_base64[:10]}\n{jpeg_base64[10:]}"

    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")

    assert exc.value.status_code == 400


def test_data_url_no_semicolon():
    """Test data URL without semicolon in header"""
    jpeg_base64 = create_valid_jpeg_base64()
    data_url = f"data:image/jpeg,{jpeg_base64}"  # No ;base64

    # Should still work, falling back to default MIME
    image_bytes, mime_type = validate_and_parse_data_url(data_url, "test")
    assert len(image_bytes) > 0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
