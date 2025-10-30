# Critical Shopify Integration Points to Preserve
**Date**: 2025-01-21
**Purpose**: Document what MUST be kept during simplification

## 1. Cart Integration (CRITICAL)
```javascript
// Global pet data access for cart
window.perkiePets = {
  // Structure that Shopify cart expects
  pets: [
    {
      sessionKey: 'pet_123',
      gcsUrl: 'https://storage.googleapis.com/...',
      effect: 'blackwhite',
      thumbnail: 'data:image/jpeg;base64,...'
    }
  ]
};
```

## 2. Product Form Integration
```liquid
<!-- In product template - MUST PRESERVE -->
<div data-pet-selector 
     data-product-id="{{ product.id }}"
     data-variant-id="{{ variant.id }}">
  <!-- Pet selector UI -->
</div>

<!-- Cart form hooks -->
<input type="hidden" name="properties[_pet_data]" value="">
```

## 3. Cart Transform API
```javascript
// When adding to cart - MUST WORK
const formData = {
  id: variantId,
  quantity: 1,
  properties: {
    '_pet_data': JSON.stringify(selectedPets)
  }
};
```

## 4. Theme Settings
```json
// config/settings_schema.json - RESPECT THESE
{
  "name": "Pet Processor",
  "settings": [
    {
      "id": "enable_product_integration",
      "type": "checkbox"
    },
    {
      "id": "max_pets_per_product",
      "type": "range"
    }
  ]
}
```

## 5. Event Dispatching
```javascript
// Other Shopify code listens for these
document.dispatchEvent(new CustomEvent('petProcessorComplete', {
  detail: {
    sessionKey: 'pet_123',
    gcsUrl: 'https://...',
    effect: 'blackwhite'
  }
}));
```

## 6. Data Attributes
```html
<!-- Product pages expect these -->
<div data-pet-id="pet_123"
     data-pet-effect="blackwhite"
     data-pet-url="https://...">
</div>
```

## DO NOT BREAK THESE:
1. `window.perkiePets` global object
2. Cart properties with `_pet_data` key
3. Product form submission with pet data
4. Theme section settings access
5. Event names: 'petProcessorComplete', 'petSelectorUpdate'