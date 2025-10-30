# Growth Engineering Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the growth engineering features in your Perkie Prints Shopify theme. The implementation includes analytics tracking, email marketing automation, A/B testing, and viral growth mechanisms.

## Prerequisites

1. **Shopify Plus or Standard Plan** (for script tags and checkout customization)
2. **Google Analytics 4 Account** with e-commerce enabled
3. **Facebook Business Manager** with Pixel created
4. **Email Service Provider** (Klaviyo recommended)
5. **Google Cloud Storage** bucket configured (already set up)

## Phase 1: Analytics Foundation (Week 1)

### Step 1: Add Analytics Settings to Theme

1. Add these settings to `config/settings_schema.json`:

```json
{
  "name": "Analytics & Tracking",
  "settings": [
    {
      "type": "text",
      "id": "ga4_measurement_id",
      "label": "Google Analytics 4 Measurement ID",
      "info": "Format: G-XXXXXXXXXX"
    },
    {
      "type": "text",
      "id": "facebook_pixel_id",
      "label": "Facebook Pixel ID",
      "info": "Found in Facebook Business Manager"
    },
    {
      "type": "checkbox",
      "id": "enable_enhanced_ecommerce",
      "label": "Enable Enhanced E-commerce Tracking",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "enable_server_side_tracking",
      "label": "Enable Server-Side Tracking",
      "info": "Improves iOS 14.5+ tracking accuracy",
      "default": false
    }
  ]
}
```

### Step 2: Include Analytics Tracking

1. Edit `layout/theme.liquid`
2. Add before closing `</head>` tag:

```liquid
{% comment %} Analytics and Growth Tools {% endcomment %}
{% render 'analytics-tracking' %}

<script src="{{ 'enhanced-product-form.js' | asset_url }}" defer></script>
<script src="{{ 'email-marketing-automation.js' | asset_url }}" defer></script>
<script src="{{ 'ab-testing-framework.js' | asset_url }}" defer></script>
<script src="{{ 'viral-growth-engine.js' | asset_url }}" defer></script>
```

### Step 3: Configure Google Analytics 4

1. Go to Google Analytics > Admin > Data Streams
2. Create a new Web stream for your store
3. Copy the Measurement ID (G-XXXXXXXXXX)
4. In Shopify Admin > Online Store > Themes > Customize
5. Go to Theme Settings > Analytics & Tracking
6. Paste your GA4 Measurement ID
7. Enable Enhanced E-commerce Tracking

### Step 4: Configure Facebook Pixel

1. Go to Facebook Business Manager > Events Manager
2. Create or select your Pixel
3. Copy the Pixel ID
4. In Theme Settings > Analytics & Tracking
5. Paste your Facebook Pixel ID

### Step 5: Test Analytics Implementation

1. Install Google Analytics Debugger Chrome extension
2. Visit your store and check console for events:
   - page_view
   - view_item (on product pages)
   - add_to_cart
   - begin_checkout
   - purchase (test order)

## Phase 2: Email Marketing Integration (Week 2)

### Step 1: Choose Email Service Provider

Recommended: **Klaviyo** (best Shopify integration)
Alternatives: Omnisend, Mailchimp, Attentive

### Step 2: Install Klaviyo App

1. In Shopify Admin > Apps > Visit Shopify App Store
2. Search for "Klaviyo"
3. Install and connect your account
4. Enable Shopify integration

### Step 3: Configure Email Flows

1. **Welcome Series** (3 emails)
   - Email 1: Welcome + 10% discount (immediate)
   - Email 2: Pet care tips + product showcase (day 3)
   - Email 3: Customer stories + referral invite (day 7)

2. **Abandoned Cart Series** (3 emails)
   - Email 1: Reminder with pet image (2 hours)
   - Email 2: 5% discount (24 hours)
   - Email 3: 10% discount + urgency (72 hours)

3. **Post-Purchase Series** (4 emails)
   - Email 1: Order confirmation + care instructions
   - Email 2: Review request (7 days)
   - Email 3: Referral program invite (14 days)
   - Email 4: Repeat purchase incentive (30 days)

### Step 4: Custom Pet Data Integration

Add to Klaviyo integration script:

```javascript
// Send pet data to Klaviyo
document.addEventListener('petUploadComplete', function(event) {
  if (window._learnq) {
    _learnq.push(['track', 'Pet Upload Completed', {
      pet_effect: event.detail.effect,
      product_id: event.detail.productId,
      has_multiple_pets: event.detail.pets && event.detail.pets.length > 1
    }]);
    
    // Update profile with pet parent status
    _learnq.push(['identify', {
      '$email': customerEmail,
      'pet_parent': true,
      'last_pet_upload': new Date().toISOString()
    }]);
  }
});
```

