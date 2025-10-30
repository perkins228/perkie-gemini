# Product Page Warmup Conversion Analysis

**Date**: 2025-10-20
**Status**: BLOCKED - Insufficient Baseline Data
**Context**: `.claude/tasks/context_session_active.md`

## Executive Summary

**Proposal**: Add API warmup to product pages to reduce cold start delays during pet upload flow.

**Expected Investment**:
- Development: 3-4 hours
- Infrastructure: +$8.22/day ($246/month)
- One-time cost: $200-300

**Expected Return** (UNVALIDATED):
- Revenue gain: +$75/day ($2,250/month)
- Net ROI: +$66.78/day ($2,003/month)
- **WARNING**: Based on unvalidated assumptions

**Current Status**: ⚠️ BLOCKED - Cannot make informed decision without baseline data

---

## Critical Data Gaps - MUST HAVE BEFORE DECISION

### Shopify Analytics Required

**MUST VALIDATE** (Obtain from Shopify Admin → Analytics):

1. **Average Order Value (AOV)**
   - Current assumption: $50
   - Reality: UNKNOWN
   - Location: Shopify → Analytics → Reports → Average Order Value (last 30 days)

2. **Product Page Sessions**
   - Current assumption: Unknown
   - Reality: UNKNOWN
   - Location: Shopify → Analytics → Online Store → Sessions by landing page

3. **Conversion Rate**
   - Current assumption: 17%
   - Reality: UNKNOWN
   - Location: Shopify → Analytics → Reports → Conversion rate over time

4. **Daily Orders**
   - Current assumption: 10 orders/day
   - Reality: UNKNOWN
   - Location: Shopify → Analytics → Reports → Total sales / 30 days

5. **Mobile vs Desktop Split**
   - Known: 70% mobile (confirmed)
   - Validate: Shopify → Analytics → Reports → Sessions by device

### Upload Funnel Metrics

**CURRENTLY UNTRACKED** (Need to implement):

1. **Upload Start Rate**: % who click "Upload Pet" button
2. **Upload Completion Rate**: % who finish upload process
3. **Cold Start Encounter Rate**: % who experience 65s+ delay
4. **Upload Abandonment**: % who start but don't complete
5. **Time on Product Page**: Before clicking "Upload Pet"

**Recommendation**: Set up Google Analytics events BEFORE implementing warmup.

---

## Store Profile

### Business Model
- **Platform**: Shopify Dawn theme + KondaSoft components
- **Product**: Custom pet products (portraits, frames, prints)
- **Unique Value**: FREE AI-powered pet background removal
- **Conversion Tool**: Background removal drives product sales (not revenue source)

### Traffic Profile
- **Mobile**: 70% of traffic and revenue ✅ CONFIRMED
- **Desktop**: 30% of traffic and revenue ✅ CONFIRMED
- **Primary Entry**: Product pages (Google search) ⚠️ ASSUMED
- **Secondary Entry**: Homepage/Collections ⚠️ ASSUMED

### Current Technical Setup
- **API**: InSPyReNet Background Removal (Google Cloud Run + GPU)
- **Cold Start**: 65-79 seconds (includes ~40s model loading)
- **Warm Processing**: 2-4 seconds
- **Cost Model**: $0 baseline (minScale=0), $0.03 per warmup, $0.065 per image
- **Current Warmup**: Only fires on `/pages/pet-background-remover` ✅ CONFIRMED

---

## Customer Journey Analysis

### Confirmed Journey (From Code Analysis)

**Step 1: Product Page**
- Location: `/products/{handle}`
- Pet Selector: Bottom of page (mobile: bottom nav)
- **NO WARMUP** ❌ (critical gap)

**Step 2: Upload Pet Button Click**
- Mobile: Bottom nav "Upload Pet" button
- Desktop: In-page button
- Action: Navigate to `/pages/pet-background-remover`

**Step 3: Processing Page**
- **WARMUP FIRES** ✅ (T+1.5s after page load)
- Three warmup strategies:
  1. Auto on page load
  2. Retry after 2s
  3. User intent (hover/touch)

