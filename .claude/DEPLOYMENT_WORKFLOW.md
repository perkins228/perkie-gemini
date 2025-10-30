# Deployment Workflow

## 🚀 CRITICAL: GitHub Auto-Deploy Only

**We do NOT use Shopify CLI for deployments!**  
All theme updates are automatically deployed through GitHub integration.

## Deployment Process

### 1. Local Development
```bash
# Make your changes locally
# Edit files as needed
```

### 2. Test Locally (Optional)
```bash
# For quick sanity checks only
# Open testing/simple-test.html in browser
```

### 3. Commit to GitHub
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Fix: Pet processor API response handling"

# Push to staging branch
git push origin staging
```

### 4. Automatic Deployment
- GitHub webhook triggers Shopify deployment
- Changes appear on staging URL within 1-2 minutes
- No manual intervention required

### 5. Test on Staging
```javascript
// Use Playwright MCP to test
mcp__playwright__browser_navigate(url: "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/")
```

## Branch Strategy

### staging (Default)
- All development work happens here
- Auto-deploys to Shopify staging environment
- Test thoroughly before merging to main

### main (Production)
- Production-ready code only
- Requires PR from staging
- Auto-deploys to live store (when configured)

## Common Mistakes to Avoid

### ❌ DON'T DO THIS:
```bash
# Don't use Shopify CLI
shopify theme push  # WRONG - Don't use this
shopify theme serve # WRONG - Don't use this
npm run deploy      # WRONG - We don't have npm scripts
```

### ✅ DO THIS INSTEAD:
```bash
# Simply push to GitHub
git push origin staging  # RIGHT - This auto-deploys
```

## Deployment Verification

### Check Deployment Status
1. Push to GitHub
2. Wait 1-2 minutes
3. Visit staging URL
4. Verify changes are live

### If Changes Don't Appear
1. Check GitHub Actions (if configured)
2. Verify you pushed to correct branch (staging)
3. Clear browser cache and refresh
4. Check browser console for errors

## File Types That Auto-Deploy

All files in the repository auto-deploy, including:
- `.liquid` - Theme templates
- `.js` - JavaScript assets  
- `.css` - Stylesheets
- `.json` - Theme configuration
- `.png/.jpg/.svg` - Images

## Testing Before Deployment

### Required Testing Steps
1. Test with Playwright MCP on staging URL
2. Check mobile responsiveness
3. Verify API endpoints are working
4. Test all user interactions
5. Check browser console for errors

### Testing Command Flow
```javascript
// 1. Navigate to staging
mcp__playwright__browser_navigate(url: "[staging-url]")

// 2. Test functionality
mcp__playwright__browser_click(element: "Upload", ref: "e123")

// 3. Check for errors
mcp__playwright__browser_console_messages()
```

## Emergency Rollback

If something breaks in staging:
```bash
# Revert the last commit
git revert HEAD
git push origin staging

# Or reset to previous commit
git reset --hard HEAD~1
git push --force origin staging
```

## Important Notes

1. **NEVER bypass GitHub** - All changes must go through git
2. **ALWAYS test on staging first** - Never push directly to main
3. **Wait for auto-deploy** - Don't panic if changes take 1-2 minutes
4. **Check staging URL validity** - Ask user for new URL if expired
5. **Document all changes** - Use clear commit messages

## Staging URL Management

Current Staging URL:
```
https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/
```

When URL expires:
1. Ask user: "The Shopify staging URL appears expired. Could you provide a new preview URL?"
2. Update this file with new URL
3. Update CLAUDE.md with new URL
4. Continue testing with new URL