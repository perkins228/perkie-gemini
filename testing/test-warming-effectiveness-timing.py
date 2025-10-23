#!/usr/bin/env python3
"""
End-to-End Timing Test for Upload Button Warming Strategy Effectiveness

This script measures the actual cold start reduction achieved by the warming strategy
by comparing processing times before and after implementing the warming flow.

Key measurements:
1. Cold start processing time (without warming)
2. Warm start processing time (after warming)
3. Warming overhead time
4. Overall effectiveness metrics

Usage:
    python test-warming-effectiveness-timing.py --api-url https://your-api.com
    python test-warming-effectiveness-timing.py --local  # For local testing
"""

import os
import sys
import time
import requests
import json
import argparse
import statistics
import concurrent.futures
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import threading
from io import BytesIO
import base64

class WarmingEffectivenessTester:
    """End-to-end timing tester for warming strategy effectiveness"""
    
    def __init__(self, api_url: str, verbose: bool = True):
        self.api_url = api_url.rstrip('/')
        self.verbose = verbose
        self.session = requests.Session()
        
        # Test configuration
        self.test_image_sizes = [1, 100, 500]  # KB sizes for different test scenarios
        self.iterations_per_test = 5
        self.cooldown_time = 90  # seconds between cold start tests
        self.warmup_timeout = 120  # seconds
        self.processing_timeout = 180  # seconds
        
        # Results storage
        self.results = {
            'cold_start_times': [],
            'warm_start_times': [],
            'warmup_times': [],
            'health_check_times': [],
            'metadata': {
                'api_url': api_url,
                'test_start': datetime.now().isoformat(),
                'iterations': self.iterations_per_test,
                'cooldown_time': self.cooldown_time
            }
        }
        
        if self.verbose:
            print(f"🔥 Warming Effectiveness Tester Initialized")
            print(f"   API URL: {self.api_url}")
            print(f"   Iterations per test: {self.iterations_per_test}")
            print(f"   Cooldown time: {self.cooldown_time}s")
            print("")

    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp"""
        if not self.verbose:
            return
            
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        prefix = {
            "INFO": "ℹ️", 
            "SUCCESS": "✅", 
            "ERROR": "❌", 
            "WARNING": "⚠️",
            "TIMING": "⏱️",
            "PROGRESS": "📊"
        }.get(level, "📝")
        
        print(f"[{timestamp}] {prefix} {message}")

    def create_test_image(self, size_kb: int = 1) -> bytes:
        """Create a test image of specified size in KB"""
        # Create a minimal PNG and pad it to reach desired size
        # PNG header + minimal image data
        base_png = (
            b'\x89PNG\r\n\x1a\n'  # PNG signature
            b'\x00\x00\x00\rIHDR'  # IHDR chunk
            b'\x00\x00\x00\x01'    # Width: 1
            b'\x00\x00\x00\x01'    # Height: 1
            b'\x08\x02'            # Bit depth: 8, Color type: 2 (RGB)
            b'\x00\x00\x00'        # Compression, filter, interlace
            b'\x90wS\xde'          # CRC
            b'\x00\x00\x00\x0cIDAT'  # IDAT chunk
            b'x\x9cc```\x00\x00\x00\x04\x00\x01'  # Compressed image data
            b'\xdd\x8d\xb4\x1c'    # CRC
            b'\x00\x00\x00\x00IEND'  # IEND chunk
            b'\xaeB`\x82'          # CRC
        )
        
        # Pad to reach desired size
        target_bytes = size_kb * 1024
        current_size = len(base_png)
        
        if target_bytes > current_size:
            padding = b'\x00' * (target_bytes - current_size)
            return base_png + padding
        
        return base_png

    async def check_api_health(self) -> Tuple[bool, Dict, float]:
        """Check API health and return status with timing"""
        start_time = time.time()
        
        try:
            response = self.session.get(
                f"{self.api_url}/health",
                timeout=15
            )
            
            response_time = time.time() - start_time
            self.results['health_check_times'].append(response_time)
            
            if response.status_code == 200:
                health_data = response.json()
                model_ready = health_data.get('model', {}).get('ready', False)
                
                self.log(f"Health check: {response_time:.3f}s - Model ready: {model_ready}")
                return True, health_data, response_time
            else:
                self.log(f"Health check failed: HTTP {response.status_code}", "ERROR")
                return False, {}, response_time
                
        except Exception as e:
            response_time = time.time() - start_time
            self.log(f"Health check error after {response_time:.3f}s: {e}", "ERROR")
            return False, {}, response_time

    def trigger_warmup(self) -> Tuple[bool, Dict, float]:
        """Trigger API warmup and measure timing"""
        start_time = time.time()
        
        try:
            response = self.session.post(
                f"{self.api_url}/warmup",
                headers={'Content-Type': 'application/json'},
                timeout=self.warmup_timeout
            )
            
            response_time = time.time() - start_time
            self.results['warmup_times'].append(response_time)
            
            if response.status_code == 200:
                warmup_data = response.json()
                model_ready = warmup_data.get('model_ready', False)
                
                self.log(f"Warmup completed: {response_time:.3f}s - Model ready: {model_ready}", "SUCCESS")
                return True, warmup_data, response_time
            else:
                self.log(f"Warmup failed: HTTP {response.status_code}", "ERROR")
                return False, {}, response_time
                
        except Exception as e:
            response_time = time.time() - start_time
            self.log(f"Warmup error after {response_time:.3f}s: {e}", "ERROR")
            return False, {}, response_time

    def process_image(self, image_data: bytes, test_type: str = "timing_test") -> Tuple[bool, Dict, float]:
        """Process an image and measure timing"""
        start_time = time.time()
        
        try:
            files = {'file': (f'{test_type}.png', image_data, 'image/png')}
            data = {
                'effects': 'enhancedblackwhite',
                'session_id': f'{test_type}_{int(time.time())}'
            }
            
            response = self.session.post(
                f"{self.api_url}/api/v2/process-with-effects",
                files=files,
                data=data,
                timeout=self.processing_timeout
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                result_data = response.json()
                processing_time = result_data.get('processing_time', response_time)
                
                self.log(f"Processing completed: {response_time:.3f}s (server: {processing_time}s)", "SUCCESS")
                return True, result_data, response_time
            else:
                self.log(f"Processing failed: HTTP {response.status_code}", "ERROR")
                return False, {}, response_time
                
        except Exception as e:
            response_time = time.time() - start_time
            self.log(f"Processing error after {response_time:.3f}s: {e}", "ERROR")
            return False, {}, response_time

    def wait_for_cooldown(self, seconds: int):
        """Wait for API to cool down"""
        self.log(f"⏳ Waiting {seconds}s for API cooldown...")
        
        for i in range(seconds):
            if i % 15 == 0 and i > 0:  # Log every 15 seconds
                remaining = seconds - i
                self.log(f"   Cooldown: {remaining}s remaining")
            time.sleep(1)
        
        self.log("Cooldown completed", "SUCCESS")

    def test_cold_start_performance(self, image_size_kb: int = 1) -> List[float]:
        """Test cold start performance with multiple iterations"""
        self.log(f"🧊 Testing cold start performance ({image_size_kb}KB image)...", "TIMING")
        
        cold_start_times = []
        test_image = self.create_test_image(image_size_kb)
        
        for iteration in range(self.iterations_per_test):
            self.log(f"   Cold start iteration {iteration + 1}/{self.iterations_per_test}")
            
            # Wait for cooldown if not first iteration
            if iteration > 0:
                self.wait_for_cooldown(self.cooldown_time)
            
            # Verify API is cold
            health_ok, health_data, _ = self.check_api_health()
            if health_ok:
                model_ready = health_data.get('model', {}).get('ready', False)
                if model_ready:
                    self.log("   ⚠️ Model appears to be warm, results may be skewed", "WARNING")
            
            # Process image (cold start)
            success, result_data, response_time = self.process_image(
                test_image, f"cold_start_{iteration}"
            )
            
            if success:
                cold_start_times.append(response_time)
                self.results['cold_start_times'].append(response_time)
            else:
                self.log(f"   ❌ Cold start iteration {iteration + 1} failed", "ERROR")
        
        if cold_start_times:
            avg_time = statistics.mean(cold_start_times)
            self.log(f"Cold start average: {avg_time:.3f}s ({len(cold_start_times)} samples)", "TIMING")
        
        return cold_start_times

    def test_warm_start_performance(self, image_size_kb: int = 1) -> List[float]:
        """Test warm start performance after warming"""
        self.log(f"🔥 Testing warm start performance ({image_size_kb}KB image)...", "TIMING")
        
        warm_start_times = []
        test_image = self.create_test_image(image_size_kb)
        
        for iteration in range(self.iterations_per_test):
            self.log(f"   Warm start iteration {iteration + 1}/{self.iterations_per_test}")
            
            # Trigger warmup before each test
            warmup_success, warmup_data, warmup_time = self.trigger_warmup()
            
            if not warmup_success:
                self.log(f"   ❌ Warmup failed for iteration {iteration + 1}", "ERROR")
                continue
            
            # Small delay to ensure warmup is complete
            time.sleep(2)
            
            # Verify API is warm
            health_ok, health_data, _ = self.check_api_health()
            if health_ok:
                model_ready = health_data.get('model', {}).get('ready', False)
                if not model_ready:
                    self.log("   ⚠️ Model not ready after warmup", "WARNING")
            
            # Process image (warm start)
            success, result_data, response_time = self.process_image(
                test_image, f"warm_start_{iteration}"
            )
            
            if success:
                warm_start_times.append(response_time)
                self.results['warm_start_times'].append(response_time)
            else:
                self.log(f"   ❌ Warm start iteration {iteration + 1} failed", "ERROR")
        
        if warm_start_times:
            avg_time = statistics.mean(warm_start_times)
            self.log(f"Warm start average: {avg_time:.3f}s ({len(warm_start_times)} samples)", "TIMING")
        
        return warm_start_times

    def calculate_effectiveness_metrics(self) -> Dict:
        """Calculate comprehensive effectiveness metrics"""
        metrics = {}
        
        cold_times = self.results['cold_start_times']
        warm_times = self.results['warm_start_times']
        warmup_times = self.results['warmup_times']
        
        if cold_times:
            metrics['cold_start'] = {
                'mean': statistics.mean(cold_times),
                'median': statistics.median(cold_times),
                'min': min(cold_times),
                'max': max(cold_times),
                'std_dev': statistics.stdev(cold_times) if len(cold_times) > 1 else 0,
                'samples': len(cold_times)
            }
        
        if warm_times:
            metrics['warm_start'] = {
                'mean': statistics.mean(warm_times),
                'median': statistics.median(warm_times),
                'min': min(warm_times),
                'max': max(warm_times),
                'std_dev': statistics.stdev(warm_times) if len(warm_times) > 1 else 0,
                'samples': len(warm_times)
            }
        
        if warmup_times:
            metrics['warmup'] = {
                'mean': statistics.mean(warmup_times),
                'median': statistics.median(warmup_times),
                'min': min(warmup_times),
                'max': max(warmup_times),
                'std_dev': statistics.stdev(warmup_times) if len(warmup_times) > 1 else 0,
                'samples': len(warmup_times)
            }
        
        # Calculate improvement metrics
        if cold_times and warm_times:
            cold_mean = statistics.mean(cold_times)
            warm_mean = statistics.mean(warm_times)
            
            improvement_percent = ((cold_mean - warm_mean) / cold_mean) * 100
            time_saved = cold_mean - warm_mean
            
            metrics['improvement'] = {
                'time_saved_seconds': time_saved,
                'improvement_percent': improvement_percent,
                'speedup_factor': cold_mean / warm_mean if warm_mean > 0 else 0
            }
            
            # Effectiveness rating
            if improvement_percent > 70:
                effectiveness = "EXCELLENT"
            elif improvement_percent > 50:
                effectiveness = "VERY_GOOD"
            elif improvement_percent > 30:
                effectiveness = "GOOD"
            elif improvement_percent > 15:
                effectiveness = "MODERATE"
            else:
                effectiveness = "POOR"
                
            metrics['effectiveness_rating'] = effectiveness
        
        return metrics

    def generate_detailed_report(self) -> str:
        """Generate comprehensive effectiveness report"""
        metrics = self.calculate_effectiveness_metrics()
        
        report = []
        report.append("🔥 UPLOAD BUTTON WARMING EFFECTIVENESS REPORT")
        report.append("=" * 70)
        report.append("")
        
        # Test Configuration
        report.append("⚙️ TEST CONFIGURATION:")
        report.append("-" * 40)
        report.append(f"API URL: {self.results['metadata']['api_url']}")
        report.append(f"Test Duration: {datetime.now().isoformat()}")
        report.append(f"Iterations per test: {self.results['metadata']['iterations']}")
        report.append(f"Cooldown time: {self.results['metadata']['cooldown_time']}s")
        report.append("")
        
        # Cold Start Performance
        if 'cold_start' in metrics:
            cold = metrics['cold_start']
            report.append("🧊 COLD START PERFORMANCE:")
            report.append("-" * 40)
            report.append(f"Mean Time: {cold['mean']:.3f}s")
            report.append(f"Median Time: {cold['median']:.3f}s")
            report.append(f"Min Time: {cold['min']:.3f}s")
            report.append(f"Max Time: {cold['max']:.3f}s")
            report.append(f"Standard Deviation: {cold['std_dev']:.3f}s")
            report.append(f"Samples: {cold['samples']}")
            report.append("")
        
        # Warm Start Performance
        if 'warm_start' in metrics:
            warm = metrics['warm_start']
            report.append("🔥 WARM START PERFORMANCE:")
            report.append("-" * 40)
            report.append(f"Mean Time: {warm['mean']:.3f}s")
            report.append(f"Median Time: {warm['median']:.3f}s")
            report.append(f"Min Time: {warm['min']:.3f}s")
            report.append(f"Max Time: {warm['max']:.3f}s")
            report.append(f"Standard Deviation: {warm['std_dev']:.3f}s")
            report.append(f"Samples: {warm['samples']}")
            report.append("")
        
        # Warmup Performance
        if 'warmup' in metrics:
            warmup = metrics['warmup']
            report.append("⚡ WARMUP PERFORMANCE:")
            report.append("-" * 40)
            report.append(f"Mean Time: {warmup['mean']:.3f}s")
            report.append(f"Median Time: {warmup['median']:.3f}s")
            report.append(f"Min Time: {warmup['min']:.3f}s")
            report.append(f"Max Time: {warmup['max']:.3f}s")
            report.append(f"Standard Deviation: {warmup['std_dev']:.3f}s")
            report.append(f"Samples: {warmup['samples']}")
            report.append("")
        
        # Effectiveness Analysis
        if 'improvement' in metrics:
            imp = metrics['improvement']
            report.append("📊 EFFECTIVENESS ANALYSIS:")
            report.append("-" * 40)
            report.append(f"Time Saved: {imp['time_saved_seconds']:.3f}s")
            report.append(f"Performance Improvement: {imp['improvement_percent']:.1f}%")
            report.append(f"Speedup Factor: {imp['speedup_factor']:.2f}x")
            report.append(f"Effectiveness Rating: {metrics['effectiveness_rating']}")
            report.append("")
        
        # Recommendations
        report.append("💡 RECOMMENDATIONS:")
        report.append("-" * 40)
        
        if 'improvement' in metrics:
            improvement = metrics['improvement']['improvement_percent']
            
            if improvement > 70:
                report.append("✅ EXCELLENT performance improvement!")
                report.append("   → Deploy warming strategy to production immediately")
                report.append("   → Monitor real-world performance metrics")
                report.append("   → Consider implementing additional optimizations")
                
            elif improvement > 50:
                report.append("✅ VERY GOOD performance improvement!")
                report.append("   → Deploy warming strategy to production")
                report.append("   → Set up performance monitoring")
                report.append("   → Document optimization for team")
                
            elif improvement > 30:
                report.append("✅ GOOD performance improvement!")
                report.append("   → Deploy warming strategy with monitoring")
                report.append("   → Consider A/B testing in production")
                report.append("   → Look for additional optimization opportunities")
                
            elif improvement > 15:
                report.append("⚠️ MODERATE performance improvement")
                report.append("   → Consider deploying with careful monitoring")
                report.append("   → Investigate potential optimizations")
                report.append("   → May need architectural improvements")
                
            else:
                report.append("❌ POOR performance improvement")
                report.append("   → Do not deploy current warming strategy")
                report.append("   → Investigate root causes of poor performance")
                report.append("   → Consider alternative warming approaches")
        
        # Technical Analysis
        report.append("")
        report.append("🔬 TECHNICAL ANALYSIS:")
        report.append("-" * 40)
        
        if 'warmup' in metrics and 'warm_start' in metrics:
            warmup_mean = metrics['warmup']['mean']
            warm_mean = metrics['warm_start']['mean']
            
            if warmup_mean > warm_mean * 10:
                report.append("⚠️ Warmup time is very high relative to processing time")
                report.append("   → Investigate model loading optimization")
                
            if warm_mean < 5:
                report.append("✅ Warm processing times are excellent (<5s)")
            elif warm_mean < 10:
                report.append("✅ Warm processing times are good (<10s)")
            else:
                report.append("⚠️ Warm processing times could be improved (>10s)")
        
        if 'cold_start' in metrics:
            cold_std = metrics['cold_start']['std_dev']
            cold_mean = metrics['cold_start']['mean']
            
            if cold_std > cold_mean * 0.3:  # High variability
                report.append("⚠️ High variability in cold start times")
                report.append("   → May indicate inconsistent infrastructure performance")
        
        report.append("")
        report.append(f"📅 Report generated: {datetime.now().isoformat()}")
        
        return "\n".join(report)

    def save_results_to_file(self, filename: str = None):
        """Save detailed results to JSON file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"warming_effectiveness_results_{timestamp}.json"
        
        # Add metrics to results
        self.results['metrics'] = self.calculate_effectiveness_metrics()
        self.results['metadata']['test_end'] = datetime.now().isoformat()
        
        try:
            with open(filename, 'w') as f:
                json.dump(self.results, f, indent=2)
            
            self.log(f"Results saved to: {filename}", "SUCCESS")
            return filename
            
        except Exception as e:
            self.log(f"Failed to save results: {e}", "ERROR")
            return None

    def run_comprehensive_effectiveness_test(self) -> Dict:
        """Run the complete effectiveness test suite"""
        self.log("🚀 Starting comprehensive warming effectiveness test...", "PROGRESS")
        
        try:
            # Initial API health check
            self.log("🔍 Initial API health assessment...")
            health_ok, health_data, _ = self.check_api_health()
            
            if not health_ok:
                self.log("❌ API is not responding, cannot run tests", "ERROR")
                return {'success': False, 'error': 'API not responding'}
            
            # Test cold start performance
            self.log("\n" + "=" * 60)
            self.log("🧊 COLD START PERFORMANCE TEST")
            self.log("=" * 60)
            
            cold_times = self.test_cold_start_performance(image_size_kb=1)
            
            if not cold_times:
                self.log("❌ No successful cold start measurements", "ERROR")
                return {'success': False, 'error': 'Cold start tests failed'}
            
            # Test warm start performance
            self.log("\n" + "=" * 60)
            self.log("🔥 WARM START PERFORMANCE TEST")
            self.log("=" * 60)
            
            warm_times = self.test_warm_start_performance(image_size_kb=1)
            
            if not warm_times:
                self.log("❌ No successful warm start measurements", "ERROR")
                return {'success': False, 'error': 'Warm start tests failed'}
            
            # Generate analysis
            self.log("\n" + "=" * 60)
            self.log("📊 GENERATING EFFECTIVENESS ANALYSIS")
            self.log("=" * 60)
            
            metrics = self.calculate_effectiveness_metrics()
            report = self.generate_detailed_report()
            
            # Print report
            print("\n" + report)
            
            # Save results
            results_file = self.save_results_to_file()
            
            # Final summary
            if 'improvement' in metrics:
                improvement = metrics['improvement']['improvement_percent']
                time_saved = metrics['improvement']['time_saved_seconds']
                rating = metrics['effectiveness_rating']
                
                self.log(f"\n🎯 FINAL RESULTS:", "SUCCESS")
                self.log(f"   Performance Improvement: {improvement:.1f}%")
                self.log(f"   Time Saved: {time_saved:.3f}s")
                self.log(f"   Effectiveness Rating: {rating}")
                
                return {
                    'success': True,
                    'improvement_percent': improvement,
                    'time_saved_seconds': time_saved,
                    'effectiveness_rating': rating,
                    'metrics': metrics,
                    'results_file': results_file
                }
            else:
                return {'success': False, 'error': 'Could not calculate improvement metrics'}
                
        except Exception as e:
            self.log(f"❌ Comprehensive test failed: {e}", "ERROR")
            return {'success': False, 'error': str(e)}


