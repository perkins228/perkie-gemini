# Integrated Pet Customizer Implementation Guide

## Overview

The Integrated Pet Customizer is a revolutionary feature that allows customers to upload and customize pet images directly on product pages, eliminating the friction of navigating to a separate page. This seamless integration significantly improves conversion rates by keeping customers engaged with the product they're viewing.

## Key Features

### 1. **Direct Product Page Integration**
- Embedded customizer appears directly on product pages for items tagged with "Custom"
- No navigation required - customers stay on the product page throughout the process
- Real-time product mockup preview shows exactly how the pet will look on the item

### 2. **Live Preview with Product Mockups**
- Dynamic overlay system positions pet images correctly on different product types
- Supports multiple product types: canvas, mugs, t-shirts, pillows, etc.
- Before/after comparison toggle for transparency

### 3. **Effect Selection**
- Five artistic effects available:
  - Enhanced Black & White (default)
  - Pop Art
  - Retro 8-Bit
  - Halftone/Dithering
  - Full Color
- Thumbnail previews generated for each effect
- One-click effect switching with instant preview updates

### 4. **Mobile-First Design**
- Responsive layout adapts to all screen sizes
- Bottom sheet pattern on mobile for ergonomic interaction
- Touch-optimized controls with proper tap targets
- Smooth animations and transitions

### 5. **Session Persistence**
- Recent pets saved for quick reuse
- Cross-product compatibility - use same pet on different items
- 7-day session retention
- Emergency cleanup utilities available

### 6. **One-Click Cart Addition**
- Adds product with pet customization properties
- Automatic fee calculation and display
- Preserves all customization data for order fulfillment
- Success confirmation with cart/continue options

## Implementation Steps

### 1. **Add to Theme**

The customizer consists of three main files:
- `assets/ks-product-pet-customizer.js` - Main JavaScript component
- `assets/ks-product-pet-customizer.css` - Styles
- `assets/ks-product-pet-customizer-mobile.css` - Mobile optimizations
- `snippets/ks-product-pet-customizer.liquid` - Liquid snippet

### 2. **Configure Product Section**

In your theme editor, add the "Integrated Pet Customizer" block to product pages:

1. Navigate to a product template
2. Add block → "Integrated Pet Customizer"
3. Configure settings:
   - Custom Image Fee: Additional charge for customization
   - Max Pets per Product: Limit concurrent customizations
   - API URL: InSPyReNet endpoint (default provided)
   - Show Recent Pets: Enable/disable session history

### 3. **Tag Products**

Products must be tagged with "Custom" (case-insensitive) to show the customizer:
- Add tag: "Custom", "custom", or "CUSTOM"
- The customizer only appears on tagged products

### 4. **Product Type Configuration**

The customizer automatically adjusts overlay positioning based on product type:

```javascript
// Default overlay areas by product type
Canvas: { top: 20%, left: 20%, width: 60%, height: 60% }
Mug: { top: 25%, left: 30%, width: 40%, height: 40% }
T-Shirt: { top: 35%, left: 35%, width: 30%, height: 30% }
Pillow: { top: 15%, left: 15%, width: 70%, height: 70% }
```

## Customization Options

### Styling

Override CSS variables for brand consistency:

```css
.ks-pet-customizer {
  --customizer-primary: #your-brand-color;
  --customizer-radius: 8px;
  --customizer-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
```

### API Configuration

The component uses the InSPyReNet API by default. To use a different endpoint:

```liquid
data-api-url="https://your-api-endpoint.com"
```

### Custom Mockup Areas

Adjust overlay positioning for custom products:

```liquid
data-mockup-overlay-area='{"top": 10, "left": 10, "width": 80, "height": 80}'
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Component initializes only when visible
2. **Image Compression**: Thumbnails generated at reduced size
3. **Effect Caching**: Processed images cached in IndexedDB
4. **Progressive Enhancement**: Basic upload works without JavaScript

### API Performance

- First request: ~11 seconds (cold start)
- Subsequent requests: ~3 seconds
- Parallel effect processing for faster previews
- CDN caching for processed images

## Mobile Experience

### Bottom Sheet Implementation

On mobile devices (≤750px), effects and actions move to a bottom sheet:
- Swipe down to dismiss
- Tap backdrop to close
- Smooth transitions with touch momentum
- Safe area padding for modern devices

### Touch Optimizations

- 48px minimum touch targets (iOS standard)
- Visual feedback on tap
- Horizontal scroll for recent pets
- Optimized for one-handed use

## Tracking & Analytics

The component fires events for conversion tracking:

```javascript
// Google Analytics 4
gtag('event', 'add_to_cart', {
  items: [{
    item_id: productId,
    custom_parameters: {
      pet_effect: selectedEffect,
      customization_type: 'pet_image'
    }
  }]
});

// Facebook Pixel
fbq('track', 'AddToCart', {
  custom_data: {
    pet_effect: selectedEffect
  }
});
```

## Troubleshooting

### Common Issues

1. **Customizer not appearing**
   - Verify product has "Custom" tag
   - Check browser console for errors
   - Ensure JavaScript is enabled

2. **Upload failures**
   - Check file size (50MB max)
   - Verify image format (JPEG, PNG, WebP)
   - Test API endpoint connectivity

3. **Mobile layout issues**
   - Clear browser cache
   - Check viewport meta tag
   - Test in device emulator

### Debug Mode

Enable debug logging:

```javascript
localStorage.setItem('petCustomizerDebug', 'true');
```

## Best Practices

### UX Guidelines

1. Place customizer after product description but before add to cart
2. Ensure mockup images are high quality and accurate
3. Provide clear pricing information for customization fees
4. Test on actual devices, not just emulators

### Performance Tips

1. Optimize mockup images (WebP format recommended)
2. Limit recent pets display to improve load time
3. Consider implementing request queuing for multiple effects
4. Monitor API usage and costs

### Accessibility

1. All interactive elements have proper ARIA labels
2. Keyboard navigation fully supported
3. Screen reader announcements for state changes
4. Color contrast meets WCAG AA standards

## Future Enhancements

Planned improvements for Phase 3:
- Multiple pet support per product
- Text customization options
- Save designs for later
- Social sharing of customized products
- AI-powered background removal improvements

## Support

For technical issues or questions:
- Check browser console for detailed error messages
- Review API logs in Google Cloud Console
- Contact support with session ID for debugging