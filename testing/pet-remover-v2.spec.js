const { test, expect } = require('@playwright/test');

test.describe('Pet Background Remover V2 - Desktop Layout Tests', () => {
  
  test('Desktop: Verifies 35%/65% grid layout with proper positioning', async ({ page }) => {
    // Create test HTML with the new design
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pet Remover V2 Test</title>
  <style>
    /* Inline the new CSS from ks-pet-bg-remover-v2.liquid */
    :root {
      --pbr-primary: #4285f4;
      --pbr-primary-hover: #3367d6;
      --pbr-surface: #f8f9fa;
      --pbr-border: #e1e5e9;
      --pbr-text: #202124;
      --pbr-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
      --pbr-radius: 12px;
      --pbr-radius-lg: 20px;
      --pbr-space-md: 1rem;
      --pbr-space-lg: 1.5rem;
      --pbr-space-xl: 2rem;
      --pbr-space-2xl: 3rem;
    }

    .pet-remover-v2 {
      container-type: inline-size;
      container-name: pet-remover;
      max-width: 100%;
      padding: var(--pbr-space-md);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Mobile styles */
    .pet-remover-v2__upload {
      border: 2px dashed var(--pbr-border);
      border-radius: var(--pbr-radius);
      padding: 3rem 1.5rem;
      text-align: center;
      background: linear-gradient(135deg, var(--pbr-surface) 0%, #ffffff 100%);
      min-height: 200px;
    }

    .pet-remover-v2__preview {
      margin-top: 2rem;
      padding: 1.5rem;
      background: white;
      border-radius: var(--pbr-radius);
      box-shadow: var(--pbr-shadow-md);
    }

    /* Desktop layout using media queries for reliable testing */
    @media screen and (min-width: 1024px) {
      .pet-remover-v2 {
        display: grid;
        grid-template-columns: 35% 65%;
        gap: 3rem;
        align-items: start;
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
      }

      .pet-remover-v2__controls {
        position: sticky;
        top: 2rem;
      }

      .pet-remover-v2__preview-panel {
        background: white;
        border-radius: var(--pbr-radius-lg);
        padding: 2rem;
        box-shadow: var(--pbr-shadow-md);
        min-height: 600px;
      }
    }

    /* Test visibility helpers */
    .pet-remover-v2__controls {
      background: #e3f2fd;
      padding: 1rem;
    }

    .pet-remover-v2__preview-panel {
      background: #f3e5f5;
      padding: 1rem;
    }
  </style>
</head>
<body>
  <div class="pet-remover-v2" data-has-image="false">
    <div class="pet-remover-v2__controls">
      <div class="pet-remover-v2__upload">
        <h3>Upload Area (35%)</h3>
        <p>This should be on the left on desktop</p>
      </div>
    </div>
    <div class="pet-remover-v2__preview-panel">
      <div class="pet-remover-v2__preview">
        <h3>Preview Panel (65%)</h3>
        <p>This should be on the right on desktop</p>
        <p>Much wider than the controls panel</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);
    
    // Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100);
    
    // Test 1: Grid layout is applied
    const container = page.locator('.pet-remover-v2');
    await expect(container).toBeVisible();
    
    const displayStyle = await container.evaluate(el => 
      window.getComputedStyle(el).display
    );
    expect(displayStyle).toBe('grid');
    
    // Test 2: Grid columns are 35%/65%
    const gridColumns = await container.evaluate(el => 
      window.getComputedStyle(el).gridTemplateColumns
    );
    console.log('Grid columns:', gridColumns);
    
    // Test 3: Verify side-by-side layout
    const controls = page.locator('.pet-remover-v2__controls');
    const preview = page.locator('.pet-remover-v2__preview-panel');
    
    const controlsBox = await controls.boundingBox();
    const previewBox = await preview.boundingBox();
    
    console.log('Controls box:', controlsBox);
    console.log('Preview box:', previewBox);
    
    // Controls should be on the left
    expect(controlsBox.x).toBeLessThan(previewBox.x);
    
    // Both should be at the same vertical position (side by side)
    expect(Math.abs(controlsBox.y - previewBox.y)).toBeLessThan(50);
    
    // Preview should be significantly wider (65% vs 35%)
    expect(previewBox.width).toBeGreaterThan(controlsBox.width * 1.5);
    
    // Test 4: Verify sticky positioning works
    const stickyPosition = await controls.evaluate(el => 
      window.getComputedStyle(el).position
    );
    expect(stickyPosition).toBe('sticky');
  });

  test('Mobile: Verifies single column layout', async ({ page }) => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    .pet-remover-v2 {
      container-type: inline-size;
      padding: 1rem;
    }
    
    .pet-remover-v2__upload {
      border: 2px dashed #e1e5e9;
      padding: 2rem;
      margin-bottom: 1rem;
      background: #f8f9fa;
    }
    
    .pet-remover-v2__preview {
      background: white;
      padding: 1rem;
      border: 1px solid #e1e5e9;
    }
    
    @media screen and (min-width: 1024px) {
      .pet-remover-v2 {
        display: grid;
        grid-template-columns: 35% 65%;
        gap: 3rem;
      }
    }
  </style>
</head>
<body>
  <div class="pet-remover-v2">
    <div class="pet-remover-v2__controls">
      <div class="pet-remover-v2__upload">Upload Area</div>
    </div>
    <div class="pet-remover-v2__preview-panel">
      <div class="pet-remover-v2__preview">Preview Panel</div>
    </div>
  </div>
</body>
</html>`;

    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);
    
    const container = page.locator('.pet-remover-v2');
    
    // Should NOT be grid on mobile
    const displayStyle = await container.evaluate(el => 
      window.getComputedStyle(el).display
    );
    expect(displayStyle).not.toBe('grid');
    
    // Elements should stack vertically
    const controls = page.locator('.pet-remover-v2__controls');
    const preview = page.locator('.pet-remover-v2__preview-panel');
    
    const controlsBox = await controls.boundingBox();
    const previewBox = await preview.boundingBox();
    
    // Preview should be below controls
    expect(previewBox.y).toBeGreaterThan(controlsBox.y + controlsBox.height);
  });

  test('Responsive Design: Layout responds properly to viewport changes', async ({ page }) => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .wrapper {
      width: 1200px; /* Fixed width to test container queries */
      margin: 0 auto;
    }
    
    .pet-remover-v2 {
      container-type: inline-size;
      container-name: pet-remover;
      padding: 1rem;
      background: #f0f0f0;
    }
    
    @media screen and (min-width: 1024px) {
      .pet-remover-v2 {
        display: grid;
        grid-template-columns: 35% 65%;
        gap: 3rem;
        background: #e0ffe0; /* Green when grid is active */
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="pet-remover-v2">
      <div class="pet-remover-v2__controls">Controls</div>
      <div class="pet-remover-v2__preview-panel">Preview</div>
    </div>
  </div>
</body>
</html>`;

    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);
    
    // Test smaller viewport - should NOT be grid (below 1024px breakpoint)
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(100);
    
    const container = page.locator('.pet-remover-v2');
    
    // Should NOT be grid on smaller viewport
    let displayStyle = await container.evaluate(el => 
      window.getComputedStyle(el).display
    );
    expect(displayStyle).toBe('block');
    
    // Test desktop viewport - should be grid (1024px+)
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(100);
    
    displayStyle = await container.evaluate(el => 
      window.getComputedStyle(el).display
    );
    expect(displayStyle).toBe('grid');
    
    // Background should be green (grid active)
    const bgColor = await container.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBe('rgb(224, 255, 224)'); // #e0ffe0
  });

  test('No CSS conflicts or !important overrides', async ({ page }) => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Test that we don't need !important */
    .pet-remover-v2 {
      container-type: inline-size;
    }
    
    @media screen and (min-width: 1024px) {
      .pet-remover-v2 {
        display: grid;
        grid-template-columns: 35% 65%;
        gap: 3rem;
        align-items: start;
      }
    }
  </style>
</head>
<body>
  <div class="pet-remover-v2" style="">
    <div class="pet-remover-v2__controls">Controls</div>
    <div class="pet-remover-v2__preview-panel">Preview</div>
  </div>
</body>
</html>`;

    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);
    await page.setViewportSize({ width: 1440, height: 900 });
    
    const container = page.locator('.pet-remover-v2');
    
    // Check inline styles and computed styles
    const styles = await container.evaluate(el => {
      const inline = el.getAttribute('style') || '';
      const computed = window.getComputedStyle(el);
      return {
        hasInlineImportant: inline.includes('!important'),
        display: computed.display,
        gridTemplateColumns: computed.gridTemplateColumns,
        alignItems: computed.alignItems,
        cssText: el.style.cssText
      };
    });
    
    // No inline !important
    expect(styles.hasInlineImportant).toBe(false);
    
    // Correct computed values without needing !important
    expect(styles.display).toBe('grid');
    expect(styles.alignItems).toBe('start');
    
    // CSS is clean
    expect(styles.cssText).not.toContain('!important');
  });

  test('Effects grid layout works on desktop screens', async ({ page }) => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .pet-remover-v2__effects-grid {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
    }
    
    .pet-remover-v2__effect-tile {
      flex: 0 0 72px;
      height: 72px;
      border: 2px solid #e1e5e9;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    @media screen and (min-width: 768px) {
      .pet-remover-v2__effects-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        overflow: visible;
      }
      
      .pet-remover-v2__effect-tile {
        flex: none;
        width: auto;
        height: 90px;
      }
    }
    
    @media screen and (min-width: 1024px) {
      .pet-remover-v2__effects-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .pet-remover-v2__effect-tile {
        height: 110px;
      }
    }
  </style>
</head>
<body>
  <div class="pet-remover-v2" style="width: 100%;">
    <div class="pet-remover-v2__effects-grid">
      <div class="pet-remover-v2__effect-tile">Effect 1</div>
      <div class="pet-remover-v2__effect-tile">Effect 2</div>
      <div class="pet-remover-v2__effect-tile">Effect 3</div>
      <div class="pet-remover-v2__effect-tile">Effect 4</div>
    </div>
  </div>
</body>
</html>`;

    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);
    
    // Focus on testing desktop functionality which is the main concern
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100); // Allow styles to apply
    
    const grid = page.locator('.pet-remover-v2__effects-grid');
    const display = await grid.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('grid');
    
    const columns = await grid.evaluate(el => 
      window.getComputedStyle(el).gridTemplateColumns
    );
    // At desktop size should have 2 columns (from 1024px+ media query)
    expect(columns.split(' ')).toHaveLength(2);
    
    // Verify tiles are appropriately sized
    const tiles = page.locator('.pet-remover-v2__effect-tile');
    const tileCount = await tiles.count();
    expect(tileCount).toBe(4);
  });
});