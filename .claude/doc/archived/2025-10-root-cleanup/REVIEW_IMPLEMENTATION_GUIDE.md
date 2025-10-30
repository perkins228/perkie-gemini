# Perkie Prints Review System Implementation Guide

## Quick Start: What You Need to Do Right Now

### Step 1: Install Judge.me (5 minutes)
1. Go to Shopify Admin → Apps
2. Click "Visit Shopify App Store"
3. Search "Judge.me"
4. Click "Add app" (14-day free trial)
5. Follow installation wizard

### Step 2: Initial Configuration (10 minutes)
After installation, configure these settings in Judge.me dashboard:

1. **Basic Settings**:
   - Enable photo reviews ✓
   - Enable verified buyer badges ✓
   - Set moderation to "Auto-approve 4+ stars"
   - Enable mobile-optimized forms ✓

2. **Email Settings**:
   - Review request delay: 3 days after delivery
   - Reminder email: 10 days after delivery
   - Email sender name: "Perkie Prints"
   - Reply-to email: your support email

3. **Widget Settings**:
   - Review widget position: After product description
   - Reviews per page: 5 (mobile-friendly)
   - Show review images: Yes
   - Sort by: Most helpful

## Phase 1: Basic Setup (Week 1)

### Day 1-2: Theme Integration

The app will automatically add code to your theme. Verify these files were added:
- `snippets/judgeme_all_reviews.liquid`
- `snippets/judgeme_core.liquid`
- `snippets/judgeme_widgets.liquid`

**No manual coding required at this stage!**

### Day 3-4: Email Template Setup

