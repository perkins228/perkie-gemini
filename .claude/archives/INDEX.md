# Claude Archives Index

## Purpose
Historical context and decisions from PerkiePrints development. Reference these when you need detailed implementation history.

## Archive Structure

### 2025-08-social-sharing/
**What**: Complete social sharing implementation journey
**Key Decision**: 38KB server-side → 2KB client-side simplification
**When to Reference**: 
- Implementing new sharing features
- Understanding why we chose client-side approach
- Desktop clipboard implementation details

### 2025-08-infrastructure/
**What**: GPU configuration and deployment decisions
**Key Decision**: minInstances=0 to save $65/day
**When to Reference**:
- Changing Cloud Run configuration
- Debugging deployment issues
- Understanding cost trade-offs

### 2025-08-product-decisions/
**What**: Strategic product decisions and pivots
**Key Decision**: Multi-pet support required (50% of orders)
**When to Reference**:
- Considering feature simplifications
- Understanding business requirements
- Learning from past mistakes (single-pet mode)

## Quick Reference

| Decision | Location | Outcome |
|----------|----------|---------|
| Social Sharing Approach | 2025-08-social-sharing/ | Client-side wins |
| Multi-Pet Support | 2025-08-product-decisions/ | Required for 50% orders |
| GPU Configuration | 2025-08-infrastructure/ | minInstances=0 always |
| Pet ID Generation | 2025-08-product-decisions/ | crypto.randomUUID() |
| White Background | 2025-08-social-sharing/ | Prevents black JPEGs |

## Original Files
- `context_session_001_original.md` - Full 232KB original (60,000+ tokens)
- Archived: 2025-08-29
- Reason: Too large for efficient context processing