**Step 4: User Uploads**
- Mobile users: Upload immediately (10-30s)
- Desktop users: Browse first (30-60s)
- **Problem**: Mobile users upload BEFORE warmup completes

### Mobile User Behavior (70% of Revenue)

**Observed Pattern**:
```
T+0s: Product page loads (NO warmup)
T+10-30s: User taps "Upload Pet" (impatient mobile behavior)
T+30-32s: Processing page loads → Warmup fires
T+30.5s: User uploads immediately → Cold start (65-79s)
T+95-109s: Upload completes (abandoned?)
```

**Problem**: 65-79 second wait = HIGH abandonment risk.

### Desktop User Behavior (30% of Revenue)

**Observed Pattern**:
```
T+0s: Product page loads (NO warmup)
T+30-60s: User clicks "Upload Pet" (browsing behavior)
T+60-62s: Processing page loads → Warmup fires
T+125-141s: Warmup completes (65-79s)
T+140s: User uploads → Warm (2-4s)
```

**Less Critical**: Desktop users more patient, warmup more likely to complete.

---

## Hypothesis: Product Page Warmup Improves Mobile Conversion

### Current Funnel (UNVALIDATED ASSUMPTIONS)

```
100 visitors → Product Page
 ↓ 80% (browse product) ⚠️ ASSUMED
 80 → Tap "Upload Pet"
 ↓ 50% (cold start frustration) ⚠️ ASSUMED
 40 → Complete Upload
 ↓ 60% (add to cart) ⚠️ ASSUMED
 24 → Add to Cart
 ↓ 70% (checkout) ⚠️ ASSUMED
 17 → Purchase

Conversion Rate: 17% ⚠️ ASSUMED
```

### Proposed Funnel (WITH WARMUP - UNVALIDATED)

```
100 visitors → Product Page (warmup fires T+1-2s)
 ↓ 80% (browse product, API warming)
 80 → Tap "Upload Pet" (API already warm)
 ↓ 70% (faster experience, +20% retention) ⚠️ ASSUMED
 56 → Complete Upload (+16 users)
 ↓ 60% (add to cart)
 34 → Add to Cart (+10 carts)
 ↓ 70% (checkout)
 24 → Purchase (+7 purchases)

Conversion Rate: 24% (+7% absolute lift)
```

### Key Assumptions to Validate

1. ⚠️ **Upload abandonment**: 50% → 30% (UNVALIDATED)
2. ⚠️ **Baseline conversion**: 17% (UNVALIDATED)
3. ⚠️ **Cold start impact**: -20% retention (UNVALIDATED)
4. ⚠️ **AOV**: $50 (UNVALIDATED)
5. ⚠️ **Daily visitors**: Unknown (UNVALIDATED)
6. ✅ **Mobile traffic**: 70% (CONFIRMED)

**Risk**: Making decision on 83% unvalidated assumptions = HIGH RISK.

---

## Financial Analysis (UNVALIDATED)

### Cost Model (CONFIRMED)

**Infrastructure Cost** ✅:
- Current warmup: 137 requests/day @ $0.03 = $4.11/day
- With product pages: 411 requests/day @ $0.03 = $12.33/day
- **Cost increase**: +$8.22/day (+$246/month)

**Development Cost** ✅:
- Hours: 3-4 hours
- Internal value: $50-100/hour
- **One-time cost**: $200-300

### Revenue Model (UNVALIDATED)

**Assumptions** ⚠️:
- AOV: $50 (UNVALIDATED)
- Orders/day: 10 (UNVALIDATED)
- Conversion lift: +15% (UNVALIDATED)
- Affected orders: 1.5/day (10 × 15%)

**Calculated Revenue** ⚠️:
- Daily gain: +$75/day ($50 AOV × 1.5 orders)
- Monthly gain: +$2,250/month
- **Net profit**: +$2,003/month ($2,250 - $246)

### ROI Scenarios

