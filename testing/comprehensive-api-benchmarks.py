#!/usr/bin/env python3
"""
Comprehensive API Performance Benchmarking Script

This script provides accurate measurements for the InSPyReNet API to understand:
1. Cold start vs warm API processing times
2. Single effect vs multiple effects performance
3. Server-side processing breakdown by stage
4. Cache effectiveness and progressive loading benefits
5. Image size impact on processing times
6. Network vs server-side processing time analysis

Results will help optimize the API deployment configuration and frontend strategy.
"""

import requests
import json
import time
import io
import hashlib
import statistics
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import concurrent.futures
import threading

# Try to import PIL for image generation/manipulation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("WARNING: PIL not available. Will use existing test images only.")

@dataclass
class BenchmarkResult:
    """Data structure for individual benchmark results"""
    test_name: str
    timestamp: datetime
    total_time: float
    server_processing_time: Optional[float]
    network_time: float
    status_code: int
    success: bool
    effects_processed: List[str]
    cache_hits: int
    cache_operations: int
    image_size_mb: float
    response_size_mb: float
    error_message: Optional[str] = None
    cold_start: bool = False
    progressive_mode: bool = False

@dataclass
class ProcessingBreakdown:
    """Server-side processing time breakdown"""
    background_removal: float
    effects_processing: float
    total_server: float
    cache_lookup: float = 0.0
    model_init: float = 0.0

