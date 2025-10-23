#!/usr/bin/env python3
"""
Realistic API Performance Test with actual pet image
Tests cold start, warm requests, and progressive loading scenarios
"""

import requests
import time
import json
import os
from typing import Dict, List, Tuple

API_URL = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"

def test_with_real_image() -> Dict:
    """Test with the actual test-image.jpg file"""
    
    # Use the existing test image
    image_path = "test-image.jpg"
    if not os.path.exists(image_path):
        print(f"Error: {image_path} not found")
        return {}
    
    file_size = os.path.getsize(image_path) / 1024
    print(f"Using test image: {file_size:.1f} KB")
    
    results = {}
    
    # Test 1: Cold start simulation (first request of the day)
    print("\n1. Testing Cold Start with All 4 Effects...")
    print("   (This simulates first user of the day)")
    
    with open(image_path, 'rb') as f:
        files = {'file': ('test.jpg', f, 'image/jpeg')}
        params = {
            'effects': 'enhancedblackwhite,popart,dithering,color',
            'return_all_effects': 'true',
            'session_id': f'test_cold_{int(time.time())}'
        }
        
        start = time.time()
        try:
            response = requests.post(
                f"{API_URL}/api/v2/process-with-effects",
                files=files,
                params=params,
                timeout=120
            )
            total_time = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                effects_count = len(data.get('effects', {}))
                response_size = len(response.content) / 1024
                
                results['cold_start_all'] = {
                    'total_time': total_time,
                    'effects_processed': effects_count,
                    'response_size_kb': response_size,
                    'server_time': data.get('processing_time', 0)
                }
                
                print(f"   Total time: {total_time:.1f}s")
                server_time = data.get('processing_time', 0)
                if isinstance(server_time, dict):
                    server_time = 0  # Handle malformed response
                print(f"   Server processing: {server_time:.1f}s")
                print(f"   Network/parsing: {total_time - data.get('processing_time', 0):.1f}s")
                print(f"   Effects processed: {effects_count}")
                print(f"   Response size: {response_size:.1f} KB")
            else:
                print(f"   Error: Status {response.status_code}")
                
        except requests.Timeout:
            print("   Timeout after 120 seconds!")
            results['cold_start_all'] = {'error': 'timeout'}
        except Exception as e:
            print(f"   Error: {e}")
            results['cold_start_all'] = {'error': str(e)}
    
    # Wait a bit to ensure API is warm
    time.sleep(2)
    
    # Test 2: Warm API with single effect (progressive loading)
    print("\n2. Testing Progressive Loading (Single Effect)...")
    print("   (Warm API, loading just primary effect)")
    
    with open(image_path, 'rb') as f:
        files = {'file': ('test.jpg', f, 'image/jpeg')}
        params = {
            'effect': 'enhancedblackwhite',
            'load_single_effect': 'true',
            'return_all_effects': 'true',
            'session_id': f'test_progressive_{int(time.time())}'
        }
        
        start = time.time()
        try:
            response = requests.post(
                f"{API_URL}/api/v2/process-with-effects",
                files=files,
                params=params,
                timeout=60
            )
            total_time = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                effects_count = len(data.get('effects', {}))
                response_size = len(response.content) / 1024
                
                results['progressive_single'] = {
                    'total_time': total_time,
                    'effects_processed': effects_count,
                    'response_size_kb': response_size,
                    'server_time': data.get('processing_time', 0)
                }
                
                print(f"   Total time: {total_time:.1f}s")
                server_time = data.get('processing_time', 0)
                if isinstance(server_time, dict):
                    server_time = 0  # Handle malformed response
                print(f"   Server processing: {server_time:.1f}s")
                print(f"   Effects processed: {effects_count}")
                print(f"   Response size: {response_size:.1f} KB")
            else:
                print(f"   Error: Status {response.status_code}")
                
        except Exception as e:
            print(f"   Error: {e}")
            results['progressive_single'] = {'error': str(e)}
    
    # Test 3: Warm API with all effects
    print("\n3. Testing Warm API with All Effects...")
    print("   (Simulates non-progressive approach with warm API)")
    
    with open(image_path, 'rb') as f:
        files = {'file': ('test.jpg', f, 'image/jpeg')}
        params = {
            'effects': 'enhancedblackwhite,popart,dithering,color',
            'return_all_effects': 'true',
            'session_id': f'test_warm_{int(time.time())}'
        }
        
        start = time.time()
        try:
            response = requests.post(
                f"{API_URL}/api/v2/process-with-effects",
                files=files,
                params=params,
                timeout=60
            )
            total_time = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                effects_count = len(data.get('effects', {}))
                response_size = len(response.content) / 1024
                
                results['warm_all'] = {
                    'total_time': total_time,
                    'effects_processed': effects_count,
                    'response_size_kb': response_size,
                    'server_time': data.get('processing_time', 0)
                }
                
                print(f"   Total time: {total_time:.1f}s")
                server_time = data.get('processing_time', 0)
                if isinstance(server_time, dict):
                    server_time = 0  # Handle malformed response
                print(f"   Server processing: {server_time:.1f}s")
                print(f"   Effects processed: {effects_count}")
                print(f"   Response size: {response_size:.1f} KB")
            else:
                print(f"   Error: Status {response.status_code}")
                
        except Exception as e:
            print(f"   Error: {e}")
            results['warm_all'] = {'error': str(e)}
    
    # Test 4: Simulate progressive loading of remaining effects
    print("\n4. Testing Background Loading (Remaining 3 Effects)...")
    print("   (Simulates loading other effects in background)")
    
    remaining_effects = ['popart', 'dithering', 'color']
    background_times = []
    
    for effect in remaining_effects:
        with open(image_path, 'rb') as f:
            files = {'file': ('test.jpg', f, 'image/jpeg')}
            params = {
                'effect': effect,
                'load_single_effect': 'true',
                'return_all_effects': 'true',
                'use_cache': 'true',
                'session_id': f'test_bg_{effect}_{int(time.time())}'
            }
            
            start = time.time()
            try:
                response = requests.post(
                    f"{API_URL}/api/v2/process-with-effects",
                    files=files,
                    params=params,
                    timeout=30
                )
                bg_time = time.time() - start
                background_times.append(bg_time)
                print(f"   {effect}: {bg_time:.1f}s")
            except Exception as e:
                print(f"   {effect}: Error - {e}")
    
    if background_times:
        results['background_loading'] = {
            'total_time': sum(background_times),
            'average_time': sum(background_times) / len(background_times),
            'effects_loaded': len(background_times)
        }
    
    return results

