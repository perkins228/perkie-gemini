# Sub-Agent Request: Return to Product Page Analysis

## Context
Session: `.claude/tasks/context_session_1736096953.md`

## Business Context
- **Product**: Perkie Prints - Custom pet product e-commerce
- **Key Feature**: FREE AI pet background removal (conversion tool, not revenue source)
- **Traffic**: 70% mobile orders
- **Stage**: NEW build, not yet deployed to customers (staging only)

## Current Conversion Funnel
```
Product Page → Upload Pet → Process (30-60s) → Collections Page → Find Product Again → Add to Cart
```

## Proposed Alternative
```
Product Page → Upload Pet → Process (30-60s) → BACK TO PRODUCT PAGE → Add to Cart
```

## Analysis Questions

### 1. Conversion Rate Impact (shopify-conversion-optimizer)
- Estimate drop-off at "Find Product Again" step
- Industry benchmarks for multi-step product customization flows
- Expected lift from direct return-to-product
- Mobile vs desktop conversion differences
- Cart abandonment risk assessment

### 2. Mobile UX Analysis (mobile-commerce-architect)
- 70% of orders are mobile - how critical is this for mobile users?
- Does forcing collections browse increase mobile abandonment?
- Touch-friendly navigation implications
- Page transition smoothness considerations
- Mobile back button behavior expectations

### 3. Strategic Decision (product-strategy-evaluator)
- Is this P0 (must-have for MVP) or P1/P2 (nice-to-have)?
- ROI estimate: Development time vs conversion lift
- Quick win vs long-term investment assessment
- Alternative solutions (better breadcrumbs, "return to product" button, etc.)
- Build vs defer recommendation with rationale

## Deliverables Required

Each agent should provide:

1. **Estimated Impact**: Quantified where possible (+X% conversion, -Y% abandonment)
2. **Industry Benchmarks**: Similar stores, custom configurators, best practices
3. **Risk Assessment**: What could go wrong?
4. **Implementation Complexity**: Hours/effort estimate
5. **Recommendation**: Build now, defer, or alternative approach

## Technical Constraints

- Shopify theme (Dawn-based with KondaSoft components)
- Must preserve localStorage session data
- Must handle multi-pet scenarios
- Should work across product types
- Need to track referrer/source product page URL

## Success Metrics

If implemented, we'd track:
- Cart add rate after processing
- Time to cart after processing
- Product rediscovery abandonment rate
- Order completion rate
- Mobile vs desktop comparison

## Output Format

Append analysis to `.claude/tasks/context_session_1736096953.md` under:
```
## Return to Product Page Analysis - [Agent Name]
```

Include:
- Key findings
- Data/benchmarks
- Recommendation with confidence level
- Implementation considerations
