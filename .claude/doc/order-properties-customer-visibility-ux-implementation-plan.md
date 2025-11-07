# Order Properties Customer Visibility - UX Implementation Plan

**Date**: 2025-11-05
**Priority**: HIGH - Customer Experience Impact
**Agent**: ux-design-ecommerce-expert
**Session**: context_session_001.md

## Executive Summary

Current state: All 28 order properties (pet names, images, styles, fonts, AND technical metadata like timestamps, URLs, filenames, processing state) are visible to customers in cart, checkout, and order confirmation pages. This creates visual clutter and exposes implementation details that don't benefit the customer experience.

**Recommendation**: Implement selective property filtering using Liquid template conditional logic to hide technical metadata from customers while preserving all data visibility for staff in Shopify admin.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [UX Recommendations](#ux-recommendations)
3. [Implementation Strategy](#implementation-strategy)
4. [Design Specifications](#design-specifications)
5. [Risk Assessment](#risk-assessment)
6. [Step-by-Step Implementation](#step-by-step-implementation)
7. [Testing Strategy](#testing-strategy)
8. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Properties Captured (28 total)

**User-Facing Properties** (Customer should see):
1. `Pet 1 Name` / `Pet 2 Name` / `Pet 3 Name` - Pet names
2. `Pet 1 Images` / `Pet 2 Images` / `Pet 3 Images` - Shopify file uploads (customer sees filename in cart)
3. `Style` - Selected artistic style (enhancedblackwhite, color, modern, sketch)
4. `Font` - Selected font style (no-text, preppy, classic, playful, elegant, trend)

**Technical Metadata** (Customer should NOT see):
5-7. `Pet 1/2/3 Order Type` - e.g., "express_upload" (internal workflow)
8-10. `Pet 1/2/3 Processing State` - e.g., "uploaded_only" (internal status)
11-13. `Pet 1/2/3 Upload Timestamp` - ISO timestamp (internal audit trail)
14-19. `Pet 1/2/3 Processed Image URL` - GCS URLs (internal fulfillment)
20-25. `Pet 1/2/3 Filename` - Sanitized filename (internal reference)
26. `Artist Notes` - Internal fulfillment notes

**Total**: 9 user-facing, 19 technical metadata fields

### Current Visibility

**Cart Page** (`sections/main-cart-items.liquid` lines 150-166):
```liquid
{%- for property in item.properties -%}
  {%- assign property_first_char = property.first | slice: 0 -%}
  {%- if property.last != blank and property_first_char != '_' -%}
    <div class="product-option">
      <dt>{{ property.first }}:</dt>
      <dd>{{ property.last }}</dd>
    </div>
  {%- endif -%}
{%- endfor -%}
```

**Current Filter**: Only hides properties starting with underscore (`_`). Since NEW properties use human-readable names without underscores, ALL 28 properties are visible to customers.

**Order Confirmation** (`sections/main-order.liquid` lines 77-89):
Same logic - displays all non-underscore properties.

**Staff View** (`snippets/order-custom-images.liquid`):
Specialized snippet showing pet data with image previews, styled for fulfillment. Technical metadata shown in collapsible `<details>` element (lines 219-233).

---

## UX Recommendations

### 1. What Customers SHOULD See

**Cart Page Summary**:
```
Product: Crew T-Shirt - Left Chest Graphic (2 Pets / White / M)

Pet Details:
• Pet 1: Sam (1 photo uploaded)
• Pet 2: Beef (using previous order #54321)

Customization:
• Style: Sketch
• Font: Trend
```

**Rationale**:
- Show pet names (emotional connection, verification)
- Indicate file upload status (reassurance)
- Show style/font choices (confirmation of customization)
- **Hide**: URLs, timestamps, filenames, processing state (implementation details)

### 2. What Customers Should NOT See

❌ `Pet 1 Order Type: express_upload`
❌ `Pet 1 Processing State: uploaded_only`
❌ `Pet 1 Upload Timestamp: 2025-11-06T00:04:10.090Z`
❌ `Pet 1 Processed Image URL: https://storage.googleapis.com/...`
❌ `Pet 1 Filename: IMG_0123_sanitized.jpg`
❌ `Artist Notes: Background needs adjustment`

**Rationale**:
- Technical jargon reduces trust ("What's a processing state?")
- Timestamps are meaningless to customers
- URLs are not user-friendly
- Artist notes are internal fulfillment communication
- 70% mobile users → Minimize scrolling/clutter

### 3. Order Confirmation UX

**Post-Purchase Messaging**:
```
✓ Order Confirmed #35894

Your Custom Pet T-Shirt:
• 2 Pets: Sam, Beef
• Style: Sketch | Font: Trend

Your photos are being prepared for printing.
We'll email you when your order ships (typically 3-5 business days).

Need to make changes? Contact us within 24 hours.
```

**Rationale**:
- Reassure customer order was received
- Summarize key choices for verification
- Set expectations for fulfillment timeline
- Provide escape hatch for corrections

### 4. Email Confirmation

**Shopify Order Email** (typically):
- Subject: "Order Confirmation #35894"
- Shows line items, prices, shipping address
- **Question**: Do order emails show line item properties by default?

**Research needed**:
1. Check if `notifications/order_confirmation.liquid` exists in theme
2. If using Shopify default email templates, properties likely shown
3. May need to customize email template separately

---

## Implementation Strategy

### Recommended Approach: Property Name Pattern Filtering (Liquid)

**Strategy**: Use Liquid conditionals to filter properties by name patterns in customer-facing templates. Staff admin view remains unchanged (Shopify admin shows ALL properties by default).

**Advantages**:
- ✅ Simple to implement (1-2 hours)
- ✅ No data model changes
- ✅ Reversible (no data loss)
- ✅ Works with existing 28 properties
- ✅ Staff admin unaffected (full visibility maintained)
- ✅ No JavaScript required (works in all contexts)

**Disadvantages**:
- ⚠️ Requires updating multiple Liquid templates
- ⚠️ Future properties must follow naming convention
- ⚠️ Email templates may need separate updates

### Alternative Approaches (NOT Recommended)

**A) CSS Display:none** ❌
- Hackable (view source reveals data)
- Not semantic (data still in DOM)
- Accessibility issues (screen readers may still announce)

**B) Underscore Prefix (e.g., `_Pet 1 Processing State`)** ❌
- Breaks existing orders (property name change)
- Would require data migration
- Increases complexity

**C) Shopify Metafields** ❌
- Major architectural change (6+ hours)
- Requires API integration
- Breaks existing localStorage flow
- Not compatible with Shopify file upload properties

**D) Hidden Checkbox Property Flag** ❌
- Would require 19 additional boolean properties
- Doubles property count (28 → 47)
- Overly complex for simple filtering

---

## Design Specifications

### Cart Page Design (Desktop & Mobile)

**Before** (Current):
```
Product: Crew T-Shirt (2 Pets / White / M)

Pet 1 Name: Sam
Pet 1 Images: IMG_0123.jpg (5.2 MB)
Pet 1 Order Type: express_upload
Pet 1 Processing State: uploaded_only
Pet 1 Upload Timestamp: 2025-11-06T00:04:10.090Z
Pet 1 Processed Image URL: https://storage.googleapis.com/perkieprints-processing-cache/...
Pet 1 Filename: IMG_0123_sanitized.jpg
Pet 2 Name: Beef
Pet 2 Order Number: 54321
Style: sketch
Font: trend
Artist Notes: Background needs adjustment for printing
```

**After** (Proposed):
```
Product: Crew T-Shirt (2 Pets / White / M)

Pet 1: Sam (1 photo uploaded ✓)
Pet 2: Beef (using previous order #54321)
Style: Sketch
Font: Trend
```

**Visual Hierarchy**:
1. Product title (bold, 1.125rem)
2. Pet details (grouped, icon + name + status)
3. Style/Font (secondary styling, 0.875rem)
4. Technical metadata: Hidden

### Order Confirmation Page Design

**Structure**:
```
Order #35894 Confirmed ✓

Your Custom Pet Product:

🐾 Pet Details:
   • Sam (Photo uploaded)
   • Beef (From order #54321)

🎨 Customization:
   • Style: Sketch
   • Font: Trend

📦 What's Next:
   Your photos are being prepared for printing.
   Estimated shipping: [DATE]
   We'll email tracking info when shipped.

Need to make changes?
Contact us within 24 hours at support@perkieprints.com
```

**Tone**: Friendly, reassuring, action-oriented

### Mobile Optimizations

**Key Considerations**:
- 70% of orders are mobile
- Minimize vertical scrolling
- Use icons for visual scanning
- Collapsible sections for dense info
- Larger touch targets (44×44px minimum)

**Mobile Cart Summary**:
```
[Product Image]

T-Shirt - 2 Pets
White / M

🐾 Sam • Beef
🎨 Sketch Style • Trend Font

$XX.XX
```

**Collapsible Details** (optional):
```
▼ Show Details
   Pet 1: Sam (1 photo ✓)
   Pet 2: Beef (Order #54321)
   Style: Sketch
   Font: Trend
```

---

## Risk Assessment

### Risk 1: Staff Cannot See Order Details ⚠️ MEDIUM

**Likelihood**: LOW (if implemented correctly)
**Impact**: HIGH (blocks order fulfillment)

**Mitigation**:
- Shopify admin order view shows ALL properties by default (unaffected by Liquid filtering)
- `snippets/order-custom-images.liquid` is staff-only snippet (already shows all data)
- Test staff admin view after implementation

**Test**: Place test order, verify Shopify admin shows all 28 properties

### Risk 2: Email Templates Show Filtered Properties ⚠️ MEDIUM

**Likelihood**: MEDIUM (email templates may use same logic)
**Impact**: LOW (customer confusion, minor)

**Mitigation**:
- Check if custom email templates exist (`templates/notifications/*.liquid`)
- If using Shopify default emails, may need to customize separately
- Worst case: Customers see technical metadata in email (current state anyway)

**Test**: Place test order, check order confirmation email content

### Risk 3: Future Properties Not Filtered ⚠️ LOW

**Likelihood**: MEDIUM (developer forgets naming convention)
**Impact**: LOW (one-off leak of technical data)

**Mitigation**:
- Document property naming convention in CLAUDE.md
- Add code comments in Liquid templates
- Regular code reviews

**Prevention**: Update CLAUDE.md with property naming guidelines

### Risk 4: Customer Service Needs Property Details ⚠️ LOW

**Likelihood**: LOW (rare edge case)
**Impact**: LOW (customer service has admin access)

**Scenario**: Customer calls support saying "My order is wrong"

**Mitigation**:
- Customer service staff have Shopify admin access (full property view)
- Order confirmation email has order number for lookup
- Customer can reference pet names for verification

**Test**: N/A (process issue, not technical)

### Risk 5: Property Name Conflicts ⚠️ LOW

**Likelihood**: LOW (controlled property creation)
**Impact**: MEDIUM (wrong properties hidden)

**Scenario**: Accidentally hide user-facing property (e.g., typo in filter logic)

**Mitigation**:
- Comprehensive test coverage (see Testing Strategy)
- Use explicit allowlist (safer than blocklist)
- Code review before deployment

**Test**: Test with all 28 property types

---

## Step-by-Step Implementation

### Phase 1: Property Classification (30 minutes)

**Goal**: Define clear rules for which properties to show/hide

**Allowlist Approach** (Recommended):
```liquid
{%- comment -%}
  Customer-facing properties (SHOW in cart/order confirmation):
  - Pet 1/2/3 Name
  - Pet 1/2/3 Images
  - Pet 1/2/3 Order Number
  - Style
  - Font
{%- endcomment -%}

{%- assign customer_visible_properties = 'Pet 1 Name,Pet 2 Name,Pet 3 Name,Pet 1 Images,Pet 2 Images,Pet 3 Images,Pet 1 Order Number,Pet 2 Order Number,Pet 3 Order Number,Style,Font' | split: ',' -%}
```

**Blocklist Approach** (Alternative):
```liquid
{%- comment -%}
  Internal-only properties (HIDE from customers):
  - Pet X Order Type
  - Pet X Processing State
  - Pet X Upload Timestamp
  - Pet X Processed Image URL
  - Pet X Filename
  - Artist Notes
{%- endcomment -%}

{%- assign internal_only_keywords = 'Order Type,Processing State,Upload Timestamp,Processed Image URL,Filename,Artist Notes' | split: ',' -%}
```

**Decision**: Use **allowlist** approach (safer, explicit)

### Phase 2: Update Cart Template (30 minutes)

**File**: `sections/main-cart-items.liquid`

**Current Code** (lines 150-166):
```liquid
{%- for property in item.properties -%}
  {%- assign property_first_char = property.first | slice: 0 -%}
  {%- if property.last != blank and property_first_char != '_' -%}
    <div class="product-option">
      <dt>{{ property.first }}:</dt>
      <dd>
        {%- if property.last contains '/uploads/' -%}
          <a href="{{ property.last }}" class="link" target="_blank">
            {{ property.last | split: '/' | last }}
          </a>
        {%- else -%}
          {{ property.last }}
        {%- endif -%}
      </dd>
    </div>
  {%- endif -%}
{%- endfor -%}
```

**Proposed Code**:
```liquid
{%- comment -%}
  Customer-visible properties (allowlist)
  Only show: Pet names, images, order numbers, style, font
{%- endcomment -%}
{%- assign customer_visible_properties = 'Pet 1 Name,Pet 2 Name,Pet 3 Name,Pet 1 Images,Pet 2 Images,Pet 3 Images,Pet 1 Order Number,Pet 2 Order Number,Pet 3 Order Number,Style,Font' | split: ',' -%}

{%- for property in item.properties -%}
  {%- assign property_first_char = property.first | slice: 0 -%}
  {%- assign is_customer_visible = customer_visible_properties | where: property.first -%}

  {%- if property.last != blank and property_first_char != '_' and is_customer_visible.size > 0 -%}
    <div class="product-option">
      <dt>{{ property.first }}:</dt>
      <dd>
        {%- if property.last contains '/uploads/' -%}
          <a href="{{ property.last }}" class="link" target="_blank">
            {{ property.last | split: '/' | last }}
          </a>
        {%- else -%}
          {{ property.last }}
        {%- endif -%}
      </dd>
    </div>
  {%- endif -%}
{%- endfor -%}
```

**Changes**:
1. Added allowlist definition (line 1-4)
2. Added `is_customer_visible` check (line 6)
3. Added `and is_customer_visible.size > 0` condition (line 8)

### Phase 3: Update Order Confirmation Template (30 minutes)

**File**: `sections/main-order.liquid`

**Current Code** (lines 77-89):
```liquid
{%- if property_size != 0 -%}
  {%- for property in line_item.properties -%}
    {% assign property_first_char = property.first | slice: 0 %}
    {%- if property.last != blank and property_first_char != '_' -%}
      <span>{{ property.first }}:</span>
      <span>
        {%- if property.last contains '/uploads/' -%}
          <a href="{{ property.last }}">{{ property.last | split: '/' | last }}</a>
        {%- else -%}
          {{ property.last }}
        {%- endif -%}
      </span>
    {%- endif -%}
  {%- endfor -%}
{%- endif -%}
```

**Proposed Code**:
```liquid
{%- if property_size != 0 -%}
  {%- comment -%}
    Customer-visible properties (allowlist)
  {%- endcomment -%}
  {%- assign customer_visible_properties = 'Pet 1 Name,Pet 2 Name,Pet 3 Name,Pet 1 Images,Pet 2 Images,Pet 3 Images,Pet 1 Order Number,Pet 2 Order Number,Pet 3 Order Number,Style,Font' | split: ',' -%}

  {%- for property in line_item.properties -%}
    {% assign property_first_char = property.first | slice: 0 %}
    {%- assign is_customer_visible = customer_visible_properties | where: property.first -%}

    {%- if property.last != blank and property_first_char != '_' and is_customer_visible.size > 0 -%}
      <span>{{ property.first }}:</span>
      <span>
        {%- if property.last contains '/uploads/' -%}
          <a href="{{ property.last }}">{{ property.last | split: '/' | last }}</a>
        {%- else -%}
          {{ property.last }}
        {%- endif -%}
      </span>
    {%- endif -%}
  {%- endfor -%}
{%- endif -%}
```

**Changes**: Identical logic to cart template

### Phase 4: Enhanced Messaging (Optional, 1 hour)

**Goal**: Add reassuring post-purchase messaging

**File**: `sections/main-order.liquid` (after line item table)

**Proposed Addition** (after line 319):
```liquid
{%- comment -%}
  Custom pet order post-purchase messaging
{%- endcomment -%}
{%- assign has_custom_pet = false -%}
{%- for line_item in order.line_items -%}
  {%- if line_item.properties['Pet 1 Name'] != blank -%}
    {%- assign has_custom_pet = true -%}
    {%- break -%}
  {%- endif -%}
{%- endfor -%}

{%- if has_custom_pet -%}
  <div style="margin: 2rem 0; padding: 1.5rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
    <h3 style="margin: 0 0 0.75rem 0; color: #212529;">✓ Your Custom Pet Order is Confirmed</h3>
    <p style="margin: 0 0 0.5rem 0; color: #495057;">Your photos are being prepared for printing by our fulfillment team.</p>
    <p style="margin: 0 0 0.5rem 0; color: #495057;"><strong>Estimated Ship Date:</strong> {{ "now" | date: "%s" | plus: 259200 | date: "%B %d, %Y" }}</p>
    <p style="margin: 0; color: #6c757d; font-size: 0.875rem;">Need to make changes? <a href="mailto:support@perkieprints.com" style="color: #007bff;">Contact us</a> within 24 hours.</p>
  </div>
{%- endif -%}
```

**Features**:
- Green checkmark + confirmation header
- Clear expectations (3-day estimate)
- Escape hatch for corrections
- Only shows for custom pet orders

### Phase 5: Email Template Check (30 minutes)

**Goal**: Verify email templates don't expose technical metadata

**Files to Check**:
1. `templates/notifications/order_confirmation.liquid` (if exists)
2. `templates/notifications/shipping_confirmation.liquid` (if exists)

**If Custom Email Templates Exist**:
- Apply same allowlist logic as cart/order templates
- Test by placing order and checking email

**If Using Shopify Default Emails**:
- Default emails show all properties (potential leak)
- **Decision**: Accept risk (low impact) or customize email templates
- Customizing emails is 2-3 hour task (outside scope of this plan)

**Recommendation**: Accept risk initially, customize emails as Phase 2 improvement

### Phase 6: Update Documentation (15 minutes)

**File**: `CLAUDE.md`

**Add Section** (after "Order Properties" section):
```markdown
### Order Property Naming Convention

**Customer-Visible Properties** (shown in cart, checkout, order confirmation):
- Pet names: `Pet 1 Name`, `Pet 2 Name`, `Pet 3 Name`
- Images: `Pet 1 Images`, `Pet 2 Images`, `Pet 3 Images`
- Order references: `Pet 1 Order Number`, `Pet 2 Order Number`, `Pet 3 Order Number`
- Style: `Style`
- Font: `Font`

**Internal-Only Properties** (hidden from customers, visible to staff in Shopify admin):
- Order type: `Pet 1/2/3 Order Type`
- Processing state: `Pet 1/2/3 Processing State`
- Upload timestamp: `Pet 1/2/3 Upload Timestamp`
- Processed URLs: `Pet 1/2/3 Processed Image URL`
- Filenames: `Pet 1/2/3 Filename`
- Artist notes: `Artist Notes`

**Rule**: When creating new properties, follow allowlist in `sections/main-cart-items.liquid` line 150.

**Rationale**: Customers don't need technical metadata, but staff require it for order fulfillment.
```

---

## Testing Strategy

### Test Case 1: Single Pet Order (Express Upload)

**Setup**:
1. Product: 1 Pet T-Shirt
2. Upload 1 photo
3. Select style: Sketch
4. Select font: Trend

**Expected Cart Display**:
```
✓ Pet 1 Name: Sam
✓ Pet 1 Images: IMG_0123.jpg
✓ Style: sketch
✓ Font: trend
✗ Pet 1 Order Type: (hidden)
✗ Pet 1 Processing State: (hidden)
✗ Pet 1 Upload Timestamp: (hidden)
✗ Pet 1 Processed Image URL: (hidden)
✗ Pet 1 Filename: (hidden)
```

**Expected Order Confirmation**: Same as cart

**Expected Shopify Admin**: All 28 properties visible

### Test Case 2: Multi-Pet Order (Mixed Upload Methods)

**Setup**:
1. Product: 3 Pet T-Shirt
2. Pet 1: Upload photo (Sam)
3. Pet 2: Use existing order #54321 (Beef)
4. Pet 3: Empty (no name, no photo)
5. Style: Color
6. Font: Classic

**Expected Cart Display**:
```
✓ Pet 1 Name: Sam
✓ Pet 1 Images: sam.jpg
✓ Pet 2 Name: Beef
✓ Pet 2 Order Number: 54321
✓ Pet 3 Name: (empty, not shown)
✓ Style: color
✓ Font: classic
✗ All technical metadata hidden (18 properties)
```

### Test Case 3: Order with Artist Notes

**Setup**:
1. Product: 1 Pet Hoodie
2. Upload 1 photo with complex background
3. Pet processor adds artist note: "Background needs cropping adjustment"

**Expected Cart Display**:
```
✓ Pet 1 Name: Charlie
✓ Pet 1 Images: charlie.jpg
✓ Style: modern
✓ Font: elegant
✗ Artist Notes: (hidden from customer)
```

**Expected Shopify Admin**: Artist Notes visible to staff

### Test Case 4: Mobile Cart Experience

**Setup**: Same as Test Case 1, but on mobile device (iPhone 12, Chrome)

**Expected**:
- Properties display in vertical list
- No horizontal scrolling
- Touch targets 44×44px minimum
- Font size legible (14px minimum)

**Test**: Use Chrome DevTools device emulation

### Test Case 5: Email Confirmation

**Setup**: Place test order, check order confirmation email

**Expected** (if using default Shopify emails):
- Email subject: "Order #XXXXX Confirmed"
- Line items shown with product image, title, price
- Properties MAY show (default Shopify behavior)

**Acceptable**: Email shows all properties (low impact, can fix in Phase 2)

### Test Case 6: Customer Account Order History

**Setup**:
1. Customer logs into account
2. Views "Order History"
3. Clicks on order with custom pet data

**Expected**:
- Order details page uses `sections/main-order.liquid`
- Should show filtered properties (same as confirmation page)

**Test**: Navigate to `/account/orders/[ORDER_ID]`

### Test Case 7: Staff Fulfillment View

**Setup**:
1. Staff logs into Shopify admin
2. Navigates to Orders → [Test Order]
3. Views order details

**Expected**:
- All 28 properties visible in "Additional details" section
- No filtering applied (Shopify admin ignores theme Liquid templates)

**Critical**: This must work for order fulfillment

---

## Success Metrics

### Immediate Metrics (Post-Implementation)

**Metric 1: Property Visibility Accuracy**
- **Goal**: 100% of technical metadata hidden from customers
- **Measurement**: Manual testing of 5 test orders (Test Cases 1-5)
- **Success Criteria**: Zero technical properties visible in cart/order confirmation

**Metric 2: Staff Fulfillment Unblocked**
- **Goal**: 100% of orders show all properties in Shopify admin
- **Measurement**: Manual testing of 5 test orders in Shopify admin
- **Success Criteria**: All 28 properties visible to staff

**Metric 3: Zero Customer Service Inquiries**
- **Goal**: No customer confusion about missing data
- **Measurement**: Support ticket tracking (7 days post-launch)
- **Success Criteria**: Zero tickets about "missing order details"

### Long-Term Metrics (30 Days Post-Implementation)

**Metric 4: Cart Abandonment Rate**
- **Baseline**: Current cart abandonment rate (unknown, needs baseline measurement)
- **Goal**: No increase (ideally slight decrease due to reduced clutter)
- **Measurement**: Shopify Analytics → Abandoned Checkouts
- **Success Criteria**: ≤ baseline rate

**Metric 5: Customer Support Load**
- **Baseline**: Current ticket volume for "order verification" issues
- **Goal**: 10-20% reduction (clearer cart summary = fewer questions)
- **Measurement**: Support ticket tags (Zendesk, Gorgias, etc.)
- **Success Criteria**: ≥10% reduction in "Did my order include...?" tickets

**Metric 6: Mobile Checkout Completion**
- **Baseline**: Current mobile checkout completion rate (70% of orders are mobile)
- **Goal**: 2-5% improvement (reduced scrolling = faster checkout)
- **Measurement**: Shopify Analytics → Checkout Behavior → Mobile
- **Success Criteria**: ≥2% improvement in mobile checkout completion

---

## Rollback Plan

### Scenario 1: Technical Metadata Needed by Customers

**Trigger**: Customer service reports customers asking for "upload timestamp" or "processing state"

**Likelihood**: VERY LOW (customers don't understand these fields)

**Rollback**:
1. Revert `sections/main-cart-items.liquid` to original (no allowlist)
2. Revert `sections/main-order.liquid` to original
3. Deploy via GitHub push to main
4. Total time: 15 minutes

### Scenario 2: Staff Cannot See Order Data

**Trigger**: Staff reports missing order information in Shopify admin

**Likelihood**: VERY LOW (Shopify admin unaffected by theme templates)

**Rollback**:
1. **DO NOT ROLLBACK** - This is not a template issue
2. Investigate Shopify admin permissions
3. Verify order properties stored in database (should be unaffected)
4. Contact Shopify support if needed

### Scenario 3: Email Templates Break

**Trigger**: Customers report broken links or missing data in email confirmations

**Likelihood**: LOW (emails use separate templates)

**Rollback**:
1. If custom email templates were modified: revert `templates/notifications/*.liquid`
2. If using default Shopify emails: no rollback needed (not modified)
3. Total time: 10 minutes

### Scenario 4: Wrong Properties Hidden

**Trigger**: Customers report "I can't see my pet's name" or "Style selection not showing"

**Likelihood**: LOW (comprehensive testing prevents this)

**Rollback**:
1. Check allowlist definition in affected template
2. Add missing property to allowlist
3. Deploy fix via GitHub push
4. Total time: 15 minutes

**Prevention**: Run Test Cases 1-3 before deploying

---

## Future Enhancements (Phase 2)

### 1. Enhanced Cart Summary Component (3 hours)

**Goal**: Replace plain list with styled component

**Design**:
```
┌─────────────────────────────────────┐
│ 🐾 Custom Pet Design                │
│                                     │
│ Pets: Sam, Beef                     │
│ Style: Sketch | Font: Trend         │
│                                     │
│ 📷 2 photos uploaded                │
└─────────────────────────────────────┘
```

**Implementation**: Create new snippet `snippets/cart-pet-summary.liquid`

### 2. Visual Pet Thumbnails in Cart (4 hours)

**Goal**: Show small thumbnails of uploaded pet photos in cart

**Design**:
```
Pet 1: Sam
[Thumbnail 80×80px]
```

**Challenge**: Shopify file upload URLs not available until checkout (files stored temporarily)

**Solution**: Use localStorage preview data (already stored by pet-processor)

### 3. Customize Email Templates (2 hours)

**Goal**: Apply same property filtering to order confirmation emails

**Files**: `templates/notifications/order_confirmation.liquid`

**Implementation**: Copy logic from cart template

### 4. A/B Test Messaging Variants (1 week)

**Hypothesis**: Adding reassuring post-purchase messaging reduces support inquiries

**Variants**:
- A: Current (no additional messaging)
- B: Green confirmation box with estimated ship date
- C: Detailed step-by-step fulfillment timeline

**Measurement**: Customer service ticket volume, NPS score

---

## Conclusion

**Implementation Time**: 2-3 hours (Phases 1-3, 6)
**Risk Level**: LOW
**Impact**: HIGH (improved customer experience, reduced support load)

**Key Success Factors**:
1. Use allowlist approach (explicit, safe)
2. Comprehensive testing (Test Cases 1-7)
3. Verify Shopify admin unaffected
4. Monitor customer support tickets post-launch

**Recommended Timeline**:
- Day 1: Implement Phases 1-3 (2 hours)
- Day 1: Test Phase 7 (1 hour)
- Day 2: Deploy to test environment, verify with Chrome DevTools MCP
- Day 3: Deploy to production
- Day 4-10: Monitor support tickets, cart abandonment metrics

**Approval Required**:
- [ ] UX design approved
- [ ] Implementation approach approved (allowlist)
- [ ] Test strategy approved
- [ ] Deployment timeline approved

---

## Appendix A: Property Reference

| Property Name | Type | Customer Visible | Staff Visible | Purpose |
|---------------|------|------------------|---------------|---------|
| Pet 1 Name | Text | ✓ | ✓ | Pet identification |
| Pet 2 Name | Text | ✓ | ✓ | Pet identification |
| Pet 3 Name | Text | ✓ | ✓ | Pet identification |
| Pet 1 Images | File | ✓ | ✓ | Customer upload (Shopify CDN) |
| Pet 2 Images | File | ✓ | ✓ | Customer upload (Shopify CDN) |
| Pet 3 Images | File | ✓ | ✓ | Customer upload (Shopify CDN) |
| Pet 1 Order Number | Text | ✓ | ✓ | Repeat customer reference |
| Pet 2 Order Number | Text | ✓ | ✓ | Repeat customer reference |
| Pet 3 Order Number | Text | ✓ | ✓ | Repeat customer reference |
| Style | Text | ✓ | ✓ | Artistic style selection |
| Font | Text | ✓ | ✓ | Font style selection |
| Pet 1 Order Type | Text | ✗ | ✓ | Workflow classification |
| Pet 2 Order Type | Text | ✗ | ✓ | Workflow classification |
| Pet 3 Order Type | Text | ✗ | ✓ | Workflow classification |
| Pet 1 Processing State | Text | ✗ | ✓ | Internal status tracking |
| Pet 2 Processing State | Text | ✗ | ✓ | Internal status tracking |
| Pet 3 Processing State | Text | ✗ | ✓ | Internal status tracking |
| Pet 1 Upload Timestamp | ISO 8601 | ✗ | ✓ | Audit trail |
| Pet 2 Upload Timestamp | ISO 8601 | ✗ | ✓ | Audit trail |
| Pet 3 Upload Timestamp | ISO 8601 | ✗ | ✓ | Audit trail |
| Pet 1 Processed Image URL | URL | ✗ | ✓ | GCS fulfillment URL |
| Pet 2 Processed Image URL | URL | ✗ | ✓ | GCS fulfillment URL |
| Pet 3 Processed Image URL | URL | ✗ | ✓ | GCS fulfillment URL |
| Pet 1 Filename | Text | ✗ | ✓ | Original filename reference |
| Pet 2 Filename | Text | ✗ | ✓ | Original filename reference |
| Pet 3 Filename | Text | ✗ | ✓ | Original filename reference |
| Artist Notes | Text | ✗ | ✓ | Internal fulfillment notes |

**Total**: 27 properties (missing 28th, likely Artist Notes is the 28th)

---

## Appendix B: Code Snippets

### Reusable Liquid Allowlist Snippet

**File**: `snippets/customer-visible-properties.liquid`

```liquid
{%- comment -%}
  Customer-Visible Properties Allowlist

  Usage:
    {%- render 'customer-visible-properties' -%}
    {%- for property in item.properties -%}
      {%- assign is_visible = customer_visible_properties | where: property.first -%}
      {%- if is_visible.size > 0 -%}
        <!-- Display property -->
      {%- endif -%}
    {%- endfor -%}
{%- endcomment -%}

{%- assign customer_visible_properties = 'Pet 1 Name,Pet 2 Name,Pet 3 Name,Pet 1 Images,Pet 2 Images,Pet 3 Images,Pet 1 Order Number,Pet 2 Order Number,Pet 3 Order Number,Style,Font' | split: ',' -%}
```

**Benefit**: Single source of truth for allowlist, reusable across templates

### Enhanced Property Display (Optional)

**Goal**: Prettier formatting with icons

```liquid
{%- for property in item.properties -%}
  {%- assign is_visible = customer_visible_properties | where: property.first -%}

  {%- if is_visible.size > 0 -%}
    <div class="product-option product-option--pet" style="display: flex; align-items: center; gap: 0.5rem;">
      {%- if property.first contains 'Pet' and property.first contains 'Name' -%}
        <span style="font-size: 1.25rem;">🐾</span>
      {%- elsif property.first == 'Style' -%}
        <span style="font-size: 1.25rem;">🎨</span>
      {%- elsif property.first == 'Font' -%}
        <span style="font-size: 1.25rem;">✏️</span>
      {%- elsif property.first contains 'Images' -%}
        <span style="font-size: 1.25rem;">📷</span>
      {%- elsif property.first contains 'Order Number' -%}
        <span style="font-size: 1.25rem;">🔖</span>
      {%- endif -%}

      <dt style="font-weight: 600;">{{ property.first }}:</dt>
      <dd style="margin: 0;">{{ property.last }}</dd>
    </div>
  {%- endif -%}
{%- endfor -%}
```

**Note**: Emojis may not render consistently across email clients - test thoroughly

---

**End of Implementation Plan**

**Next Steps**:
1. Review this plan with stakeholders
2. Get approval on approach and timeline
3. Begin Phase 1 implementation
4. Update `.claude/tasks/context_session_001.md` when work begins
