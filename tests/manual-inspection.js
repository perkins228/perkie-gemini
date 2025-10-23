const { chromium } = require('playwright');

async function inspectPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set up logging
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page Error: ${error.message}`));
  
  try {
    console.log('🔄 Navigating to page...');
    await page.goto('https://owgp57je7zp1viyv-2930573424.shopifypreview.com/pages/custom-image-processing', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded, waiting 3 seconds...');
    await page.waitForTimeout(3000);
    
    // Get page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check what sections are on the page
    const sections = await page.evaluate(() => {
      const sectionElements = document.querySelectorAll('section, .section, [class*="pet"], [class*="processor"]');
      return Array.from(sectionElements).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        textContent: el.textContent.substring(0, 100) + '...'
      }));
    });
    
    console.log('📋 Found sections:', sections);
    
    // Look for file inputs
    const fileInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="file"], input[accept*="image"]');
      return Array.from(inputs).map(input => ({
        id: input.id,
        className: input.className,
        accept: input.accept,
        name: input.name
      }));
    });
    
    console.log('📂 Found file inputs:', fileInputs);
    
    // Check for pet-related elements
    const petElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="pet"], [id*="pet"], [data-*="pet"]');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        dataset: {...el.dataset}
      }));
    });
    
    console.log('🐾 Found pet elements:', petElements);
    
    // Check for effect buttons
    const effectButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('[data-effect], .effect-button, .effect-btn, button[class*="effect"]');
      return Array.from(buttons).map(btn => ({
        tagName: btn.tagName,
        className: btn.className,
        dataEffect: btn.getAttribute('data-effect'),
        textContent: btn.textContent.trim()
      }));
    });
    
    console.log('🎨 Found effect buttons:', effectButtons);
    
    // Check for JavaScript objects
    const jsObjects = await page.evaluate(() => {
      return {
        perkieEffects: typeof window.perkieEffects,
        petProcessor: typeof window.petProcessor,
        keys: Object.keys(window).filter(key => key.toLowerCase().includes('pet') || key.toLowerCase().includes('perkie'))
      };
    });
    
    console.log('🔧 JavaScript objects:', jsObjects);
    
    // Take a screenshot
    await page.screenshot({ path: 'manual-inspection.png', fullPage: true });
    console.log('📸 Screenshot saved as manual-inspection.png');
    
    // Wait for user to examine the page
    console.log('🔍 Keeping browser open for manual inspection... Press Ctrl+C when done.');
    await new Promise(() => {}); // Keep alive
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectPage();