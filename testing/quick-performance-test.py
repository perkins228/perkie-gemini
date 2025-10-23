#!/usr/bin/env python3
"""
Quick Performance Test for InSPyReNet API

This script provides immediate performance insights without triggering cold starts.
It focuses on measuring warm API performance, cache effectiveness, and processing breakdowns
to understand the current API behavior and optimization opportunities.

Run this first to get baseline measurements before running the comprehensive benchmarks.
"""

import requests
import json
import time
import io
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Try to import PIL for image creation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

class QuickPerformanceTester:
    """Quick API performance tester focused on immediate insights"""
    
    def __init__(self):
        self.api_base_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"
        self.endpoints = {
            "health": f"{self.api_base_url}/health",
            "process_v2": f"{self.api_base_url}/api/v2/process-with-effects",
            "stats": f"{self.api_base_url}/api/v2/stats",
            "model_info": f"{self.api_base_url}/model-info",
            "v2_root": f"{self.api_base_url}/api/v2/"
        }
        
        self.test_image = self.create_quick_test_image()
        
    def create_quick_test_image(self) -> io.BytesIO:
        """Create a small test image for quick testing"""
        if PIL_AVAILABLE:
            # Small image for quick tests
            img = Image.new('RGB', (800, 600), color=(200, 100, 50))
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=80)
            buf.seek(0)
            print(f"Created test image: {len(buf.getvalue()) / 1024:.1f} KB")
            return buf
        else:
            # Look for small existing test image
            test_paths = [
                Path(__file__).parent.parent / "backend/inspirenet-api/tests/Images/Rosie.jpg"
            ]
            
            for path in test_paths:
                if path.exists():
                    with open(path, 'rb') as f:
                        data = f.read()
                        print(f"Using existing test image: {path.name} ({len(data) / 1024:.1f} KB)")
                        return io.BytesIO(data)
            
            raise RuntimeError("No test image available and PIL not installed")
    
    def test_api_health_and_info(self) -> Dict[str, Any]:
        """Test API health and gather basic information"""
        print("Testing API Health and Information")
        print("=" * 50)
        
        results = {}
        
        # Health check
        try:
            start_time = time.time()
            health_response = requests.get(self.endpoints["health"], timeout=10)
            health_time = time.time() - start_time
            
            results["health"] = {
                "status_code": health_response.status_code,
                "response_time": health_time,
                "success": health_response.status_code == 200
            }
            
            print(f"Health check: {health_response.status_code} ({health_time:.2f}s)")
            
        except Exception as e:
            results["health"] = {"error": str(e), "success": False}
            print(f"❌ Health check failed: {e}")
            return results
        
        # API v2 info
        try:
            start_time = time.time()
            v2_response = requests.get(self.endpoints["v2_root"], timeout=10)
            v2_time = time.time() - start_time
            
            if v2_response.status_code == 200:
                v2_data = v2_response.json()
                results["v2_info"] = {
                    "response_time": v2_time,
                    "available_effects": v2_data.get("available_effects", []),
                    "version": v2_data.get("version", "unknown"),
                    "features": v2_data.get("features", [])
                }
                
                print(f"✅ API v2 info: {len(v2_data.get('available_effects', []))} effects available ({v2_time:.2f}s)")
                print(f"   Effects: {', '.join(v2_data.get('available_effects', []))}")
            
        except Exception as e:
            print(f"⚠️  Could not get v2 info: {e}")
        
        # Model info
        try:
            start_time = time.time()
            model_response = requests.get(self.endpoints["model_info"], timeout=10)
            model_time = time.time() - start_time
            
            if model_response.status_code == 200:
                model_data = model_response.json()
                results["model_info"] = {
                    "response_time": model_time,
                    "model_data": model_data
                }
                
                print(f"✅ Model info: Available ({model_time:.2f}s)")
                
        except Exception as e:
            print(f"⚠️  Could not get model info: {e}")
        
        return results
    
    def test_single_effect_performance(self) -> Dict[str, Any]:
        """Test performance of single effect processing"""
        print("\\n🎨 Testing Single Effect Performance")
        print("=" * 50)
        
        # Test each available effect
        effects_to_test = ["enhancedblackwhite", "popart", "dithering", "color"]
        results = {}
        
        for effect in effects_to_test:
            print(f"\\nTesting {effect} effect...")
            
            # Reset image buffer
            self.test_image.seek(0)
            
            params = {
                "effect": effect,
                "return_all_effects": "false",
                "output_format": "png",
                "use_cache": "true"
            }
            
            files = {"file": ("test_image.jpg", self.test_image, "image/jpeg")}
            
            try:
                start_time = time.time()
                response = requests.post(
                    self.endpoints["process_v2"],
                    params=params,
                    files=files,
                    timeout=30
                )
                end_time = time.time()
                
                total_time = end_time - start_time
                
                # Extract timing information
                server_time = None
                cache_hits = 0
                
                if 'X-Processing-Time' in response.headers:
                    try:
                        server_time = float(response.headers['X-Processing-Time'])
                    except ValueError:
                        pass
                
                if 'X-Cache-Hits' in response.headers:
                    try:
                        cache_hits = int(response.headers['X-Cache-Hits'])
                    except ValueError:
                        pass
                
                results[effect] = {
                    "total_time": total_time,
                    "server_time": server_time,
                    "network_time": total_time - (server_time or 0),
                    "status_code": response.status_code,
                    "success": response.status_code == 200,
                    "response_size_kb": len(response.content) / 1024,
                    "cache_hits": cache_hits
                }
                
                print(f"   ⏱️  Total: {total_time:.2f}s")
                if server_time:
                    print(f"   🖥️  Server: {server_time:.2f}s")
                    print(f"   🌐 Network: {total_time - server_time:.2f}s")
                print(f"   📊 Status: {response.status_code}")
                print(f"   💾 Cache hits: {cache_hits}")
                print(f"   📦 Response: {len(response.content) / 1024:.1f} KB")
                
            except requests.exceptions.Timeout:
                results[effect] = {
                    "error": "timeout",
                    "total_time": 30.0,
                    "success": False
                }
                print(f"   ❌ Timeout after 30s")
                
            except Exception as e:
                results[effect] = {
                    "error": str(e),
                    "success": False
                }
                print(f"   ❌ Error: {e}")
        
        return results
    
    def test_multiple_effects_performance(self) -> Dict[str, Any]:
        """Test performance of multiple effects processing"""
        print("\\n🎭 Testing Multiple Effects Performance")
        print("=" * 50)
        
        test_cases = [
            {
                "name": "two_effects",
                "effects": ["enhancedblackwhite", "popart"],
                "description": "2 effects"
            },
            {
                "name": "all_effects",
                "effects": ["enhancedblackwhite", "popart", "dithering", "color"],
                "description": "All 4 effects"
            }
        ]
        
        results = {}
        
        for test_case in test_cases:
            print(f"\\nTesting {test_case['description']}...")
            
            # Reset image buffer
            self.test_image.seek(0)
            
            params = {
                "effects": ",".join(test_case["effects"]),
                "return_all_effects": "true",
                "output_format": "png",
                "use_cache": "true"
            }
            
            files = {"file": ("test_image.jpg", self.test_image, "image/jpeg")}
            
            try:
                start_time = time.time()
                response = requests.post(
                    self.endpoints["process_v2"],
                    params=params,
                    files=files,
                    timeout=60
                )
                end_time = time.time()
                
                total_time = end_time - start_time
                
                # Parse JSON response for detailed information
                server_time = None
                cache_hits = 0
                effects_processed = []
                
                if response.status_code == 200:
                    try:
                        json_data = response.json()
                        
                        if 'processing_time' in json_data:
                            server_time = json_data['processing_time'].get('total')
                        
                        if 'cache_info' in json_data:
                            cache_hits = json_data['cache_info'].get('total_cache_hits', 0)
                        
                        if 'effects' in json_data:
                            effects_processed = list(json_data['effects'].keys())
                        
                    except Exception as e:
                        print(f"   ⚠️  Could not parse JSON response: {e}")
                
                results[test_case["name"]] = {
                    "total_time": total_time,
                    "server_time": server_time,
                    "network_time": total_time - (server_time or 0),
                    "status_code": response.status_code,
                    "success": response.status_code == 200,
                    "response_size_kb": len(response.content) / 1024,
                    "cache_hits": cache_hits,
                    "effects_requested": test_case["effects"],
                    "effects_processed": effects_processed,
                    "effects_count": len(effects_processed)
                }
                
                print(f"   ⏱️  Total: {total_time:.2f}s")
                if server_time:
                    print(f"   🖥️  Server: {server_time:.2f}s")
                    print(f"   🌐 Network: {total_time - server_time:.2f}s")
                print(f"   📊 Status: {response.status_code}")
                print(f"   🎨 Effects processed: {len(effects_processed)}/{len(test_case['effects'])}")
                print(f"   💾 Cache hits: {cache_hits}")
                print(f"   📦 Response: {len(response.content) / 1024:.1f} KB")
                
            except requests.exceptions.Timeout:
                results[test_case["name"]] = {
                    "error": "timeout",
                    "total_time": 60.0,
                    "success": False
                }
                print(f"   ❌ Timeout after 60s")
                
            except Exception as e:
                results[test_case["name"]] = {
                    "error": str(e),
                    "success": False
                }
                print(f"   ❌ Error: {e}")
        
        return results
    
    def test_cache_effectiveness(self) -> Dict[str, Any]:
        """Test cache effectiveness with repeated requests"""
        print("\\n💾 Testing Cache Effectiveness")
        print("=" * 50)
        
        # Test same request multiple times to see cache impact
        effect = "enhancedblackwhite"
        results = {"requests": []}
        
        for i in range(3):
            print(f"\\nRequest {i+1}/3...")
            
            # Reset image buffer
            self.test_image.seek(0)
            
            params = {
                "effect": effect,
                "return_all_effects": "false",
                "output_format": "png",
                "use_cache": "true"
            }
            
            files = {"file": ("test_image.jpg", self.test_image, "image/jpeg")}
            
            try:
                start_time = time.time()
                response = requests.post(
                    self.endpoints["process_v2"],
                    params=params,
                    files=files,
                    timeout=30
                )
                end_time = time.time()
                
                total_time = end_time - start_time
                server_time = None
                cache_hits = 0
                
                if 'X-Processing-Time' in response.headers:
                    try:
                        server_time = float(response.headers['X-Processing-Time'])
                    except ValueError:
                        pass
                
                if 'X-Cache-Hits' in response.headers:
                    try:
                        cache_hits = int(response.headers['X-Cache-Hits'])
                    except ValueError:
                        pass
                
                request_result = {
                    "request_number": i + 1,
                    "total_time": total_time,
                    "server_time": server_time,
                    "cache_hits": cache_hits,
                    "success": response.status_code == 200
                }
                
                results["requests"].append(request_result)
                
                print(f"   ⏱️  Time: {total_time:.2f}s")
                if server_time:
                    print(f"   🖥️  Server: {server_time:.2f}s")
                print(f"   💾 Cache hits: {cache_hits}")
                
                # Small delay between requests
                time.sleep(1)
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                results["requests"].append({
                    "request_number": i + 1,
                    "error": str(e),
                    "success": False
                })
        
        # Analyze cache effectiveness
        successful_requests = [r for r in results["requests"] if r.get("success")]
        if len(successful_requests) >= 2:
            first_time = successful_requests[0]["total_time"]
            subsequent_times = [r["total_time"] for r in successful_requests[1:]]
            avg_subsequent = sum(subsequent_times) / len(subsequent_times)
            
            results["analysis"] = {
                "first_request_time": first_time,
                "average_subsequent_time": avg_subsequent,
                "speedup_factor": first_time / avg_subsequent if avg_subsequent > 0 else 0,
                "cache_working": avg_subsequent < first_time * 0.8  # 20% improvement threshold
            }
            
            print(f"\\n📊 Cache Analysis:")
            print(f"   First request: {first_time:.2f}s")
            print(f"   Subsequent avg: {avg_subsequent:.2f}s")
            print(f"   Speedup: {first_time / avg_subsequent:.1f}x" if avg_subsequent > 0 else "   No speedup")
            print(f"   Cache effective: {'✅ Yes' if results['analysis']['cache_working'] else '❌ No'}")
        
        return results
    
    def generate_performance_report(self, all_results: Dict[str, Any]) -> None:
        """Generate a comprehensive performance report"""
        print("\\n" + "=" * 80)
        print("📋 QUICK PERFORMANCE REPORT")
        print("=" * 80)
        
        # API Health Summary
        if "health_info" in all_results:
            health = all_results["health_info"]["health"]
            if health.get("success"):
                print(f"✅ API Status: Healthy ({health['response_time']:.2f}s response)")
            else:
                print(f"❌ API Status: Unhealthy")
        
        # Single Effect Performance
        if "single_effects" in all_results:
            single_results = all_results["single_effects"]
            successful_effects = {name: data for name, data in single_results.items() if data.get("success")}
            
            if successful_effects:
                avg_time = sum(data["total_time"] for data in successful_effects.values()) / len(successful_effects)
                fastest = min(successful_effects.items(), key=lambda x: x[1]["total_time"])
                slowest = max(successful_effects.items(), key=lambda x: x[1]["total_time"])
                
                print(f"\\n🎨 Single Effect Performance:")
                print(f"   Average time: {avg_time:.2f}s")
                print(f"   Fastest: {fastest[0]} ({fastest[1]['total_time']:.2f}s)")
                print(f"   Slowest: {slowest[0]} ({slowest[1]['total_time']:.2f}s)")
        
        # Multiple Effects Performance
        if "multiple_effects" in all_results:
            multi_results = all_results["multiple_effects"]
            
            if "all_effects" in multi_results and multi_results["all_effects"].get("success"):
                all_effects_time = multi_results["all_effects"]["total_time"]
                effects_count = multi_results["all_effects"]["effects_count"]
                print(f"\\n🎭 Multiple Effects Performance:")
                print(f"   All 4 effects: {all_effects_time:.2f}s")
                if effects_count > 0:
                    print(f"   Time per effect: {all_effects_time / effects_count:.2f}s")
        
        # Cache Effectiveness
        if "cache_test" in all_results:
            cache_analysis = all_results["cache_test"].get("analysis", {})
            if cache_analysis:
                print(f"\\n💾 Cache Effectiveness:")
                print(f"   First request: {cache_analysis['first_request_time']:.2f}s")
                print(f"   Subsequent avg: {cache_analysis['average_subsequent_time']:.2f}s")
                if cache_analysis.get("cache_working"):
                    print(f"   ✅ Cache is working effectively")
                else:
                    print(f"   ⚠️  Cache may not be working optimally")
        
        # Recommendations
        print(f"\\n💡 Quick Recommendations:")
        
        # Based on single effect performance
        if "single_effects" in all_results:
            single_results = all_results["single_effects"]
            successful_effects = {name: data for name, data in single_results.items() if data.get("success")}
            
            if successful_effects:
                avg_time = sum(data["total_time"] for data in successful_effects.values()) / len(successful_effects)
                
                if avg_time > 10:
                    print(f"   ⚠️  Single effects averaging {avg_time:.1f}s - consider optimization")
                elif avg_time > 5:
                    print(f"   📊 Single effects averaging {avg_time:.1f}s - reasonable performance")
                else:
                    print(f"   ✅ Single effects averaging {avg_time:.1f}s - good performance")
        
        # Based on multiple effects
        if "multiple_effects" in all_results:
            multi_results = all_results["multiple_effects"]
            if "all_effects" in multi_results and multi_results["all_effects"].get("success"):
                all_effects_time = multi_results["all_effects"]["total_time"]
                
                if all_effects_time > 20:
                    print(f"   🚨 All effects taking {all_effects_time:.1f}s - immediate optimization needed")
                elif all_effects_time > 15:
                    print(f"   ⚠️  All effects taking {all_effects_time:.1f}s - optimization recommended")
                else:
                    print(f"   ✅ All effects taking {all_effects_time:.1f}s - acceptable performance")
        
        # Cache recommendations
        if "cache_test" in all_results:
            cache_analysis = all_results["cache_test"].get("analysis", {})
            if cache_analysis and not cache_analysis.get("cache_working"):
                print(f"   💾 Cache optimization needed - not seeing expected speedup")
    
    def run_quick_tests(self) -> Dict[str, Any]:
        """Run all quick performance tests"""
        print("Quick Performance Test - InSPyReNet API")
        print("=" * 60)
        print("Testing warm API performance and cache effectiveness...")
        print()
        
        all_results = {}
        
        try:
            # 1. Test API health and info
            all_results["health_info"] = self.test_api_health_and_info()
            
            # Check if API is healthy before proceeding
            if not all_results["health_info"]["health"].get("success"):
                print("❌ API is not healthy. Stopping tests.")
                return all_results
            
            # 2. Test single effect performance
            all_results["single_effects"] = self.test_single_effect_performance()
            
            # 3. Test multiple effects performance
            all_results["multiple_effects"] = self.test_multiple_effects_performance()
            
            # 4. Test cache effectiveness
            all_results["cache_test"] = self.test_cache_effectiveness()
            
            # 5. Generate report
            self.generate_performance_report(all_results)
            
            # 6. Save results
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"quick_performance_test_{timestamp}.json"
            output_path = Path(__file__).parent / filename
            
            with open(output_path, 'w') as f:
                json.dump(all_results, f, indent=2, default=str)
            
            print(f"\\n💾 Results saved to: {output_path}")
            
            return all_results
            
        except KeyboardInterrupt:
            print("\\n⚠️  Test interrupted by user")
            return all_results
        
        except Exception as e:
            print(f"\\n❌ Test failed: {e}")
            return all_results

def main():
    """Main execution function"""
    print("Perkie Prints - Quick API Performance Test")
    print("=" * 50)
    print("This test provides immediate performance insights")
    print("without triggering expensive cold starts.")
    print()
    
    tester = QuickPerformanceTester()
    results = tester.run_quick_tests()
    
    if results:
        print("\\n🎉 Quick performance test completed!")
        print("Run the comprehensive benchmarks for cold start analysis.")
    else:
        print("\\n❌ Test failed or was incomplete.")

if __name__ == "__main__":
    main()