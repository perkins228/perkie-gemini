# Perkie Prints Deployment and Monitoring Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the comprehensive deployment and monitoring plan for Perkie Prints' AI-powered pet background removal service.

## Quick Start Commands

```bash
# 1. Validate staging environment
./scripts/deployment/validate-staging-deployment.sh

# 2. Deploy to production (after staging validation)
./scripts/deployment/production-deployment.sh

# 3. Monitor deployment
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health
```

## Implementation Phases

### Phase 1: Foundation Setup (Week 1)

#### Day 1-2: Security and Monitoring Integration

1. **Integrate Security Middleware**
```bash
cd backend/inspirenet-api/src
# The security middleware is ready - integrate into main.py
```

Add to `main.py`:
```python
from security_middleware import security_middleware_handler

# Add security middleware
app.add_middleware("http")
async def security_middleware_wrapper(request, call_next):
    return await security_middleware_handler(request, call_next)
```

2. **Integrate Monitoring System**
```python
from monitoring import performance_monitor, create_request_metrics

# In your endpoint handlers, add:
@app.middleware("http")
async def monitoring_middleware(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    
    # Record metrics
    processing_time = time.time() - start_time
    metrics = create_request_metrics(request, response, processing_time)
    performance_monitor.record_request(metrics)
    
    return response
```

3. **Set Up Cost Optimization**
```python
from cost_optimizer import cost_optimizer

# In startup event:
@app.on_event("startup")
async def startup_event():
    # Existing startup code...
    
    # Initialize cost optimizer
    cost_optimizer.start_optimization_loop()
    logger.info("Cost optimization system started")
```

#### Day 3-4: Environment Configuration

1. **Configure Staging Environment**
```bash
# Create staging buckets
gcloud storage buckets create gs://perkieprints-staging-cache
gcloud storage buckets create gs://perkieprints-staging-customer-images

# Deploy staging
gcloud run services replace backend/inspirenet-api/deploy-staging.yaml --region=us-central1
```

2. **Set Environment Variables**
```bash
# Production environment variables
export RATE_LIMIT_PER_IP=100
export RATE_LIMIT_PER_SESSION=20
export ENABLE_RATE_LIMITING=true
export DAILY_BUDGET_USD=200
export MONTHLY_BUDGET_USD=5000
export MAX_SCALE=5
export MIN_SCALE_BUSINESS_HOURS=1
export MIN_SCALE_OFF_HOURS=0
```

#### Day 5-7: Testing and Validation

1. **Run Comprehensive Tests**
```bash
# Make scripts executable
chmod +x scripts/deployment/*.sh

# Validate staging environment
./scripts/deployment/validate-staging-deployment.sh

# Check results and fix any issues
```

2. **Performance Baseline Testing**
```python
# Run in Python environment
from backend.inspirenet_api.src.performance_benchmarks import performance_benchmark_system
import asyncio

# Run comprehensive benchmark suite
async def run_baseline_tests():
    results = await performance_benchmark_system.run_comprehensive_benchmark_suite()
    print("Baseline performance established")
    return results

# Execute
asyncio.run(run_baseline_tests())
```

### Phase 2: Production Deployment (Week 2)

#### Production Deployment Process

1. **Pre-Deployment Checklist**
- [ ] Staging validation passed
- [ ] Performance baselines established
- [ ] Security middleware tested
- [ ] Monitoring systems active
- [ ] Cost tracking configured
- [ ] Team notified of deployment window

2. **Execute Deployment**
```bash
# Set up Slack notifications (optional)
export SLACK_WEBHOOK_URL="your-slack-webhook-url"

# Run production deployment
./scripts/deployment/production-deployment.sh

# Monitor deployment progress
watch -n 30 'curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health | jq .'
```

3. **Post-Deployment Validation**
```bash
# Test key endpoints
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/model-info

# Test image processing (with valid test image)
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process \
  -F "image=@test-pet-image.jpg" \
  -F "effects=[\"blackwhite\"]"
```

### Phase 3: Monitoring and Optimization (Week 3-4)

#### Dashboard Setup

