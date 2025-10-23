# Shopify Modular Pet & Font Selectors Implementation Plan

## Executive Summary

Convert the current monolithic pet-selector and font-selector components into independent Shopify modules that can be selectively added to products. This enables precise control over which customization features appear on specific products, improving conversion rates through targeted functionality.

**Key Benefits:**
- 🎯 Product-specific customization options
- 📱 70% mobile traffic optimization maintained
- 🔧 Shopify-native module management
- 🚀 Improved page load performance (conditional loading)
- 💰 Enhanced conversion through relevant feature presentation

## Current State Analysis

### Existing Architecture
- **Pet Selector**: Complex component in `snippets/ks-product-pet-selector.liquid` (29k+ tokens)
- **Font Selector**: Self-contained component in `snippets/pet-font-selector.liquid` (348 lines)
- **Integration**: Both bundled under single `ks_pet_selector` block type in `sections/main-product.liquid`
- **Control Logic**: Pet selector uses "custom" product tags, Font selector uses `supports_font_styles` metafield

### Dependencies Identified
- Pet Processor V5 JavaScript (`assets/pet-processor-v5-es5.js`)
- Pet Storage system (`assets/pet-storage.js`)
- localStorage persistence
- Custom event communication (`pet:selected`, `font:selected`)
- Mobile-first responsive design (WCAG 2.1 AA compliant)

## Implementation Strategy

### Phase 1: Shopify Block Architecture Conversion

#### 1.1 Create Separate Block Types in main-product.liquid

**File**: `sections/main-product.liquid`

**Changes Required**:
```liquid
// Add new block types to schema
{
  "type": "pet_selector",
  "name": "Pet Customization Module",
  "limit": 1,
  "settings": [
    {
      "type": "checkbox",
      "id": "enable_pet_selector", 
      "label": "Enable Pet Selector",
      "default": true
    },
    {
      "type": "number",
      "id": "custom_image_fee",
      "label": "Custom Image Fee (cents)",
      "default": 0
    },
    {
      "type": "range", 
      "id": "max_pets_per_product",
      "min": 1,
      "max": 10,
      "label": "Maximum Pets Per Product",
      "default": 1
    },
    {
      "type": "text",
      "id": "preview_product_variant_id",
      "label": "Preview Product Variant ID"
    }
  ]
},
{
  "type": "font_selector", 
  "name": "Font Style Module",
  "limit": 1,
  "settings": [
    {
      "type": "checkbox",
      "id": "enable_font_selector",
      "label": "Enable Font Selector", 
      "default": true
    },
    {
      "type": "select",
      "id": "default_font_style",
      "label": "Default Font Style",
      "options": [
        {"value": "classic", "label": "Classic"},
        {"value": "modern", "label": "Modern"},
        {"value": "playful", "label": "Playful"},
        {"value": "elegant", "label": "Elegant"}
      ],
      "default": "classic"
    }
  ]
}
```

**Block Rendering Logic**:
```liquid
{%- when 'pet_selector' -%}
  {% if block.settings.enable_pet_selector %}
    <div class="product__pet-selector" {{ block.shopify_attributes }}>
      {% render 'ks-product-pet-selector-module', 
          product: product, 
          section: section,
          block: block %}
    </div>
  {% endif %}

{%- when 'font_selector' -%}
  {% if block.settings.enable_font_selector %}
    <div class="product__font-selector" {{ block.shopify_attributes }}>
      {% render 'pet-font-selector-module',
          product: product,
          section: section, 
          block: block %}
    </div>
  {% endif %}
```

#### 1.2 Create Modular Pet Selector Component

**File**: `snippets/ks-product-pet-selector-module.liquid`

**Key Changes**:
- Extract core pet selector logic from existing snippet
- Remove dependency on hardcoded "custom" tag checking
- Accept block settings as parameters instead of parsing from section
- Maintain all existing functionality (ES5 compatibility, mobile optimization)
- Preserve localStorage integration and custom events

**Critical Assumptions**:
- All existing pet processor JavaScript remains unchanged
- Event system (`pet:selected`) continues to work across modules
- Mobile touch optimization (WCAG 48px minimum) preserved

#### 1.3 Create Modular Font Selector Component

**File**: `snippets/pet-font-selector-module.liquid`

**Key Changes**:
- Extract from existing `pet-font-selector.liquid`
- Accept block settings for default style configuration
- Remove dependency on `supports_font_styles` metafield
- Maintain existing responsive design and accessibility features
- Keep self-contained CSS and JavaScript structure

### Phase 2: Product Configuration System

#### 2.1 Shopify Product Metafields Setup

**Metafield Definitions** (via Shopify Admin):
```json
{
  "namespace": "customization",
  "key": "pet_selector_enabled",
  "type": "boolean",
  "name": "Enable Pet Customization",
  "description": "Allow customers to add pet images to this product"
}

{
  "namespace": "customization", 
  "key": "font_selector_enabled",
  "type": "boolean",
  "name": "Enable Font Selection",
  "description": "Allow customers to choose font styles for this product"
}

{
  "namespace": "customization",
  "key": "max_pets_allowed",
  "type": "number_integer", 
  "name": "Maximum Pets Allowed",
  "description": "Maximum number of pet images per product (1-10)"
}
```

#### 2.2 Enhanced Conditional Rendering