## Phase 3: Conversion Optimization (Week 3-4)

### Step 1: Add Theme Settings for CRO

Add to `config/settings_schema.json`:

```json
{
  "name": "Conversion Optimization",
  "settings": [
    {
      "type": "checkbox",
      "id": "show_social_proof",
      "label": "Show Social Proof Notifications",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "enable_exit_intent",
      "label": "Enable Exit Intent Popup",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_urgency_indicators",
      "label": "Show Urgency Indicators",
      "default": true
    },
    {
      "type": "range",
      "id": "low_stock_threshold",
      "label": "Low Stock Warning Threshold",
      "min": 1,
      "max": 20,
      "step": 1,
      "default": 10
    }
  ]
}
```

### Step 2: Add CSS for Growth Features

Create `assets/growth-features.css`:

```css
/* Social Proof Notifications */
.social-proof-container {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
}

.social-proof-notification {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  transform: translateX(-400px);
  transition: transform 0.3s ease;
  max-width: 350px;
}

.social-proof-notification--visible {
  transform: translateX(0);
}

/* Exit Intent Popup */
.exit-intent-popup {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.exit-intent-popup--visible {
  opacity: 1;
  pointer-events: all;
}

.exit-intent-popup__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}

.exit-intent-popup__content {
  background: white;
  padding: 40px;
  border-radius: 12px;
  max-width: 500px;
  position: relative;
  text-align: center;
}

/* Urgency Indicators */
.product-form__urgency {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: #d32f2f;
  font-size: 14px;
}

.product-form__urgency .icon {
  flex-shrink: 0;
}

/* A/B Test Variations */
.experiment-pricing_display-variant_a .price-compare {
  text-decoration: line-through;
  opacity: 0.6;
  margin-right: 8px;
}

.experiment-pricing_display-variant_b .price-badge {
  background: #4caf50;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-left: 8px;
}

/* Referral Sharing */
.product-viral-share {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  text-align: center;
}

.viral-share-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 16px;
}

.viral-share-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.viral-share-button:hover {
  background: #f5f5f5;
  transform: translateY(-1px);
}

/* Pet Gallery */
.pet-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin: 40px 0;
}

.pet-gallery-card {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s ease;
}

.pet-gallery-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

/* Email Capture Modals */
.spin-to-win-container {
  text-align: center;
  padding: 20px;
}

.spin-wheel {
  position: relative;
  width: 300px;
  height: 300px;
  margin: 20px auto;
}

.spin-wheel canvas {
  width: 100%;
  height: 100%;
}

.spin-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #333;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 50px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.spin-button:hover {
  background: #555;
  transform: translate(-50%, -50%) scale(1.1);
}

/* Contest Banners */
.contest-banner {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
  color: white;
  padding: 16px 0;
}

.contest-banner-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 20px;
}

@media (max-width: 768px) {
  .contest-banner-content {
    flex-direction: column;
    text-align: center;
  }
  
  .social-proof-container {
    left: 10px;
    right: 10px;
  }
  
  .pet-gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}
```

### Step 3: Include CSS in Theme

Add to `layout/theme.liquid`:

```liquid
{{ 'growth-features.css' | asset_url | stylesheet_tag }}
```

## Phase 4: Viral Growth Implementation (Month 2)

### Step 1: Create Referral Page Template

Create `templates/page.referral-program.json`:

```json
{
  "sections": {
    "main": {
      "type": "main-page"
    },
    "referral-program": {
      "type": "referral-program",
      "settings": {
        "heading": "Give 15%, Get 10%",
        "subheading": "Share the love with fellow pet parents!",
        "friend_discount": 15,
        "your_reward": 10
      }
    }
  },
  "order": ["main", "referral-program"]
}
```

### Step 2: Create Referral Section

Create `sections/referral-program.liquid`:

