#!/usr/bin/env python3
"""
Server-Side Timing Analysis Script

This script analyzes the actual server-side processing times by:
1. Extracting detailed timing information from API responses
2. Parsing Cloud Run logs to understand model initialization times
3. Breaking down processing by stage (model load, background removal, effects)
4. Comparing cache vs non-cache performance
5. Analyzing progressive loading effectiveness

This provides the ACTUAL measurements needed to understand the 60s cold start issue.
"""

import requests
import json
import time
import io
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import statistics

# Try to import PIL for image creation
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

@dataclass
class DetailedTiming:
    """Detailed timing breakdown from server response"""
    total_client_time: float
    total_server_time: Optional[float]
    background_removal_time: Optional[float]
    effects_processing_time: Optional[float]
    cache_lookup_time: Optional[float]
    model_initialization_time: Optional[float]
    network_time: float
    cache_hits: int
    cache_operations: int
    cold_start_detected: bool
    response_parsing_time: float

class ServerTimingAnalyzer:
    """Analyze server-side processing times with detailed breakdown"""
    
    def __init__(self):
        self.api_base_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"
        self.endpoints = {
            "health": f"{self.api_base_url}/health",
            "process_v2": f"{self.api_base_url}/api/v2/process-with-effects",
            "stats": f"{self.api_base_url}/api/v2/stats",
            "model_info": f"{self.api_base_url}/model-info"
        }
        
        # Create test image
        self.test_image = self.create_test_image()
        
    def create_test_image(self) -> io.BytesIO:
        """Create a standardized test image for consistent timing"""
        if PIL_AVAILABLE:
            # Create medium-sized image for consistent testing
            img = Image.new('RGB', (1500, 1000), color=(128, 64, 192))
            # Add some pattern to make it more realistic
            pixels = img.load()
            for x in range(0, img.width, 50):
                for y in range(0, img.height, 50):
                    pixels[x, y] = (255, 255, 255)
            
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=85)
            buf.seek(0)
            return buf
        else:
            # Look for existing test image
            test_paths = [
                Path(__file__).parent.parent / "backend/inspirenet-api/tests/Images/Rosie.jpg",
                Path(__file__).parent.parent / "IMG_2733.jpeg"
            ]
            
            for path in test_paths:
                if path.exists():
                    with open(path, 'rb') as f:
                        return io.BytesIO(f.read())
            
            raise RuntimeError("No test image available and PIL not installed")
    
    def trigger_cold_start(self) -> None:
        """Wait for API to go cold to ensure next request is a cold start"""
        print("🕐 Waiting for API to scale to 0 (cold start trigger)...")
        print("   This may take 2-3 minutes based on Cloud Run configuration...")
        
        # Wait long enough for API to scale down
        wait_time = 180  # 3 minutes
        for remaining in range(wait_time, 0, -10):
            mins, secs = divmod(remaining, 60)
            print(f"   Time remaining: {mins:02d}:{secs:02d}", end='\r')
            time.sleep(10)
        
        print(f"\\n✅ Cold start window ready. Next request should be cold.")
    
    def extract_detailed_timing(
        self, 
        client_start: float,
        client_end: float, 
        response: requests.Response
    ) -> DetailedTiming:
        """Extract detailed timing information from API response"""
        
        total_client_time = client_end - client_start
        network_time = total_client_time
        
        # Parse response for timing data
        response_parse_start = time.time()
        total_server_time = None
        background_removal_time = None
        effects_processing_time = None
        cache_lookup_time = None
        model_init_time = None
        cache_hits = 0
        cache_operations = 0
        
        # Extract from headers first
        if 'X-Processing-Time' in response.headers:
            try:
                total_server_time = float(response.headers['X-Processing-Time'])
                network_time = total_client_time - total_server_time
            except ValueError:
                pass
        
        if 'X-Cache-Hits' in response.headers:
            try:
                cache_hits = int(response.headers['X-Cache-Hits'])
            except ValueError:
                pass
        
        # Parse JSON response for detailed breakdown
        try:
            if response.headers.get('content-type', '').startswith('application/json'):
                json_data = response.json()
                
                # Extract processing time breakdown
                if 'processing_time' in json_data:
                    timing_data = json_data['processing_time']
                    
                    if 'total' in timing_data:
                        total_server_time = timing_data['total']
                        network_time = total_client_time - total_server_time
                    
                    if 'background_removal' in timing_data:
                        background_removal_time = timing_data['background_removal']
                    
                    if 'effects_processing' in timing_data:
                        effects_processing_time = timing_data['effects_processing']
                    
                    # Look for model initialization time (might be in different keys)
                    for key in ['model_initialization', 'model_load_time', 'cold_start_time']:
                        if key in timing_data:
                            model_init_time = timing_data[key]
                            break
                
                # Extract cache information
                if 'cache_info' in json_data:
                    cache_data = json_data['cache_info']
                    cache_hits = cache_data.get('total_cache_hits', 0)
                    cache_operations = cache_data.get('total_operations', 0)
                    
                    # Look for cache timing
                    if 'cache_lookup_time' in cache_data:
                        cache_lookup_time = cache_data['cache_lookup_time']
        
        except Exception as e:
            print(f"   Warning: Could not parse response JSON: {e}")
        
        response_parse_time = time.time() - response_parse_start
        
        # Detect cold start based on timing
        cold_start_detected = total_client_time > 25.0  # 25+ seconds indicates cold start
        
        return DetailedTiming(
            total_client_time=total_client_time,
            total_server_time=total_server_time,
            background_removal_time=background_removal_time,
            effects_processing_time=effects_processing_time,
            cache_lookup_time=cache_lookup_time,
            model_initialization_time=model_init_time,
            network_time=network_time,
            cache_hits=cache_hits,
            cache_operations=cache_operations,
            cold_start_detected=cold_start_detected,
            response_parsing_time=response_parse_time
        )
    
    def test_single_effect_timing(self, effect_name: str, use_cache: bool = True, label: str = "") -> DetailedTiming:
        """Test timing for a single effect with detailed measurement"""
        
        print(f"\n📊 Testing {effect_name} effect {label}")
        
        # Reset image buffer
        self.test_image.seek(0)
        
        # Prepare request
        params = {
            "effect": effect_name,
            "return_all_effects": "false",
            "output_format": "png",
            "use_cache": str(use_cache).lower()
        }
        
        files = {"file": ("test_image.jpg", self.test_image, "image/jpeg")}
        
        print(f"   Parameters: {params}")
        
        # Make request with precise timing
        client_start = time.time()
        
        try:
            response = requests.post(
                self.endpoints["process_v2"],
                params=params,
                files=files,
                timeout=120
            )
            
            client_end = time.time()
            
            # Extract detailed timing
            timing = self.extract_detailed_timing(client_start, client_end, response)
            
            # Print immediate results
            print(f"   ⏱️  Total client time: {timing.total_client_time:.2f}s")
            if timing.total_server_time:
                print(f"   🖥️  Server processing: {timing.total_server_time:.2f}s")
                print(f"   🌐 Network overhead: {timing.network_time:.2f}s")
            if timing.background_removal_time:
                print(f"   🎯 Background removal: {timing.background_removal_time:.2f}s")
            if timing.effects_processing_time:
                print(f"   🎨 Effects processing: {timing.effects_processing_time:.2f}s")
            if timing.model_initialization_time:
                print(f"   🚀 Model initialization: {timing.model_initialization_time:.2f}s")
            if timing.cache_lookup_time:
                print(f"   💾 Cache lookup: {timing.cache_lookup_time:.2f}s")
            
            print(f"   📊 Status: {response.status_code}")
            print(f"   💾 Cache: {timing.cache_hits}/{timing.cache_operations} hits")
            print(f"   🥶 Cold start: {'Yes' if timing.cold_start_detected else 'No'}")
            
            return timing
            
        except requests.exceptions.Timeout:
            print(f"   ❌ Request timed out after 120 seconds")
            return DetailedTiming(
                total_client_time=120.0,
                total_server_time=None,
                background_removal_time=None,
                effects_processing_time=None,
                cache_lookup_time=None,
                model_initialization_time=None,
                network_time=120.0,
                cache_hits=0,
                cache_operations=0,
                cold_start_detected=True,
                response_parsing_time=0.0
            )
        
        except Exception as e:
            print(f"   ❌ Request failed: {e}")
            return DetailedTiming(
                total_client_time=0.0,
                total_server_time=None,
                background_removal_time=None,
                effects_processing_time=None,
                cache_lookup_time=None,
                model_initialization_time=None,
                network_time=0.0,
                cache_hits=0,
                cache_operations=0,
                cold_start_detected=False,
                response_parsing_time=0.0
            )
    
    def test_multiple_effects_timing(self, effects: List[str], use_cache: bool = True, label: str = "") -> DetailedTiming:
        """Test timing for multiple effects processing"""
        
        print(f"\\n📊 Testing multiple effects {label}")
        
        # Reset image buffer
        self.test_image.seek(0)
        
        # Prepare request
        params = {
            "effects": ",".join(effects),
            "return_all_effects": "true",
            "output_format": "png",
            "use_cache": str(use_cache).lower()
        }
        
        files = {"file": ("test_image.jpg", self.test_image, "image/jpeg")}
        
        print(f"   Effects: {effects}")
        print(f"   Parameters: {params}")
        
        # Make request with precise timing
        client_start = time.time()
        
        try:
            response = requests.post(
                self.endpoints["process_v2"],
                params=params,
                files=files,
                timeout=120
            )
            
            client_end = time.time()
            
            # Extract detailed timing
            timing = self.extract_detailed_timing(client_start, client_end, response)
            
            # Print immediate results
            print(f"   ⏱️  Total client time: {timing.total_client_time:.2f}s")
            if timing.total_server_time:
                print(f"   🖥️  Server processing: {timing.total_server_time:.2f}s")
                print(f"   🌐 Network overhead: {timing.network_time:.2f}s")
            if timing.background_removal_time:
                print(f"   🎯 Background removal: {timing.background_removal_time:.2f}s")
            if timing.effects_processing_time:
                print(f"   🎨 Effects processing: {timing.effects_processing_time:.2f}s")
                if len(effects) > 1:
                    per_effect = timing.effects_processing_time / len(effects)
                    print(f"   🎨 Time per effect: {per_effect:.2f}s")
            if timing.model_initialization_time:
                print(f"   🚀 Model initialization: {timing.model_initialization_time:.2f}s")
            
            print(f"   📊 Status: {response.status_code}")
            print(f"   💾 Cache: {timing.cache_hits}/{timing.cache_operations} hits")
            print(f"   🥶 Cold start: {'Yes' if timing.cold_start_detected else 'No'}")
            
            return timing
            
        except Exception as e:
            print(f"   ❌ Request failed: {e}")
            return DetailedTiming(
                total_client_time=0.0,
                total_server_time=None,
                background_removal_time=None,
                effects_processing_time=None,
                cache_lookup_time=None,
                model_initialization_time=None,
                network_time=0.0,
                cache_hits=0,
                cache_operations=0,
                cold_start_detected=False,
                response_parsing_time=0.0
            )
    
    def analyze_progressive_loading(self) -> Dict[str, Any]:
        """Analyze progressive loading vs batch processing performance"""
        
        print("\\n" + "="*80)
        print("📈 PROGRESSIVE LOADING ANALYSIS")
        print("="*80)
        
        effects_list = ["enhancedblackwhite", "popart", "dithering", "color"]
        
        # Warm up API first
        print("🔥 Warming up API...")
        warmup = self.test_single_effect_timing("enhancedblackwhite", use_cache=True, label="(warmup)")
        time.sleep(2)
        
        # Test 1: Batch processing (all effects at once)
        print("\\n--- BATCH PROCESSING (All 4 effects at once) ---")
        batch_timing = self.test_multiple_effects_timing(effects_list, use_cache=True, label="(batch)")
        
        # Test 2: Progressive loading (1 + 3 background requests)
        print("\\n--- PROGRESSIVE LOADING (1 initial + 3 background) ---")
        
        # Initial effect
        initial_timing = self.test_single_effect_timing("enhancedblackwhite", use_cache=True, label="(progressive initial)")
        
        # Background effects (should use cached background removal)
        background_timings = []
        for i, effect in enumerate(["popart", "dithering", "color"]):
            bg_timing = self.test_single_effect_timing(effect, use_cache=True, label=f"(progressive bg {i+1})")
            background_timings.append(bg_timing)
            time.sleep(0.5)  # Small delay between requests
        
        # Calculate progressive totals
        progressive_total_time = initial_timing.total_client_time + sum(t.total_client_time for t in background_timings)
        progressive_server_time = (initial_timing.total_server_time or 0) + sum(t.total_server_time or 0 for t in background_timings)
        
        # Analysis
        analysis = {
            "batch_processing": {
                "total_time": batch_timing.total_client_time,
                "server_time": batch_timing.total_server_time,
                "background_removal_time": batch_timing.background_removal_time,
                "effects_processing_time": batch_timing.effects_processing_time,
                "cache_hits": batch_timing.cache_hits,
                "cache_operations": batch_timing.cache_operations
            },
            "progressive_loading": {
                "total_time": progressive_total_time,
                "server_time": progressive_server_time,
                "initial_effect_time": initial_timing.total_client_time,
                "background_effects_time": sum(t.total_client_time for t in background_timings),
                "average_background_effect_time": statistics.mean([t.total_client_time for t in background_timings]),
                "total_cache_hits": initial_timing.cache_hits + sum(t.cache_hits for t in background_timings),
                "requests_count": 4
            },
            "comparison": {
                "time_difference": progressive_total_time - batch_timing.total_client_time,
                "batch_faster": batch_timing.total_client_time < progressive_total_time,
                "time_savings_batch": max(0, progressive_total_time - batch_timing.total_client_time),
                "overhead_progressive": max(0, progressive_total_time - batch_timing.total_client_time)
            }
        }
        
        # Print analysis
        print("\\n" + "="*60)
        print("📊 PROGRESSIVE LOADING ANALYSIS RESULTS")
        print("="*60)
        
        print(f"\\n🔄 Batch Processing (All at once):")
        print(f"   Total time: {batch_timing.total_client_time:.2f}s")
        if batch_timing.total_server_time:
            print(f"   Server time: {batch_timing.total_server_time:.2f}s")
        print(f"   Cache hits: {batch_timing.cache_hits}/{batch_timing.cache_operations}")
        
        print(f"\\n📈 Progressive Loading (1 + 3 background):")
        print(f"   Total time: {progressive_total_time:.2f}s")
        print(f"   Initial effect: {initial_timing.total_client_time:.2f}s")
        print(f"   Background effects: {sum(t.total_client_time for t in background_timings):.2f}s")
        print(f"   Average per background effect: {statistics.mean([t.total_client_time for t in background_timings]):.2f}s")
        print(f"   Total requests: 4")
        
        print(f"\\n⚖️  Comparison:")
        if analysis["comparison"]["batch_faster"]:
            print(f"   🏆 Batch processing is FASTER by {analysis['comparison']['time_savings_batch']:.2f}s")
            print(f"   Progressive loading overhead: {analysis['comparison']['overhead_progressive']:.2f}s")
        else:
            print(f"   🏆 Progressive loading is FASTER by {-analysis['comparison']['time_difference']:.2f}s")
        
        return analysis
    
    def analyze_cold_start_breakdown(self) -> Dict[str, Any]:
        """Analyze what happens during a cold start"""
        
        print("\\n" + "="*80)
        print("🥶 COLD START BREAKDOWN ANALYSIS")
        print("="*80)
        
        # Trigger cold start
        self.trigger_cold_start()
        
        # Test cold start with single effect
        print("\\n--- COLD START: Single Effect ---")
        cold_single = self.test_single_effect_timing("enhancedblackwhite", use_cache=True, label="(cold start single)")
        
        # Wait for another cold start
        self.trigger_cold_start()
        
        # Test cold start with all effects
        print("\\n--- COLD START: All Effects ---")
        cold_all = self.test_multiple_effects_timing(
            ["enhancedblackwhite", "popart", "dithering", "color"], 
            use_cache=True, 
            label="(cold start all)"
        )
        
        analysis = {
            "cold_start_single_effect": {
                "total_time": cold_single.total_client_time,
                "server_time": cold_single.total_server_time,
                "background_removal": cold_single.background_removal_time,
                "effects_processing": cold_single.effects_processing_time,
                "model_initialization": cold_single.model_initialization_time,
                "cold_start_detected": cold_single.cold_start_detected
            },
            "cold_start_all_effects": {
                "total_time": cold_all.total_client_time,
                "server_time": cold_all.total_server_time,
                "background_removal": cold_all.background_removal_time,
                "effects_processing": cold_all.effects_processing_time,
                "model_initialization": cold_all.model_initialization_time,
                "cold_start_detected": cold_all.cold_start_detected
            }
        }
        
        print("\\n" + "="*60)
        print("🥶 COLD START ANALYSIS RESULTS")
        print("="*60)
        
        print(f"\\n❄️  Cold Start - Single Effect:")
        print(f"   Total time: {cold_single.total_client_time:.2f}s")
        if cold_single.total_server_time:
            print(f"   Server time: {cold_single.total_server_time:.2f}s")
        if cold_single.model_initialization_time:
            print(f"   Model init: {cold_single.model_initialization_time:.2f}s")
        if cold_single.background_removal_time:
            print(f"   Background removal: {cold_single.background_removal_time:.2f}s")
        if cold_single.effects_processing_time:
            print(f"   Effects processing: {cold_single.effects_processing_time:.2f}s")
        
        print(f"\\n❄️  Cold Start - All Effects:")
        print(f"   Total time: {cold_all.total_client_time:.2f}s")
        if cold_all.total_server_time:
            print(f"   Server time: {cold_all.total_server_time:.2f}s")
        if cold_all.model_initialization_time:
            print(f"   Model init: {cold_all.model_initialization_time:.2f}s")
        if cold_all.background_removal_time:
            print(f"   Background removal: {cold_all.background_removal_time:.2f}s")
        if cold_all.effects_processing_time:
            print(f"   Effects processing: {cold_all.effects_processing_time:.2f}s")
            
        return analysis
    
    def run_comprehensive_timing_analysis(self) -> Dict[str, Any]:
        """Run comprehensive server timing analysis"""
        
        print("🔍 Server-Side Timing Analysis - InSPyReNet API")
        print("="*80)
        print("This analysis will measure ACTUAL server processing times")
        print("to understand the 60-second cold start issue breakdown.")
        print()
        
        # Check API health
        try:
            health_response = requests.get(self.endpoints["health"], timeout=10)
            if health_response.status_code != 200:
                print(f"❌ API health check failed: {health_response.status_code}")
                return {}
            print("✅ API health check passed")
        except Exception as e:
            print(f"❌ Cannot reach API: {e}")
            return {}
        
        results = {}
        
        try:
            # 1. Progressive loading analysis
            results["progressive_analysis"] = self.analyze_progressive_loading()
            
            # 2. Cold start breakdown analysis
            results["cold_start_analysis"] = self.analyze_cold_start_breakdown()
            
            # 3. Save results
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"server_timing_analysis_{timestamp}.json"
            output_path = Path(__file__).parent / filename
            
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            print(f"\\n💾 Analysis results saved to: {output_path}")
            
            # 4. Generate summary report
            self.generate_summary_report(results)
            
            return results
            
        except KeyboardInterrupt:
            print("\\n⚠️  Analysis interrupted by user")
            return results
        
        except Exception as e:
            print(f"\\n❌ Analysis failed: {e}")
            return results
    
    def generate_summary_report(self, results: Dict[str, Any]) -> None:
        """Generate human-readable summary report"""
        
        print("\\n" + "="*80)
        print("📋 EXECUTIVE SUMMARY - API PERFORMANCE ANALYSIS")
        print("="*80)
        
        # Progressive loading findings
        if "progressive_analysis" in results:
            prog = results["progressive_analysis"]
            batch_time = prog["batch_processing"]["total_time"]
            progressive_time = prog["progressive_loading"]["total_time"]
            
            print(f"\\n🔄 Progressive Loading vs Batch Processing:")
            print(f"   Batch (all at once): {batch_time:.1f}s")
            print(f"   Progressive (1+3): {progressive_time:.1f}s")
            
            if prog["comparison"]["batch_faster"]:
                print(f"   ✅ RECOMMENDATION: Use batch processing (saves {prog['comparison']['time_savings_batch']:.1f}s)")
            else:
                print(f"   ✅ RECOMMENDATION: Progressive loading is effective")
        
        # Cold start findings
        if "cold_start_analysis" in results:
            cold = results["cold_start_analysis"]
            single_cold = cold["cold_start_single_effect"]["total_time"]
            all_cold = cold["cold_start_all_effects"]["total_time"]
            
            print(f"\\n🥶 Cold Start Performance:")
            print(f"   Single effect cold start: {single_cold:.1f}s")
            print(f"   All effects cold start: {all_cold:.1f}s")
            
            if single_cold > 30:
                print(f"   ⚠️  CRITICAL: Cold starts exceed 30s - consider minScale=1")
            if all_cold > 60:
                print(f"   🚨 URGENT: All effects cold start exceeds 60s - immediate optimization needed")
        
        print(f"\\n💡 Key Recommendations:")
        print(f"   1. Monitor Cloud Run configuration (minScale setting)")
        print(f"   2. Consider GPU vs CPU performance trade-offs")
        print(f"   3. Implement frontend warming strategies")
        print(f"   4. Review model loading optimization opportunities")
        print(f"   5. Consider effect processing parallelization")

def main():
    """Main execution function"""
    print("Perkie Prints - Server-Side Timing Analysis")
    print("="*50)
    print("This analysis will extract detailed server processing times")
    print("to understand exactly where the 60-second delays occur.")
    print()
    print("WARNING: This will trigger multiple cold starts!")
    print("Each cold start may incur Cloud Run charges.")
    print()
    
    confirm = input("Continue with timing analysis? (y/N): ").strip().lower()
    if confirm != 'y':
        print("Analysis cancelled.")
        return
    
    analyzer = ServerTimingAnalyzer()
    results = analyzer.run_comprehensive_timing_analysis()
    
    if results:
        print("\\n🎉 Server timing analysis completed!")
        print("Review the summary above for key findings and recommendations.")
    else:
        print("\\n❌ Analysis failed or was incomplete.")

if __name__ == "__main__":
    main()