**Implementation in Module Snippets**:
```liquid
{% comment %} Check if product supports this customization type {% endcomment %}
{% assign pet_customization_enabled = product.metafields.customization.pet_selector_enabled | default: false %}
{% assign block_enabled = block.settings.enable_pet_selector | default: true %}

{% if pet_customization_enabled and block_enabled %}
  {% comment %} Render pet selector {% endcomment %}
{% endif %}
```

### Phase 3: Module Management & Performance Optimization

#### 3.1 Conditional Asset Loading

**File**: `sections/main-product.liquid` (head section)

**Implementation**:
```liquid
{% assign has_pet_selector = false %}
{% assign has_font_selector = false %}

{% for block in section.blocks %}
  {% if block.type == 'pet_selector' and block.settings.enable_pet_selector %}
    {% assign has_pet_selector = true %}
  {% endif %}
  {% if block.type == 'font_selector' and block.settings.enable_font_selector %}
    {% assign has_font_selector = true %}
  {% endif %}
{% endfor %}

{% if has_pet_selector %}
  <script src="{{ 'pet-storage.js' | asset_url }}" defer="defer"></script>
  <script src="{{ 'pet-processor-v5-es5.js' | asset_url }}" defer="defer"></script>
{% endif %}

{% if has_font_selector %}
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400&family=Permanent+Marker&family=Rampart+One&family=Sacramento&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
{% endif %}
```

#### 3.2 Module Communication System

**File**: `assets/modular-pet-system.js` (new file)

**Purpose**: Manage inter-module communication and shared state
- Maintain backward compatibility with existing event system
- Handle localStorage coordination between modules
- Provide module registration system for dynamic loading

### Phase 4: Conversion Optimization Enhancements

#### 4.1 Mobile-First Module Display

**Key Considerations**:
- Maintain 48px minimum touch targets (WCAG 2.5.5)
- Stack modules vertically on mobile
- Progressive disclosure for complex options
- Preserve existing mobile carousel functionality

#### 4.2 Performance Impact Mitigation

**Strategies**:
- Lazy load module assets only when needed
- Implement intersection observer for below-the-fold modules
- Maintain existing Core Web Vitals performance
- Use resource hints for predictive loading

#### 4.3 A/B Testing Framework Preparation

**Module-Level Testing Support**:
- Enable/disable modules per product for testing
- Track conversion impact of individual modules
- Measure mobile vs desktop usage patterns
- Monitor cart abandonment by customization complexity

## Migration Plan

### Week 1: Foundation Setup
1. Create new block types in `main-product.liquid` schema
2. Develop `ks-product-pet-selector-module.liquid`
3. Develop `pet-font-selector-module.liquid`
4. Test backward compatibility with existing products

### Week 2: Product Configuration
1. Set up Shopify metafield definitions
2. Implement conditional rendering logic
3. Create product configuration guide for merchants
4. Test on staging environment with sample products

### Week 3: Performance & Testing
1. Implement conditional asset loading
2. Set up mobile testing across all modules
3. Performance audit with Core Web Vitals
4. Cross-browser compatibility testing (ES5 focus)

### Week 4: Deployment & Monitoring
1. Deploy to staging for full testing
2. Create merchant documentation
3. Set up conversion tracking for modular approach
4. Production deployment with rollback plan

## File Changes Summary

### New Files Required
- `snippets/ks-product-pet-selector-module.liquid`
- `snippets/pet-font-selector-module.liquid`
- `assets/modular-pet-system.js`
- `docs/merchant-module-configuration-guide.md`

### Files to Modify
- `sections/main-product.liquid` (schema and rendering logic)
- Existing snippets remain for backward compatibility

### Files to Deprecate (Future)
- `snippets/ks-product-pet-selector.liquid` (after migration complete)
- `snippets/pet-font-selector.liquid` (after migration complete)

## Risk Mitigation

### Technical Risks
- **Event System Disruption**: Maintain existing custom events (`pet:selected`, `font:selected`)
- **Mobile Performance**: Rigorous testing on actual devices, not just dev tools
- **localStorage Conflicts**: Namespace module data properly
- **ES5 Compatibility**: Continue using existing ES5-compatible code

### Business Risks
- **Conversion Impact**: A/B test modular approach vs current implementation
- **Merchant Adoption**: Provide clear configuration documentation
- **Support Overhead**: Create troubleshooting guides for module combinations

## Success Metrics

### Technical KPIs
- Page load time remains <3 seconds on mobile
- Core Web Vitals scores maintained or improved
- Zero JavaScript errors in console
- 100% backward compatibility during transition

### Business KPIs
- Conversion rate maintained or improved
- Reduced bounce rate on products with appropriate modules
- Increased average order value through better customization targeting
- Positive merchant feedback on module flexibility

## Next Steps

1. **Immediate**: Review and approve this implementation plan
2. **Technical Validation**: Create proof-of-concept with single product
3. **Stakeholder Alignment**: Confirm merchant workflow requirements
4. **Development Sprint Planning**: Break down implementation into manageable tasks

## Critical Notes

- **NO Shopify CLI Required**: Use existing GitHub auto-deployment workflow
- **Staging Testing Priority**: Use Playwright MCP with current staging URL
- **Mobile-First Approach**: 70% mobile traffic requires mobile optimization priority
- **Free Pet Processing**: Maintain current business model positioning
- **Cost Control**: Keep API min-instances at 0 to avoid GPU costs
- **Backward Compatibility**: Ensure smooth transition without breaking existing products

This modular approach will provide the flexibility to optimize conversion rates by showing relevant customization options per product while maintaining the technical excellence and mobile-first focus that defines the current implementation.