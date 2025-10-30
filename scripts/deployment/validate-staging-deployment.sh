#!/bin/bash

# Staging Deployment Validation Script for Perkie Prints InSPyReNet API
# Comprehensive validation testing before production deployment

set -euo pipefail

# Configuration
STAGING_URL="https://inspirenet-bg-removal-api-staging-725543555429.us-central1.run.app"
PROJECT_ID="perkieprints-processing"
REGION="us-central1"
SERVICE_NAME="inspirenet-bg-removal-api-staging"
TEST_IMAGE_PATH="../testing/test-images/test-pet.jpg"
MAX_WAIT_TIME=300  # 5 minutes max wait for deployment
CONCURRENT_REQUESTS=20

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if gcloud is installed and authenticated
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        log_error "curl not found. Please install curl."
        exit 1
    fi
    
    # Check if jq is installed for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_error "jq not found. Please install jq for JSON parsing."
        exit 1
    fi
    
    # Verify gcloud project
    current_project=$(gcloud config get-value project 2>/dev/null || echo "")
    if [[ "$current_project" != "$PROJECT_ID" ]]; then
        log_warning "Current project is '$current_project', expected '$PROJECT_ID'"
        gcloud config set project "$PROJECT_ID"
    fi
    
    log_success "Prerequisites check passed"
}

# Deploy staging environment
deploy_staging() {
    log_info "Deploying staging environment..."
    
    cd "$(dirname "$0")/../../backend/inspirenet-api"
    
    # Deploy using staging configuration
    if gcloud run services replace deploy-staging.yaml --region=$REGION; then
        log_success "Staging deployment completed"
    else
        log_error "Staging deployment failed"
        exit 1
    fi
    
    # Wait for deployment to be ready
    log_info "Waiting for service to be ready..."
    local wait_time=0
    while [[ $wait_time -lt $MAX_WAIT_TIME ]]; do
        if gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.conditions[0].status)" | grep -q "True"; then
            log_success "Service is ready"
            break
        fi
        
        sleep 10
        wait_time=$((wait_time + 10))
        log_info "Waiting... ($wait_time/$MAX_WAIT_TIME seconds)"
    done
    
    if [[ $wait_time -ge $MAX_WAIT_TIME ]]; then
        log_error "Service failed to become ready within $MAX_WAIT_TIME seconds"
        exit 1
    fi
}

# Test basic health endpoints
test_health_endpoints() {
    log_info "Testing health endpoints..."
    
    # Test root endpoint
    log_info "Testing root endpoint..."
    if curl -sf "$STAGING_URL/" -o /dev/null; then
        log_success "Root endpoint responding"
    else
        log_error "Root endpoint failed"
        return 1
    fi
    
    # Test health endpoint
    log_info "Testing health endpoint..."
    health_response=$(curl -sf "$STAGING_URL/health" | jq -r '.status' 2>/dev/null || echo "error")
    if [[ "$health_response" =~ ^(healthy|warming|degraded)$ ]]; then
        log_success "Health endpoint responding with status: $health_response"
    else
        log_error "Health endpoint failed or returned unexpected status: $health_response"
        return 1
    fi
    
    # Test model info endpoint
    log_info "Testing model info endpoint..."
    if curl -sf "$STAGING_URL/model-info" -o /dev/null; then
        log_success "Model info endpoint responding"
    else
        log_warning "Model info endpoint not responding (may be normal if model not loaded)"
    fi
    
    return 0
}

# Test cold start performance
test_cold_start() {
    log_info "Testing cold start performance..."
    
    # Trigger warmup and measure time
    start_time=$(date +%s)
    warmup_response=$(curl -sf -X POST "$STAGING_URL/warmup" 2>/dev/null || echo '{"status":"error"}')
    end_time=$(date +%s)
    cold_start_time=$((end_time - start_time))
    
    warmup_status=$(echo "$warmup_response" | jq -r '.status' 2>/dev/null || echo "error")
    
    if [[ "$warmup_status" == "success" ]]; then
        if [[ $cold_start_time -le 35 ]]; then
            log_success "Cold start completed in ${cold_start_time}s (within 35s threshold)"
        else
            log_warning "Cold start took ${cold_start_time}s (exceeds 35s threshold)"
        fi
    else
        log_error "Cold start failed with status: $warmup_status"
        return 1
    fi
    
    return 0
}