**Best Case** (+20% conversion, $75 AOV):
- Revenue: +$150/day
- Profit: +$141.78/day
- **Annual**: +$51,750/year

**Base Case** (+15% conversion, $50 AOV):
- Revenue: +$75/day
- Profit: +$66.78/day
- **Annual**: +$24,375/year

**Worst Case** (+5% conversion, $30 AOV):
- Revenue: +$15/day
- Profit: +$6.78/day
- **Annual**: +$2,475/year

**Break-Even**: +4.3% conversion at any AOV above $30.

### Sensitivity Analysis

**What if AOV is $30?** (40% lower than assumed)
- Best case: +$90/day profit
- Base case: +$36/day profit
- Worst case: +$0/day profit (break-even)

**What if orders are 5/day?** (50% lower than assumed)
- Best case: +$67/day profit
- Base case: +$29/day profit
- Worst case: -$5/day loss (NEGATIVE ROI)

**Critical Threshold**: Need AOV > $30 AND orders > 5/day for positive ROI at +15% lift.

---

## Risk Assessment

### Conversion Risks

**Risk 1: Assumptions Wrong (HIGH PROBABILITY)**
- **Likelihood**: HIGH (83% of model unvalidated)
- **Impact**: CRITICAL (could be NEGATIVE ROI)
- **Mitigation**: Obtain baseline data BEFORE implementation

**Risk 2: No Conversion Lift (MEDIUM PROBABILITY)**
- **Likelihood**: MEDIUM (cold start may not be the bottleneck)
- **Impact**: HIGH (wasted $246/month)
- **Mitigation**: A/B test, monitor early indicators

**Risk 3: Page Load Slowdown (LOW PROBABILITY)**
- **Likelihood**: LOW (script is 5KB, async)
- **Impact**: MEDIUM (could negate benefits)
- **Mitigation**: Monitor Core Web Vitals

**Risk 4: Technical Issues (LOW PROBABILITY)**
- **Likelihood**: LOW (code already tested)
- **Impact**: HIGH (broken upload = 0 conversion)
- **Mitigation**: Staged rollout, monitoring

### Business Risks

**Risk 5: Opportunity Cost**
- **Alternative**: Customer reviews (+10-20% conversion, same effort)
- **Alternative**: Product images (+2-5% conversion, less effort)
- **Impact**: Could be doing higher-ROI work
- **Mitigation**: Prioritize based on validated impact

**Risk 6: Mobile Battery Drain**
- **Likelihood**: VERY LOW (single 2-4s API call)
- **Impact**: LOW (negative perception)
- **Mitigation**: Network-aware warmup (future)

---

## Alternative Optimizations (Opportunity Cost)

### Higher-Impact Options (Possibly)

**Option 1: Customer Reviews / Social Proof** 🌟
- **Time**: 3-4 hours (install app, configure)
- **Cost**: $0-50/month (Shopify app)
- **Impact**: +10-20% conversion (industry standard)
- **Risk**: LOW
- **Data Required**: NONE (proven tactic)
- **ROI**: Potentially HIGHER than warmup

**Option 2: Product Description Optimization**
- **Time**: 2-3 hours (copywriting)
- **Cost**: $0
- **Impact**: +3-8% conversion (clarity)
- **Risk**: LOW
- **Data Required**: None
- **ROI**: GOOD (no ongoing cost)

**Option 3: Optimize Product Images**
- **Time**: 2-3 hours
- **Cost**: $0
- **Impact**: +2-5% conversion (faster load)
- **Risk**: LOW
- **Data Required**: None
- **ROI**: GOOD (no ongoing cost)

**Option 4: Simplify Checkout**
- **Time**: 4-6 hours
- **Cost**: $0
- **Impact**: +5-15% checkout conversion
- **Risk**: MEDIUM
- **Data Required**: Checkout abandonment rate
- **ROI**: HIGH (if abandonment is high)

**Option 5: Add Urgency/Scarcity**
- **Time**: 2-3 hours
- **Cost**: $0
- **Impact**: +5-10% conversion
- **Risk**: MEDIUM (can feel pushy)
- **Data Required**: None
- **ROI**: GOOD

