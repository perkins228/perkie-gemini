#!/usr/bin/env python3
"""
Simple API Performance Test - No Unicode Characters

Quick test to measure current API performance without emojis that cause Windows encoding issues.
"""

import requests
import json
import time
import io
from datetime import datetime

# Try to import PIL for image creation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

def create_test_image():
    """Create a simple test image"""
    if PIL_AVAILABLE:
        img = Image.new('RGB', (800, 600), color=(200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80)
        buf.seek(0)
        print(f"Created test image: {len(buf.getvalue()) / 1024:.1f} KB")
        return buf
    else:
        raise RuntimeError("PIL not available - cannot create test image")

def test_api_health():
    """Test API health"""
    api_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"
    
    print("Testing API Health...")
    try:
        start_time = time.time()
        response = requests.get(f"{api_url}/health", timeout=30)
        end_time = time.time()
        
        print(f"Health check: {response.status_code} ({end_time - start_time:.2f}s)")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_single_effect():
    """Test single effect processing"""
    api_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects"
    
    print("\\nTesting Single Effect (enhancedblackwhite)...")
    
    test_image = create_test_image()
    
    params = {
        "effect": "enhancedblackwhite",
        "return_all_effects": "false",
        "output_format": "png",
        "use_cache": "true"
    }
    
    files = {"file": ("test_image.jpg", test_image, "image/jpeg")}
    
    try:
        start_time = time.time()
        response = requests.post(api_url, params=params, files=files, timeout=30)
        end_time = time.time()
        
        total_time = end_time - start_time
        
        # Extract server time from headers
        server_time = None
        if 'X-Processing-Time' in response.headers:
            try:
                server_time = float(response.headers['X-Processing-Time'])
            except ValueError:
                pass
        
        print(f"Total time: {total_time:.2f}s")
        if server_time:
            print(f"Server time: {server_time:.2f}s")
            print(f"Network time: {total_time - server_time:.2f}s")
        print(f"Status: {response.status_code}")
        print(f"Response size: {len(response.content) / 1024:.1f} KB")
        
        return {
            "total_time": total_time,
            "server_time": server_time,
            "success": response.status_code == 200
        }
        
    except requests.exceptions.Timeout:
        print("Request timed out after 30 seconds")
        return {"error": "timeout", "success": False}
    except Exception as e:
        print(f"Request failed: {e}")
        return {"error": str(e), "success": False}

def test_multiple_effects():
    """Test multiple effects processing"""
    api_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects"
    
    print("\\nTesting Multiple Effects (all 4)...")
    
    test_image = create_test_image()
    
    params = {
        "effects": "enhancedblackwhite,popart,dithering,color",
        "return_all_effects": "true",
        "output_format": "png",
        "use_cache": "true"
    }
    
    files = {"file": ("test_image.jpg", test_image, "image/jpeg")}
    
    try:
        start_time = time.time()
        response = requests.post(api_url, params=params, files=files, timeout=60)
        end_time = time.time()
        
        total_time = end_time - start_time
        
        # Try to parse JSON response
        server_time = None
        effects_count = 0
        
        if response.status_code == 200:
            try:
                json_data = response.json()
                
                if 'processing_time' in json_data:
                    server_time = json_data['processing_time'].get('total')
                
                if 'effects' in json_data:
                    effects_count = len(json_data['effects'])
                
            except Exception as e:
                print(f"Could not parse JSON response: {e}")
        
        print(f"Total time: {total_time:.2f}s")
        if server_time:
            print(f"Server time: {server_time:.2f}s")
            print(f"Network time: {total_time - server_time:.2f}s")
        print(f"Status: {response.status_code}")
        print(f"Effects processed: {effects_count}/4")
        print(f"Response size: {len(response.content) / 1024:.1f} KB")
        
        return {
            "total_time": total_time,
            "server_time": server_time,
            "effects_count": effects_count,
            "success": response.status_code == 200
        }
        
    except requests.exceptions.Timeout:
        print("Request timed out after 60 seconds")
        return {"error": "timeout", "success": False}
    except Exception as e:
        print(f"Request failed: {e}")
        return {"error": str(e), "success": False}

def test_cache_effectiveness():
    """Test cache effectiveness with repeated requests"""
    api_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects"
    
    print("\\nTesting Cache Effectiveness (3 identical requests)...")
    
    params = {
        "effect": "enhancedblackwhite",
        "return_all_effects": "false",
        "output_format": "png",
        "use_cache": "true"
    }
    
    times = []
    
    for i in range(3):
        print(f"Request {i+1}/3...")
        
        test_image = create_test_image()
        files = {"file": ("test_image.jpg", test_image, "image/jpeg")}
        
        try:
            start_time = time.time()
            response = requests.post(api_url, params=params, files=files, timeout=30)
            end_time = time.time()
            
            total_time = end_time - start_time
            times.append(total_time)
            
            print(f"  Time: {total_time:.2f}s")
            print(f"  Status: {response.status_code}")
            
            time.sleep(1)  # Small delay between requests
            
        except Exception as e:
            print(f"  Error: {e}")
            times.append(None)
    
    # Analyze cache effectiveness
    valid_times = [t for t in times if t is not None]
    if len(valid_times) >= 2:
        first_time = valid_times[0]
        avg_subsequent = sum(valid_times[1:]) / len(valid_times[1:])
        speedup = first_time / avg_subsequent if avg_subsequent > 0 else 0
        
        print(f"\\nCache Analysis:")
        print(f"First request: {first_time:.2f}s")
        print(f"Subsequent avg: {avg_subsequent:.2f}s")
        print(f"Speedup factor: {speedup:.1f}x")
        print(f"Cache working: {'Yes' if speedup > 1.2 else 'No'}")
        
        return {
            "first_time": first_time,
            "subsequent_avg": avg_subsequent,
            "speedup": speedup,
            "cache_working": speedup > 1.2
        }
    
    return {"error": "Insufficient valid responses"}

def main():
    """Main test execution"""
    print("Perkie Prints - Simple API Performance Test")
    print("=" * 60)
    print("Testing current API performance and cache effectiveness")
    print()
    
    # Test API health
    if not test_api_health():
        print("API is not healthy - stopping tests")
        return
    
    # Test single effect
    single_result = test_single_effect()
    
    # Test multiple effects
    multiple_result = test_multiple_effects()
    
    # Test cache effectiveness
    cache_result = test_cache_effectiveness()
    
    # Generate summary
    print("\\n" + "=" * 60)
    print("PERFORMANCE SUMMARY")
    print("=" * 60)
    
    if single_result.get("success"):
        print(f"Single effect time: {single_result['total_time']:.2f}s")
        if single_result.get("server_time"):
            print(f"  Server processing: {single_result['server_time']:.2f}s")
    
    if multiple_result.get("success"):
        print(f"All 4 effects time: {multiple_result['total_time']:.2f}s")
        if multiple_result.get("server_time"):
            print(f"  Server processing: {multiple_result['server_time']:.2f}s")
        print(f"  Effects processed: {multiple_result.get('effects_count', 0)}/4")
    
    if "speedup" in cache_result:
        print(f"Cache speedup: {cache_result['speedup']:.1f}x")
        print(f"Cache effective: {'Yes' if cache_result['cache_working'] else 'No'}")
    
    # Recommendations
    print("\\nRecommendations:")
    
    if single_result.get("success") and single_result["total_time"] > 5:
        print("- Single effect performance may need optimization")
    
    if multiple_result.get("success") and multiple_result["total_time"] > 15:
        print("- Multiple effects processing time is high")
    
    if "cache_working" in cache_result and not cache_result["cache_working"]:
        print("- Cache effectiveness should be investigated")
    
    if single_result.get("success") and multiple_result.get("success"):
        single_time = single_result["total_time"]
        multiple_time = multiple_result["total_time"]
        if multiple_time > single_time * 2:
            print("- Consider progressive loading for better user experience")
    
    print("\\nTest completed. Check results above for performance insights.")

if __name__ == "__main__":
    main()