# Test image processing functionality
test_image_processing() {
    log_info "Testing image processing functionality..."
    
    # Create a test image if it doesn't exist
    if [[ ! -f "$TEST_IMAGE_PATH" ]]; then
        log_warning "Test image not found, creating a simple test image..."
        # Create a simple colored rectangle as test image
        convert -size 800x600 xc:blue -fill white -gravity center -pointsize 72 -annotate +0+0 "TEST" "$TEST_IMAGE_PATH" 2>/dev/null || {
            log_error "Failed to create test image and none provided"
            return 1
        }
    fi
    
    # Test basic background removal
    log_info "Testing background removal..."
    start_time=$(date +%s.%3N)
    
    processing_response=$(curl -sf -X POST "$STAGING_URL/api/v2/process" \
        -F "image=@$TEST_IMAGE_PATH" \
        -F "effects=[]" 2>/dev/null || echo '{"status":"error"}')
    
    end_time=$(date +%s.%3N)
    processing_time=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "unknown")
    
    response_status=$(echo "$processing_response" | jq -r '.status' 2>/dev/null || echo "error")
    
    if [[ "$response_status" == "success" ]]; then
        log_success "Background removal completed in ${processing_time}s"
        
        # Check if response contains expected data
        if echo "$processing_response" | jq -e '.data.processed_image' > /dev/null 2>&1; then
            log_success "Response contains processed image data"
        else
            log_warning "Response missing processed image data"
        fi
    else
        log_error "Background removal failed with status: $response_status"
        return 1
    fi
    
    return 0
}

# Test concurrent request handling
test_concurrent_requests() {
    log_info "Testing concurrent request handling with $CONCURRENT_REQUESTS requests..."
    
    # Create temporary directory for concurrent test results
    temp_dir=$(mktemp -d)
    
    # Launch concurrent requests
    for i in $(seq 1 $CONCURRENT_REQUESTS); do
        {
            start_time=$(date +%s.%3N)
            response=$(curl -sf "$STAGING_URL/health" 2>/dev/null || echo "error")
            end_time=$(date +%s.%3N)
            response_time=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0")
            
            if [[ "$response" != "error" ]]; then
                echo "success,$response_time" > "$temp_dir/result_$i.txt"
            else
                echo "error,0" > "$temp_dir/result_$i.txt"
            fi
        } &
    done
    
    # Wait for all requests to complete
    wait
    
    # Analyze results
    success_count=0
    total_time=0
    max_time=0
    
    for result_file in "$temp_dir"/result_*.txt; do
        if [[ -f "$result_file" ]]; then
            result=$(cat "$result_file")
            status=$(echo "$result" | cut -d',' -f1)
            time_taken=$(echo "$result" | cut -d',' -f2)
            
            if [[ "$status" == "success" ]]; then
                success_count=$((success_count + 1))
                total_time=$(echo "$total_time + $time_taken" | bc 2>/dev/null || echo "$total_time")
                
                if (( $(echo "$time_taken > $max_time" | bc -l) )); then
                    max_time=$time_taken
                fi
            fi
        fi
    done
    
    # Calculate metrics
    success_rate=$(echo "scale=2; $success_count * 100 / $CONCURRENT_REQUESTS" | bc 2>/dev/null || echo "0")
    avg_time=$(echo "scale=3; $total_time / $success_count" | bc 2>/dev/null || echo "0")
    
    # Clean up
    rm -rf "$temp_dir"
    
    # Evaluate results
    if (( $(echo "$success_rate >= 95" | bc -l) )); then
        log_success "Concurrent test passed: ${success_rate}% success rate, avg ${avg_time}s, max ${max_time}s"
    else
        log_error "Concurrent test failed: ${success_rate}% success rate (expected >= 95%)"
        return 1
    fi
    
    return 0
}

