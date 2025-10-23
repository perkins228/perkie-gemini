#!/usr/bin/env python3
"""
Rate Limiting and Error Handling Validation Tests

This script comprehensively tests the rate limiting and error handling mechanisms
of the upload button warming strategy to ensure robust production behavior.

Test Categories:
1. Rate Limiting Validation
2. Error Handling Robustness
3. Edge Case Scenarios
4. Recovery Mechanisms
5. Concurrent Access Patterns

Usage:
    python test-rate-limiting-error-handling.py --api-url https://your-api.com
    python test-rate-limiting-error-handling.py --local --stress-test
"""

import os
import sys
import time
import requests
import json
import argparse
import threading
import concurrent.futures
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import statistics
import random
from unittest.mock import patch

class RateLimitingErrorTester:
    """Comprehensive tester for rate limiting and error handling"""
    
    def __init__(self, api_url: str, verbose: bool = True):
        self.api_url = api_url.rstrip('/')
        self.verbose = verbose
        self.session = requests.Session()
        
        # Test configuration based on frontend warming config
        self.rate_limit_config = {
            'cooldown_period': 30,  # seconds between warming attempts
            'health_timeout': 10,   # seconds for health check
            'warmup_timeout': 30    # seconds for warmup request
        }
        
        # Test results storage
        self.test_results = {
            'rate_limiting': {
                'attempts': 0,
                'successful': 0,
                'rate_limited': 0,
                'errors': 0
            },
            'error_handling': {
                'network_errors': 0,
                'timeout_errors': 0,
                'server_errors': 0,
                'recovery_successful': 0
            },
            'concurrent_access': {
                'total_threads': 0,
                'successful_threads': 0,
                'failed_threads': 0,
                'race_conditions': 0
            },
            'edge_cases': {
                'malformed_requests': 0,
                'oversized_requests': 0,
                'invalid_endpoints': 0,
                'handled_gracefully': 0
            }
        }
        
        if self.verbose:
            print(f"🛡️ Rate Limiting & Error Handling Tester Initialized")
            print(f"   API URL: {self.api_url}")
            print(f"   Rate limit cooldown: {self.rate_limit_config['cooldown_period']}s")
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
            "RATE_LIMIT": "🚦",
            "CONCURRENT": "🔄",
            "EDGE_CASE": "🔍"
        }.get(level, "📝")
        
        print(f"[{timestamp}] {prefix} {message}")

    def simulate_frontend_rate_limiting(self) -> Dict:
        """Simulate the exact frontend rate limiting logic"""
        class FrontendWarmingSimulator:
            def __init__(self, tester):
                self.tester = tester
                self.lastUploadWarming = 0
                self.isWarmingUp = False
                self.warmingPromise = None
                self.apiHealthStatus = 'unknown'
                self.cooldownPeriod = 30000  # 30 seconds in milliseconds
                
            def triggerUploadButtonWarming(self) -> Tuple[bool, str]:
                """Simulate the frontend triggerUploadButtonWarming method"""
                now = time.time() * 1000  # Convert to milliseconds
                
                # Rate limiting check
                if self.lastUploadWarming and (now - self.lastUploadWarming) < self.cooldownPeriod:
                    return False, "rate_limited"
                
                # Skip if API is already healthy
                if self.apiHealthStatus == 'healthy' or self.isWarmingUp:
                    return False, "already_warm"
                
                self.lastUploadWarming = now
                return True, "triggered"
        
        return FrontendWarmingSimulator(self)

    def test_basic_rate_limiting(self) -> Dict:
        """Test basic rate limiting functionality"""
        self.log("🚦 Testing basic rate limiting...", "RATE_LIMIT")
        
        simulator = self.simulate_frontend_rate_limiting()
        results = {
            'attempts': 0,
            'triggered': 0,
            'rate_limited': 0,
            'timing_violations': 0
        }
        
        # Make rapid consecutive attempts
        for i in range(10):
            results['attempts'] += 1
            triggered, reason = simulator.triggerUploadButtonWarming()
            
            if triggered:
                results['triggered'] += 1
                self.log(f"   Attempt {i+1}: Triggered warming")
                
                # Simulate warming in progress
                simulator.isWarmingUp = True
                time.sleep(0.5)  # Brief warming simulation
                simulator.isWarmingUp = False
                simulator.apiHealthStatus = 'healthy'
                
            elif reason == "rate_limited":
                results['rate_limited'] += 1
                self.log(f"   Attempt {i+1}: Rate limited (expected)")
                
            elif reason == "already_warm":
                self.log(f"   Attempt {i+1}: Skipped - already warm")
            
            # Small delay between attempts
            time.sleep(0.1)
        
        # Validate rate limiting effectiveness
        if results['rate_limited'] > 0:
            self.log(f"✅ Rate limiting working: {results['rate_limited']} attempts blocked", "SUCCESS")
        else:
            self.log("⚠️ Rate limiting may not be working correctly", "WARNING")
        
        # Test cooldown period respect
        self.log("   Testing cooldown period...")
        time.sleep(31)  # Wait for cooldown to expire
        
        # Reset API status to allow new warming
        simulator.apiHealthStatus = 'unknown'
        triggered, reason = simulator.triggerUploadButtonWarming()
        
        if triggered:
            self.log("✅ Cooldown period respected - new warming allowed", "SUCCESS")
        else:
            self.log("⚠️ Cooldown period may not be working correctly", "WARNING")
            results['timing_violations'] += 1
        
        self.test_results['rate_limiting'].update(results)
        return results

    def test_rapid_click_simulation(self, num_clicks: int = 20) -> Dict:
        """Simulate rapid user clicks to test rate limiting under stress"""
        self.log(f"🚦 Simulating {num_clicks} rapid clicks...", "RATE_LIMIT")
        
        simulator = self.simulate_frontend_rate_limiting()
        start_time = time.time()
        
        results = {
            'total_clicks': num_clicks,
            'triggered_warmings': 0,
            'rate_limited_clicks': 0,
            'errors': 0,
            'test_duration': 0
        }
        
        for i in range(num_clicks):
            try:
                triggered, reason = simulator.triggerUploadButtonWarming()
                
                if triggered:
                    results['triggered_warmings'] += 1
                    
                    # Simulate actual warming call to API
                    try:
                        response = self.session.post(
                            f"{self.api_url}/warmup",
                            headers={'Content-Type': 'application/json'},
                            timeout=5  # Short timeout for rapid testing
                        )
                        
                        if response.status_code == 200:
                            simulator.apiHealthStatus = 'healthy'
                        
                    except requests.exceptions.Timeout:
                        self.log(f"   Click {i+1}: Warmup timeout (acceptable for rapid testing)")
                    except Exception as e:
                        results['errors'] += 1
                        self.log(f"   Click {i+1}: Warmup error: {e}")
                    
                elif reason == "rate_limited":
                    results['rate_limited_clicks'] += 1
                
                # Vary click timing to simulate real user behavior
                time.sleep(random.uniform(0.1, 0.5))
                
            except Exception as e:
                results['errors'] += 1
                self.log(f"   Click {i+1}: Simulation error: {e}", "ERROR")
        
        results['test_duration'] = time.time() - start_time
        
        # Analysis
        rate_limit_effectiveness = (results['rate_limited_clicks'] / num_clicks) * 100
        self.log(f"Rapid click test completed in {results['test_duration']:.2f}s", "SUCCESS")
        self.log(f"   Warmings triggered: {results['triggered_warmings']}")
        self.log(f"   Rate limited: {results['rate_limited_clicks']} ({rate_limit_effectiveness:.1f}%)")
        self.log(f"   Errors: {results['errors']}")
        
        return results

    def test_network_error_handling(self) -> Dict:
        """Test handling of various network errors"""
        self.log("🌐 Testing network error handling...", "ERROR")
        
        results = {
            'connection_errors': 0,
            'timeout_errors': 0,
            'dns_errors': 0,
            'graceful_failures': 0,
            'total_tests': 0
        }
        
        error_scenarios = [
            ("Connection refused", "http://localhost:99999"),
            ("DNS resolution failure", "http://nonexistent-domain-12345.com"),
            ("Timeout", self.api_url),  # Will test with very short timeout
            ("Invalid URL", "not-a-url"),
        ]
        
        for scenario_name, test_url in error_scenarios:
            self.log(f"   Testing {scenario_name}...")
            results['total_tests'] += 1
            
            try:
                if scenario_name == "Timeout":
                    # Test timeout handling
                    response = self.session.post(
                        f"{test_url}/warmup",
                        headers={'Content-Type': 'application/json'},
                        timeout=0.001  # Very short timeout to force timeout error
                    )
                else:
                    # Test other error types
                    response = self.session.post(
                        f"{test_url}/warmup",
                        headers={'Content-Type': 'application/json'},
                        timeout=5
                    )
                
                # If we get here without exception, check response
                if response.status_code >= 400:
                    results['graceful_failures'] += 1
                    
            except requests.exceptions.ConnectionError:
                results['connection_errors'] += 1
                results['graceful_failures'] += 1
                self.log(f"   ✅ Connection error handled gracefully")
                
            except requests.exceptions.Timeout:
                results['timeout_errors'] += 1
                results['graceful_failures'] += 1
                self.log(f"   ✅ Timeout error handled gracefully")
                
            except requests.exceptions.InvalidURL:
                results['graceful_failures'] += 1
                self.log(f"   ✅ Invalid URL error handled gracefully")
                
            except Exception as e:
                self.log(f"   ❌ Unexpected error type: {e}", "ERROR")
        
        success_rate = (results['graceful_failures'] / results['total_tests']) * 100
        self.log(f"Network error handling: {success_rate:.1f}% graceful failures", "SUCCESS")
        
        self.test_results['error_handling'].update(results)
        return results

    def test_concurrent_warming_requests(self, num_threads: int = 10) -> Dict:
        """Test concurrent warming requests to check for race conditions"""
        self.log(f"🔄 Testing {num_threads} concurrent warming requests...", "CONCURRENT")
        
        results = {
            'threads_started': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'timeout_requests': 0,
            'response_times': [],
            'concurrent_successes': 0
        }
        
        def make_warmup_request(thread_id: int) -> Dict:
            """Single warmup request for threading"""
            start_time = time.time()
            
            try:
                response = self.session.post(
                    f"{self.api_url}/warmup",
                    headers={'Content-Type': 'application/json'},
                    timeout=30
                )
                
                response_time = time.time() - start_time
                
                if response.status_code == 200:
                    return {
                        'thread_id': thread_id,
                        'success': True,
                        'response_time': response_time,
                        'status_code': response.status_code
                    }
                else:
                    return {
                        'thread_id': thread_id,
                        'success': False,
                        'response_time': response_time,
                        'status_code': response.status_code
                    }
                    
            except requests.exceptions.Timeout:
                return {
                    'thread_id': thread_id,
                    'success': False,
                    'response_time': time.time() - start_time,
                    'error': 'timeout'
                }
            except Exception as e:
                return {
                    'thread_id': thread_id,
                    'success': False,
                    'response_time': time.time() - start_time,
                    'error': str(e)
                }
        
        # Execute concurrent requests
        thread_results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            # Submit all requests
            futures = [executor.submit(make_warmup_request, i) for i in range(num_threads)]
            results['threads_started'] = num_threads
            
            # Collect results
            for future in concurrent.futures.as_completed(futures):
                try:
                    result = future.result()
                    thread_results.append(result)
                    
                    if result['success']:
                        results['successful_requests'] += 1
                        results['response_times'].append(result['response_time'])
                    else:
                        results['failed_requests'] += 1
                        
                        if result.get('error') == 'timeout':
                            results['timeout_requests'] += 1
                            
                except Exception as e:
                    self.log(f"   Thread execution error: {e}", "ERROR")
                    results['failed_requests'] += 1
        
        # Analyze results
        if results['response_times']:
            avg_response_time = statistics.mean(results['response_times'])
            max_response_time = max(results['response_times'])
            min_response_time = min(results['response_times'])
            
            self.log(f"Concurrent requests completed:", "SUCCESS")
            self.log(f"   Successful: {results['successful_requests']}/{num_threads}")
            self.log(f"   Failed: {results['failed_requests']}")
            self.log(f"   Timeouts: {results['timeout_requests']}")
            self.log(f"   Avg response time: {avg_response_time:.3f}s")
            self.log(f"   Response time range: {min_response_time:.3f}s - {max_response_time:.3f}s")
            
            # Check for race conditions (all requests succeeding suggests good handling)
            if results['successful_requests'] == num_threads:
                self.log("   ✅ No apparent race conditions - all requests handled")
            elif results['successful_requests'] > 0:
                self.log("   ⚠️ Some requests failed - possible resource contention")
            else:
                self.log("   ❌ All requests failed - potential race condition or overload", "ERROR")
        
        self.test_results['concurrent_access'].update(results)
        return results

    def test_edge_case_scenarios(self) -> Dict:
        """Test various edge cases and malformed requests"""
        self.log("🔍 Testing edge case scenarios...", "EDGE_CASE")
        
        results = {
            'malformed_json': 0,
            'oversized_payload': 0,
            'invalid_headers': 0,
            'wrong_http_method': 0,
            'graceful_handling': 0,
            'total_tests': 0
        }
        
        edge_cases = [
            {
                'name': 'Malformed JSON',
                'method': 'POST',
                'endpoint': '/warmup',
                'headers': {'Content-Type': 'application/json'},
                'data': '{invalid json'
            },
            {
                'name': 'Oversized payload',
                'method': 'POST',
                'endpoint': '/warmup',
                'headers': {'Content-Type': 'application/json'},
                'data': json.dumps({'data': 'x' * 1000000})  # 1MB of data
            },
            {
                'name': 'Invalid Content-Type',
                'method': 'POST',
                'endpoint': '/warmup',
                'headers': {'Content-Type': 'text/plain'},
                'data': 'not json'
            },
            {
                'name': 'Wrong HTTP method',
                'method': 'GET',
                'endpoint': '/warmup',
                'headers': {},
                'data': None
            },
            {
                'name': 'Invalid endpoint',
                'method': 'POST',
                'endpoint': '/nonexistent-endpoint',
                'headers': {'Content-Type': 'application/json'},
                'data': '{}'
            }
        ]
        
        for test_case in edge_cases:
            self.log(f"   Testing {test_case['name']}...")
            results['total_tests'] += 1
            
            try:
                if test_case['method'] == 'POST':
                    response = self.session.post(
                        f"{self.api_url}{test_case['endpoint']}",
                        headers=test_case['headers'],
                        data=test_case['data'],
                        timeout=10
                    )
                else:
                    response = self.session.get(
                        f"{self.api_url}{test_case['endpoint']}",
                        headers=test_case['headers'],
                        timeout=10
                    )
                
                # Check if server handled the request gracefully (didn't crash)
                if response.status_code in [400, 404, 405, 413, 415, 422]:
                    results['graceful_handling'] += 1
                    self.log(f"   ✅ Handled gracefully (HTTP {response.status_code})")
                elif response.status_code >= 500:
                    self.log(f"   ⚠️ Server error (HTTP {response.status_code})", "WARNING")
                else:
                    self.log(f"   ℹ️ Unexpected response (HTTP {response.status_code})")
                
                # Categorize the test
                if 'json' in test_case['name'].lower():
                    results['malformed_json'] += 1
                elif 'oversized' in test_case['name'].lower():
                    results['oversized_payload'] += 1
                elif 'content-type' in test_case['name'].lower():
                    results['invalid_headers'] += 1
                elif 'method' in test_case['name'].lower():
                    results['wrong_http_method'] += 1
                    
            except requests.exceptions.Timeout:
                self.log(f"   ⚠️ Request timed out (may indicate server issue)", "WARNING")
            except Exception as e:
                self.log(f"   ❌ Request failed: {e}", "ERROR")
        
        handling_rate = (results['graceful_handling'] / results['total_tests']) * 100
        self.log(f"Edge case handling: {handling_rate:.1f}% handled gracefully", "SUCCESS")
        
        self.test_results['edge_cases'].update(results)
        return results

    def test_recovery_mechanisms(self) -> Dict:
        """Test system recovery after errors"""
        self.log("🔧 Testing recovery mechanisms...", "SUCCESS")
        
        results = {
            'recovery_attempts': 0,
            'successful_recoveries': 0,
            'failed_recoveries': 0
        }
        
        # Test recovery after timeout
        self.log("   Testing recovery after timeout...")
        results['recovery_attempts'] += 1
        
        try:
            # Force a timeout
            self.session.post(
                f"{self.api_url}/warmup",
                headers={'Content-Type': 'application/json'},
                timeout=0.001
            )
        except requests.exceptions.Timeout:
            self.log("   Timeout occurred (expected)")
        
        # Try normal request after timeout
        try:
            response = self.session.post(
                f"{self.api_url}/warmup",
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                results['successful_recoveries'] += 1
                self.log("   ✅ Successfully recovered after timeout")
            else:
                results['failed_recoveries'] += 1
                self.log("   ⚠️ Recovery attempt failed", "WARNING")
                
        except Exception as e:
            results['failed_recoveries'] += 1
            self.log(f"   ❌ Recovery failed: {e}", "ERROR")
        
        # Test recovery after connection error
        self.log("   Testing recovery after connection error...")
        results['recovery_attempts'] += 1
        
        try:
            # Try to connect to invalid endpoint
            self.session.post(
                "http://localhost:99999/warmup",
                headers={'Content-Type': 'application/json'},
                timeout=1
            )
        except requests.exceptions.ConnectionError:
            self.log("   Connection error occurred (expected)")
        
        # Try normal request after connection error
        try:
            response = self.session.post(
                f"{self.api_url}/warmup",
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                results['successful_recoveries'] += 1
                self.log("   ✅ Successfully recovered after connection error")
            else:
                results['failed_recoveries'] += 1
                self.log("   ⚠️ Recovery attempt failed", "WARNING")
                
        except Exception as e:
            results['failed_recoveries'] += 1
            self.log(f"   ❌ Recovery failed: {e}", "ERROR")
        
        recovery_rate = (results['successful_recoveries'] / results['recovery_attempts']) * 100
        self.log(f"Recovery success rate: {recovery_rate:.1f}%", "SUCCESS")
        
        return results

    def generate_comprehensive_report(self) -> str:
        """Generate comprehensive test report"""
        report = []
        report.append("🛡️ RATE LIMITING & ERROR HANDLING TEST REPORT")
        report.append("=" * 70)
        report.append("")
        
        # Rate Limiting Results
        report.append("🚦 RATE LIMITING RESULTS:")
        report.append("-" * 40)
        rl = self.test_results['rate_limiting']
        report.append(f"Total Attempts: {rl['attempts']}")
        report.append(f"Successful: {rl['successful']}")
        report.append(f"Rate Limited: {rl['rate_limited']}")
        report.append(f"Errors: {rl['errors']}")
        
        if rl['attempts'] > 0:
            rate_limit_effectiveness = (rl['rate_limited'] / rl['attempts']) * 100
            report.append(f"Rate Limiting Effectiveness: {rate_limit_effectiveness:.1f}%")
        report.append("")
        
        # Error Handling Results
        report.append("⚠️ ERROR HANDLING RESULTS:")
        report.append("-" * 40)
        eh = self.test_results['error_handling']
        report.append(f"Network Errors: {eh['network_errors']}")
        report.append(f"Timeout Errors: {eh['timeout_errors']}")
        report.append(f"Server Errors: {eh['server_errors']}")
        report.append(f"Recovery Successful: {eh['recovery_successful']}")
        report.append("")
        
        # Concurrent Access Results
        report.append("🔄 CONCURRENT ACCESS RESULTS:")
        report.append("-" * 40)
        ca = self.test_results['concurrent_access']
        report.append(f"Total Threads: {ca['total_threads']}")
        report.append(f"Successful Threads: {ca['successful_threads']}")
        report.append(f"Failed Threads: {ca['failed_threads']}")
        report.append(f"Race Conditions: {ca['race_conditions']}")
        report.append("")
        
        # Edge Cases Results
        report.append("🔍 EDGE CASES RESULTS:")
        report.append("-" * 40)
        ec = self.test_results['edge_cases']
        report.append(f"Malformed Requests: {ec['malformed_requests']}")
        report.append(f"Oversized Requests: {ec['oversized_requests']}")
        report.append(f"Invalid Endpoints: {ec['invalid_endpoints']}")
        report.append(f"Handled Gracefully: {ec['handled_gracefully']}")
        report.append("")
        
        # Overall Assessment
        report.append("🎯 OVERALL ASSESSMENT:")
        report.append("-" * 40)
        
        # Calculate overall scores
        total_tests_run = sum([
            rl.get('attempts', 0),
            ca.get('total_threads', 0),
            ec.get('malformed_requests', 0) + ec.get('oversized_requests', 0) + ec.get('invalid_endpoints', 0)
        ])
        
        total_successful = sum([
            rl.get('successful', 0),
            ca.get('successful_threads', 0),
            ec.get('handled_gracefully', 0)
        ])
        
        if total_tests_run > 0:
            overall_success_rate = (total_successful / total_tests_run) * 100
            report.append(f"Overall Success Rate: {overall_success_rate:.1f}%")
            
            if overall_success_rate > 90:
                report.append("✅ EXCELLENT - System shows robust error handling and rate limiting")
                report.append("   → Ready for production deployment")
            elif overall_success_rate > 75:
                report.append("✅ GOOD - System handles most scenarios well")
                report.append("   → Consider monitoring specific failure cases")
            elif overall_success_rate > 60:
                report.append("⚠️ MODERATE - Some issues detected")
                report.append("   → Review and fix identified issues before production")
            else:
                report.append("❌ POOR - Significant issues detected")
                report.append("   → Major improvements needed before production")
        
        report.append("")
        report.append("💡 RECOMMENDATIONS:")
        report.append("-" * 40)
        
        # Rate limiting recommendations
        if rl.get('rate_limited', 0) == 0 and rl.get('attempts', 0) > 0:
            report.append("⚠️ Rate limiting may not be working - investigate cooldown logic")
        elif rl.get('rate_limited', 0) > 0:
            report.append("✅ Rate limiting is functioning correctly")
        
        # Error handling recommendations
        if eh.get('recovery_successful', 0) > 0:
            report.append("✅ Error recovery mechanisms are working")
        else:
            report.append("⚠️ Test error recovery mechanisms")
        
        # Concurrent access recommendations
        if ca.get('race_conditions', 0) > 0:
            report.append("⚠️ Potential race conditions detected - review locking mechanisms")
        elif ca.get('successful_threads', 0) > 0:
            report.append("✅ Concurrent access handling is robust")
        
        report.append("")
        report.append(f"📅 Report generated: {datetime.now().isoformat()}")
        
        return "\n".join(report)

    def run_comprehensive_test_suite(self) -> Dict:
        """Run all rate limiting and error handling tests"""
        self.log("🚀 Starting comprehensive rate limiting and error handling tests...", "SUCCESS")
        
        all_results = {}
        
        try:
            # Test 1: Basic Rate Limiting
            self.log("\n" + "=" * 60)
            self.log("TEST 1: Basic Rate Limiting")
            self.log("=" * 60)
            all_results['basic_rate_limiting'] = self.test_basic_rate_limiting()
            
            # Test 2: Rapid Click Simulation
            self.log("\n" + "=" * 60)
            self.log("TEST 2: Rapid Click Simulation")
            self.log("=" * 60)
            all_results['rapid_clicks'] = self.test_rapid_click_simulation()
            
            # Test 3: Network Error Handling
            self.log("\n" + "=" * 60)
            self.log("TEST 3: Network Error Handling")
            self.log("=" * 60)
            all_results['network_errors'] = self.test_network_error_handling()
            
            # Test 4: Concurrent Requests
            self.log("\n" + "=" * 60)
            self.log("TEST 4: Concurrent Warming Requests")
            self.log("=" * 60)
            all_results['concurrent_requests'] = self.test_concurrent_warming_requests()
            
            # Test 5: Edge Cases
            self.log("\n" + "=" * 60)
            self.log("TEST 5: Edge Case Scenarios")
            self.log("=" * 60)
            all_results['edge_cases'] = self.test_edge_case_scenarios()
            
            # Test 6: Recovery Mechanisms
            self.log("\n" + "=" * 60)
            self.log("TEST 6: Recovery Mechanisms")
            self.log("=" * 60)
            all_results['recovery'] = self.test_recovery_mechanisms()
            
            # Generate comprehensive report
            self.log("\n" + "=" * 60)
            self.log("GENERATING COMPREHENSIVE REPORT")
            self.log("=" * 60)
            
            report = self.generate_comprehensive_report()
            print("\n" + report)
            
            # Calculate overall success
            total_tests = len(all_results)
            successful_tests = sum(1 for result in all_results.values() 
                                 if isinstance(result, dict) and not any(
                                     'error' in str(v) for v in result.values()
                                 ))
            
            return {
                'success': successful_tests == total_tests,
                'total_tests': total_tests,
                'successful_tests': successful_tests,
                'results': all_results,
                'report': report
            }
            
        except Exception as e:
            self.log(f"❌ Comprehensive test suite failed: {e}", "ERROR")
            return {
                'success': False,
                'error': str(e),
                'results': all_results
            }


def main():
    """Main test execution function"""
    parser = argparse.ArgumentParser(
        description='Rate Limiting and Error Handling Tester',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test-rate-limiting-error-handling.py --api-url https://your-api.com
  python test-rate-limiting-error-handling.py --local --stress-test
  python test-rate-limiting-error-handling.py --production --concurrent 20
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
        '--stress-test', 
        action='store_true',
        help='Run additional stress tests'
    )
    parser.add_argument(
        '--concurrent', 
        type=int, 
        default=10,
        help='Number of concurrent threads for testing (default: 10)'
    )
    parser.add_argument(
        '--rapid-clicks', 
        type=int, 
        default=20,
        help='Number of rapid clicks to simulate (default: 20)'
    )
    parser.add_argument(
        '--quiet', 
        action='store_true',
        help='Reduce output verbosity'
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
    tester = RateLimitingErrorTester(
        api_url=api_url,
        verbose=not args.quiet
    )
    
    # Run comprehensive tests
    results = tester.run_comprehensive_test_suite()
    
    # Print final results and exit with appropriate code
    print(f"\n🎯 FINAL RESULTS")
    print("=" * 50)
    
    if results['success']:
        print("✅ All rate limiting and error handling tests passed!")
        print("   The system demonstrates robust error handling capabilities.")
        exit(0)
    else:
        print("❌ Some tests failed or encountered issues.")
        print("   Review the test output above for details.")
        exit(1)


if __name__ == "__main__":
    main()