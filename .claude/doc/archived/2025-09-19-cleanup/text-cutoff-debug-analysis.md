# Text Cutoff Debug Analysis - Pet Selector

## Problem Statement
Text descenders (y, p, g, j, q) in "Add your pet photo" are being cut off in the pet-selector component.

**Affected Text**: "Add your pet photo"  
**Affected Letters**: "y" and "p" descenders  
**Location**: `snippets/ks-product-pet-selector.liquid` lines 693-704  

## Current CSS Implementation
```css
.ks-pet-selector__empty-compact .ks-pet-selector__empty-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: #24292e;
  margin: 0;
  line-height: 1;  /* ← SUSPECTED ROOT CAUSE */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## Root Cause Analysis Request

### Context
- **Project**: Perkie Prints Shopify theme (NEW BUILD, not deployed)
- **Traffic**: 70% mobile users
- **Critical Focus**: Mobile UX optimization
- **Component**: Pet selector with compact layout

### Root Cause Hypothesis
`line-height: 1` on line 700 is too restrictive for text containing descenders, causing visual cutoff.

### Investigation Needed
1. **Typography Analysis**: Confirm if line-height: 1 is insufficient for descenders
2. **Mobile Impact Assessment**: How does line-height change affect mobile layout
3. **Cross-browser Testing**: Ensure fix works across all browsers/devices
4. **Layout Stability**: Verify no side effects on compact layout design
5. **Optimal Value**: Determine the minimal line-height that prevents cutoff

### Expected Solution
- Increase line-height to accommodate descenders
- Maintain compact layout integrity
- Ensure mobile responsiveness (70% traffic priority)
- No impact on surrounding elements

### Files Involved
- `snippets/ks-product-pet-selector.liquid` (primary fix location)

### Context File
Please review context from: `.claude/tasks/context_session_001.md`

**Debug specialist requested to provide:**
1. Root cause confirmation
2. Optimal line-height recommendation
3. Mobile impact analysis
4. Implementation risk assessment
5. Testing strategy