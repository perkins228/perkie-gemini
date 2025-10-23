/**
 * Frontend Debug Script for API Response Issue
 * Run this in the browser console to diagnose why effects aren't showing
 */

console.log('🔍 PERKIE PRINTS DEBUG SCRIPT STARTING...');

// Check if modules are loaded
function checkModulesLoaded() {
    console.log('\n=== MODULE AVAILABILITY CHECK ===');
    
    const checks = {
        'window.perkieCore': !!window.perkieCore,
        'window.perkieEffects': !!window.perkieEffects,
        'window.perkieEffectBlobs': !!window.perkieEffectBlobs,
        'Core Engine': !!(window.perkieCore && window.perkieCore.modules),
        'API Client': !!(window.perkieCore && window.perkieCore.modules && window.perkieCore.modules.api)
    };
    
    Object.entries(checks).forEach(([name, available]) => {
        console.log(`${available ? '✅' : '❌'} ${name}: ${available ? 'Available' : 'Not Available'}`);
    });
    
    // Check effects specifically
    if (window.perkieEffects) {
        const effectKeys = Object.keys(window.perkieEffects);
        console.log(`📊 Current perkieEffects keys: [${effectKeys.join(', ')}]`);
        console.log(`📊 Total effects: ${effectKeys.length}`);
        
        effectKeys.forEach(key => {
            const value = window.perkieEffects[key];
            console.log(`  - ${key}: ${typeof value} ${value ? `(${value.substring(0, 50)}...)` : '(null/undefined)'}`);
        });
    } else {
        console.log('❌ window.perkieEffects is not defined');
    }
}

// Test API call directly
async function testDirectAPICall() {
    console.log('\n=== DIRECT API TEST ===');
    
    if (!window.perkieCore || !window.perkieCore.modules || !window.perkieCore.modules.api) {
        console.log('❌ API client not available. Loading...');
        
        try {
            // Try to load the API client
            const { APIClient } = await import('./assets/api-client.js');
            window.testAPIClient = new APIClient();
            console.log('✅ API client loaded for testing');
        } catch (error) {
            console.error('❌ Failed to load API client:', error);
            return;
        }
    }
    
    // Create a test image (1x1 red pixel PNG)
    const testImageBlob = await createTestImage();
    
    console.log('📞 Making direct API call...');
    const startTime = Date.now();
    
    try {
        const apiClient = window.testAPIClient || window.perkieCore.modules.api;
        const result = await apiClient.removeBackground(testImageBlob);
        
        const endTime = Date.now();
        console.log(`✅ API call completed in ${endTime - startTime}ms`);
        console.log('🎯 API Result:', result ? 'SUCCESS' : 'FAILED');
        
        // Check effects after API call
        setTimeout(() => {
            checkModulesLoaded();
        }, 100);
        
        return result;
    } catch (error) {
        console.error('❌ Direct API call failed:', error);
        return null;
    }
}

// Create a simple test image
async function createTestImage() {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // Draw a red square
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 100, 100);
        
        canvas.toBlob(resolve, 'image/png');
    });
}

// Monitor network requests
function monitorNetworkRequests() {
    console.log('\n=== NETWORK MONITORING SETUP ===');
    
    // Store original fetch
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
        const [url, options] = args;
        
        // Only log API calls
        if (url && url.includes('inspirenet-bg-removal-api')) {
            console.log('🌐 API Request:', {
                url: url,
                method: options?.method || 'GET',
                hasBody: !!options?.body,
                timestamp: new Date().toISOString()
            });
            
            try {
                const response = await originalFetch.apply(this, args);
                
                console.log('🌐 API Response:', {
                    url: url,
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get('content-type'),
                    timestamp: new Date().toISOString()
                });
                
                // Clone response to read without consuming
                const clonedResponse = response.clone();
                
                // Try to log response data
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const jsonData = await clonedResponse.json();
                        console.log('📊 API JSON Response:', {
                            hasEffects: !!(jsonData.effects),
                            effectCount: jsonData.effects ? Object.keys(jsonData.effects).length : 0,
                            effectKeys: jsonData.effects ? Object.keys(jsonData.effects) : [],
                            totalEffects: jsonData.total_effects,
                            sessionId: jsonData.session_id
                        });
                    }
                } catch (parseError) {
                    console.log('⚠️  Could not parse API response as JSON:', parseError.message);
                }
                
                return response;
            } catch (error) {
                console.error('❌ API Request failed:', error);
                throw error;
            }
        }
        
        return originalFetch.apply(this, args);
    };
    
    console.log('✅ Network monitoring active');
}

// Check for JavaScript errors
function checkForErrors() {
    console.log('\n=== ERROR MONITORING SETUP ===');
    
    // Store original error handler
    const originalErrorHandler = window.onerror;
    
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('🚨 JavaScript Error Detected:', {
            message: message,
            source: source,
            line: lineno,
            column: colno,
            error: error,
            timestamp: new Date().toISOString()
        });
        
        // Call original handler if it exists
        if (originalErrorHandler) {
            return originalErrorHandler.apply(this, arguments);
        }
        
        return false;
    };
    
    // Also monitor unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('🚨 Unhandled Promise Rejection:', {
            reason: event.reason,
            promise: event.promise,
            timestamp: new Date().toISOString()
        });
    });
    
    console.log('✅ Error monitoring active');
}

// Main diagnostic function
async function runFullDiagnostic() {
    console.log('🔍 RUNNING FULL PERKIE PRINTS DIAGNOSTIC...\n');
    
    // 1. Check current state
    checkModulesLoaded();
    
    // 2. Set up monitoring
    monitorNetworkRequests();
    checkForErrors();
    
    // 3. Test API directly
    await testDirectAPICall();
    
    // 4. Final state check
    setTimeout(() => {
        console.log('\n=== FINAL STATE CHECK ===');
        checkModulesLoaded();
        
        console.log('\n🏁 DIAGNOSTIC COMPLETE');
        console.log('📋 If effects still show "none", check:');
        console.log('   1. Are there JavaScript errors in the console?');
        console.log('   2. Is the API actually being called?'); 
        console.log('   3. Does the API response contain the effects data?');
        console.log('   4. Are there CORS issues?');
        console.log('   5. Is the base64ToBlob conversion failing?');
    }, 2000);
}

// Export functions for manual use
window.perkieDebug = {
    checkModulesLoaded,
    testDirectAPICall,
    monitorNetworkRequests,
    checkForErrors,
    runFullDiagnostic,
    createTestImage
};

console.log('✅ Debug script loaded. Available functions:');
console.log('   - window.perkieDebug.runFullDiagnostic() - Run complete diagnostic');
console.log('   - window.perkieDebug.checkModulesLoaded() - Check current state');
console.log('   - window.perkieDebug.testDirectAPICall() - Test API directly');
console.log('');
console.log('🚀 Run window.perkieDebug.runFullDiagnostic() to start');