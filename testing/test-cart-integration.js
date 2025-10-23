//**
 * Test Cart Integration
 * Run this in browser console on the pet background remover page
 */

console.log('=== Testing Cart Integration ===');

// Step 1: Check if modules are loaded
console.log('\n1. Checking module availability:');
const modules = {
    'CartManager': typeof CartManager !== 'undefined',
    'ImageUploader': typeof ImageUploader !== 'undefined',
    'SessionManager': typeof SessionManager !== 'undefined',
    'SimpleSessionManager': typeof SimpleSessionManager !== 'undefined'
};

Object.entries(modules).forEach(([name, loaded]) => {
    console.log(`   ${name}: ${loaded ? '✅ Loaded' : '❌ Not Found'}`);
});

// Step 2: Check if KsPetBgRemover component exists
console.log('\n2. Looking for Pet Background Remover component:');
const component = document.querySelector('ks-pet-bg-remover');
if (component) {
    console.log('   ✅ Component found');
    
    // Check critical properties
    console.log('\n3. Checking component properties:');
    console.log(`   Section ID: ${component.sectionId || '❌ Missing'}`);
    console.log(`   Variant ID: ${component.previewProductVariantId || '❌ Missing'}`);
    console.log(`   API URL: ${component.apiUrl || '❌ Missing'}`);
    console.log(`   Cart Manager: ${component.cartManager ? '✅ Initialized' : '❌ Not Initialized'}`);
    
    // Check if addToProduct method exists
    console.log('\n4. Checking critical methods:');
    console.log(`   addToProduct: ${typeof component.addToProduct === 'function' ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   processImage: ${typeof component.processImage === 'function' ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   showStatus: ${typeof component.showStatus === 'function' ? '✅ Exists' : '❌ Missing'}`);
    
    // Test the cart flow (dry run)
    console.log('\n5. Testing cart flow (dry run):');
    if (typeof component.addToProduct === 'function') {
        console.log('   ✅ addToProduct method is available');
        console.log('   To test adding to cart, run: document.querySelector("ks-pet-bg-remover").addToProduct()');
        
        // Check current state
        if (component.currentProcessedImageUrl) {
            console.log('   ✅ Has processed image - ready to add to cart');
        } else {
            console.log('   ⚠️  No processed image - need to process an image first');
        }
    } else {
        console.log('   ❌ addToProduct method not found - CRITICAL BUG!');
    }
    
} else {
    console.log('   ❌ Component not found on this page');
}

console.log('\n=== Test Complete ===');
console.log('If you see any ❌ marks above, those issues need to be fixed.');