```liquid
<div class="referral-program page-width">
  <div class="referral-header">
    <h2>{{ section.settings.heading }}</h2>
    <p>{{ section.settings.subheading }}</p>
  </div>
  
  <div class="referral-steps">
    <div class="referral-step">
      <div class="step-icon">1</div>
      <h3>Share Your Code</h3>
      <p>Send your unique code to friends</p>
    </div>
    <div class="referral-step">
      <div class="step-icon">2</div>
      <h3>They Save {{ section.settings.friend_discount }}%</h3>
      <p>On their first custom pet product</p>
    </div>
    <div class="referral-step">
      <div class="step-icon">3</div>
      <h3>You Get {{ section.settings.your_reward }}%</h3>
      <p>After they make a purchase</p>
    </div>
  </div>
  
  <div class="referral-share-box">
    <h3>Your Referral Code</h3>
    <div class="referral-code-display">
      <input type="text" value="Loading..." readonly id="userReferralCode">
      <button class="button button--secondary" onclick="copyReferralCode()">Copy</button>
    </div>
    
    <div class="referral-share-methods">
      <h4>Share via:</h4>
      <div class="share-buttons">
        <!-- Share buttons here -->
      </div>
    </div>
  </div>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const codeInput = document.getElementById('userReferralCode');
    const referralCode = localStorage.getItem('perkie_referral_code') || 'PETLOVE';
    codeInput.value = referralCode;
  });
  
  function copyReferralCode() {
    const codeInput = document.getElementById('userReferralCode');
    codeInput.select();
    document.execCommand('copy');
    
    // Show feedback
    event.target.textContent = 'Copied!';
    setTimeout(() => {
      event.target.textContent = 'Copy';
    }, 2000);
  }
</script>

{% schema %}
{
  "name": "Referral Program",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Give 15%, Get 10%"
    },
    {
      "type": "text",
      "id": "subheading",
      "label": "Subheading",
      "default": "Share the love with fellow pet parents!"
    },
    {
      "type": "number",
      "id": "friend_discount",
      "label": "Friend's Discount %",
      "default": 15
    },
    {
      "type": "number",
      "id": "your_reward",
      "label": "Referrer Reward %",
      "default": 10
    }
  ]
}
{% endschema %}
```

## Phase 5: Testing & Optimization

### A/B Testing Setup

1. **Configure Experiments** in `ab-testing-framework.js`
2. **Set Traffic Allocation** (start with 50/50 splits)
3. **Define Success Metrics**:
   - Primary: Conversion Rate
   - Secondary: Average Order Value
   - Tertiary: Email Capture Rate

### Testing Schedule

**Week 1-2**: Pricing Display Tests
- Control vs Strike-through vs Percentage Badge

**Week 3-4**: CTA Button Tests
- "Add to Cart" vs "Customize Now" vs "Create Your Pet Product"

**Week 5-6**: Urgency Tests
- No urgency vs Time-based vs Inventory-based

**Week 7-8**: Social Proof Tests
- None vs Recent purchases vs Reviews vs Both

### Performance Monitoring

1. **Set up GA4 Dashboard** with:
   - Conversion funnel visualization
   - E-commerce performance
   - User behavior flow
   - Custom event tracking

2. **Create Klaviyo Reports** for:
   - Email performance by flow
   - Revenue attribution
   - List growth rate
   - Segment performance

3. **Weekly Review Metrics**:
   - Conversion rate by source
   - Cart abandonment rate
   - Email capture rate
   - Referral program performance
   - A/B test results

## Troubleshooting

### Common Issues

1. **Analytics Not Tracking**
   - Check browser console for errors
   - Verify IDs are correct
   - Ensure scripts are loading
   - Test in incognito mode

2. **Email Flows Not Triggering**
   - Verify Klaviyo integration
   - Check event names match
   - Test with real email addresses
   - Review flow filters

3. **A/B Tests Not Showing**
   - Clear browser cache
   - Check targeting rules
   - Verify experiment is active
   - Test with different user IDs

### Support Resources

- **Google Analytics**: [GA4 Help Center](https://support.google.com/analytics)
- **Facebook Pixel**: [Facebook Business Help](https://www.facebook.com/business/help)
- **Klaviyo**: [Klaviyo Academy](https://academy.klaviyo.com)
- **Shopify**: [Shopify Help Center](https://help.shopify.com)

## Next Steps

1. **Month 1**: Complete implementation of all tracking and basic features
2. **Month 2**: Launch A/B tests and optimize based on data
3. **Month 3**: Scale successful initiatives and explore advanced features
4. **Ongoing**: Weekly performance reviews and iterative improvements

## Expected Results

Based on similar implementations:

- **25-40% increase in conversion rate** (3-6 months)
- **30-50% increase in email capture rate** (1-2 months)
- **20-30% reduction in cart abandonment** (2-3 months)
- **15-25% increase in average order value** (3-4 months)
- **10-20% of revenue from referrals** (6+ months)

Remember: Growth is iterative. Start with the basics, measure everything, and continuously optimize based on data.