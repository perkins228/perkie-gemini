# Google Cloud Storage Bucket Audit
**Date**: 2025-11-08
**Auditor**: Infrastructure Reliability Engineer
**Scope**: All GCS buckets across Perkie Prints projects

## Executive Summary

We have identified **10 GCS buckets** across two Google Cloud projects with a total storage usage of **9.3 GB**. Of these, **6 buckets are actively used**, **2 are empty/unused**, and **2 are system-managed**. The largest storage consumers are production buckets holding customer images and processing cache (4.12 GB combined).

### Key Findings
1. **Active Usage**: 6 buckets are actively used for production and testing
2. **Redundancy Found**: 2 empty buckets created but never used
3. **Naming Confusion**: Multiple buckets with similar purposes but different names
4. **Cost Impact**: ~$0.23/month for storage (minimal), but organizational complexity adds operational overhead

### Immediate Recommendations
1. **DELETE**: 2 empty buckets that were never used
2. **CONSOLIDATE**: Test environment buckets could be merged
3. **DOCUMENT**: Create bucket naming convention and purpose documentation

## Bucket Inventory

### Production Project: perkieprints-processing
**Total Storage**: 9.21 GB across 4 buckets

| Bucket Name | Size | Created | Location | Purpose | Status |
|------------|------|---------|----------|---------|--------|
| `perkieprints-customer-images` | 1.42 GB | 2025-07-26 | us-central1 | Customer uploaded images for processing | ✅ ACTIVE |
| `perkieprints-processing-cache` | 2.7 GB | 2025-07-16 | us-central1 | Cache for processed images (InSPyReNet + Gemini) | ✅ ACTIVE |
| `perkieprints-processing_cloudbuild` | 204 MB | (system) | us-central1 | Cloud Build artifacts | 🔧 SYSTEM |
| `run-sources-perkieprints-processing-us-central1` | 4.87 GB | (system) | us-central1 | Cloud Run source deployments | 🔧 SYSTEM |

### Test Project: gen-lang-client-0601138686 (perkieprints-nanobanana)
**Total Storage**: 70.3 MB across 6 buckets

| Bucket Name | Size | Created | Location | Purpose | Status |
|------------|------|---------|----------|---------|--------|
| `gemini-artistic-753651513695` | 59.7 MB | 2025-10-24 | us-central1 | Gemini API test images (last used: Oct 24) | ⚠️ STALE |
| `perkieprints-nanobanana-cache` | 7.8 MB | (unknown) | us-central1 | Test environment cache | ✅ ACTIVE |
| `perkieprints-nanobanana-customer-images` | 0 B | (unknown) | us-central1 | Test customer images (never used) | ❌ UNUSED |
| `perkieprints-test-uploads` | 0 B | 2025-11-08 | us-central1 | Direct upload feature (created today) | ❌ UNUSED |
| `gen-lang-client-0601138686_cloudbuild` | 2.4 MB | (system) | us-central1 | Cloud Build artifacts | 🔧 SYSTEM |
| `run-sources-gen-lang-client-0601138686-us-central1` | 388 KB | (system) | us-central1 | Cloud Run source deployments | 🔧 SYSTEM |

## Usage Analysis

### Active Buckets (6)

#### Production (2)
1. **perkieprints-processing-cache** (2.7 GB)
   - **Purpose**: Primary cache for all processed images
   - **Structure**: `/gemini-generated/`, `/gemini-originals/`, `/inspirenet-cache/`, `/shares/`
   - **Last Activity**: 2025-11-07 (yesterday - active daily)
   - **Code References**:
     - `backend/inspirenet-api/src/main.py:173`
     - `backend/gemini-artistic-api/src/config.py:26`
   - **Critical**: Used by both InSPyReNet and Gemini APIs

2. **perkieprints-customer-images** (1.42 GB)
   - **Purpose**: Store original customer uploads
   - **Last Activity**: Daily
   - **Code References**: `backend/inspirenet-api/src/main.py:194`
   - **Critical**: Source images for all processing

#### Test Environment (2)
3. **perkieprints-nanobanana-cache** (7.8 MB)
   - **Purpose**: Test environment cache
   - **Usage**: Minimal but active during testing
   - **Keep**: Required for test environment

4. **gemini-artistic-753651513695** (59.7 MB)
   - **Purpose**: Early Gemini API testing
   - **Last Activity**: 2025-10-24 (2 weeks old)
   - **Status**: Contains test data from initial Gemini development
   - **Recommendation**: Archive and delete after confirming no needed data

### Unused Buckets (2)

5. **perkieprints-nanobanana-customer-images** (0 B)
   - **Created**: Unknown
   - **Purpose**: Intended for test customer images
   - **Status**: Never used
   - **Recommendation**: DELETE - redundant with cache bucket

6. **perkieprints-test-uploads** (0 B)
   - **Created**: 2025-11-08 (today)
   - **Purpose**: Direct upload feature implementation
   - **Code References**: `backend/gemini-artistic-api/src/main.py:358,370,401`
   - **Status**: Just created, not yet used
   - **Recommendation**: KEEP - actively being implemented

### System-Managed Buckets (4)
- Cloud Build and Cloud Run buckets are managed by Google Cloud
- Should not be deleted manually
- Cloud Run sources bucket (4.87 GB) could be cleaned of old deployments

## Code References Analysis

