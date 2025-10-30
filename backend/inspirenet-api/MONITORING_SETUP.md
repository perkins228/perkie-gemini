# Monitoring Dashboard Setup Guide

## Overview
Simple monitoring dashboard using FREE Google Cloud Console (no additional tools needed).

**Time Required**: 30 minutes
**Cost**: $0 (uses existing Cloud Run metrics)

---

## Step 1: Access Cloud Run Metrics (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **Cloud Run** → Select `inspirenet-bg-removal-api` service
3. Click **METRICS** tab at the top

You'll see default metrics:
- Request count
- Request latency
- Container instance count
- Container CPU utilization
- Container memory utilization

---

## Step 2: Create Custom Dashboard (15 minutes)

### 2.1 Open Monitoring Dashboard

1. In Cloud Console, go to **Monitoring** → **Dashboards**
2. Click **+ CREATE DASHBOARD**
3. Name it: "InSPyReNet API - Production Monitoring"

### 2.2 Add Request Rate Chart

1. Click **+ ADD WIDGET** → **Line Chart**
2. Configure:
   - **Title**: "API Requests per Minute"
   - **Resource Type**: Cloud Run Revision
   - **Metric**: `Request count`
   - **Filter**: `service_name = "inspirenet-bg-removal-api"`
   - **Aggregation**: Rate (1 minute)
   - **Group By**: (none)
3. Click **APPLY**

### 2.3 Add Error Rate Chart

1. Click **+ ADD WIDGET** → **Line Chart**
2. Configure:
   - **Title**: "Error Rate (4xx/5xx)"
   - **Resource Type**: Cloud Run Revision
   - **Metric**: `Request count`
   - **Filter**:
     - `service_name = "inspirenet-bg-removal-api"`
     - `response_code_class != "2xx"`
   - **Aggregation**: Rate (1 minute)
   - **Group By**: `response_code_class`
3. Click **APPLY**

### 2.4 Add Cold Start Frequency

1. Click **+ ADD WIDGET** → **Line Chart**
2. Configure:
   - **Title**: "Container Instances (Cold Starts)"
   - **Resource Type**: Cloud Run Revision
   - **Metric**: `Container instance count`
   - **Filter**: `service_name = "inspirenet-bg-removal-api"`
   - **Aggregation**: Mean (1 minute)
3. Click **APPLY**

### 2.5 Add Response Time (P95)

1. Click **+ ADD WIDGET** → **Line Chart**
2. Configure:
   - **Title**: "Response Time (95th Percentile)"
   - **Resource Type**: Cloud Run Revision
   - **Metric**: `Request latency`
   - **Filter**: `service_name = "inspirenet-bg-removal-api"`
   - **Aggregation**: 95th percentile (1 minute)
3. Click **APPLY**

### 2.6 Add Memory Usage

1. Click **+ ADD WIDGET** → **Line Chart**
2. Configure:
   - **Title**: "Memory Utilization"
   - **Resource Type**: Cloud Run Revision
   - **Metric**: `Container memory utilization`
   - **Filter**: `service_name = "inspirenet-bg-removal-api"`
   - **Aggregation**: Mean (1 minute)
3. Click **APPLY**

---

## Step 3: Set Up Simple Alerts (Optional, 10 minutes)

### 3.1 High Error Rate Alert

1. Go to **Monitoring** → **Alerting** → **+ CREATE POLICY**
2. Configure:
   - **Name**: "High API Error Rate"
   - **Condition**:
     - Resource: Cloud Run Revision
     - Metric: Request count
     - Filter: `response_code_class != "2xx"`
     - Threshold: > 5 errors per minute for 5 minutes
   - **Notification**: Email to your address
3. Click **SAVE**

### 3.2 High Memory Alert

1. **+ CREATE POLICY**
2. Configure:
   - **Name**: "High Memory Usage"
   - **Condition**:
     - Resource: Cloud Run Revision
     - Metric: Container memory utilization
     - Threshold: > 80% for 10 minutes
   - **Notification**: Email
3. Click **SAVE**

---

## What You'll See

### Normal Operation
- **Requests/min**: 0-10 (mostly zeros with occasional spikes)
- **Error rate**: 0
- **Container instances**: 0 (cold) → spikes to 1 when request comes in
- **Response time P95**: 3-5s (warm), 30-60s (cold start)
- **Memory**: 40-60% during processing

### Problem Indicators
- **High error rate**: > 5 errors/min → Check logs
- **High response time**: > 60s consistently → Model loading issue
- **Memory > 80%**: Risk of OOM crashes → Reduce batch size
- **Many cold starts**: Every request is slow → Consider warming (after launch)

---

## How to Use

1. **Check daily**: Open dashboard, scan for red flags
2. **Before deploy**: Check current traffic patterns
3. **After deploy**: Monitor for 1 hour for errors
4. **Debug issues**: Click any metric → **View in Metrics Explorer** → Drill down

---

## Cost

**$0** - All metrics are free for Cloud Run services

No need for:
- ❌ Third-party APM tools ($50-200/month)
- ❌ Custom telemetry infrastructure
- ❌ Complex monitoring setup

Just use what's already there.

---

## Next Steps

1. **Create dashboard now** (30 minutes)
2. **Observe for 1 week** with staging traffic
3. **Adjust thresholds** based on actual patterns
4. **Add more metrics** only if needed (not before!)

Remember: **Simple monitoring > No monitoring > Over-engineered monitoring**
