# Pet Count as Line Item Property - Technical Requirements

## Business Objective
Convert "number of pets" from a product variant to a line item property, freeing up a variant slot for more valuable options (frames, finishes, etc.) while maintaining all pricing and fulfillment capabilities. This change is expected to generate $85-125k annual revenue opportunity with 700-1,000% ROI.

## Technical Requirements

### 1. Product Template Modifications
**Acceptance Criteria**: Pet count selection works as line item property without breaking existing functionality

#### 1.1 Variant Picker Updates
- **Remove**: Pet count option from `product.options_with_values` iteration
- **Location**: `sections/main-product.liquid` line 432-433 (variant_picker block)
- **Impact**: Variant picker will only show Color and Size options
- **Fallback**: Must handle products that still have pet count as variant during migration

#### 1.2 Pet Selector Integration
- **Current**: `snippets/ks-product-pet-selector.liquid` updates variant based on pet count
- **Required Change**: Update to set line item property instead of variant
- **Location**: Lines 2360-2380 in `updateVariantForPetCount()` function
- **New Behavior**:
  ```javascript
  // Instead of updating variant selector
  // Set hidden line item property field
  var petCountField = document.querySelector('[name="properties[_pet_count]"]');
  if (!petCountField) {
    petCountField = document.createElement('input');
    petCountField.type = 'hidden';
    petCountField.name = 'properties[_pet_count]';
    form.appendChild(petCountField);
  }
  petCountField.value = petCount.toString();
  ```

#### 1.3 Form Field Structure
- **Add**: Hidden input for pet count property
- **Location**: Within product form in `sections/main-product.liquid`
- **Format**: `<input type="hidden" name="properties[_pet_count]" value="1">`
- **Integration**: Sync with existing properties like `_pet_name`, `_font_style`, `_has_custom_pet`

### 2. Pricing Logic Implementation

#### 2.1 App-Based Solution (Recommended for Phase 1)
**Acceptance Criteria**: Dynamic pricing adjusts based on pet count line item property

**Recommended Apps** (in order of preference):
1. **Bold Product Options** ($19.99/month)
   - Native line item property pricing
   - No code modifications needed
   - Instant setup with pricing rules

2. **Infinite Options by ShopPad** ($14.99/month)
   - Conditional logic support
   - Works with existing Dawn theme
   - Good mobile optimization

3. **Product Customizer** ($9.99/month)
   - Budget option
   - Basic property pricing
   - May need CSS adjustments

**Configuration Required**:
- Rule: If `properties[_pet_count]` = "1" then price = base
- Rule: If `properties[_pet_count]` = "2" then price = base + $10
- Rule: If `properties[_pet_count]` = "3" then price = base + $15
- Rule: If `properties[_pet_count]` = "4+" then price = base + $20

#### 2.2 Script-Based Solution (Phase 2 - if needed)
**For Shopify Plus Only** - Using Script Editor
```ruby
# Line item pricing script
Input.cart.line_items.each do |line_item|
  pet_count = line_item.properties["_pet_count"]

  if pet_count
    case pet_count.to_i
    when 2
      line_item.change_line_price(line_item.line_price + Money.new(cents: 1000))
    when 3
      line_item.change_line_price(line_item.line_price + Money.new(cents: 1500))
    when 4..10
      line_item.change_line_price(line_item.line_price + Money.new(cents: 2000))
    end
  end
end
```

#### 2.3 Custom JavaScript Solution (Fallback)
**Display-only pricing** - Shows adjusted price before checkout
```javascript
// In pet-processor.js or new pricing module
function updateDisplayPrice(petCount) {
  const basePrice = parseFloat(document.querySelector('[data-price]').dataset.price);
  const adjustment = getPriceAdjustment(petCount);
  const newPrice = basePrice + adjustment;

  // Update display
  document.querySelector('.price__regular').textContent = formatMoney(newPrice);

  // Store adjustment for cart
  document.querySelector('[name="properties[_price_adjustment]"]').value = adjustment;
}
```

### 3. Cart and Checkout Display

#### 3.1 Cart Drawer Updates
**Acceptance Criteria**: Pet count displays correctly in cart with appropriate pricing

**File**: `snippets/cart-drawer.liquid`
**Requirements**:
- Display pet count from `item.properties._pet_count`
- Show price adjustment if applicable
- Format: "Number of Pets: 2 (+$10.00)"
- Maintain existing property display for `_pet_name`, `_font_style`

#### 3.2 Checkout Display
**Requirements**:
- Properties automatically pass to checkout
- Fulfillment team sees pet count in order details
- Format consistent with other line item properties

### 4. Migration Strategy

#### 4.1 Product Catalog Migration
**Acceptance Criteria**: All products successfully migrated without customer disruption

**Phase 1: Test Products** (Week 1)
- Select 5 top products for initial migration
- Create duplicate products with new structure
- A/B test with 20% traffic

**Phase 2: Progressive Rollout** (Weeks 2-3)
- Migrate products in batches of 10-20
- Monitor conversion metrics after each batch
- Rollback capability per product

**Phase 3: Full Migration** (Week 4)
- Complete remaining products
- Archive old variant-based products
- Update all internal links

#### 4.2 Data Migration Script
```javascript
// Shopify Admin API migration script
async function migrateProduct(productId) {
  const product = await getProduct(productId);

  // Remove pet count from options
  const newOptions = product.options.filter(opt =>
    !opt.name.toLowerCase().includes('pet') &&
    !opt.name.toLowerCase().includes('number')
  );

  // Update product
  await updateProduct(productId, {
    options: newOptions,
    metafields: [
      {
        namespace: 'custom',
        key: 'supports_pet_count',
        value: 'true',
        type: 'boolean'
      }
    ]
  });

  // Rebuild variants without pet count dimension
  await rebuildVariants(productId);
}
```

