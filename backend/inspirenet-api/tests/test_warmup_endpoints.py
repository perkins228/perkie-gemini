"""
Comprehensive tests for the upload-button warming strategy API endpoints.
Tests /health and /warmup endpoints to ensure proper warming functionality.
"""

import os
import sys
import time
import requests
import json
import concurrent.futures
from typing import Dict, List, Optional, Tuple
import threading
from datetime import datetime

# Add src directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

class WarmupEndpointTester:
    """Comprehensive tester for warmup strategy API endpoints"""
    
    def __init__(self, api_url: str = None):
        self.api_url = api_url or os.getenv('API_URL', 'http://localhost:8080')
        self.session = requests.Session()
        self.test_results = []
        self.metrics = {
            'health_response_times': [],
            'warmup_response_times': [],
            'cold_start_times': [],
            'warm_start_times': []
        }
        
        # Test configuration
        self.health_timeout = 15  # seconds
        self.warmup_timeout = 90  # seconds
        self.processing_timeout = 120  # seconds
        
        print(f"🔥 Warmup Endpoint Tester initialized")
        print(f"   API URL: {self.api_url}")
        print(f"   Timeouts: Health={self.health_timeout}s, Warmup={self.warmup_timeout}s")
        print("")

    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        prefix = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "WARNING": "⚠️"}.get(level, "📝")
        print(f"[{timestamp}] {prefix} {message}")

    def test_health_endpoint_basic(self) -> Dict:
        """Test basic health endpoint functionality"""
        self.log("Testing health endpoint basic functionality...")
        
        start_time = time.time()
        
        try:
            response = self.session.get(
                f"{self.api_url}/health",
                timeout=self.health_timeout
            )
            
            response_time = time.time() - start_time
            self.metrics['health_response_times'].append(response_time)
            
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
            
            health_data = response.json()
            
            # Validate response structure
            required_fields = ['status', 'timestamp', 'model', 'memory', 'endpoints']
            missing_fields = [field for field in required_fields if field not in health_data]
            
            if missing_fields:
                raise Exception(f"Missing required fields: {missing_fields}")
            
            # Validate model information
            model_info = health_data.get('model', {})
            required_model_fields = ['status', 'ready', 'loading']
            missing_model_fields = [field for field in required_model_fields if field not in model_info]
            
            if missing_model_fields:
                raise Exception(f"Missing required model fields: {missing_model_fields}")
            
            self.log(f"Health endpoint response in {response_time:.3f}s", "SUCCESS")
            self.log(f"   Status: {health_data.get('status')}")
            self.log(f"   Model Status: {model_info.get('status')}")
            self.log(f"   Model Ready: {model_info.get('ready')}")
            self.log(f"   Memory Healthy: {health_data.get('memory', {}).get('healthy')}")
            
            return {
                'success': True,
                'response_time': response_time,
                'health_data': health_data,
                'model_ready': model_info.get('ready', False),
                'model_status': model_info.get('status', 'unknown')
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            self.log(f"Health endpoint test failed after {response_time:.3f}s: {e}", "ERROR")
            
            return {
                'success': False,
                'response_time': response_time,
                'error': str(e)
            }

    def test_warmup_endpoint_basic(self) -> Dict:
        """Test basic warmup endpoint functionality"""
        self.log("Testing warmup endpoint basic functionality...")
        
        start_time = time.time()
        
        try:
            response = self.session.post(
                f"{self.api_url}/warmup",
                headers={'Content-Type': 'application/json'},
                timeout=self.warmup_timeout
            )
            
            response_time = time.time() - start_time
            self.metrics['warmup_response_times'].append(response_time)
            
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
            
            warmup_data = response.json()
            
            # Validate response structure
            required_fields = ['status', 'timestamp', 'endpoint', 'container_ready']
            missing_fields = [field for field in required_fields if field not in warmup_data]
            
            if missing_fields:
                raise Exception(f"Missing required fields: {missing_fields}")
            
            self.log(f"Warmup endpoint response in {response_time:.3f}s", "SUCCESS")
            self.log(f"   Status: {warmup_data.get('status')}")
            self.log(f"   Model Ready: {warmup_data.get('model_ready')}")
            self.log(f"   Total Time: {warmup_data.get('total_time')}s")
            
            if warmup_data.get('model_load_time'):
                self.log(f"   Model Load Time: {warmup_data.get('model_load_time')}s")
            
            return {
                'success': True,
                'response_time': response_time,
                'warmup_data': warmup_data,
                'model_ready': warmup_data.get('model_ready', False),
                'total_time': warmup_data.get('total_time', 0)
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            self.log(f"Warmup endpoint test failed after {response_time:.3f}s: {e}", "ERROR")
            
            return {
                'success': False,
                'response_time': response_time,
                'error': str(e)
            }

    def test_warmup_idempotency(self) -> Dict:
        """Test that multiple warmup calls are handled correctly"""
        self.log("Testing warmup endpoint idempotency...")
        
        results = []
        
        # Make multiple warmup calls in rapid succession
        for i in range(3):
            self.log(f"   Warmup call {i+1}/3")
            result = self.test_warmup_endpoint_basic()
            results.append(result)
            
            if not result['success']:
                self.log(f"Warmup call {i+1} failed, stopping idempotency test", "ERROR")
                break
        
        # Analyze results
        successful_calls = [r for r in results if r['success']]
        
        if len(successful_calls) == len(results):
            self.log("Warmup idempotency test passed", "SUCCESS")
            
            # Check if subsequent calls are faster (should be if model is already loaded)
            if len(successful_calls) > 1:
                first_time = successful_calls[0]['response_time']
                subsequent_times = [r['response_time'] for r in successful_calls[1:]]
                avg_subsequent = sum(subsequent_times) / len(subsequent_times)
                
                self.log(f"   First call: {first_time:.3f}s")
                self.log(f"   Subsequent calls avg: {avg_subsequent:.3f}s")
                
                if avg_subsequent < first_time * 0.5:  # Subsequent calls should be significantly faster
                    self.log("   ✅ Subsequent calls are faster (expected behavior)")
                else:
                    self.log("   ⚠️ Subsequent calls not significantly faster", "WARNING")
            
            return {'success': True, 'results': results}
        else:
            self.log("Warmup idempotency test failed", "ERROR")
            return {'success': False, 'results': results}

    def test_health_after_warmup(self) -> Dict:
        """Test that health endpoint reflects model readiness after warmup"""
        self.log("Testing health endpoint status after warmup...")
        
        # First, check initial health
        self.log("   Step 1: Initial health check")
        initial_health = self.test_health_endpoint_basic()
        
        if not initial_health['success']:
            return {'success': False, 'error': 'Initial health check failed'}
        
        initial_ready = initial_health['model_ready']
        self.log(f"   Initial model ready: {initial_ready}")
        
        # If model is already ready, we can't test the transition
        if initial_ready:
            self.log("   Model already ready, skipping transition test", "WARNING")
            return {'success': True, 'skipped': True, 'reason': 'Model already ready'}
        
        # Trigger warmup
        self.log("   Step 2: Triggering warmup")
        warmup_result = self.test_warmup_endpoint_basic()
        
        if not warmup_result['success']:
            return {'success': False, 'error': 'Warmup failed'}
        
        # Check health after warmup
        self.log("   Step 3: Health check after warmup")
        post_warmup_health = self.test_health_endpoint_basic()
        
        if not post_warmup_health['success']:
            return {'success': False, 'error': 'Post-warmup health check failed'}
        
        post_warmup_ready = post_warmup_health['model_ready']
        self.log(f"   Post-warmup model ready: {post_warmup_ready}")
        
        # Validate transition
        if not initial_ready and post_warmup_ready:
            self.log("   ✅ Health endpoint correctly reflects model transition", "SUCCESS")
            return {
                'success': True, 
                'transition_detected': True,
                'initial_ready': initial_ready,
                'post_warmup_ready': post_warmup_ready
            }
        elif initial_ready == post_warmup_ready:
            self.log("   ⚠️ No model state transition detected", "WARNING")
            return {
                'success': True,
                'transition_detected': False,
                'initial_ready': initial_ready,
                'post_warmup_ready': post_warmup_ready
            }
        else:
            self.log("   ❌ Unexpected model state transition", "ERROR")
            return {'success': False, 'error': 'Unexpected state transition'}

    def create_test_image(self) -> bytes:
        """Create a minimal test image for processing tests"""
        # Create a minimal PNG (1x1 pixel black image)
        # PNG header + IHDR chunk + IDAT chunk + IEND chunk
        png_data = (
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
        return png_data

    def test_processing_performance(self, warm_start: bool = False) -> Dict:
        """Test image processing performance (cold or warm start)"""
        test_type = "warm start" if warm_start else "cold start"
        self.log(f"Testing {test_type} processing performance...")
        
        if warm_start:
            # Ensure model is warmed up first
            self.log("   Pre-warming for warm start test")
            warmup_result = self.test_warmup_endpoint_basic()
            if not warmup_result['success']:
                return {'success': False, 'error': 'Pre-warmup failed'}
        
        # Create test image
        test_image = self.create_test_image()
        
        # Prepare form data
        files = {'file': ('test.png', test_image, 'image/png')}
        data = {
            'effects': 'enhancedblackwhite',
            'session_id': f'{test_type.replace(" ", "_")}_test_{int(time.time())}'
        }
        
        start_time = time.time()
        
        try:
            response = self.session.post(
                f"{self.api_url}/api/v2/process-with-effects",
                files=files,
                data=data,
                timeout=self.processing_timeout
            )
            
            response_time = time.time() - start_time
            
            if warm_start:
                self.metrics['warm_start_times'].append(response_time)
            else:
                self.metrics['cold_start_times'].append(response_time)
            
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
            
            result_data = response.json()
            
            self.log(f"{test_type.title()} processing completed in {response_time:.3f}s", "SUCCESS")
            self.log(f"   Session ID: {result_data.get('session_id')}")
            self.log(f"   Processing Time: {result_data.get('processing_time')}s")
            
            return {
                'success': True,
                'response_time': response_time,
                'processing_data': result_data,
                'test_type': test_type
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            self.log(f"{test_type.title()} processing failed after {response_time:.3f}s: {e}", "ERROR")
            
            return {
                'success': False,
                'response_time': response_time,
                'error': str(e),
                'test_type': test_type
            }

    def test_concurrent_warmup_calls(self, num_concurrent: int = 5) -> Dict:
        """Test concurrent warmup calls to ensure thread safety"""
        self.log(f"Testing {num_concurrent} concurrent warmup calls...")
        
        def make_warmup_call(call_id: int) -> Tuple[int, Dict]:
            """Make a single warmup call"""
            return call_id, self.test_warmup_endpoint_basic()
        
        start_time = time.time()
        results = {}
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent) as executor:
                # Submit all calls
                futures = [executor.submit(make_warmup_call, i) for i in range(num_concurrent)]
                
                # Collect results
                for future in concurrent.futures.as_completed(futures):
                    call_id, result = future.result()
                    results[call_id] = result
            
            total_time = time.time() - start_time
            successful_calls = sum(1 for result in results.values() if result['success'])
            
            self.log(f"Concurrent warmup test completed in {total_time:.3f}s", "SUCCESS")
            self.log(f"   Successful calls: {successful_calls}/{num_concurrent}")
            
            if successful_calls == num_concurrent:
                self.log("   ✅ All concurrent calls succeeded")
                return {'success': True, 'results': results, 'total_time': total_time}
            else:
                self.log(f"   ⚠️ {num_concurrent - successful_calls} calls failed", "WARNING")
                return {'success': False, 'results': results, 'total_time': total_time}
                
        except Exception as e:
            total_time = time.time() - start_time
            self.log(f"Concurrent warmup test failed after {total_time:.3f}s: {e}", "ERROR")
            return {'success': False, 'error': str(e), 'total_time': total_time}

    def wait_for_cooldown(self, seconds: int = 60):
        """Wait for API to cool down (simulate cold start condition)"""
        self.log(f"Waiting {seconds}s for API cooldown...")
        
        for i in range(seconds):
            if i % 10 == 0:  # Log every 10 seconds
                remaining = seconds - i
                self.log(f"   Cooldown: {remaining}s remaining")
            time.sleep(1)
        
        self.log("Cooldown period completed")

    def generate_performance_report(self) -> str:
        """Generate comprehensive performance report"""
        report = []
        report.append("🔥 WARMUP ENDPOINT PERFORMANCE REPORT")
        report.append("=" * 60)
        report.append("")
        
        # Health endpoint metrics
        health_times = self.metrics['health_response_times']
        if health_times:
            avg_health = sum(health_times) / len(health_times)
            min_health = min(health_times)
            max_health = max(health_times)
            
            report.append("📊 Health Endpoint Performance:")
            report.append(f"   Average Response Time: {avg_health:.3f}s")
            report.append(f"   Min Response Time: {min_health:.3f}s")
            report.append(f"   Max Response Time: {max_health:.3f}s")
            report.append(f"   Total Calls: {len(health_times)}")
            report.append("")
        
        # Warmup endpoint metrics
        warmup_times = self.metrics['warmup_response_times']
        if warmup_times:
            avg_warmup = sum(warmup_times) / len(warmup_times)
            min_warmup = min(warmup_times)
            max_warmup = max(warmup_times)
            
            report.append("🔥 Warmup Endpoint Performance:")
            report.append(f"   Average Response Time: {avg_warmup:.3f}s")
            report.append(f"   Min Response Time: {min_warmup:.3f}s")
            report.append(f"   Max Response Time: {max_warmup:.3f}s")
            report.append(f"   Total Calls: {len(warmup_times)}")
            report.append("")
        
        # Processing performance comparison
        cold_times = self.metrics['cold_start_times']
        warm_times = self.metrics['warm_start_times']
        
        if cold_times and warm_times:
            avg_cold = sum(cold_times) / len(cold_times)
            avg_warm = sum(warm_times) / len(warm_times)
            improvement = ((avg_cold - avg_warm) / avg_cold) * 100
            time_saved = avg_cold - avg_warm
            
            report.append("⚡ Processing Performance Comparison:")
            report.append(f"   Cold Start Average: {avg_cold:.3f}s")
            report.append(f"   Warm Start Average: {avg_warm:.3f}s")
            report.append(f"   Time Saved: {time_saved:.3f}s")
            report.append(f"   Performance Improvement: {improvement:.1f}%")
            report.append("")
            
            # Effectiveness rating
            if improvement > 70:
                rating = "🔥 EXCELLENT"
            elif improvement > 40:
                rating = "✅ GOOD"
            elif improvement > 20:
                rating = "⚠️ MODERATE"
            else:
                rating = "❌ POOR"
            
            report.append(f"🎯 Warming Effectiveness: {rating}")
            report.append("")
        
        # Recommendations
        report.append("💡 Recommendations:")
        if warmup_times:
            avg_warmup = sum(warmup_times) / len(warmup_times)
            if avg_warmup > 30:
                report.append("   ⚠️ Warmup times are high - consider optimizing model loading")
            elif avg_warmup > 15:
                report.append("   ℹ️ Warmup times are moderate - monitor in production")
            else:
                report.append("   ✅ Warmup times are acceptable")
        
        if health_times:
            avg_health = sum(health_times) / len(health_times)
            if avg_health > 5:
                report.append("   ⚠️ Health check times are high - may impact UX")
            else:
                report.append("   ✅ Health check times are good")
        
        report.append("")
        report.append(f"📅 Report generated: {datetime.now().isoformat()}")
        
        return "\n".join(report)

    def run_comprehensive_test(self, include_performance: bool = True, cooldown_time: int = 60) -> Dict:
        """Run comprehensive warmup endpoint tests"""
        self.log("🚀 Starting comprehensive warmup endpoint tests...")
        self.log("")
        
        all_results = {}
        
        try:
            # Test 1: Basic health endpoint
            self.log("=" * 50)
            self.log("TEST 1: Basic Health Endpoint")
            self.log("=" * 50)
            all_results['health_basic'] = self.test_health_endpoint_basic()
            
            # Test 2: Basic warmup endpoint
            self.log("\n" + "=" * 50)
            self.log("TEST 2: Basic Warmup Endpoint")
            self.log("=" * 50)
            all_results['warmup_basic'] = self.test_warmup_endpoint_basic()
            
            # Test 3: Warmup idempotency
            self.log("\n" + "=" * 50)
            self.log("TEST 3: Warmup Idempotency")
            self.log("=" * 50)
            all_results['warmup_idempotency'] = self.test_warmup_idempotency()
            
            # Test 4: Health after warmup
            self.log("\n" + "=" * 50)
            self.log("TEST 4: Health Status After Warmup")
            self.log("=" * 50)
            all_results['health_after_warmup'] = self.test_health_after_warmup()
            
            # Test 5: Concurrent warmup calls
            self.log("\n" + "=" * 50)
            self.log("TEST 5: Concurrent Warmup Calls")
            self.log("=" * 50)
            all_results['concurrent_warmup'] = self.test_concurrent_warmup_calls()
            
            # Performance tests (optional, as they take longer)
            if include_performance:
                # Test 6: Cold start performance
                self.log("\n" + "=" * 50)
                self.log("TEST 6: Cold Start Performance")
                self.log("=" * 50)
                self.wait_for_cooldown(cooldown_time)
                all_results['cold_start_performance'] = self.test_processing_performance(warm_start=False)
                
                # Test 7: Warm start performance
                self.log("\n" + "=" * 50)
                self.log("TEST 7: Warm Start Performance")
                self.log("=" * 50)
                all_results['warm_start_performance'] = self.test_processing_performance(warm_start=True)
            
            # Generate summary
            self.log("\n" + "=" * 50)
            self.log("TEST SUMMARY")
            self.log("=" * 50)
            
            total_tests = len(all_results)
            successful_tests = sum(1 for result in all_results.values() 
                                 if isinstance(result, dict) and result.get('success', False))
            
            self.log(f"Total Tests: {total_tests}")
            self.log(f"Successful Tests: {successful_tests}")
            self.log(f"Success Rate: {(successful_tests/total_tests)*100:.1f}%")
            
            # Generate performance report
            if include_performance:
                self.log("\n" + "=" * 50)
                self.log("PERFORMANCE REPORT")
                self.log("=" * 50)
                performance_report = self.generate_performance_report()
                print(performance_report)
            
            return {
                'success': successful_tests == total_tests,
                'total_tests': total_tests,
                'successful_tests': successful_tests,
                'results': all_results,
                'performance_report': self.generate_performance_report() if include_performance else None
            }
            
        except Exception as e:
            self.log(f"Comprehensive test failed: {e}", "ERROR")
            return {
                'success': False,
                'error': str(e),
                'results': all_results
            }


def main():
    """Main test execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Warmup Endpoint Tester')
    parser.add_argument('--api-url', default='http://localhost:8080', help='API base URL')
    parser.add_argument('--no-performance', action='store_true', help='Skip performance tests')
    parser.add_argument('--cooldown', type=int, default=60, help='Cooldown time in seconds')
    
    args = parser.parse_args()
    
    # Initialize tester
    tester = WarmupEndpointTester(api_url=args.api_url)
    
    # Run comprehensive tests
    results = tester.run_comprehensive_test(
        include_performance=not args.no_performance,
        cooldown_time=args.cooldown
    )
    
    # Print final results
    print("\n" + "🎯 FINAL RESULTS" + "\n" + "=" * 50)
    if results['success']:
        print("✅ All tests passed successfully!")
        print("   The warmup endpoint strategy is working correctly.")
    else:
        print("❌ Some tests failed.")
        print("   Review the test output above for details.")
    
    print(f"\nSuccess Rate: {(results['successful_tests']/results['total_tests'])*100:.1f}% ({results['successful_tests']}/{results['total_tests']})")
    
    # Exit with appropriate code
    exit(0 if results['success'] else 1)


if __name__ == "__main__":
    main()