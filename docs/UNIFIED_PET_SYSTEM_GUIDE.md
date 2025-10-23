# Unified Pet System Implementation Guide

This guide covers the new unified pet processor and selector system that replaces the fragmented v5 implementation with a clean, maintainable, and mobile-optimized architecture.

## 🏗️ Architecture Overview

The unified system consists of 5 core modules that work together seamlessly:

1. **PetDataManager** - Centralized data and session management
2. **PetProcessor** - Modular image processing component  
3. **PetSelector** - Clean product page pet selection component
4. **PetCartIntegration** - Enhanced cart and checkout flow
5. **PetBackwardCompatibility** - Seamless migration from v5

## 📋 Quick Migration Checklist

### For Existing v5 Implementations

- [ ] Include new unified scripts (see [Script Loading Order](#script-loading-order))
- [ ] Update section templates (optional - backward compatible)
- [ ] Test cart integration functionality
- [ ] Verify mobile responsiveness
- [ ] Run compatibility tests

### For New Implementations

- [ ] Include all 5 unified scripts
- [ ] Use new section template format
- [ ] Configure mobile-optimized CSS
- [ ] Set up cart integration
- [ ] Implement progressive enhancement

## 🚀 Implementation Guide

### Script Loading Order

Add these scripts to your theme in the correct order:

```html
<!-- Core unified system (required) -->
{{ 'pet-data-manager.js' | asset_url | script_tag }}
{{ 'pet-mobile-grid.css' | asset_url | stylesheet_tag }}
{{ 'pet-processor-unified.js' | asset_url | script_tag }}
{{ 'pet-selector-unified.js' | asset_url | script_tag }}
{{ 'pet-cart-integration.js' | asset_url | script_tag }}

<!-- Backward compatibility (for migration) -->
{{ 'pet-backward-compatibility.js' | asset_url | script_tag }}
```

### Section Template Updates

#### New Unified Pet Processor Section

Replace your existing `ks-pet-processor-v5.liquid` with:

```liquid
{%- comment -%}
  Unified Pet Processor Section
  Uses new modular architecture with enhanced mobile support
{%- endcomment -%}

{{ 'pet-mobile-grid.css' | asset_url | stylesheet_tag }}

<section id="pet-processor-{{ section.id }}" 
         class="pet-processor-section color-{{ section.settings.color_scheme }}"
         data-section-type="unified-pet-processor" 
         data-section-id="{{ section.id }}">
  
  {% if section.settings.heading != blank %}
    <div class="section-header">
      <h2 class="section-heading">{{ section.settings.heading }}</h2>
      {% if section.settings.subheading != blank %}
        <p class="section-subheading">{{ section.settings.subheading }}</p>
      {% endif %}
    </div>
  {% endif %}
  
  <!-- Unified processor container -->
  <div id="pet-processor-content-{{ section.id }}" class="pet-processor-content">
    <!-- Processor UI will be inserted here by JavaScript -->
  </div>
</section>

<script src="{{ 'pet-data-manager.js' | asset_url }}" defer></script>
<script src="{{ 'pet-processor-unified.js' | asset_url }}" defer></script>
<script src="{{ 'pet-cart-integration.js' | asset_url }}" defer></script>
```

#### Updated Pet Selector Snippet

Replace your existing `ks-product-pet-selector.liquid` with:

```liquid
{% comment %}
  Unified Pet Selector - Enhanced mobile-first implementation
{% endcomment %}

{% assign has_custom_tag = false %}
{% for tag in product.tags %}
  {% if tag contains 'custom' or tag contains 'Custom' %}
    {% assign has_custom_tag = true %}
    {% break %}
  {% endif %}
{% endfor %}

{% if has_custom_tag %}
  <div class="pet-selector-unified" 
       id="pet-selector-{{ section.id }}"
       data-section-id="{{ section.id }}"
       data-custom-image-fee="{{ block.settings.custom_image_fee | default: 0 }}"
       data-max-pets="{{ block.settings.max_pets_per_product | default: 3 }}"
       data-product-id="{{ product.id }}"
       data-product-price="{{ product.price }}">
    
    <div class="pet-selector-header">
      <h3>Add Your Pet Image</h3>
      <p>Choose from your saved pet images or 
         <a href="{{ pages['pet-background-remover'].url }}">create a new one</a>
      </p>
    </div>
    
    <div id="pet-selector-content-{{ section.id }}" class="pet-selector-content">
      <!-- Selector UI will be inserted here -->
    </div>
  </div>

  <script src="{{ 'pet-data-manager.js' | asset_url }}" defer></script>
  <script src="{{ 'pet-selector-unified.js' | asset_url }}" defer></script>
  <script src="{{ 'pet-cart-integration.js' | asset_url }}" defer></script>
{% endif %}
```

## 🎨 Mobile-First CSS Integration

The new system includes responsive grid CSS that automatically adapts to all screen sizes:

### Breakpoints and Grid Behavior

| Screen Size | Selector Grid | Effect Grid | Touch Targets |
|-------------|---------------|-------------|---------------|
| 320-375px   | 2 columns     | 4 columns   | 48px+ minimum |
| 376-480px   | 3 columns     | 4 columns   | 48px+ minimum |
| 481-768px   | 3 columns     | 4 columns   | 48px+ minimum |
| 769-1024px  | 4 columns     | 4 columns   | 48px+ minimum |
| 1025px+     | 4 columns     | 4 columns   | 48px+ minimum |

### CSS Customization

To customize the grid for your theme:

```css
/* Custom pet grid overrides */
.pet-selector-grid {
  /* Override default grid behavior */
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

/* Custom effect buttons */
.effect-grid .effect-btn {
  /* Customize effect button appearance */
  border-radius: 12px;
  padding: 1.2rem 0.6rem;
}

/* Theme color integration */
.pet-item.selected {
  border-color: rgb(var(--color-button));
  background: rgba(var(--color-button), 0.05);
}
```

## 🛒 Cart Integration Setup

### Automatic Integration

The cart integration works automatically once scripts are loaded:

```javascript
// Pet selection events are automatically handled
document.addEventListener('petSelected', function(e) {
  console.log('Pet selected:', e.detail.petName);
  // Custom cart logic here if needed
});
```

### Manual Cart Properties

For custom cart forms, add pet data manually:

```javascript
// Get selected pets for cart
const selectedPets = window.getSelectedPetsForCart();

// Add specific pet to cart with custom properties
window.addPetToCart('section-id', {
  sessionKey: 'pet_key_123',
  petName: 'Fluffy',
  effect: 'enhancedblackwhite',
  artistNotes: 'Make eyes more prominent'
});
```

### Cart Form Properties

The system automatically adds these properties to cart forms:

- `properties[Pet Data]` - JSON with pet session info
- `properties[Custom Image Fee]` - Additional fee for custom pet image
- `properties[Artist Notes]` - Customer's special requests

## 📱 Mobile Optimization Features

### Progressive Loading

The new system loads the primary effect first for immediate preview:

```javascript
// Configure progressive loading
const processor = new PetProcessor('section-id', {
  enableProgressiveLoading: true,
  defaultEffect: 'enhancedblackwhite'
});
```

### Touch-Friendly Interface

All interactive elements meet mobile accessibility standards:

- Minimum 48px touch targets
- Proper focus management
- Keyboard navigation support
- Screen reader compatibility

### Viewport-Based Sizing

Grid layouts adapt automatically using CSS viewport units:

```css
.effect-emoji {
  /* Responsive sizing based on viewport */
  font-size: clamp(2.5rem, 12vw, 5rem);
}
```

## 🔄 Migration from v5

### Automatic Migration

The backward compatibility layer automatically:

1. Migrates existing localStorage data
2. Preserves legacy API functions
3. Bridges old events to new system
4. Maintains existing cart integration

### Manual Migration Steps

For optimal performance, consider updating:

```liquid
<!-- Old v5 section -->
{% render 'ks-pet-bg-remover-v5' %}

<!-- New unified section -->
{% render 'unified-pet-processor' %}
```

### Testing Migration

Use the comprehensive test suite to verify migration:

```html
<!-- Load test suite -->
<script src="testing/unified-pet-system-test.html"></script>

<!-- Run compatibility check -->
<script>
  const report = window.getPetCompatibilityReport();
  console.log('Migration status:', report);
</script>
```

## 🧪 Testing and Debugging

### Test Suite

The system includes a comprehensive test suite at:
`/testing/unified-pet-system-test.html`

Features:
- Component functionality tests
- Mobile responsiveness tests  
- Cart integration tests
- Performance benchmarks
- Memory leak detection

### Debug Tools

Access debug information:

```javascript
// System status
window.petDataManager.getStats();

// Compatibility report
window.getPetCompatibilityReport();

// Emergency cleanup
window.emergencyCleanupPetData();
```

### Performance Monitoring

Monitor system performance:

```javascript
// Track processing times
document.addEventListener('petProcessorPrimaryEffectComplete', function(e) {
  console.log('Primary effect loaded in:', e.detail.processingTime + 'ms');
});

// Monitor memory usage
const stats = window.petDataManager.getStats();
console.log('Cache size:', stats.totalCacheSize / 1024 + 'KB');
```

## 🔧 Configuration Options

### Pet Processor Options

```javascript
const processor = new PetProcessor('section-id', {
  apiUrl: 'https://your-api-endpoint.com',
  effects: ['enhancedblackwhite', 'popart', 'dithering', 'color'],
  defaultEffect: 'enhancedblackwhite',
  enableProgressiveLoading: true,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png']
});
```

### Pet Selector Options

```javascript
const selector = new PetSelector('section-id', {
  maxPets: 3,
  customImageFee: 500, // $5.00 in cents
  autoRefresh: true,
  enablePriceCalculation: true
});
```

### Cart Integration Options

```javascript
const cartIntegration = new PetCartIntegration({
  enablePriceUpdates: true,
  enableAutoAddToCart: false,
  maxPetsPerProduct: 3,
  validateBeforeAdd: true
});
```

## ⚡ Performance Optimization

### Loading Strategy

Implement progressive enhancement:

```html
<!-- Critical CSS inline -->
<style>
  .pet-processor-container { /* essential styles */ }
</style>

<!-- Deferred JavaScript -->
<script src="pet-system.js" defer></script>
```

### Memory Management

The system automatically:
- Cleans up expired sessions (7 days default)
- Revokes unused blob URLs
- Removes orphaned cache entries
- Monitors memory usage

### Caching Strategy

Optimize API calls:
- Primary effect loads immediately (~3s)
- Background effects load progressively
- Results cached in memory for instant switching
- Automatic warmup for subsequent requests

## 🚨 Troubleshooting

### Common Issues

1. **"Pet images not showing"**
   - Check localStorage quota
   - Verify blob URL generation
   - Clear cache: `window.emergencyCleanupPetData()`

2. **"Mobile grid not responsive"**
   - Ensure `pet-mobile-grid.css` is loaded
   - Check viewport meta tag
   - Verify CSS Grid support

3. **"Cart integration not working"**
   - Check cart form selectors
   - Verify event listeners
   - Test with: `window.getSelectedPetsForCart()`

### Debug Commands

```javascript
// Check system health
window.petDataManager.getStats();

// Test compatibility
window.getPetCompatibilityReport();

// Force cleanup
window.emergencyCleanupPetData();

// Reset to clean state
localStorage.clear();
location.reload();
```

## 🔄 Maintenance

### Regular Tasks

- Monitor cache size growth
- Clean up expired sessions
- Update API endpoints
- Test mobile responsiveness
- Review error logs

### Updates

To update the system:

1. Replace JavaScript files
2. Update CSS if needed
3. Test with existing data
4. Monitor for compatibility issues
5. Update documentation

## 📊 Analytics and Monitoring

### Key Metrics

Track these metrics for system health:

```javascript
// Usage metrics
const stats = window.petDataManager.getStats();
console.log({
  totalPets: stats.totalPets,
  cacheSize: stats.totalCacheSize,
  processingTimes: '3s primary, 8s total'
});

// Conversion metrics
document.addEventListener('petSaved', function(e) {
  // Track successful pet processing
  analytics.track('Pet Processed', {
    effect: e.detail.effect,
    processingTime: e.detail.processingTime
  });
});
```

### Error Tracking

Monitor common errors:

```javascript
// API failures
document.addEventListener('petProcessingError', function(e) {
  console.error('Processing failed:', e.detail);
  // Send to error tracking service
});

// Memory issues
window.addEventListener('beforeunload', function() {
  const stats = window.petDataManager.getStats();
  if (stats.totalCacheSize > 50 * 1024 * 1024) { // 50MB
    console.warn('Large cache size detected:', stats.totalCacheSize);
  }
});
```

---

## 📁 File Structure

```
assets/
├── pet-data-manager.js           # Core data management
├── pet-processor-unified.js      # Modular processor component  
├── pet-selector-unified.js       # Clean selector component
├── pet-cart-integration.js       # Enhanced cart flow
├── pet-backward-compatibility.js # Migration layer
└── pet-mobile-grid.css          # Responsive grid system

sections/
├── unified-pet-processor.liquid  # New processor section
└── ...

snippets/
├── unified-pet-selector.liquid   # New selector snippet
└── ...

testing/
└── unified-pet-system-test.html  # Comprehensive test suite
```

This unified system provides a solid foundation for the Perkie Prints pet customization experience with improved performance, better mobile support, and a cleaner architecture that's easier to maintain and extend.