def main():
    print("=" * 60)
    print("REALISTIC API PERFORMANCE TEST")
    print("Testing with actual image file")
    print("=" * 60)
    
    results = test_with_real_image()
    
    # Summary
    print("\n" + "=" * 60)
    print("PERFORMANCE SUMMARY")
    print("=" * 60)
    
    if 'cold_start_all' in results and 'error' not in results['cold_start_all']:
        cold_time = results['cold_start_all']['total_time']
        print(f"\nCold Start (All Effects): {cold_time:.1f}s")
        print(f"  Server processing: {results['cold_start_all'].get('server_time', 0):.1f}s")
        print(f"  Client overhead: {cold_time - results['cold_start_all'].get('server_time', 0):.1f}s")
    
    if 'progressive_single' in results and 'error' not in results['progressive_single']:
        prog_time = results['progressive_single']['total_time']
        print(f"\nProgressive (Initial Effect): {prog_time:.1f}s")
        print(f"  Server processing: {results['progressive_single'].get('server_time', 0):.1f}s")
        print(f"  Effects loaded: {results['progressive_single']['effects_processed']}")
    
    if 'warm_all' in results and 'error' not in results['warm_all']:
        warm_time = results['warm_all']['total_time']
        print(f"\nWarm API (All Effects): {warm_time:.1f}s")
        print(f"  Server processing: {results['warm_all'].get('server_time', 0):.1f}s")
        print(f"  Effects loaded: {results['warm_all']['effects_processed']}")
    
    if 'background_loading' in results:
        bg_total = results['background_loading']['total_time']
        print(f"\nBackground Loading (3 effects): {bg_total:.1f}s total")
        print(f"  Average per effect: {results['background_loading']['average_time']:.1f}s")
    
    # Progressive vs Traditional comparison
    if 'progressive_single' in results and 'warm_all' in results:
        prog_total = results['progressive_single']['total_time']
        if 'background_loading' in results:
            # User sees first effect quickly, others load in background
            print(f"\n⚡ PROGRESSIVE LOADING ADVANTAGE:")
            print(f"  User sees first effect in: {prog_total:.1f}s")
            print(f"  Traditional approach: {warm_time:.1f}s")
            print(f"  Time saved: {warm_time - prog_total:.1f}s ({(1 - prog_total/warm_time)*100:.0f}% faster)")
    
    # Cold start impact
    if 'cold_start_all' in results and 'warm_all' in results:
        if 'error' not in results['cold_start_all'] and 'error' not in results['warm_all']:
            cold_penalty = cold_time - warm_time
            print(f"\n❄️ COLD START IMPACT:")
            print(f"  Cold start penalty: {cold_penalty:.1f}s")
            print(f"  This explains the 60-second delays users experience!")
    
    print("\n" + "=" * 60)
    print("RECOMMENDATIONS:")
    print("=" * 60)
    
    if 'cold_start_all' in results and 'error' not in results['cold_start_all']:
        if cold_time > 30:
            print("❗ Set minScale=1 in Cloud Run to eliminate cold starts")
            print("   This will save users 30-60 seconds on first request")
    
    if 'progressive_single' in results and 'warm_all' in results:
        if 'error' not in results['progressive_single'] and 'error' not in results['warm_all']:
            if prog_time < warm_time * 0.5:
                print("✅ Progressive loading is working well!")
                print(f"   Users see results {(1 - prog_time/warm_time)*100:.0f}% faster")
            else:
                print("⚠️ Progressive loading needs optimization")
                print("   Single effect should be much faster than all effects")

if __name__ == "__main__":
    main()