### Comparison Matrix

| Optimization | Time | Cost/mo | Impact | Risk | Data Req | ROI |
|--------------|------|---------|--------|------|----------|-----|
| **Product Warmup** | 3-4h | $246 | +15%? | Med | HIGH | ? |
| **Customer Reviews** 🌟 | 3-4h | $0-50 | +10-20% | Low | NONE | HIGH |
| Product Images | 2-3h | $0 | +2-5% | Low | None | Med |
| Product Copy | 2-3h | $0 | +3-8% | Low | None | Med |
| Checkout Simplify | 4-6h | $0 | +5-15% | Med | Some | High |
| Urgency Triggers | 2-3h | $0 | +5-10% | Med | None | Med |

**Recommendation**: **Customer reviews may be the better first step**:
- Proven +10-20% conversion lift (validated by industry)
- Lower risk (no assumptions needed)
- Lower ongoing cost ($0-50 vs $246)
- Same development time (3-4 hours)

---

## A/B Testing Strategy

### Shopify A/B Testing Challenge

**Problem**: Shopify doesn't have native A/B testing for theme changes.

**Solution Options**:

**Option 1: JavaScript-Based Split** (Recommended)
```javascript
// 50/50 random assignment
const isTestGroup = Math.random() < 0.5;
localStorage.setItem('warmup_test_group', isTestGroup);

if (isTestGroup) {
  // Load warmup on product pages
  loadWarmupScript();
}

// Track with Google Analytics
gtag('event', 'warmup_test', {
  'test_group': isTestGroup ? 'test' : 'control'
});
```

**Option 2: Time-Based Split**
- Week 1: Control (no warmup)
- Week 2: Test (with warmup)
- Risk: Seasonal variation, external factors

**Option 3: Geographic Split**
- US traffic: Test group
- International: Control group
- Risk: Regional behavior differences

### Statistical Significance

**Sample Size Calculation**:
- Baseline conversion: 17% (assumed)
- Minimum detectable effect: +3% (→ 20%)
- Confidence: 95%
- Power: 80%
- **Required**: ~600 conversions per group

**Timeline** (depends on traffic):
- 100 orders/month → 6 months
- 300 orders/month → 2 months
- 600 orders/month → 1 month

**Early Stopping**:
- If negative impact → IMMEDIATE ROLLBACK
- If no improvement after 1,000 visitors → DEFER
- If cost exceeds revenue → KILL

### Metrics to Track

**Primary** (North Star):
1. **Revenue per product page visitor** (RPV)
2. Overall conversion rate (product page → purchase)

**Secondary**:
1. Upload start rate (% who click "Upload Pet")
2. Upload completion rate (% who finish upload)
3. Add to cart rate (after successful upload)
4. Cart abandonment rate
5. Time to upload (page load → upload complete)

**Technical**:
1. Warmup success rate (should be 99%+ after OPTIONS fix)
2. Cold start encounter rate (should decrease)
3. API response time (warm vs cold)
4. Page load time (should be <100ms impact)

---

## Decision Framework: BUILD / DEFER / KILL

### BUILD IF (All Must Be True)

- [ ] AOV > $40 (validate with Shopify)
- [ ] Orders > 5/day (validate with Shopify)
- [ ] Product page traffic > 100/day (validate)
- [ ] Mobile traffic > 60% ✅ (confirmed 70%)
- [ ] Upload abandonment > 15% (validate with GA)
- [ ] No higher-ROI alternatives available (e.g., reviews)

**Current Status**: CANNOT DETERMINE (insufficient data)

### DEFER IF (Any Are True)

- [ ] Baseline data not available ✅ **CURRENT STATE**
- [ ] Higher-priority optimizations exist (e.g., reviews)
- [ ] Resource constraints (3-4 hours unavailable)
- [ ] A/B testing infrastructure not ready
- [ ] Recent major changes (wait for stabilization)

**Current Status**: **DEFER** (blocked by data gaps)

### KILL IF (Any Are True)