class APIBenchmarkSuite:
    """Comprehensive API performance benchmarking suite"""
    
    def __init__(self):
        self.api_base_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"
        self.results: List[BenchmarkResult] = []
        self.test_images = {}
        self.cold_start_detected = False
        
        # Endpoints
        self.endpoints = {
            "health": f"{self.api_base_url}/health",
            "process_v2": f"{self.api_base_url}/api/v2/process-with-effects",
            "model_info": f"{self.api_base_url}/model-info",
            "stats": f"{self.api_base_url}/api/v2/stats"
        }
        
        print(f"Initializing API Benchmark Suite")
        print(f"Target API: {self.api_base_url}")
        print(f"Timestamp: {datetime.now()}")
    
    def create_test_images(self) -> Dict[str, io.BytesIO]:
        """Create test images of different sizes for benchmarking"""
        images = {}
        
        if PIL_AVAILABLE:
            # Small image (2MB target)
            img_small = Image.new('RGB', (1200, 800), color=(255, 0, 0))
            buf_small = io.BytesIO()
            img_small.save(buf_small, format='JPEG', quality=95)
            images['small_2mb'] = buf_small
            
            # Medium image (5MB target) 
            img_medium = Image.new('RGB', (2000, 1500), color=(0, 255, 0))
            buf_medium = io.BytesIO()
            img_medium.save(buf_medium, format='JPEG', quality=95)
            images['medium_5mb'] = buf_medium
            
            # Large image (10MB target)
            img_large = Image.new('RGB', (3000, 2000), color=(0, 0, 255))
            buf_large = io.BytesIO()
            img_large.save(buf_large, format='JPEG', quality=95)
            images['large_10mb'] = buf_large
            
            # Ultra-high quality PNG (larger file size)
            img_png = Image.new('RGBA', (2500, 2000), color=(255, 255, 0, 255))
            buf_png = io.BytesIO()
            img_png.save(buf_png, format='PNG')
            images['large_png'] = buf_png
            
            print(f"Generated test images:")
            for name, buf in images.items():
                size_mb = len(buf.getvalue()) / 1024 / 1024
                buf.seek(0)  # Reset buffer position
                print(f"  {name}: {size_mb:.2f} MB")
        
        else:
            # Look for existing test images
            test_paths = [
                Path(__file__).parent.parent / "backend/inspirenet-api/tests/Images/Rosie.jpg",
                Path(__file__).parent.parent / "backend/inspirenet-api/tests/Images/Squid.jpg",
                Path(__file__).parent.parent / "backend/inspirenet-api/tests/Images/Tex.jpeg",
                Path(__file__).parent.parent / "IMG_2733.jpeg"
            ]
            
            for i, path in enumerate(test_paths):
                if path.exists():
                    with open(path, 'rb') as f:
                        buf = io.BytesIO(f.read())
                        size_mb = len(buf.getvalue()) / 1024 / 1024
                        images[f'existing_{i}_{size_mb:.1f}mb'] = buf
                        buf.seek(0)
                        print(f"Found existing image: {path.name} ({size_mb:.2f} MB)")
        
        if not images:
            print("ERROR: No test images available!")
            
        return images
    
    def wait_for_cold_start(self, wait_minutes: int = 2) -> None:
        """Wait for API to go cold (for cold start testing)"""
        print(f"\n🕐 Waiting {wait_minutes} minutes for API to go cold...")
        print("This simulates the production scenario where the API scales to 0 instances.")
        
        for remaining in range(wait_minutes * 60, 0, -10):
            mins, secs = divmod(remaining, 60)
            print(f"   Time remaining: {mins:02d}:{secs:02d}", end='\r')
            time.sleep(10)
        
        print(f"\n✅ Cold start wait completed. Next request will be a cold start.")
        self.cold_start_detected = False
    
    def detect_cold_start(self, response_time: float) -> bool:
        """Detect if this was likely a cold start based on response time"""
        # Cold starts typically take 30+ seconds for the first request
        return response_time > 25.0
    
    def make_api_request(
        self, 
        image_data: io.BytesIO,
        image_name: str,
        params: Dict[str, str],
        test_name: str,
        expect_cold_start: bool = False
    ) -> BenchmarkResult:
        """Make a single API request with comprehensive timing measurement"""
        
        # Reset image buffer
        image_data.seek(0)
        image_size_mb = len(image_data.getvalue()) / 1024 / 1024
        image_data.seek(0)
        
        # Prepare request
        files = {"file": (f"{image_name}.jpg", image_data, "image/jpeg")}
        
        print(f"\n📊 Testing: {test_name}")
        print(f"   Image: {image_name} ({image_size_mb:.2f} MB)")
        print(f"   Params: {params}")
        print(f"   Expected cold start: {expect_cold_start}")
        
        # Make request with detailed timing
        start_time = time.time()
        
        try:
            response = requests.post(
                self.endpoints["process_v2"],
                params=params,
                files=files,
                timeout=120  # Extended timeout for cold starts
            )
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # Detect cold start
            is_cold_start = self.detect_cold_start(total_time) or expect_cold_start
            if is_cold_start and not self.cold_start_detected:
                self.cold_start_detected = True
                print(f"   🥶 COLD START DETECTED ({total_time:.1f}s)")
            
            # Extract server processing time from headers
            server_time = None
            if 'X-Processing-Time' in response.headers:
                try:
                    server_time = float(response.headers['X-Processing-Time'])
                except ValueError:
                    pass
            
            # Calculate network time
            network_time = total_time - (server_time or 0)
            
            # Parse response
            success = response.status_code == 200
            effects_processed = []
            cache_hits = 0
            cache_operations = 0
            response_size_mb = len(response.content) / 1024 / 1024
            error_message = None
            
            if success:
                try:
                    if response.headers.get('content-type', '').startswith('application/json'):
                        json_response = response.json()
                        
                        # Extract effects information
                        if 'effects' in json_response:
                            effects_processed = list(json_response['effects'].keys())
                        
                        # Extract cache information
                        if 'cache_info' in json_response:
                            cache_info = json_response['cache_info']
                            cache_hits = cache_info.get('total_cache_hits', 0)
                            cache_operations = cache_info.get('total_operations', 0)
                        
                        # Extract server timing breakdown
                        if 'processing_time' in json_response:
                            server_timing = json_response['processing_time']
                            if 'total' in server_timing:
                                server_time = server_timing['total']
                                network_time = total_time - server_time
                    
                    else:
                        # Binary response (PNG)
                        if 'X-Available-Effects' in response.headers:
                            effects_processed = response.headers['X-Available-Effects'].split(',')
                        if 'X-Cache-Hits' in response.headers:
                            try:
                                cache_hits = int(response.headers['X-Cache-Hits'])
                            except ValueError:
                                pass
                
                except Exception as e:
                    error_message = f"Response parsing error: {e}"
                    success = False
            
            else:
                error_message = f"HTTP {response.status_code}: {response.text[:200]}"
            
            # Create result
            result = BenchmarkResult(
                test_name=test_name,
                timestamp=datetime.now(),
                total_time=total_time,
                server_processing_time=server_time,
                network_time=network_time,
                status_code=response.status_code,
                success=success,
                effects_processed=effects_processed,
                cache_hits=cache_hits,
                cache_operations=cache_operations,
                image_size_mb=image_size_mb,
                response_size_mb=response_size_mb,
                error_message=error_message,
                cold_start=is_cold_start,
                progressive_mode=params.get('load_single_effect') == 'true'
            )
            
            # Print immediate results
            print(f"   ⏱️  Total time: {total_time:.2f}s")
            if server_time:
                print(f"   🖥️  Server time: {server_time:.2f}s")
                print(f"   🌐 Network time: {network_time:.2f}s")
            print(f"   📊 Status: {response.status_code}")
            print(f"   🎨 Effects: {len(effects_processed)} processed")
            print(f"   💾 Cache: {cache_hits}/{cache_operations} hits")
            print(f"   📦 Response: {response_size_mb:.2f} MB")
            
            if error_message:
                print(f"   ❌ Error: {error_message}")
            
            return result
        
        except requests.exceptions.Timeout:
            return BenchmarkResult(
                test_name=test_name,
                timestamp=datetime.now(),
                total_time=120.0,
                server_processing_time=None,
                network_time=120.0,
                status_code=408,
                success=False,
                effects_processed=[],
                cache_hits=0,
                cache_operations=0,
                image_size_mb=image_size_mb,
                response_size_mb=0.0,
                error_message="Request timeout (120s)",
                cold_start=True
            )
        
        except Exception as e:
            return BenchmarkResult(
                test_name=test_name,
                timestamp=datetime.now(),
                total_time=0.0,
                server_processing_time=None,
                network_time=0.0,
                status_code=0,
                success=False,
                effects_processed=[],
                cache_hits=0,
                cache_operations=0,
                image_size_mb=image_size_mb,
                response_size_mb=0.0,
                error_message=str(e)
            )
    
    def run_cold_start_benchmarks(self) -> None:
        """Test cold start scenarios"""
        print("\n" + "="*80)
        print("🥶 COLD START BENCHMARKS")
        print("="*80)
        
        if not self.test_images:
            print("No test images available for cold start testing")
            return
        
        # Use medium size image for cold start tests
        test_image_name = next(iter(self.test_images.keys()))
        test_image = self.test_images[test_image_name]
        
        # Test 1: Cold start with all 4 effects (current default)
        self.wait_for_cold_start(2)
        result1 = self.make_api_request(
            image_data=test_image,
            image_name="cold_all_effects",
            params={
                "effects": "enhancedblackwhite,popart,dithering,color",
                "return_all_effects": "true",
                "output_format": "png"
            },
            test_name="Cold Start - All 4 Effects",
            expect_cold_start=True
        )
        self.results.append(result1)
        
        # Test 2: Cold start with single effect (progressive loading)
        self.wait_for_cold_start(2)
        result2 = self.make_api_request(
            image_data=test_image,
            image_name="cold_single_effect",
            params={
                "effect": "enhancedblackwhite",
                "load_single_effect": "true",
                "return_all_effects": "true",
                "output_format": "png"
            },
            test_name="Cold Start - Single Effect (Progressive)",
            expect_cold_start=True
        )
        self.results.append(result2)
    
    def run_warm_api_benchmarks(self) -> None:
        """Test warm API scenarios"""
        print("\n" + "="*80)
        print("🔥 WARM API BENCHMARKS")
        print("="*80)
        
        if not self.test_images:
            print("No test images available for warm API testing")
            return
        
        test_image_name = next(iter(self.test_images.keys()))
        test_image = self.test_images[test_image_name]
        
        # Warm up the API first
        print("🔥 Warming up API...")
        warmup_result = self.make_api_request(
            image_data=test_image,
            image_name="warmup",
            params={"effect": "enhancedblackwhite", "output_format": "png"},
            test_name="API Warmup"
        )
        
        # Wait a moment for warmup to complete
        time.sleep(2)
        
        # Test 3: Warm API with all 4 effects
        result3 = self.make_api_request(
            image_data=test_image,
            image_name="warm_all_effects",
            params={
                "effects": "enhancedblackwhite,popart,dithering,color",
                "return_all_effects": "true",
                "output_format": "png"
            },
            test_name="Warm API - All 4 Effects"
        )
        self.results.append(result3)
        
        # Test 4: Warm API with single effect
        result4 = self.make_api_request(
            image_data=test_image,
            image_name="warm_single_effect",
            params={
                "effect": "enhancedblackwhite",
                "return_all_effects": "false",
                "output_format": "png"
            },
            test_name="Warm API - Single Effect"
        )
        self.results.append(result4)
        
        # Test 5: Progressive loading simulation (1 initial + 3 background)
        print("\n📈 Testing Progressive Loading Pattern...")
        
        # Initial effect
        result5a = self.make_api_request(
            image_data=test_image,
            image_name="progressive_initial",
            params={
                "effect": "enhancedblackwhite",
                "load_single_effect": "true",
                "return_all_effects": "true",
                "output_format": "png"
            },
            test_name="Progressive - Initial Effect"
        )
        
        # Background effects (simulate 3 additional requests)
        background_times = []
        for i, effect in enumerate(["popart", "dithering", "color"]):
            bg_result = self.make_api_request(
                image_data=test_image,
                image_name=f"progressive_bg_{effect}",
                params={
                    "effect": effect,
                    "load_single_effect": "true",
                    "return_all_effects": "false",
                    "output_format": "png",
                    "use_cache": "true"  # Should use cached background removal
                },
                test_name=f"Progressive - Background Effect {i+1} ({effect})"
            )
            background_times.append(bg_result.total_time)
            
        # Calculate progressive loading total
        progressive_total = result5a.total_time + sum(background_times)
        
        # Create synthetic result for progressive loading total
        progressive_result = BenchmarkResult(
            test_name="Progressive Loading - Total Time",
            timestamp=datetime.now(),
            total_time=progressive_total,
            server_processing_time=None,
            network_time=0,
            status_code=200,
            success=True,
            effects_processed=["enhancedblackwhite", "popart", "dithering", "color"],
            cache_hits=3,  # 3 background effects should hit cache
            cache_operations=4,
            image_size_mb=result5a.image_size_mb,
            response_size_mb=result5a.response_size_mb * 4,
            progressive_mode=True
        )
        
        self.results.extend([result5a, progressive_result])
    
    def run_image_size_benchmarks(self) -> None:
        """Test impact of different image sizes"""
        print("\n" + "="*80)
        print("📏 IMAGE SIZE IMPACT BENCHMARKS") 
        print("="*80)
        
        if len(self.test_images) < 2:
            print("Not enough test images for size comparison")
            return
        
        # Test each image size with the same parameters
        test_params = {
            "effects": "enhancedblackwhite,popart",
            "return_all_effects": "true",
            "output_format": "png"
        }
        
        for image_name, image_data in self.test_images.items():
            result = self.make_api_request(
                image_data=image_data,
                image_name=image_name,
                params=test_params,
                test_name=f"Size Test - {image_name}"
            )
            self.results.append(result)
    
    def run_cache_effectiveness_tests(self) -> None:
        """Test cache effectiveness with repeated requests"""
        print("\n" + "="*80)
        print("💾 CACHE EFFECTIVENESS TESTS")
        print("="*80)
        
        if not self.test_images:
            print("No test images available for cache testing")
            return
        
        test_image_name = next(iter(self.test_images.keys()))
        test_image = self.test_images[test_image_name]
        
        # Test same image multiple times to see cache benefits
        test_params = {
            "effects": "enhancedblackwhite,popart",
            "return_all_effects": "true",
            "output_format": "png",
            "use_cache": "true"
        }
        
        for i in range(3):
            result = self.make_api_request(
                image_data=test_image,
                image_name=f"cache_test_{i+1}",
                params=test_params,
                test_name=f"Cache Test - Attempt {i+1}"
            )
            self.results.append(result)
            
            # Small delay between requests
            time.sleep(1)
    
    def analyze_results(self) -> Dict[str, Any]:
        """Analyze benchmark results and provide insights"""
        print("\n" + "="*80)
        print("📈 PERFORMANCE ANALYSIS")
        print("="*80)
        
        if not self.results:
            print("No results to analyze")
            return {}
        
        # Categorize results
        cold_start_results = [r for r in self.results if r.cold_start]
        warm_results = [r for r in self.results if not r.cold_start and r.success]
        progressive_results = [r for r in self.results if r.progressive_mode]
        all_effects_results = [r for r in self.results if len(r.effects_processed) >= 4]
        single_effect_results = [r for r in self.results if len(r.effects_processed) == 1]
        
        analysis = {
            "summary": {
                "total_tests": len(self.results),
                "successful_tests": len([r for r in self.results if r.success]),
                "cold_starts_detected": len(cold_start_results),
                "cache_hits_total": sum(r.cache_hits for r in self.results)
            },
            "timing_analysis": {},
            "recommendations": []
        }
        
        # Cold start analysis
        if cold_start_results:
            cold_times = [r.total_time for r in cold_start_results if r.success]
            if cold_times:
                analysis["timing_analysis"]["cold_start"] = {
                    "average_time": statistics.mean(cold_times),
                    "min_time": min(cold_times),
                    "max_time": max(cold_times),
                    "count": len(cold_times)
                }
                print(f"🥶 Cold Start Analysis:")
                print(f"   Average: {statistics.mean(cold_times):.1f}s")
                print(f"   Range: {min(cold_times):.1f}s - {max(cold_times):.1f}s")
        
        # Warm API analysis
        if warm_results:
            warm_times = [r.total_time for r in warm_results]
            analysis["timing_analysis"]["warm_api"] = {
                "average_time": statistics.mean(warm_times),
                "min_time": min(warm_times),
                "max_time": max(warm_times),
                "count": len(warm_times)
            }
            print(f"\n🔥 Warm API Analysis:")
            print(f"   Average: {statistics.mean(warm_times):.1f}s")
            print(f"   Range: {min(warm_times):.1f}s - {max(warm_times):.1f}s")
        
        # Effect count comparison
        if all_effects_results and single_effect_results:
            all_effects_times = [r.total_time for r in all_effects_results if r.success and not r.cold_start]
            single_effect_times = [r.total_time for r in single_effect_results if r.success and not r.cold_start]
            
            if all_effects_times and single_effect_times:
                print(f"\n🎨 Effect Count Comparison:")
                print(f"   All 4 effects avg: {statistics.mean(all_effects_times):.1f}s")
                print(f"   Single effect avg: {statistics.mean(single_effect_times):.1f}s")
                print(f"   Time per additional effect: {(statistics.mean(all_effects_times) - statistics.mean(single_effect_times)) / 3:.1f}s")
        
        # Cache effectiveness
        cache_effective_results = [r for r in self.results if r.cache_hits > 0]
        if cache_effective_results:
            cache_hit_rates = [r.cache_hits / max(1, r.cache_operations) for r in cache_effective_results]
            print(f"\n💾 Cache Effectiveness:")
            print(f"   Average hit rate: {statistics.mean(cache_hit_rates):.1%}")
            print(f"   Tests with cache hits: {len(cache_effective_results)}")
        
        # Image size impact
        size_groups = {}
        for result in self.results:
            if result.success and not result.cold_start:
                size_key = f"{result.image_size_mb:.1f}MB"
                if size_key not in size_groups:
                    size_groups[size_key] = []
                size_groups[size_key].append(result.total_time)
        
        if len(size_groups) > 1:
            print(f"\n📏 Image Size Impact:")
            for size, times in size_groups.items():
                print(f"   {size}: {statistics.mean(times):.1f}s avg ({len(times)} tests)")
        
        # Server vs Network time analysis
        server_times = [r for r in self.results if r.server_processing_time is not None and r.success]
        if server_times:
            server_avg = statistics.mean([r.server_processing_time for r in server_times])
            network_avg = statistics.mean([r.network_time for r in server_times])
            total_avg = statistics.mean([r.total_time for r in server_times])
            
            print(f"\n⚡ Server vs Network Time Breakdown:")
            print(f"   Server processing: {server_avg:.1f}s ({server_avg/total_avg:.1%})")
            print(f"   Network overhead: {network_avg:.1f}s ({network_avg/total_avg:.1%})")
            print(f"   Total average: {total_avg:.1f}s")
            
            analysis["timing_analysis"]["breakdown"] = {
                "server_processing": server_avg,
                "network_overhead": network_avg,
                "total_average": total_avg
            }
        
        # Generate recommendations
        recommendations = []
        
        if cold_start_results:
            avg_cold_time = statistics.mean([r.total_time for r in cold_start_results if r.success])
            if avg_cold_time > 30:
                recommendations.append(f"CRITICAL: Cold starts average {avg_cold_time:.1f}s. Consider setting minScale=1 during business hours.")
        
        if warm_results:
            avg_warm_time = statistics.mean([r.total_time for r in warm_results])
            if avg_warm_time > 10:
                recommendations.append(f"Warm API still slow at {avg_warm_time:.1f}s. Check GPU allocation and model optimization.")
        
        if cache_effective_results:
            avg_cache_rate = statistics.mean([r.cache_hits / max(1, r.cache_operations) for r in cache_effective_results])
            if avg_cache_rate < 0.5:
                recommendations.append(f"Cache hit rate low at {avg_cache_rate:.1%}. Review cache key generation and TTL settings.")
        
        analysis["recommendations"] = recommendations
        
        print(f"\n💡 Recommendations:")
        for i, rec in enumerate(recommendations, 1):
            print(f"   {i}. {rec}")
        
        return analysis
    
    def save_results(self, filename: str = None) -> str:
        """Save benchmark results to JSON file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"api_benchmark_results_{timestamp}.json"
        
        # Convert results to serializable format
        serializable_results = []
        for result in self.results:
            result_dict = asdict(result)
            result_dict['timestamp'] = result.timestamp.isoformat()
            serializable_results.append(result_dict)
        
        # Include analysis
        analysis = self.analyze_results()
        
        output_data = {
            "benchmark_metadata": {
                "api_url": self.api_base_url,
                "test_count": len(self.results),
                "timestamp": datetime.now().isoformat(),
                "test_images_used": list(self.test_images.keys())
            },
            "results": serializable_results,
            "analysis": analysis
        }
        
        output_path = Path(__file__).parent / filename
        with open(output_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"\n💾 Results saved to: {output_path}")
        return str(output_path)
    
    def run_comprehensive_benchmarks(self) -> str:
        """Run the complete benchmark suite"""
        print("🚀 Starting Comprehensive API Benchmarks")
        print("="*80)
        
        # Initialize test images
        self.test_images = self.create_test_images()
        if not self.test_images:
            print("❌ No test images available. Cannot run benchmarks.")
            return ""
        
        # Check API health
        try:
            health_response = requests.get(self.endpoints["health"], timeout=10)
            if health_response.status_code != 200:
                print(f"❌ API health check failed: {health_response.status_code}")
                return ""
            print("✅ API health check passed")
        except Exception as e:
            print(f"❌ Cannot reach API: {e}")
            return ""
        
        # Run benchmark suites
        try:
            # 1. Cold start benchmarks
            self.run_cold_start_benchmarks()
            
            # 2. Warm API benchmarks 
            self.run_warm_api_benchmarks()
            
            # 3. Image size impact
            self.run_image_size_benchmarks()
            
            # 4. Cache effectiveness
            self.run_cache_effectiveness_tests()
            
            # 5. Analysis and save results
            self.analyze_results()
            return self.save_results()
            
        except KeyboardInterrupt:
            print("\n⚠️  Benchmark interrupted by user")
            if self.results:
                print("Saving partial results...")
                return self.save_results("partial_benchmark_results.json")
            return ""
        
        except Exception as e:
            print(f"\n❌ Benchmark failed: {e}")
            if self.results:
                print("Saving partial results...")
                return self.save_results("failed_benchmark_results.json")
            return ""

def main():
    """Main execution function"""
    print("Perkie Prints - InSPyReNet API Performance Benchmarks")
    print("="*60)
    print()
    print("This comprehensive benchmark will measure:")
    print("• Cold start vs warm API performance") 
    print("• Single effect vs multiple effects processing")
    print("• Progressive loading effectiveness")
    print("• Image size impact on processing times")
    print("• Cache effectiveness and hit rates")
    print("• Server vs network processing time breakdown")
    print()
    print("WARNING: This test will trigger multiple cold starts,")
    print("which may incur significant Cloud Run charges!")
    print()
    
    confirm = input("Continue with benchmarks? (y/N): ").strip().lower()
    if confirm != 'y':
        print("Benchmark cancelled.")
        return
    
    # Run benchmarks
    suite = APIBenchmarkSuite()
    results_file = suite.run_comprehensive_benchmarks()
    
    if results_file:
        print(f"\n🎉 Benchmarks completed successfully!")
        print(f"📄 Detailed results saved to: {results_file}")
        print("\nNext steps:")
        print("1. Review the analysis and recommendations")
        print("2. Consider adjusting Cloud Run configuration based on findings")
        print("3. Implement progressive loading if cold starts are problematic")
        print("4. Optimize cache strategies based on hit rate analysis")
    else:
        print("\n❌ Benchmarks failed or were cancelled.")

if __name__ == "__main__":
    main()