1. **Google Cloud Monitoring Dashboard**
```yaml
# Create monitoring dashboard with key metrics
displayName: "Perkie Prints API Monitoring"
mosaicLayout:
  tiles:
    - displayName: "Request Rate"
    - displayName: "Error Rate" 
    - displayName: "Response Time"
    - displayName: "Memory Usage"
    - displayName: "GPU Utilization"
    - displayName: "Cost Tracking"
```

2. **Custom Metrics Endpoints**
```python
@app.get("/metrics")
async def get_metrics():
    """Custom metrics endpoint for monitoring"""
    return performance_monitor.get_current_stats()

@app.get("/cost-report")
async def get_cost_report():
    """Cost analysis endpoint"""
    return cost_optimizer.get_cost_report(days=7)

@app.get("/kpi-report")
async def get_kpi_report():
    """KPI performance report"""
    return performance_benchmark_system.get_kpi_report(days=7)
```

#### Alerting Configuration

1. **Google Cloud Alerting Policies**
```bash
# Create alerting policies
gcloud alpha monitoring policies create --policy-from-file=monitoring-policies.yaml
```

Example `monitoring-policies.yaml`:
```yaml
displayName: "High Error Rate"
conditions:
  - displayName: "Error rate > 5%"
    conditionThreshold:
      filter: 'resource.type="cloud_run_revision"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.05
      duration: "300s"
notificationChannels:
  - "projects/perkieprints-processing/notificationChannels/YOUR_CHANNEL_ID"
```

2. **Custom Alerting Integration**
```python
# Add to monitoring.py
async def send_alert(alert_type: str, message: str, severity: str = "warning"):
    """Send alert to configured channels"""
    # Slack integration
    if os.getenv('SLACK_WEBHOOK_URL'):
        await send_slack_alert(message, severity)
    
    # Email integration
    if os.getenv('ALERT_EMAIL'):
        await send_email_alert(message, severity)
    
    # PagerDuty for critical alerts
    if severity == "critical" and os.getenv('PAGERDUTY_KEY'):
        await trigger_pagerduty_alert(message)
```

## Daily Operations

### Morning Health Check (Automated)
```bash
#!/bin/bash
# daily-health-check.sh

echo "=== Daily Health Check $(date) ==="

# Check service health
health=$(curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health | jq -r '.status')
echo "Service Health: $health"

# Check cost status
cost_report=$(curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/cost-report)
daily_cost=$(echo "$cost_report" | jq -r '.daily_breakdown | to_entries | last | .value.cost')
echo "Yesterday's Cost: $${daily_cost}"

# Check KPI status
kpi_report=$(curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/kpi-report)
violations=$(echo "$kpi_report" | jq -r '.violation_count')
echo "KPI Violations: $violations"

# Summary
if [[ "$health" == "healthy" ]] && [[ "$violations" -eq 0 ]] && (( $(echo "$daily_cost < 200" | bc -l) )); then
    echo "✅ All systems healthy"
else
    echo "⚠️ Issues detected - check logs"
fi
```

### Weekly Review Process
```python
# weekly-review.py
import asyncio
from datetime import datetime, timedelta

async def generate_weekly_report():
    """Generate comprehensive weekly report"""
    
    # Performance report
    perf_report = performance_benchmark_system.get_kpi_report(days=7)
    
    # Cost analysis
    cost_report = cost_optimizer.get_cost_report(days=7)
    
    # System metrics
    system_stats = performance_monitor.get_current_stats()
    
    # Generate recommendations
    recommendations = cost_optimizer.get_optimization_recommendations()
    
    report = {
        'week_ending': datetime.now().strftime('%Y-%m-%d'),
        'performance': perf_report,
        'costs': cost_report,
        'system_health': system_stats,
        'recommendations': recommendations,
        'action_items': generate_action_items(perf_report, cost_report)
    }
    
    # Save report
    with open(f'weekly-report-{datetime.now().strftime("%Y-%m-%d")}.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    return report
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. High Cold Start Times (> 35 seconds)
```bash
# Check current scaling configuration
gcloud run services describe inspirenet-bg-removal-api --region=us-central1 --format="value(spec.template.metadata.annotations)"

