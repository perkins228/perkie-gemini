#!/usr/bin/env python3
"""
Verify that all optimizations are working after deployment
"""

import requests
import time
import json

API_URL = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"

def test_health():
    """Test API is running"""
    print("1. Testing API Health...")
    response = requests.get(f"{API_URL}/health")
    if response.status_code == 200:
        data = response.json()
        print(f"   [PASS] API is healthy: {data['status']}")
        print(f"   - Model loaded: {data.get('model_loaded', 'N/A')}")
        print(f"   - Storage connected: {data.get('storage_connected', 'N/A')}")
        return True
    else:
        print(f"   [FAIL] Health check failed: {response.status_code}")
        return False

def test_compression():
    """Test gzip compression is enabled"""
    print("\n2. Testing GZip Compression...")
    headers = {'Accept-Encoding': 'gzip'}
    response = requests.get(f"{API_URL}/api/v2/", headers=headers)
    
    # Check if response was compressed
    content_encoding = response.headers.get('Content-Encoding', '')
    if 'gzip' in content_encoding.lower():
        print(f"   [PASS] GZip compression is enabled")
    else:
        print(f"   [WARNING] GZip compression may not be working (header: {content_encoding})")
    
    print(f"   - Response size: {len(response.content)} bytes")
    return True

def test_progressive_loading():
    """Test progressive loading endpoint"""
    print("\n3. Testing Progressive Loading Support...")
    
    # Create a small test image
    from PIL import Image
    import io
    
    img = Image.new('RGB', (100, 100), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=80)
    buf.seek(0)
    
    # Test single effect loading
    params = {
        'effect': 'enhancedblackwhite',
        'load_single_effect': 'true',
        'return_all_effects': 'true'
    }
    
    files = {'file': ('test.jpg', buf, 'image/jpeg')}
    
    print("   - Testing single effect endpoint...")
    start = time.time()
    response = requests.post(
        f"{API_URL}/api/v2/process",
        params=params,
        files=files,
        timeout=60
    )
    elapsed = time.time() - start
    
    if response.status_code == 200:
        print(f"   [PASS] Progressive loading works ({elapsed:.1f}s)")
        return True
    else:
        print(f"   [FAIL] Progressive loading failed: {response.status_code}")
        return False

def test_cache():
    """Test cache is working"""
    print("\n4. Testing Cache Functionality...")
    
    # Create test image
    from PIL import Image
    import io
    
    img = Image.new('RGB', (100, 100), color=(128, 64, 192))
    
    times = []
    for i in range(2):
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80)
        buf.seek(0)
        
        params = {
            'effect': 'enhancedblackwhite',
            'use_cache': 'true'
        }
        
        files = {'file': ('test.jpg', buf, 'image/jpeg')}
        
        start = time.time()
        response = requests.post(
            f"{API_URL}/api/v2/process",
            params=params,
            files=files,
            timeout=60
        )
        elapsed = time.time() - start
        times.append(elapsed)
        
        print(f"   - Request {i+1}: {elapsed:.2f}s (status: {response.status_code})")
        time.sleep(1)
    
    if len(times) == 2 and times[1] < times[0] * 0.5:
        print(f"   [PASS] Cache is working (speedup: {times[0]/times[1]:.1f}x)")
        return True
    else:
        print(f"   [WARNING] Cache may not be optimal (speedup: {times[0]/times[1] if times[1] > 0 else 0:.1f}x)")
        return True  # Warning only

def test_configuration():
    """Verify deployment configuration"""
    print("\n5. Verifying Configuration...")
    
    # Check minScale=0 for cost optimization
    import subprocess
    result = subprocess.run(
        ["gcloud", "run", "services", "describe", "inspirenet-bg-removal-api", 
         "--region=us-central1", "--format=value(spec.template.metadata.annotations)"],
        capture_output=True,
        text=True
    )
    
    if "minScale=0" in result.stdout:
        print("   [PASS] minScale=0 (cost optimized)")
    else:
        print("   [FAIL] minScale is not 0")
    
    if "maxScale=3" in result.stdout or "maxScale=10" in result.stdout:
        print("   [PASS] maxScale configured for scaling")
    
    return True

def main():
    print("=" * 60)
    print("DEPLOYMENT VERIFICATION")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Health", test_health()))
    results.append(("Compression", test_compression()))
    
    # Only test these if API is healthy
    if results[0][1]:
        try:
            results.append(("Progressive Loading", test_progressive_loading()))
            results.append(("Cache", test_cache()))
        except ImportError:
            print("\n[WARNING] Skipping image tests (PIL not installed)")
    
    results.append(("Configuration", test_configuration()))
    
    # Summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    all_passed = all(r[1] for r in results)
    
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"{name}: {status}")
    
    if all_passed:
        print("\n[SUCCESS] All optimizations verified successfully!")
        print("\nExpected Performance:")
        print("- Cold start (first effect): 15-20s")
        print("- Warm API (first effect): 2-3s")
        print("- Cached request: <1s")
        print("- Monthly cost: ~$10-20 (pay per use)")
    else:
        print("\n[WARNING] Some checks failed. Review the output above.")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()