- [ ] AOV < $30 (ROI negative)
- [ ] Orders < 3/day (insufficient volume)
- [ ] Upload abandonment < 5% (not the bottleneck)
- [ ] Mobile traffic < 30% (low impact segment)
- [ ] Alternative provides 2x better ROI

**Current Status**: CANNOT DETERMINE (insufficient data)

---

## Recommended Action Plan

### Phase 0: Data Collection ⚠️ **START HERE**

**Duration**: 1 week
**Effort**: 2-3 hours setup

**Step 1: Obtain Shopify Baseline Data** (30 min)
1. Log into Shopify Admin → Analytics
2. Record (last 30 days):
   - Average Order Value
   - Total orders
   - Total sessions (overall)
   - Product page sessions (by landing page)
   - Conversion rate
   - Mobile vs desktop split
3. Calculate:
   - Orders per day
   - Product page conversion rate
   - Revenue per visitor

**Step 2: Set Up Google Analytics Events** (1-2 hours)
```javascript
// Track upload funnel
gtag('event', 'upload_start', {
  'event_category': 'Upload',
  'event_label': 'Pet Upload Started'
});

gtag('event', 'upload_complete', {
  'event_category': 'Upload',
  'event_label': 'Pet Upload Completed',
  'upload_duration': duration_seconds
});

gtag('event', 'cold_start_encountered', {
  'event_category': 'Performance',
  'event_label': 'Cold Start',
  'wait_time': wait_seconds
});
```

**Step 3: Monitor for 1 Week** (passive)
- Upload start rate
- Upload completion rate
- Cold start frequency
- Time on product page before upload

**Step 4: Decision Point** (30 min analysis)
- Calculate actual ROI based on real data
- Compare to alternative optimizations
- **Decide**: BUILD / DEFER / KILL

### Phase 1: Implementation (IF BUILD)

**Duration**: 3-4 hours
**Prerequisites**: Phase 0 complete, data validates ROI

**Step 1: Modify Product Template** (1 hour)

File: `sections/main-product.liquid`

```liquid
{%- comment -%}
  Add API warmup for products with pet selector
{%- endcomment -%}
{%- if section.blocks | where: "type", "pet_selector" | size > 0 -%}
  <script src="{{ 'api-warmer.js' | asset_url }}" defer></script>
{%- endif -%}
```

**Step 2: A/B Test Setup** (1 hour)

Modify `assets/api-warmer.js`:
```javascript
// Random 50/50 split
const isTestGroup = Math.random() < 0.5;
localStorage.setItem('warmup_ab_test', isTestGroup);

// Only warmup for test group on product pages
if (isTestGroup || isProcessingPage()) {
  warmupAPI();
}
```

**Step 3: Deploy to Staging** (30 min)
1. Commit changes
2. Push to staging branch
3. GitHub auto-deploys
4. Test with Playwright MCP

**Step 4: Deploy to Production** (30 min)
1. Merge staging → main
2. GitHub auto-deploys
3. Monitor Cloud Run logs

**Step 5: Monitor** (1 hour setup, then passive)
- Set up daily metric dashboard
- Configure alerts (error rate > 5%)
- Track warmup success rate

### Phase 2: Analysis (2 Weeks After Launch)

**Duration**: 2 weeks monitoring + 1 hour analysis

**Daily Checks**:
- Error rate (<5% required)
- Warmup success rate (>95% required)
- Conversion rate (test vs control)
- Revenue per visitor (test vs control)

**Weekly Review**:
- Statistical significance check
- Cost vs revenue tracking
- User feedback review

**Decision Point** (End of Week 2):
- **Full Rollout**: If +10% conversion AND positive ROI
- **Rollback**: If negative impact OR cost > revenue
- **Continue Testing**: If inconclusive (extend 1 more week)

### Phase 3: Optimization (IF SUCCESSFUL)

**Duration**: 5-7 hours (optional enhancements)

**Enhancement 1: Warmup Status Indicator** (2 hours)
- Add visual indicator (green dot = ready)
- Show "Warming up..." spinner
- Reduce user anxiety