def main():
    """Main test execution function"""
    parser = argparse.ArgumentParser(
        description='End-to-End Warming Effectiveness Tester',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test-warming-effectiveness-timing.py --api-url https://your-api.com
  python test-warming-effectiveness-timing.py --local --iterations 3
  python test-warming-effectiveness-timing.py --production --detailed
        """
    )
    
    parser.add_argument(
        '--api-url', 
        default='http://localhost:8080',
        help='API base URL (default: http://localhost:8080)'
    )
    parser.add_argument(
        '--local', 
        action='store_true',
        help='Use localhost:8080 for testing'
    )
    parser.add_argument(
        '--production', 
        action='store_true',
        help='Use production API URL'
    )
    parser.add_argument(
        '--iterations', 
        type=int, 
        default=5,
        help='Number of iterations per test (default: 5)'
    )
    parser.add_argument(
        '--cooldown', 
        type=int, 
        default=90,
        help='Cooldown time between tests in seconds (default: 90)'
    )
    parser.add_argument(
        '--quiet', 
        action='store_true',
        help='Reduce output verbosity'
    )
    parser.add_argument(
        '--save-results', 
        help='Save results to specific file'
    )
    
    args = parser.parse_args()
    
    # Determine API URL
    if args.local:
        api_url = 'http://localhost:8080'
    elif args.production:
        api_url = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app'
    else:
        api_url = args.api_url
    
    # Initialize tester
    tester = WarmingEffectivenessTester(
        api_url=api_url,
        verbose=not args.quiet
    )
    
    # Override configuration if specified
    tester.iterations_per_test = args.iterations
    tester.cooldown_time = args.cooldown
    
    # Run comprehensive test
    results = tester.run_comprehensive_effectiveness_test()
    
    # Save results if requested
    if args.save_results:
        tester.save_results_to_file(args.save_results)
    
    # Print final results and exit with appropriate code
    if results['success']:
        improvement = results.get('improvement_percent', 0)
        
        print(f"\n🎯 TEST COMPLETED SUCCESSFULLY!")
        print(f"   Warming strategy achieved {improvement:.1f}% improvement")
        print(f"   Effectiveness rating: {results.get('effectiveness_rating', 'UNKNOWN')}")
        
        # Exit code based on effectiveness
        if improvement > 30:
            exit(0)  # Success
        elif improvement > 15:
            exit(1)  # Moderate improvement
        else:
            exit(2)  # Poor improvement
    else:
        print(f"\n❌ TEST FAILED: {results.get('error', 'Unknown error')}")
        exit(3)


if __name__ == "__main__":
    main()