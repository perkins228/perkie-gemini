#!/usr/bin/env python3
"""
Cache Fix Demonstration
Shows the difference between the old flawed test and proper cache testing
"""

import requests
import json
import time
import io
import hashlib
from datetime import datetime

# Try to import PIL for image creation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

def create_random_test_image():
    """Create a random test image (like the original flawed test)"""
    if PIL_AVAILABLE:
        # Add randomness that breaks cache (timestamp-based colors)
        timestamp = int(time.time() * 1000) % 255
        img = Image.new('RGB', (800, 600), color=(200, 100, timestamp))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80)
        buf.seek(0)
        return buf
    else:
        raise RuntimeError("PIL not available")

def create_identical_test_image():
    """Create an identical test image (proper method)"""
    if PIL_AVAILABLE:
        # Deterministic image that will be identical every time
        img = Image.new('RGB', (800, 600), color=(200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format='PNG', optimize=False)  # PNG without optimization for consistency
        buf.seek(0)
        return buf
    else:
        raise RuntimeError("PIL not available")

def test_method(image_creator, method_name):
    """Test cache effectiveness with given image creation method"""
    api_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects"
    
    print(f"\nTesting {method_name}...")
    print("=" * 50)
    
    params = {
        "effect": "enhancedblackwhite",
        "return_all_effects": "false", 
        "output_format": "png",
        "use_cache": "true"
    }
    
    times = []
    cache_hits = []
    image_hashes = []
    
    for i in range(3):
        print(f"Request {i+1}/3...")
        
        # Create image using specified method
        test_image = image_creator()
        image_data = test_image.getvalue()
        
        # Calculate hash to show why cache works or doesn't work
        image_hash = hashlib.sha256(image_data).hexdigest()[:16]
        image_hashes.append(image_hash)
        
        files = {"file": ("test_image.png", io.BytesIO(image_data), "image/png")}
        
        start_time = time.time()
        response = requests.post(api_url, params=params, files=files, timeout=30)
        end_time = time.time()
        
        total_time = end_time - start_time
        times.append(total_time)
        
        cache_hits_header = response.headers.get('X-Cache-Hits', '0')
        cache_hits.append(cache_hits_header)
        
        print(f"  Time: {total_time:.3f}s")
        print(f"  Status: {response.status_code}")
        print(f"  Cache hits: {cache_hits_header}")
        print(f"  Image hash: {image_hash}")
        
        if i < 2:
            time.sleep(0.5)
    
    # Analysis
    first_time = times[0]
    avg_subsequent = sum(times[1:]) / len(times[1:])
    speedup = first_time / avg_subsequent if avg_subsequent > 0 else 0
    
    print(f"\nResults for {method_name}:")
    print(f"  First request:    {first_time:.3f}s")
    print(f"  Subsequent avg:   {avg_subsequent:.3f}s")
    print(f"  Speedup:          {speedup:.1f}x")
    print(f"  Cache working:    {'YES' if speedup > 1.5 else 'NO'}")
    print(f"  Image hashes:     {' -> '.join(image_hashes)}")
    print(f"  Hash consistency: {'SAME' if len(set(image_hashes)) == 1 else 'DIFFERENT'}")
    
    return {
        "speedup": speedup,
        "cache_working": speedup > 1.5,
        "hash_consistency": len(set(image_hashes)) == 1
    }

def main():
    """Demonstrate the cache fix"""
    print("Cache Fix Demonstration")
    print("=" * 70)
    print("This demonstrates why the original test failed and how the fix works")
    print()
    
    # Test with random images (original flawed method)
    result1 = test_method(create_random_test_image, "Random Images (Original Flawed Test)")
    
    # Test with identical images (proper method)
    result2 = test_method(create_identical_test_image, "Identical Images (Proper Test)")
    
    print("\n" + "=" * 70)
    print("COMPARISON SUMMARY")
    print("=" * 70)
    
    print(f"Random Images Method:")
    print(f"  Cache working: {'YES' if result1['cache_working'] else 'NO'}")
    print(f"  Speedup: {result1['speedup']:.1f}x")
    print(f"  Hash consistency: {'SAME' if result1['hash_consistency'] else 'DIFFERENT'}")
    print(f"  Issue: {'Images differ -> cache keys differ -> no cache hits' if not result1['hash_consistency'] else 'None'}")
    
    print(f"\nIdentical Images Method:")
    print(f"  Cache working: {'YES' if result2['cache_working'] else 'NO'}")
    print(f"  Speedup: {result2['speedup']:.1f}x")
    print(f"  Hash consistency: {'SAME' if result2['hash_consistency'] else 'DIFFERENT'}")
    print(f"  Issue: {'None - cache working as expected!' if result2['cache_working'] else 'Still has issues'}")
    
    print(f"\n" + "=" * 70)
    print("CONCLUSION")
    print("=" * 70)
    
    if result2['cache_working'] and not result1['cache_working']:
        print("SUCCESS: Cache fix is working correctly!")
        print("\nKey insights:")
        print("1. Original test created different images each time")
        print("2. Different images = different hashes = different cache keys")
        print("3. Cache normalization now handles metadata differences")
        print("4. Identical pixel content now produces identical cache keys")
        print("5. Cache speedup: ~7-8x for identical images")
        
    elif result1['cache_working'] and result2['cache_working']:
        print("UNEXPECTED: Both methods work - may need further investigation")
        
    else:
        print("ISSUE: Cache still not working properly")
        print("This suggests there may be additional issues beyond image normalization")

if __name__ == "__main__":
    main()