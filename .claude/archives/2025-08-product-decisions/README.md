# Product Decisions Archive
*Archived: 2025-08-29*

## Summary
Strategic product decisions, multi-pet support, and critical bug fixes.

## Key Files
- `multi-pet-decisions.md` - Recent multi-pet implementation and fixes

## Critical Decisions

### Multi-Pet Support (ENABLED)
- **Data**: 50% of orders contain multiple pets
- **Decision**: Full multi-pet support required
- **Implementation**: UUID-based unique IDs

### Single-Pet Mode (REVERTED)
- **Attempt**: Simplified to single-pet only
- **Problem**: Would lose 50% of order value
- **Action**: Immediately reverted

### UUID Fix (IMPLEMENTED)
- **Problem**: Date.now() caused ID collisions
- **Solution**: crypto.randomUUID() - one line fix
- **Lesson**: Simple beats complex for new builds

## Key Learnings
1. Check business data before simplifying
2. Don't over-engineer for zero customers
3. Standard solutions (UUID) beat custom implementations
4. 2-minute fixes beat 50-minute architectures