### Primary Bucket Usage
```python
# Production API (backend/inspirenet-api/src/main.py)
STORAGE_BUCKET = "perkieprints-processing-cache"          # Line 173
CUSTOMER_STORAGE_BUCKET = "perkieprints-customer-images"  # Line 194

# Gemini API (backend/gemini-artistic-api/src/config.py)
storage_bucket: str = "perkieprints-processing-cache"     # Line 26

# Direct Upload Feature (backend/gemini-artistic-api/src/main.py)
bucket = "perkieprints-test-uploads"                      # Lines 358, 401
```

### Bucket Configuration Patterns
- Production uses environment variables for bucket names
- Test environment hardcodes some bucket names
- Inconsistent naming conventions across services

## Cost Analysis

### Current Monthly Costs (Estimated)
- **Storage**: ~$0.23/month (9.3 GB @ $0.026/GB)
- **Operations**: ~$5-10/month (API requests, egress)
- **Total**: ~$10-15/month

### Potential Savings
- Delete unused buckets: Minimal ($0.00)
- Clean old Cloud Run deployments: ~$0.12/month (4.87 GB)
- Implement lifecycle policies: ~$0.05/month

## Recommendations

### Immediate Actions (This Week)

1. **DELETE Empty Buckets**
   ```bash
   # Delete never-used test bucket
   gsutil rm -r gs://perkieprints-nanobanana-customer-images
   ```

2. **ARCHIVE Old Test Data**
   ```bash
   # Archive and delete old Gemini test data
   gsutil -m cp -r gs://gemini-artistic-753651513695/* \
     gs://perkieprints-nanobanana-cache/archive/gemini-oct-2025/
   gsutil rm -r gs://gemini-artistic-753651513695
   ```

3. **CLEAN Old Deployments**
   ```bash
   # List and remove Cloud Run deployments older than 30 days
   gcloud run revisions list --service=inspirenet-bg-removal-api
   # Delete old revisions keeping last 5
   ```

### Medium-Term Actions (Next Month)

4. **IMPLEMENT Lifecycle Policies**
   - Auto-delete temp files older than 7 days
   - Move to Nearline storage after 30 days for archives
   - Auto-delete test data after 90 days

5. **STANDARDIZE Naming Convention**
   ```
   Production: perkieprints-prod-{purpose}
   Test: perkieprints-test-{purpose}
   Staging: perkieprints-stage-{purpose}
   ```

6. **CONSOLIDATE Test Buckets**
   - Merge `perkieprints-nanobanana-cache` and `perkieprints-test-uploads`
   - Use single test bucket with clear folder structure

### Long-Term Actions (Next Quarter)

7. **IMPLEMENT Monitoring**
   - Set up storage growth alerts
   - Create monthly usage reports
   - Track per-customer storage usage

8. **OPTIMIZE Storage Classes**
   - Use Standard for active data (<30 days)
   - Use Nearline for archives (30-365 days)
   - Use Coldline for compliance (>365 days)

## Security Review

### Public Access
- ✅ All buckets have public access prevention enabled
- ✅ CORS configured only where needed (gemini-artistic bucket)
- ✅ No buckets allow anonymous access

### Permissions
- ⚠️ Review service account permissions (least privilege)
- ⚠️ Audit user access to production buckets
- ⚠️ Implement bucket-level IAM policies

## Compliance Considerations

### Data Retention
- Customer images: No defined retention policy
- Processed images: No automatic cleanup
- **Risk**: Accumulating PII without retention limits

### Recommendations
1. Implement 90-day retention for processed images
2. Implement 1-year retention for original uploads
3. Add customer data deletion API endpoint
4. Document retention policies in privacy policy

## Migration Plan

### Phase 1: Cleanup (Week 1)
- [ ] Delete `perkieprints-nanobanana-customer-images`
- [ ] Archive data from `gemini-artistic-753651513695`
- [ ] Clean old Cloud Run deployments

### Phase 2: Consolidation (Week 2)
- [ ] Update code to use consolidated test bucket
- [ ] Migrate active test data
- [ ] Update environment variables

### Phase 3: Optimization (Month 2)
- [ ] Implement lifecycle policies
- [ ] Set up monitoring
- [ ] Document bucket purposes

## Appendix A: Bucket Access Patterns

### Read/Write Patterns
```
Production Cache: 1000+ reads/day, 100+ writes/day
Customer Images: 100+ writes/day, 500+ reads/day
Test Buckets: <10 operations/day
```

### Geographic Distribution
- All buckets in `us-central1` (optimal for US traffic)
- Consider multi-region for global expansion

## Appendix B: Lifecycle Policy Template

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 7,
          "matchesPrefix": ["temp/", "tmp/"]
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["archive/"]
        }
      }
    ]
  }
}
```

## Appendix C: Monitoring Query

```sql
-- BigQuery query for storage analysis
SELECT
  bucket_name,
  DATE(timestamp) as date,
  SUM(size_bytes) / POW(10,9) as size_gb,
  COUNT(*) as object_count
FROM `project.dataset.storage_logs`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY bucket_name, date
ORDER BY date DESC, size_gb DESC
```

## Conclusion

The GCS bucket infrastructure is functional but shows signs of organic growth without clear governance. The primary issues are organizational rather than technical:

1. **Redundant buckets** created but never used
2. **Inconsistent naming** making purpose unclear
3. **No lifecycle management** leading to accumulation
4. **Missing documentation** of bucket purposes

Total cleanup potential is minimal in terms of cost (~$0.20/month) but significant in terms of operational clarity. Implementing the recommended consolidation and governance will improve maintainability and reduce confusion for future development.

**Next Steps**:
1. Review and approve immediate deletion of unused buckets
2. Schedule consolidation work for next sprint
3. Assign owner for ongoing bucket governance

---

*Document Version*: 1.0
*Last Updated*: 2025-11-08
*Next Review*: 2025-12-01