# Temporarily increase minScale
gcloud run services update inspirenet-bg-removal-api --region=us-central1 --min-instances=1

# Monitor improvement
watch -n 10 'curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health | jq ".model.load_progress"'
```

#### 2. High Error Rates (> 5%)
```bash
# Check recent errors
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=20 --format=json

# Check rate limiting status
curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health | jq '.system'

# Adjust rate limits if needed (in security_middleware.py)
export RATE_LIMIT_PER_IP=150  # Temporarily increase
```

#### 3. Budget Overrun
```bash
# Check current spend
curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/cost-report | jq '.daily_breakdown'

# Enable emergency cost optimization
export EMERGENCY_COST_MODE=true

# Reduce scaling
gcloud run services update inspirenet-bg-removal-api --region=us-central1 --max-instances=2
```

#### 4. Memory Pressure (> 90% usage)
```python
# Force memory cleanup via API
import requests
response = requests.post('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/cleanup-memory')

# Check memory status
response = requests.get('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health')
print(response.json()['memory'])
```

## Rollback Procedures

### Emergency Rollback
```bash
# Get previous revision
PREVIOUS_REVISION=$(gcloud run services describe inspirenet-bg-removal-api --region=us-central1 --format="value(status.traffic[1].revisionName)")

# Immediate rollback
gcloud run services update-traffic inspirenet-bg-removal-api --region=us-central1 --to-revisions="$PREVIOUS_REVISION=100"

# Verify rollback
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health
```

### Partial Rollback
```bash
# Split traffic 50/50 between current and previous
gcloud run services update-traffic inspirenet-bg-removal-api --region=us-central1 --to-revisions="$CURRENT_REVISION=50,$PREVIOUS_REVISION=50"

# Monitor and adjust as needed
```

## Performance Optimization Tips

### 1. Pre-warming Strategy
```javascript
// Frontend integration for intelligent pre-warming
const PreWarmingManager = {
  shouldPreWarm() {
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour <= 23;
    const lastProcessed = localStorage.getItem('lastProcessingTime');
    const timeSinceLastProcessed = Date.now() - parseInt(lastProcessed || '0');
    
    return isBusinessHours && timeSinceLastProcessed > 10 * 60 * 1000; // 10 minutes
  },
  
  async preWarm() {
    if (this.shouldPreWarm()) {
      try {
        await fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup', {
          method: 'POST',
          mode: 'no-cors'
        });
        console.log('API pre-warmed successfully');
      } catch (error) {
        console.log('Pre-warming failed (non-critical):', error);
      }
    }
  }
};

// Trigger on user interaction
document.addEventListener('mouseover', (e) => {
  if (e.target.closest('.upload-button')) {
    PreWarmingManager.preWarm();
  }
}, { once: true });
```

### 2. Cost Optimization
```python
# Dynamic scaling based on time and traffic
import schedule
import time

def adjust_scaling_for_business_hours():
    """Adjust scaling for business hours"""
    current_hour = datetime.now().hour
    
    if 9 <= current_hour <= 23:  # Business hours
        min_instances = 1
        max_instances = 5
    else:  # Off hours
        min_instances = 0
        max_instances = 2
    
    # Update Cloud Run configuration
    update_cloud_run_scaling(min_instances, max_instances)

# Schedule scaling adjustments
schedule.every().hour.do(adjust_scaling_for_business_hours)
```

## Success Metrics and KPIs

Track these metrics daily:

- **Cold Start Time**: < 35 seconds (99th percentile)
- **Warm Processing**: < 5 seconds (95th percentile)
- **Availability**: > 99.5% overall, > 99.9% during peak hours
- **Error Rate**: < 2%
- **Cost Efficiency**: < $65/1000 images
- **Customer Satisfaction**: > 95%

## Maintenance Schedule

- **Daily**: Health checks, cost monitoring
- **Weekly**: Performance review, optimization adjustments
- **Monthly**: Security updates, capacity planning
- **Quarterly**: Architecture review, technology updates

This implementation provides a robust, cost-effective, and scalable foundation for Perkie Prints' AI-powered pet image processing service.