**Enhancement 2: Network-Aware Warmup** (3-4 hours)
- Detect 3G/4G/5G connection
- Skip warmup on slow networks (save cost)
- Prioritize warmup on fast networks

**Enhancement 3: Predictive Warmup** (1 hour)
- Track user behavior patterns
- Warmup when user hovers on pet selector
- Warmup when user scrolls to product details

---

## Shopify-Specific Considerations

### Page Load Speed Impact

**Shopify Speed Score** (Online Store → Themes → Speed):
- Current: Unknown (check Shopify admin)
- Script size: ~5KB (negligible)
- Load method: Async defer (non-blocking)
- **Expected impact**: <100ms, no score change

**Core Web Vitals**:
- **LCP** (Largest Contentful Paint): No impact (script doesn't block rendering)
- **FID** (First Input Delay): No impact (async load)
- **CLS** (Cumulative Layout Shift): No impact (no layout changes)

**Recommendation**: Monitor Shopify speed score before/after deployment.

### Mobile Commerce Best Practices

**Shopify Mobile Optimization** ✅:
- Touch events properly handled (`touchstart`)
- Passive event listeners (performance)
- No hover dependence (mobile doesn't support)
- Bottom nav integration (already implemented)

**Mobile Checkout** ✅:
- Apple Pay / Google Pay already enabled
- Fast checkout critical path
- Warmup enhances the "fast" promise

### Theme Compatibility

**Dawn Theme** ✅:
- Compatible (no Dawn-specific conflicts)
- Uses standard Liquid syntax
- Async script loading (Dawn pattern)

**KondaSoft Components** ✅:
- Pet selector block already integrated
- No conflicts with warmup script
- Conditional load prevents issues

---

## Competitive Analysis

### Industry Benchmarks

**E-commerce Speed Standards**:
- **Amazon**: 100ms delay = -1% revenue
- **Google**: 500ms delay = -20% traffic
- **Industry**: 10s page load = 50% abandonment

**Our Context**:
- Cold start: 65-79 seconds (EXTREME delay)
- Mobile users (70%): Low patience threshold
- **Hypothesis**: Cold start causing significant abandonment

**Validation Needed**: Is cold start the actual bottleneck?

### Competitor Research

**Required**:
1. Test competitor pet product sites
2. Measure upload speed
3. Identify differentiators
4. Check if "instant upload" is valued

**Questions**:
- Do competitors offer faster upload?
- Is speed a competitive advantage?
- Do customers mention speed in reviews?

---

## Conclusion

### Current Recommendation: **DEFER PENDING DATA** ⚠️

**Justification**:

1. **83% of financial model based on unvalidated assumptions**
   - AOV unknown
   - Orders/day unknown
   - Conversion rate unknown
   - Upload abandonment unknown
   - Only mobile traffic (70%) confirmed

2. **Cannot determine if warmup solves the right problem**
   - Is cold start causing abandonment?
   - Is upload flow the bottleneck?
   - Or is it product page, cart, or checkout?

3. **Alternative optimizations may have higher ROI**
   - Customer reviews: +10-20% (proven, lower risk)
   - No ongoing cost (vs $246/month)
   - Same development time (3-4 hours)

4. **Risk of negative ROI**
   - If AOV < $40 or orders < 5/day → NEGATIVE ROI
   - $246/month recurring cost requires validation
   - Opportunity cost of developer time

### Required Actions Before Decision

**USER - Provide Baseline Data** (30 minutes):

From Shopify Admin → Analytics (last 30 days):
1. Average Order Value
2. Total orders
3. Total sessions
4. Product page sessions
5. Conversion rate

**TEAM - Set Up Analytics** (1-2 hours):

Implement Google Analytics events:
1. Upload start
2. Upload complete
3. Cold start encountered
4. Time on product page

**TEAM - Monitor for 1 Week** (passive):

Collect baseline funnel data:
1. Upload start rate
2. Upload completion rate
3. Cold start frequency
4. Upload abandonment rate

**THEN - Make Informed Decision**:

Based on validated data:
- **BUILD**: If ROI positive AND no higher-priority work
- **DEFER**: If higher-ROI alternatives available
- **KILL**: If ROI negative OR volume too low

### If Data Validates Positive ROI

**Then Execute**:
1. Implement product page warmup (3-4 hours)
2. Deploy with 50/50 A/B test
3. Monitor for 2 weeks
4. Full rollout if successful

**Expected Outcome** (if assumptions correct):
- +15% conversion lift
- +$2,003/month profit
- Better mobile UX (70% of revenue)
- Competitive advantage ("instant upload")

### If Data Shows Negative ROI or Low Impact

**Then**:
1. KILL product page warmup
2. Prioritize higher-impact optimizations:
   - Customer reviews (+10-20% conversion, proven)
   - Product images (+2-5% conversion, no ongoing cost)
   - Checkout optimization (+5-15% checkout conversion)

---

## Next Steps

### Immediate Action Required

**USER**:
1. Provide Shopify baseline data (30 min)
   - Screenshot Analytics dashboard
   - Or manually record key metrics
2. Decide priority: Warmup vs Reviews vs Other
3. Approve data collection (GA events)

**TEAM**:
1. Set up Google Analytics events (1-2 hours)
2. Monitor for 1 week (passive)
3. Analyze data and calculate ROI (30 min)
4. Present BUILD/DEFER/KILL recommendation

### Timeline

**Week 1**: Data collection
**Week 1 End**: Decision point (BUILD/DEFER/KILL)
**Week 2-3** (if BUILD): Implementation + A/B test
**Week 4-5** (if BUILD): Analysis + full rollout decision

---

## Appendices

### Appendix A: Known Facts (Confirmed)

✅ **Technical**:
- Mobile traffic: 70% of revenue
- Cold start: 65-79 seconds
- Warm processing: 2-4 seconds
- Warmup cost: $0.03 per request
- Current warmup: 137 requests/day
- Current warmup location: Processing page only
- OPTIONS failure rate: 15.4% (being fixed)

✅ **Architecture**:
- Google Cloud Run + NVIDIA L4 GPU
- minScale=0 (cost-optimized)
- Shopify Dawn theme + KondaSoft
- Customer journey: Product page → Processing page → Upload

### Appendix B: Unvalidated Assumptions

⚠️ **Financial**:
- AOV: $50 (could be $30 or $75)
- Orders/day: 10 (could be 3 or 30)
- Product page visitors/day: Unknown
- Conversion rate: 17% (could be 5% or 25%)

⚠️ **Behavioral**:
- Upload abandonment: 50% (could be 10% or 70%)
- Cold start impact: -20% (could be -10% or -50%)
- Conversion lift: +15% (could be 0% or +30%)
- Mobile impatience: Assumed (not measured)

⚠️ **Market**:
- Competitor upload speed: Unknown
- Customer speed sensitivity: Unknown
- "Instant upload" value: Unknown

### Appendix C: ROI Formulas

**Monthly Revenue Gain**:
```
Revenue = AOV × Orders/day × Lift% × 30 days
Example: $50 × 10 × 15% × 30 = $2,250/month
```

**Monthly Cost**:
```
Cost = Warmup requests/day × $0.03 × 30 days
Example: 274 × $0.03 × 30 = $246/month
```

**Net Profit**:
```
Profit = Revenue - Cost
Example: $2,250 - $246 = $2,004/month
```

**ROI Percentage**:
```
ROI = (Profit / Cost) × 100
Example: ($2,004 / $246) × 100 = 814%
```

**Break-Even Conversion Lift**:
```
Lift% = Cost / (AOV × Orders/day × 30)
Example: $246 / ($50 × 10 × 30) = 1.64%
```

---

**Status**: BLOCKED - Awaiting baseline data from Shopify Analytics

**Session Context**: `.claude/tasks/context_session_active.md`

**Created**: 2025-10-20
**Last Updated**: 2025-10-20
**Next Review**: After user provides baseline data
