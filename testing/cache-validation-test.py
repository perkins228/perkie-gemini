#!/usr/bin/env python3
"""
Cache Validation Test
Tests cache effectiveness with identical images to validate cache key normalization
"""

import requests
import json
import time
import io
import os
from datetime import datetime

# Try to import PIL for image creation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

def create_identical_test_image():
    """Create a deterministic test image that will be identical across calls"""
    if PIL_AVAILABLE:
        # Create a simple, deterministic image with fixed patterns
        img = Image.new('RGB', (400, 300), color=(128, 64, 192))
        
        # Add some deterministic patterns for realism
        pixels = img.load()
        for x in range(0, 400, 20):
            for y in range(0, 300, 20):
                if (x + y) % 40 == 0:
                    pixels[x, y] = (255, 255, 255)
        
        # Save as PNG to ensure deterministic output
        buf = io.BytesIO()
        img.save(buf, format='PNG', optimize=False)  # Disable optimization for consistency
        buf.seek(0)
        print(f"Created deterministic test image: {len(buf.getvalue()) / 1024:.1f} KB")
        return buf
    else:
        raise RuntimeError("PIL not available - cannot create test image")

def save_test_image_to_file():
    """Save a test image to file for reuse"""
    test_image = create_identical_test_image()
    test_file = "test_cache_image.png"
    
    with open(test_file, 'wb') as f:
        f.write(test_image.getvalue())
    
    print(f"Saved test image to {test_file}")
    return test_file

def load_test_image_from_file(filename):
    """Load the same test image from file"""
    with open(filename, 'rb') as f:
        content = f.read()
    
    buf = io.BytesIO(content)
    print(f"Loaded test image from {filename}: {len(content) / 1024:.1f} KB")
    return buf

def test_cache_with_identical_images():
    """Test cache effectiveness with truly identical images"""
    api_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects"
    
    print("Testing Cache with Identical Images...")
    print("=" * 50)
    
    # Create and save a test image
    test_file = save_test_image_to_file()
    
    params = {
        "effect": "enhancedblackwhite",
        "return_all_effects": "false", 
        "output_format": "png",
        "use_cache": "true"
    }
    
    times = []
    cache_hits = []
    
    try:
        for i in range(3):
            print(f"\nRequest {i+1}/3...")
            
            # Load the SAME image file for each request
            test_image = load_test_image_from_file(test_file)
            files = {"file": ("test_cache_image.png", test_image, "image/png")}
            
            start_time = time.time()
            response = requests.post(api_url, params=params, files=files, timeout=30)
            end_time = time.time()
            
            total_time = end_time - start_time
            times.append(total_time)
            
            # Extract cache info from headers
            cache_hits_header = response.headers.get('X-Cache-Hits', '0')
            cache_hits.append(cache_hits_header)
            
            print(f"  Time: {total_time:.3f}s")
            print(f"  Status: {response.status_code}")
            print(f"  Cache hits: {cache_hits_header}")
            print(f"  Response size: {len(response.content) / 1024:.1f} KB")
            
            if i < 2:  # Don't sleep after last request
                time.sleep(0.5)  # Small delay between requests
        
        # Analyze results
        print(f"\n{'='*50}")
        print("CACHE ANALYSIS")
        print(f"{'='*50}")
        
        if len(times) >= 2:
            first_time = times[0]
            subsequent_times = times[1:]
            avg_subsequent = sum(subsequent_times) / len(subsequent_times)
            speedup = first_time / avg_subsequent if avg_subsequent > 0 else 0
            
            print(f"First request:     {first_time:.3f}s")
            print(f"Second request:    {times[1]:.3f}s")
            print(f"Third request:     {times[2]:.3f}s")
            print(f"Subsequent avg:    {avg_subsequent:.3f}s")
            print(f"Speedup factor:    {speedup:.1f}x")
            print(f"Cache effective:   {'YES' if speedup > 1.5 else 'NO'}")
            
            # Expected behavior:
            # - First request: ~0.3-0.5s (cold cache)
            # - Subsequent: ~0.05-0.1s (cache hits)
            # - Speedup: 3-10x
            
            print(f"\nCache hits progression: {' -> '.join(cache_hits)}")
            
            if speedup > 1.5:
                print("SUCCESS: Cache is working correctly!")
                improvement = ((first_time - avg_subsequent) / first_time) * 100
                print(f"   Performance improvement: {improvement:.1f}%")
            else:
                print("ERROR: Cache is not providing expected speedup")
                print("   Expected: >1.5x speedup for identical images")
                
        return {
            "times": times,
            "cache_hits": cache_hits,
            "speedup": speedup if 'speedup' in locals() else 0,
            "cache_working": speedup > 1.5 if 'speedup' in locals() else False
        }
            
    finally:
        # Clean up test file
        if os.path.exists(test_file):
            os.remove(test_file)
            print(f"\nCleaned up {test_file}")

def test_cache_key_consistency():
    """Test that identical images produce identical cache keys"""
    print("\nTesting Cache Key Consistency...")
    print("=" * 40)
    
    # Create two identical images
    img1 = create_identical_test_image()
    img2 = create_identical_test_image()
    
    # Verify they have identical bytes
    data1 = img1.getvalue()
    data2 = img2.getvalue()
    
    print(f"Image 1 size: {len(data1)} bytes")
    print(f"Image 2 size: {len(data2)} bytes")
    print(f"Images identical: {'YES' if data1 == data2 else 'NO'}")
    
    if data1 == data2:
        print("SUCCESS: Test images are truly identical")
    else:
        print("ERROR: Test images differ - cache test may be invalid")
        
    return data1 == data2

def main():
    """Main test execution"""
    print("Cache Validation Test")
    print("=" * 60)
    print("Testing cache effectiveness with identical images")
    print()
    
    # First verify our test images are identical
    if not test_cache_key_consistency():
        print("ERROR: Cannot create identical test images - stopping test")
        return
    
    # Test cache effectiveness
    result = test_cache_with_identical_images()
    
    print(f"\n{'='*60}")
    print("FINAL RESULTS")
    print(f"{'='*60}")
    
    if result and result.get("cache_working"):
        print("SUCCESS: CACHE IS WORKING CORRECTLY")
        print(f"   Speedup: {result['speedup']:.1f}x")
    else:
        print("ERROR: CACHE ISSUE DETECTED")
        if result:
            print(f"   Speedup: {result.get('speedup', 0):.1f}x (expected >1.5x)")
        print("   This indicates cache keys are still not matching for identical images")
    
    print("\nIf cache is still not working after the fix:")
    print("1. Check server logs for cache key generation")
    print("2. Verify image normalization is working")
    print("3. Check Google Cloud Storage bucket permissions")

if __name__ == "__main__":
    main()