1. In Judge.me → Email Templates:
   - Choose "Pet Products" template category
   - Customize with your brand colors (#FF6B35)
   - Add your logo

2. **Recommended Email Subject Lines**:
   - First email: "How's [Pet Name] enjoying their new [Product]? 🐾"
   - Reminder: "[Customer Name], share your pet's transformation!"

3. **Email Body Template** (copy this):
```
Hi [Customer Name],

We hope [Pet Name] is loving their new [Product Name]!

We'd love to see how it looks - especially if you used our FREE background removal tool to create amazing pet photos.

Share your experience and help other pet parents:

[REVIEW BUTTON - "Leave a Review in 30 Seconds"]

As a thank you, you'll receive 10% off your next order when you include a photo!

Wagging tails and purrs,
The Perkie Prints Team

P.S. Your honest feedback helps us create better products for all our furry friends!
```

### Day 5-7: Mobile Optimization

Add this CSS to your theme for better mobile display:

1. Go to Online Store → Themes → Customize → Theme Settings → Custom CSS
2. Add this code:

```css
/* Judge.me Mobile Optimizations */
@media (max-width: 768px) {
  .jdgm-widget {
    padding: 10px;
  }
  
  .jdgm-rev__body {
    font-size: 14px;
    line-height: 1.5;
  }
  
  .jdgm-rev__author {
    font-size: 13px;
  }
  
  .jdgm-rev__media img {
    max-width: 100%;
    height: auto;
  }
  
  /* Touch-friendly star ratings */
  .jdgm-star {
    font-size: 20px;
    padding: 5px;
  }
  
  /* Mobile-friendly review form */
  .jdgm-form__submit-btn {
    width: 100%;
    padding: 15px;
    font-size: 16px;
  }
}
```

## Phase 2: AI Background Removal Integration (Week 2)

### Step 1: Link Reviews to Background Removal

Add this to `assets/pet-processor-v5-es5.js` after successful processing:

```javascript
// After line where processing completes successfully
// Look for: processingStatus === 'complete'

// Add this code:
if (typeof JudgeMe !== 'undefined') {
    // Store transformation for review enhancement
    var petTransformation = {
        hasTransformation: true,
        date: new Date().toISOString(),
        productId: window.currentProductId || null
    };
    localStorage.setItem('petTransformationForReview', JSON.stringify(petTransformation));
    
    // Show review prompt after 2 seconds
    setTimeout(function() {
        var reviewPrompt = document.createElement('div');
        reviewPrompt.className = 'transformation-review-prompt';
        reviewPrompt.innerHTML = 
            '<div style="position: fixed; bottom: 20px; right: 20px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 999; max-width: 300px;">' +
            '<h3 style="margin: 0 0 10px 0; font-size: 16px;">Love your pet\'s new look? ✨</h3>' +
            '<p style="margin: 0 0 15px 0; font-size: 14px;">Share it with other pet parents!</p>' +
            '<button onclick="this.parentElement.parentElement.remove()" style="background: #FF6B35; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%;">I\'ll Review Later</button>' +
            '</div>';
        document.body.appendChild(reviewPrompt);
        
        // Auto-remove after 10 seconds
        setTimeout(function() {
            if (reviewPrompt.parentElement) {
                reviewPrompt.remove();
            }
        }, 10000);
    }, 2000);
}
```

### Step 2: Track AI Usage in Reviews

In Judge.me settings, create a custom question:
1. Go to Judge.me → Settings → Custom Forms
2. Add question: "Did you use our FREE background removal tool?"
3. Type: Yes/No checkbox
4. Make it optional

## Phase 3: Shopify Flow Automation (Week 3)

### Setting Up Automated Review Requests

1. **Install Shopify Flow** (free):
   - Apps → Search "Shopify Flow"
   - Install the app

2. **Create Review Request Flow**:

**Flow Name**: "Post-Delivery Review Request"

```
WHEN: Order delivered
IF: 
  - Customer email exists
  - Order total > $25
  - Customer tag does NOT contain "reviewed"
THEN:
  - Wait 3 days
  - Send email via Judge.me
  - Add tag "review-requested"
```

3. **Create High-Value Customer Flow**:

**Flow Name**: "VIP Review Request"

```
WHEN: Order delivered
IF:
  - Order total > $100
  - Customer has 2+ orders
THEN:
  - Wait 1 day
  - Send personalized email
  - Include special thank you message
```

## Phase 4: Display Reviews Effectively (Week 4)

### Product Page Integration

1. **Above the Add to Cart button**:
   - Judge.me will automatically place star ratings here
   - No action needed

2. **After Product Description**:
   - Full review widget appears automatically
   - Shows photos, text, and ratings

3. **Collection Pages** (optional):
   In `snippets/product-card.liquid`, add after price:
   ```liquid
   {% render 'judgeme_widgets', widget_type: 'judgeme_preview_badge', product: product %}
   ```

## Testing Checklist

### Before Going Live:

- [ ] Place a test order
- [ ] Wait for review request email (use 1-hour delay for testing)
- [ ] Submit a test review with photo
- [ ] Check review appears on product page
- [ ] Test on mobile device (real phone, not browser)
- [ ] Verify email looks good on mobile
- [ ] Check page load speed (should be <3 seconds)

### Mobile Testing (Critical - 70% of traffic):
- [ ] Star ratings are easy to tap
- [ ] Review form fits screen without horizontal scroll
- [ ] Photo upload works from phone camera
- [ ] Reviews display properly in mobile view
- [ ] Email opens correctly in mobile mail apps

## Success Metrics to Track

### Week 1 Targets:
- Install app and configure ✓
- Send first 10 review requests
- Get 2-3 reviews (20-30% response rate)

### Month 1 Targets:
- 50+ reviews collected
- 4.3+ average star rating
- 30% of reviews include photos
- 15% conversion rate increase

### Month 3 Targets:
- 200+ reviews
- 35% conversion rate improvement
- $10,000+ additional revenue
- 20% reduction in support questions

## Costs

### Monthly:
- Judge.me: $29/month
- Total: $29/month

### One-time:
- Setup time: 2-3 hours
- Testing: 1-2 hours
- Total: 3-5 hours of work

### ROI:
- Expected additional revenue: $4,375/month
- Cost: $29/month
- **Net gain: $4,346/month**
- **ROI: 15,000%**

## Troubleshooting

### Common Issues:

1. **Reviews not showing**:
   - Check Judge.me app is installed
   - Clear Shopify cache
   - Verify theme integration

2. **Emails not sending**:
   - Check email settings in Judge.me
   - Verify order status is "delivered"
   - Check spam filters

3. **Mobile display issues**:
   - Add the CSS provided above
   - Test on actual device
   - Clear browser cache

4. **Low response rate**:
   - Adjust email timing (try 7 days)
   - Improve subject lines
   - Add incentive (10% off)

## Support Resources

### Judge.me Support:
- Email: support@judge.me
- Live chat: Available in app
- Documentation: https://judge.me/docs

### Shopify Support:
- For app installation issues
- For Shopify Flow help

## Next Steps After Implementation

1. **Week 1-2**: Monitor and adjust email timing
2. **Week 3-4**: A/B test email templates
3. **Month 2**: Add loyalty points for reviews
4. **Month 3**: Create review showcase page

## Important Notes

1. **Don't overthink it** - Start simple, optimize later
2. **Mobile first** - 70% of your traffic is mobile
3. **Be patient** - Reviews take time to accumulate
4. **Respond to all reviews** - Especially negative ones
5. **Use photos** - Pet products need visual proof

## Quick Win Tips

1. **First 10 Reviews**:
   - Manually email your last 20 customers
   - Offer 15% off for photo reviews
   - Feature reviews on social media

2. **Boost Response Rates**:
   - Use customer's pet name in email
   - Send from founder's email address
   - Include product photo in email

3. **Handle Negative Reviews**:
   - Respond within 24 hours
   - Offer solution publicly
   - Follow up privately

---

**Ready to start?** 

1. Go install Judge.me now (5 minutes)
2. Configure basic settings (10 minutes)
3. Wait for magic to happen!

Expected result: 35% conversion increase within 90 days.

Questions? The Judge.me support team is excellent and responds quickly.