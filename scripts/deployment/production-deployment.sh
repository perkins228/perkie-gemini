#!/bin/bash

# Production Deployment Script for Perkie Prints InSPyReNet API
# Implements blue-green deployment with comprehensive monitoring

set -euo pipefail

# Configuration
PROJECT_ID="perkieprints-processing"
REGION="us-central1"
SERVICE_NAME="inspirenet-bg-removal-api"
PRODUCTION_URL="https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"
STAGING_URL="https://inspirenet-bg-removal-api-staging-725543555429.us-central1.run.app"

# Deployment configuration
TRAFFIC_SPLIT_PHASES=(10 50 100)  # Traffic split percentages
MONITORING_DURATION=1800  # 30 minutes per phase
ROLLBACK_ERROR_THRESHOLD=5  # Error rate percentage that triggers rollback
ROLLBACK_LATENCY_THRESHOLD=15  # Latency in seconds that triggers rollback

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Slack notification function (optional)
send_slack_notification() {
    local message=$1
    local color=${2:-"good"}
    local webhook_url=${SLACK_WEBHOOK_URL:-""}
    
    if [[ -n "$webhook_url" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$webhook_url" 2>/dev/null || true
    fi
}

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check gcloud authentication and project
    current_project=$(gcloud config get-value project 2>/dev/null || echo "")
    if [[ "$current_project" != "$PROJECT_ID" ]]; then
        log_error "Wrong project. Current: '$current_project', Expected: '$PROJECT_ID'"
        exit 1
    fi
    
    # Check if staging validation passed
    log_info "Checking staging environment health..."
    staging_health=$(curl -sf "$STAGING_URL/health" | jq -r '.status' 2>/dev/null || echo "error")
    if [[ "$staging_health" != "healthy" ]]; then
        log_error "Staging environment not healthy: $staging_health"
        log_error "Please run staging validation first"
        exit 1
    fi
    
    # Check current production health
    log_info "Checking current production health..."
    prod_health=$(curl -sf "$PRODUCTION_URL/health" | jq -r '.status' 2>/dev/null || echo "error")
    log_info "Current production health: $prod_health"
    
    # Check for ongoing deployments
    if gcloud run operations list --filter="metadata.target:$SERVICE_NAME" --filter="done:false" --format="value(name)" | grep -q .; then
        log_error "There are ongoing operations for $SERVICE_NAME. Wait for completion."
        exit 1
    fi
    
    log_success "Pre-flight checks passed"
}

# Create new revision without traffic
deploy_new_revision() {
    log_info "Deploying new revision without traffic..."
    
    cd "$(dirname "$0")/../../backend/inspirenet-api"
    
    # Deploy with no traffic initially
    if gcloud run services replace deploy-production-clean.yaml \
        --region=$REGION \
        --no-traffic; then
        log_success "New revision deployed successfully"
    else
        log_error "Failed to deploy new revision"
        exit 1
    fi
    
    # Get the new revision name
    NEW_REVISION=$(gcloud run services describe $SERVICE_NAME --region=$REGION \
        --format="value(status.latestCreatedRevisionName)")
    
    log_info "New revision: $NEW_REVISION"
    
    # Wait for revision to be ready
    log_info "Waiting for new revision to be ready..."
    if ! gcloud run services wait $SERVICE_NAME --region=$REGION; then
        log_error "New revision failed to become ready"
        exit 1
    fi
    
    log_success "New revision is ready"
}

# Get current metrics for comparison
get_baseline_metrics() {
    log_info "Collecting baseline metrics..."
    
    # Get current metrics from production
    baseline_response=$(curl -sf "$PRODUCTION_URL/api/v2/metrics" 2>/dev/null || echo '{}')
    
    # Extract key metrics
    BASELINE_ERROR_RATE=$(echo "$baseline_response" | jq -r '.requests.error_rate_percent // 0')
    BASELINE_AVG_LATENCY=$(echo "$baseline_response" | jq -r '.requests.avg_response_time // 0')
    BASELINE_REQUESTS_PER_MIN=$(echo "$baseline_response" | jq -r '.requests.requests_per_minute // 0')
    
    log_info "Baseline metrics:"
    log_info "  Error rate: ${BASELINE_ERROR_RATE}%"
    log_info "  Avg latency: ${BASELINE_AVG_LATENCY}s"
    log_info "  Requests/min: ${BASELINE_REQUESTS_PER_MIN}"
    
    # Store baseline for rollback decisions
    echo "{\"error_rate\":$BASELINE_ERROR_RATE,\"avg_latency\":$BASELINE_AVG_LATENCY,\"requests_per_min\":$BASELINE_REQUESTS_PER_MIN}" > /tmp/baseline_metrics.json
}

# Monitor metrics during deployment
monitor_metrics() {
    local traffic_percent=$1
    local duration=$2
    local monitoring_start=$(date +%s)
    local monitoring_end=$((monitoring_start + duration))
    
    log_info "Monitoring metrics for ${duration}s with ${traffic_percent}% traffic to new revision"
    
    local error_count=0
    local latency_violations=0
    local check_interval=30
    
    while [[ $(date +%s) -lt $monitoring_end ]]; do
        sleep $check_interval
        
        # Get current metrics
        current_response=$(curl -sf "$PRODUCTION_URL/api/v2/metrics" 2>/dev/null || echo '{}')
        
        current_error_rate=$(echo "$current_response" | jq -r '.requests.error_rate_percent // 0')
        current_avg_latency=$(echo "$current_response" | jq -r '.requests.avg_response_time // 0')
        current_requests_per_min=$(echo "$current_response" | jq -r '.requests.requests_per_minute // 0')
        
        # Check error rate
        if (( $(echo "$current_error_rate > $ROLLBACK_ERROR_THRESHOLD" | bc -l) )); then
            error_count=$((error_count + 1))
            log_warning "High error rate detected: ${current_error_rate}% (threshold: ${ROLLBACK_ERROR_THRESHOLD}%)"
        fi
        
        # Check latency
        if (( $(echo "$current_avg_latency > $ROLLBACK_LATENCY_THRESHOLD" | bc -l) )); then
            latency_violations=$((latency_violations + 1))
            log_warning "High latency detected: ${current_avg_latency}s (threshold: ${ROLLBACK_LATENCY_THRESHOLD}s)"
        fi
        
        # Check if we need to rollback (3 consecutive violations)
        if [[ $error_count -ge 3 ]] || [[ $latency_violations -ge 3 ]]; then
            log_error "Multiple metric violations detected. Initiating rollback."
            return 1
        fi
        
        # Log current status
        local elapsed=$(($(date +%s) - monitoring_start))
        local remaining=$((monitoring_end - $(date +%s)))
        log_info "Monitoring: ${elapsed}s elapsed, ${remaining}s remaining. Error: ${current_error_rate}%, Latency: ${current_avg_latency}s"
    done
    
    log_success "Monitoring phase completed successfully"
    return 0
}

# Split traffic to new revision
split_traffic() {
    local traffic_percent=$1
    
    log_info "Splitting ${traffic_percent}% traffic to new revision"
    
    if gcloud run services update-traffic $SERVICE_NAME \
        --region=$REGION \
        --to-revisions="$NEW_REVISION=$traffic_percent"; then
        log_success "Traffic split updated to ${traffic_percent}%"
        return 0
    else
        log_error "Failed to update traffic split"
        return 1
    fi
}

# Rollback to previous revision
rollback_deployment() {
    log_error "Initiating rollback procedure..."
    
    send_slack_notification "🚨 Production rollback initiated for Perkie Prints API deployment" "danger"
    
    # Get previous revision
    PREVIOUS_REVISION=$(gcloud run services describe $SERVICE_NAME --region=$REGION \
        --format="value(status.traffic[0].revisionName)")
    
    if [[ -n "$PREVIOUS_REVISION" ]] && [[ "$PREVIOUS_REVISION" != "$NEW_REVISION" ]]; then
        log_info "Rolling back to revision: $PREVIOUS_REVISION"
        
        if gcloud run services update-traffic $SERVICE_NAME \
            --region=$REGION \
            --to-revisions="$PREVIOUS_REVISION=100"; then
            log_success "Rollback completed successfully"
            
            # Wait for rollback to take effect
            sleep 30
            
            # Verify rollback
            health_check=$(curl -sf "$PRODUCTION_URL/health" | jq -r '.status' 2>/dev/null || echo "error")
            if [[ "$health_check" == "healthy" ]]; then
                log_success "Rollback verification passed"
                send_slack_notification "✅ Production rollback completed successfully" "good"
            else
                log_error "Rollback verification failed"
                send_slack_notification "❌ Production rollback verification failed" "danger"
            fi
        else
            log_error "Rollback failed"
            send_slack_notification "💥 Production rollback failed - manual intervention required" "danger"
        fi
    else
        log_error "Unable to determine previous revision for rollback"
        send_slack_notification "💥 Unable to rollback - no previous revision found" "danger"
    fi
}

# Cleanup old revisions
cleanup_old_revisions() {
    log_info "Cleaning up old revisions..."
    
    # Keep last 3 revisions, delete others
    old_revisions=$(gcloud run revisions list \
        --service=$SERVICE_NAME \
        --region=$REGION \
        --format="value(metadata.name)" \
        --sort-by="~metadata.creationTimestamp" \
        --limit=100 | tail -n +4)
    
    if [[ -n "$old_revisions" ]]; then
        for revision in $old_revisions; do
            log_info "Deleting old revision: $revision"
            gcloud run revisions delete "$revision" --region=$REGION --quiet || true
        done
        log_success "Old revisions cleaned up"
    else
        log_info "No old revisions to clean up"
    fi
}

# Pre-warm new deployment
prewarm_deployment() {
    log_info "Pre-warming new deployment..."
    
    # Call warmup endpoint multiple times to ensure model is loaded
    for i in {1..3}; do
        log_info "Warmup attempt $i/3..."
        warmup_response=$(curl -sf -X POST "$PRODUCTION_URL/warmup" 2>/dev/null || echo '{"status":"error"}')
        warmup_status=$(echo "$warmup_response" | jq -r '.status' 2>/dev/null || echo "error")
        
        if [[ "$warmup_status" == "success" ]]; then
            log_success "Warmup successful"
            break
        else
            log_warning "Warmup attempt $i failed: $warmup_status"
            if [[ $i -eq 3 ]]; then
                log_error "All warmup attempts failed"
                return 1
            fi
            sleep 30
        fi
    done
    
    return 0
}

# Main deployment process
main() {
    local deployment_start=$(date +%s)
    
    log_info "Starting production deployment for Perkie Prints InSPyReNet API"
    send_slack_notification "🚀 Starting production deployment for Perkie Prints API" "good"
    
    # Pre-flight checks
    preflight_checks
    
    # Get baseline metrics
    get_baseline_metrics
    
    # Deploy new revision
    deploy_new_revision
    
    # Pre-warm the deployment
    if ! prewarm_deployment; then
        log_error "Pre-warming failed. Aborting deployment."
        exit 1
    fi
    
    # Gradual traffic split with monitoring
    for traffic_percent in "${TRAFFIC_SPLIT_PHASES[@]}"; do
        log_info "=== Phase: ${traffic_percent}% traffic split ==="
        
        # Update traffic split
        if ! split_traffic $traffic_percent; then
            rollback_deployment
            exit 1
        fi
        
        # Monitor metrics
        if ! monitor_metrics $traffic_percent $MONITORING_DURATION; then
            rollback_deployment
            exit 1
        fi
        
        log_success "Phase ${traffic_percent}% completed successfully"
        
        # Send progress update
        send_slack_notification "✅ Traffic split ${traffic_percent}% phase completed successfully"
        
        # Brief pause between phases (except for the last one)
        if [[ $traffic_percent -ne 100 ]]; then
            log_info "Pausing 2 minutes before next phase..."
            sleep 120
        fi
    done
    
    # Final verification
    log_info "Running final verification..."
    final_health=$(curl -sf "$PRODUCTION_URL/health" | jq -r '.status' 2>/dev/null || echo "error")
    if [[ "$final_health" == "healthy" ]]; then
        log_success "Final health check passed"
    else
        log_error "Final health check failed: $final_health"
        rollback_deployment
        exit 1
    fi
    
    # Cleanup old revisions
    cleanup_old_revisions
    
    # Calculate deployment time
    deployment_end=$(date +%s)
    deployment_duration=$((deployment_end - deployment_start))
    deployment_minutes=$((deployment_duration / 60))
    
    # Success notification
    log_success "Production deployment completed successfully in ${deployment_minutes} minutes!"
    send_slack_notification "🎉 Production deployment completed successfully in ${deployment_minutes} minutes!" "good"
    
    # Final status report
    echo
    log_info "=== DEPLOYMENT SUMMARY ==="
    echo "Service: $SERVICE_NAME"
    echo "New revision: $NEW_REVISION"
    echo "Production URL: $PRODUCTION_URL"
    echo "Duration: ${deployment_minutes} minutes"
    echo "Status: SUCCESS"
    echo
    log_info "Monitor the deployment closely for the next few hours."
    log_info "Rollback command: gcloud run services update-traffic $SERVICE_NAME --region=$REGION --to-revisions=<PREVIOUS_REVISION>=100"
}

# Trap for cleanup on script exit
cleanup_on_exit() {
    if [[ $? -ne 0 ]]; then
        log_error "Deployment script exited with error"
        send_slack_notification "💥 Production deployment script failed" "danger"
    fi
}

trap cleanup_on_exit EXIT

# Run main deployment
main "$@"