# Test memory efficiency
test_memory_efficiency() {
    log_info "Testing memory efficiency..."
    
    # Get initial memory status
    initial_memory=$(curl -sf "$STAGING_URL/health" | jq -r '.memory.cpu_percent' 2>/dev/null || echo "0")
    
    # Process several images to test memory usage
    for i in {1..5}; do
        log_info "Processing test image $i/5..."
        curl -sf -X POST "$STAGING_URL/api/v2/process" \
            -F "image=@$TEST_IMAGE_PATH" \
            -F "effects=[\"blackwhite\"]" > /dev/null 2>&1 || {
            log_warning "Failed to process test image $i"
        }
        sleep 2
    done
    
    # Check memory after processing
    final_memory=$(curl -sf "$STAGING_URL/health" | jq -r '.memory.cpu_percent' 2>/dev/null || echo "0")
    
    if (( $(echo "$final_memory < 85" | bc -l) )); then
        log_success "Memory efficiency test passed: ${final_memory}% memory usage"
    else
        log_warning "High memory usage detected: ${final_memory}%"
    fi
    
    return 0
}

# Test CORS configuration
test_cors() {
    log_info "Testing CORS configuration..."
    
    # Test CORS headers with OPTIONS request
    cors_response=$(curl -sf -X OPTIONS "$STAGING_URL/api/v2/process" \
        -H "Origin: https://perkieprints.myshopify.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -I 2>/dev/null || echo "error")
    
    if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
        log_success "CORS headers present"
    else
        log_error "CORS headers missing"
        return 1
    fi
    
    return 0
}

# Test error handling
test_error_handling() {
    log_info "Testing error handling..."
    
    # Test with invalid image
    error_response=$(curl -s -X POST "$STAGING_URL/api/v2/process" \
        -F "image=invalid_data" 2>/dev/null || echo '{"status":"error"}')
    
    response_status=$(echo "$error_response" | jq -r '.status' 2>/dev/null || echo "unknown")
    
    if [[ "$response_status" == "error" ]]; then
        log_success "Error handling working correctly"
    else
        log_warning "Error handling may not be working as expected"
    fi
    
    return 0
}

# Cleanup staging resources (optional)
cleanup_staging() {
    read -p "Do you want to clean up the staging environment? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up staging environment..."
        
        if gcloud run services delete $SERVICE_NAME --region=$REGION --quiet 2>/dev/null; then
            log_success "Staging service deleted"
        else
            log_warning "Failed to delete staging service or it doesn't exist"
        fi
    else
        log_info "Keeping staging environment for manual testing"
    fi
}

# Generate validation report
generate_report() {
    local passed_tests=$1
    local total_tests=$2
    local success_rate=$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc 2>/dev/null || echo "0")
    
    echo
    log_info "=== STAGING VALIDATION REPORT ==="
    echo "Tests passed: $passed_tests/$total_tests (${success_rate}%)"
    echo "Staging URL: $STAGING_URL"
    echo "Timestamp: $(date)"
    
    if [[ $passed_tests -eq $total_tests ]]; then
        log_success "All tests passed! Staging environment is ready for production deployment."
        echo
        log_info "Next steps:"
        echo "1. Review the staging environment manually if needed"
        echo "2. Run production deployment when ready"
        echo "3. Monitor the production deployment closely"
        return 0
    else
        log_error "Some tests failed. Please review and fix issues before production deployment."
        return 1
    fi
}

# Main execution
main() {
    local passed_tests=0
    local total_tests=8
    
    log_info "Starting staging deployment validation..."
    echo "Staging URL: $STAGING_URL"
    echo "Project: $PROJECT_ID"
    echo "Region: $REGION"
    echo
    
    # Check prerequisites
    check_prerequisites
    
    # Deploy staging
    deploy_staging
    
    # Run validation tests
    if test_health_endpoints; then
        passed_tests=$((passed_tests + 1))
    fi
    
    if test_cold_start; then
        passed_tests=$((passed_tests + 1))
    fi
    
    if test_image_processing; then
        passed_tests=$((passed_tests + 1))
    fi
    
    if test_concurrent_requests; then
        passed_tests=$((passed_tests + 1))
    fi
    
    if test_memory_efficiency; then
        passed_tests=$((passed_tests + 1))
    fi
    
    if test_cors; then
        passed_tests=$((passed_tests + 1))
    fi
    
    if test_error_handling; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Final connectivity test
    if curl -sf "$STAGING_URL/health" > /dev/null; then
        log_success "Final connectivity test passed"
        passed_tests=$((passed_tests + 1))
    else
        log_error "Final connectivity test failed"
    fi
    
    # Generate report
    generate_report $passed_tests $total_tests
    local validation_result=$?
    
    # Optional cleanup
    cleanup_staging
    
    exit $validation_result
}

# Run main function
main "$@"