### 5. Fulfillment Workflow Updates

#### 5.1 Order Processing
**Acceptance Criteria**: Fulfillment team can process orders with new property structure

**Requirements**:
- Pet count visible in order details
- Packing slip shows pet count
- Design team receives pet count in work order

#### 5.2 Admin Order View
- Add pet count to order line item display
- Update order printer templates
- Train fulfillment team on new format

#### 5.3 Integration Updates
- Update any third-party fulfillment integrations
- Ensure Zapier/webhooks capture new properties
- Test with production management tools

### 6. Testing Requirements

#### 6.1 Functional Testing
- [ ] Pet selector updates line item property correctly
- [ ] Pricing adjusts based on pet count
- [ ] Cart displays pet count and price adjustment
- [ ] Checkout preserves all properties
- [ ] Order confirmation shows correct details
- [ ] Fulfillment receives all necessary data

#### 6.2 Cross-Browser Testing
- [ ] Chrome (Desktop & Mobile)
- [ ] Safari (Desktop & Mobile)
- [ ] Firefox
- [ ] Edge
- [ ] Older browsers (ES5 compatibility)

#### 6.3 Performance Testing
- [ ] Page load time < 3s with new structure
- [ ] No JavaScript errors in console
- [ ] Mobile performance maintained (70% traffic)

#### 6.4 Edge Cases
- [ ] Customer changes pet count in cart
- [ ] Multiple products with different pet counts
- [ ] Discount codes apply correctly
- [ ] Inventory tracking unaffected
- [ ] Gift cards work properly

### 7. Rollback Plan

#### 7.1 Immediate Rollback Triggers
- Conversion rate drops >5%
- Cart abandonment increases >10%
- Critical pricing errors
- Fulfillment workflow breaks

#### 7.2 Rollback Process
1. **Hour 0**: Detect issue via monitoring
2. **Hour 0-1**: Revert product templates via Git
3. **Hour 1-2**: Restore variant-based products
4. **Hour 2-4**: Verify all systems operational
5. **Hour 4+**: Root cause analysis

#### 7.3 Dual-Path Support
- Maintain both systems for 30 days
- Flag products with migration status
- Support team trained on both approaches

### 8. Success Metrics

#### 8.1 Primary KPIs
- **Conversion Rate**: Target +2-3% improvement
- **AOV**: Target +$10-15 increase
- **Cart Abandonment**: Target -5% reduction
- **Support Tickets**: Target <1% increase

#### 8.2 Secondary Metrics
- Page load performance
- Variant selection time
- Customer satisfaction scores
- Fulfillment accuracy

#### 8.3 Tracking Implementation
```javascript
// Analytics tracking for migration
window.dataLayer.push({
  'event': 'pet_count_property_migration',
  'product_id': productId,
  'pet_count': petCount,
  'migration_version': 'v2',
  'user_segment': 'test_group_a'
});
```

## Technical Considerations

### Performance Optimization
- **Caching**: Cache price calculations for common pet counts
- **Lazy Loading**: Load pricing logic only when pet selector is present
- **CDN**: Ensure pricing app assets are CDN-delivered
- **Mobile**: Minimize JavaScript execution on mobile devices

### Scalability Planning
- Design for future property additions (background styles, etc.)
- Ensure solution handles 100+ products efficiently
- Plan for seasonal traffic spikes
- Consider international pricing variations

### Integration Points
**Existing Systems to Update**:
1. **PetStorage System**: Update to track pet count separately
2. **Font Selector**: Ensure compatibility with new structure
3. **Analytics**: Update tracking for new property
4. **Email Confirmations**: Include pet count in order emails
5. **Customer Accounts**: Display pet count in order history

## Risk Mitigation

### Technical Risks
- **Pricing App Dependency**: Have fallback if app fails
- **Migration Errors**: Test thoroughly on staging first
- **Browser Compatibility**: Extensive ES5 testing required

### Business Risks
- **Customer Confusion**: Clear migration communication
- **Fulfillment Errors**: Comprehensive team training
- **Revenue Impact**: Monitor closely with rollback ready

## Implementation Timeline

| Week | Phase | Tasks | Success Criteria |
|------|-------|-------|------------------|
| 1 | Planning & Setup | - Select pricing app<br>- Create test products<br>- Update pet selector logic | Test products working with properties |
| 2 | Development | - Implement pricing logic<br>- Update cart display<br>- Migration scripts | Full feature working on staging |
| 3 | Testing & Training | - QA testing<br>- Team training<br>- A/B test setup | <1% error rate in testing |
| 4 | Rollout | - 20% traffic test<br>- Progressive migration<br>- Monitor metrics | Positive metrics confirmed |
| 5-6 | Optimization | - Full migration<br>- New variant options<br>- Performance tuning | 100% migrated, ROI tracking positive |

## Dependencies

### External Dependencies
- Pricing app selection and setup
- Shopify API rate limits for migration
- Fulfillment team availability for training

### Internal Dependencies
- Product team approval for new variant options
- Design team for variant option assets
- Marketing for migration communication

## Approval Requirements

- [ ] Technical team review
- [ ] Product owner sign-off
- [ ] Fulfillment team acknowledgment
- [ ] Finance approval for app costs
- [ ] Customer service briefing

---

*Document created: 2025-09-18*
*Next review: After Week 1 implementation*
*Owner: Technical Implementation Team*