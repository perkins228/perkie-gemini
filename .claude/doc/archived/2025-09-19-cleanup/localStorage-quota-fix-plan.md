# localStorage Quota Fix Implementation Plan

## Problem Summary
Pet migration failing with `QuotaExceededError` when trying to save consolidated data to 'perkiePersistence' key. Root cause is multiple redundant backup systems accumulating massive base64 image data (10-20MB) that exceeds typical localStorage quota (5-10MB).

## Root Cause Analysis

### 1. Storage Bloat Sources
- **`perkieEffects_backup`**: Full resolution effects data (multiple MB)
- **`perkieThumbnails_backup`**: Thumbnail images (still large due to base64)
- **`perkieAllEffects_backup`**: Comprehensive effects data (largest offender)
- **`perkieSessionPets_backup`**: Session pet data
- **Legacy session keys**: `pet_session_*` keys from old system
- **A/B testing data**: Various `perkie_*` experiment keys
- **Email marketing data**: Cart abandonment and user tracking

### 2. Migration Logic Flaw
The migration in `pet-data-migration-es5.js` attempts to:
1. Load ALL legacy data (19 keys × multiple effects = massive size)
2. Merge into unified format 
3. Save to single `perkiePersistence` key
4. **FAILS** because combined data exceeds quota
5. Rollback preserves bloated state

### 3. Current Cleanup Inadequate  
- `session.js` has `handleQuotaExceeded()` but only cleans `perkie_*` keys
- Pet backup systems not included in cleanup
- No pre-migration space clearing

## Solution: Pre-Migration Aggressive Cleanup

### Phase 1: Emergency Space Recovery
**File**: `assets/pet-data-migration-es5.js`

**Add method**: `_emergencyCleanupBeforeMigration()`
```javascript
// Add before migration starts (line ~35)
_emergencyCleanupBeforeMigration: function() {
  console.log('🧹 Emergency cleanup before migration...');
  
  var spaceCleaned = 0;
  var keysRemoved = 0;
  
  // 1. Remove old A/B testing data (can be regenerated)
  var abTestKeys = [
    'perkie_experiment_views',
    'perkie_experiment_conversions', 
    'perkie_experiments'
  ];
  
  abTestKeys.forEach(function(key) {
    var data = localStorage.getItem(key);
    if (data) {
      spaceCleaned += data.length;
      localStorage.removeItem(key);
      keysRemoved++;
    }
  });
  
  // 2. Remove expired email marketing data
  var emailKeys = [
    'perkie_abandonment',
    'perkie_cart_abandonment',
    'perkie_pending_emails'
  ];
  
  emailKeys.forEach(function(key) {
    var data = localStorage.getItem(key);
    if (data) {
      try {
        var parsed = JSON.parse(data);
        var isExpired = parsed.timestamp && 
                       (Date.now() - parsed.timestamp) > (7 * 24 * 60 * 60 * 1000); // 7 days
        if (isExpired) {
          spaceCleaned += data.length;
          localStorage.removeItem(key);
          keysRemoved++;
        }
      } catch (e) {
        // Invalid data, remove it
        spaceCleaned += data.length;
        localStorage.removeItem(key);
        keysRemoved++;
      }
    }
  });
  
  // 3. Remove old session data (> 24 hours)
  var sessionKeys = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key && key.indexOf('pet_session_') === 0) {
      sessionKeys.push(key);
    }
  }
  
  sessionKeys.forEach(function(key) {
    var data = localStorage.getItem(key);
    if (data) {
      try {
        var parsed = JSON.parse(data);
        var isOld = parsed.timestamp && 
                   (Date.now() - parsed.timestamp) > (24 * 60 * 60 * 1000); // 24 hours
        if (isOld || !parsed.timestamp) {
          spaceCleaned += data.length;
          localStorage.removeItem(key);
          keysRemoved++;
        }
      } catch (e) {
        spaceCleaned += data.length;
        localStorage.removeItem(key);
        keysRemoved++;
      }
    }
  });
  
  console.log('🧹 Emergency cleanup freed', (spaceCleaned / 1024).toFixed(2), 'KB by removing', keysRemoved, 'keys');
  return spaceCleaned;
}
```

### Phase 2: Optimize Data Before Consolidation
**File**: `assets/pet-data-migration-es5.js`

**Modify method**: `_mergeIntoUnified()` (around line 230)
```javascript
// Add size optimization before creating unified data
_mergeIntoUnified: function(legacyData) {
  var unifiedData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    pets: {}
  };
  
  // OPTIMIZATION: Only keep essential data for each pet
  var processedPets = 0;
  
  // Process each unique pet key with size limits
  for (var i = 0; i < legacyData.uniqueKeys.length; i++) {
    var key = legacyData.uniqueKeys[i];
    
    var petData = {
      original: null,      // Keep original
      thumbnail: null,     // Keep small thumbnail only
      effects: {},         // Limit to 4 most recent effects
      metadata: {
        name: legacyData.petNames[key] || ('Pet ' + (processedPets + 1)),
        uploadedAt: new Date().toISOString(),
        processed: true
      }
    };
    
    // Get original image (prefer smallest available)
    petData.original = this._getBestOriginal(key, legacyData);
    
    // Get optimized thumbnail (max 150x150)
    petData.thumbnail = this._getOptimizedThumbnail(key, legacyData);
    
    // Limit effects to save space (keep only thumbnails of effects)
    var effectCount = 0;
    var maxEffects = 4; // Limit to prevent quota issues
    
    for (var effect in legacyData.allEffects[key] || {}) {
      if (effectCount >= maxEffects) break;
      if (legacyData.allEffects[key].hasOwnProperty(effect)) {
        // Store thumbnail version of effect, not full size
        petData.effects[effect] = this._createEffectThumbnail(
          legacyData.allEffects[key][effect]
        );
        effectCount++;
      }
    }
    
    unifiedData.pets[key] = petData;
    processedPets++;
  }
  
  console.log('📦 Created unified data for', processedPets, 'pets with size optimization');
  
  // Check final size before returning
  var dataStr = JSON.stringify(unifiedData);
  var sizeKB = (dataStr.length / 1024).toFixed(2);
  console.log('📊 Unified data size:', sizeKB, 'KB');
  
  // If still too large, remove some effects
  if (dataStr.length > 4 * 1024 * 1024) { // 4MB threshold
    console.warn('⚠️ Data still large, reducing effects further...');
    unifiedData = this._reduceDataSize(unifiedData);
  }
  
  return unifiedData;
}
```

### Phase 3: Add Helper Methods
**File**: `assets/pet-data-migration-es5.js`

**Add methods** (after existing methods):
```javascript
// Helper to get best original image
_getBestOriginal: function(key, legacyData) {
  // Try thumbnail first (smaller), then effects
  if (legacyData.thumbnails[key]) {
    return legacyData.thumbnails[key];
  }
  
  // Try session pets
  for (var i = 0; i < legacyData.sessionPets.length; i++) {
    if (legacyData.sessionPets[i].id === key && legacyData.sessionPets[i].originalImage) {
      return legacyData.sessionPets[i].originalImage;
    }
  }
  
  return null;
},

// Helper to create optimized thumbnail
_getOptimizedThumbnail: function(key, legacyData) {
  if (legacyData.thumbnails[key]) {
    return legacyData.thumbnails[key];
  }
  
  // If no thumbnail, create from original
  var original = this._getBestOriginal(key, legacyData);
  if (original) {
    return this._resizeImage(original, 150, 150);
  }
  
  return null;
},

// Create effect thumbnail (smaller version)
_createEffectThumbnail: function(effectData) {
  if (typeof effectData === 'string') {
    // It's already an image, resize it
    return this._resizeImage(effectData, 200, 200);
  }
  return effectData;
},

// Reduce data size if needed
_reduceDataSize: function(unifiedData) {
  console.log('🔄 Reducing data size...');
  
  // Remove all but 2 effects per pet
  for (var key in unifiedData.pets) {
    if (unifiedData.pets.hasOwnProperty(key)) {
      var effects = unifiedData.pets[key].effects;
      var effectKeys = Object.keys(effects);
      
      if (effectKeys.length > 2) {
        var newEffects = {};
        // Keep first 2 effects only
        newEffects[effectKeys[0]] = effects[effectKeys[0]];
        if (effectKeys[1]) {
          newEffects[effectKeys[1]] = effects[effectKeys[1]];
        }
        unifiedData.pets[key].effects = newEffects;
      }
    }
  }
  
  return unifiedData;
},

// Simple image resizer (ES5 compatible)
_resizeImage: function(dataUrl, maxWidth, maxHeight) {
  // This is a placeholder - would need proper canvas resizing
  // For now, return original but add logic later if needed
  return dataUrl;
}
```

### Phase 4: Update Migration Entry Point
**File**: `assets/pet-data-migration-es5.js`

**Modify**: `migrate()` method (line ~25)
```javascript
// Add emergency cleanup at start
migrate: function() {
  if (localStorage.getItem(this.MIGRATION_FLAG)) {
    console.log('✅ PetDataMigration: Already migrated');
    return { success: true, message: 'Already migrated' };
  }
  
  console.log('🚀 PetDataMigration: Starting migration...');
  
  try {
    // Step 0: Emergency cleanup to free space
    var freedSpace = this._emergencyCleanupBeforeMigration();
    
    // Step 1: Create backup point
    this._createBackupPoint();
    
    // Continue with existing migration...
```

### Phase 5: Enhanced Error Handling
**File**: `assets/pet-data-migration-es5.js`

**Modify**: `_saveUnifiedData()` method (line ~330)
```javascript
_saveUnifiedData: function(data) {
  try {
    var dataStr = JSON.stringify(data);
    
    // Pre-check size
    var sizeKB = (dataStr.length / 1024).toFixed(2);
    console.log('💾 Attempting to save', sizeKB, 'KB of unified data');
    
    // If still too large, try more aggressive reduction
    if (dataStr.length > 3 * 1024 * 1024) { // 3MB threshold
      console.warn('⚠️ Data approaching quota limit, final reduction...');
      data = this._finalDataReduction(data);
      dataStr = JSON.stringify(data);
      sizeKB = (dataStr.length / 1024).toFixed(2);
      console.log('📉 Reduced to', sizeKB, 'KB');
    }
    
    localStorage.setItem('perkiePersistence', dataStr);
    console.log('💾 Saved unified data (', sizeKB, 'KB )');
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('❌ Quota exceeded even after cleanup. Data size:', (JSON.stringify(data).length / 1024).toFixed(2), 'KB');
      // Try one more aggressive cleanup
      this._desperateCleanup();
      return false;
    }
    console.error('❌ Failed to save unified data:', error);
    return false;
  }
}
```

### Phase 6: Desperate Cleanup Method
**File**: `assets/pet-data-migration-es5.js`

**Add method**:
```javascript
_desperateCleanup: function() {
  console.log('🚨 Desperate cleanup - removing ALL non-essential data');
  
  // Remove everything except current page essentials
  var keysToKeep = ['perkiePersistence'];
  var allKeys = [];
  
  // Collect all keys
  for (var i = 0; i < localStorage.length; i++) {
    allKeys.push(localStorage.key(i));
  }
  
  // Remove everything else
  allKeys.forEach(function(key) {
    if (keysToKeep.indexOf(key) === -1) {
      localStorage.removeItem(key);
    }
  });
  
  console.log('🚨 Desperate cleanup completed');
},

_finalDataReduction: function(data) {
  // Keep only thumbnails, remove all effects
  for (var key in data.pets) {
    if (data.pets.hasOwnProperty(key)) {
      data.pets[key].effects = {}; // Remove all effects
    }
  }
  return data;
}
```

## Implementation Steps

1. **Backup Current State**: Test migration on staging first
2. **Add Emergency Cleanup**: Implement `_emergencyCleanupBeforeMigration()`
3. **Add Size Optimization**: Implement `_mergeIntoUnified()` changes
4. **Add Helper Methods**: Implement all helper functions
5. **Update Entry Point**: Add emergency cleanup to migration start
6. **Enhanced Error Handling**: Improve `_saveUnifiedData()` with size checks
7. **Add Desperate Cleanup**: Last resort cleanup method

## Critical Notes

- **ES5 Compatibility**: All code uses `var`, `function()`, and ES5 syntax
- **Mobile Priority**: 70% mobile traffic - test thoroughly on mobile devices
- **Data Preservation**: Emergency cleanup only removes non-essential/expired data
- **Size Limits**: Target final unified data under 3MB to leave headroom
- **Graceful Degradation**: If migration fails, system falls back to legacy mode

## Prevention Strategy

- **Regular Cleanup**: Implement automatic cleanup of expired data
- **Size Monitoring**: Add localStorage usage monitoring
- **Effect Limits**: Limit effects per pet to prevent future bloat
- **Thumbnail-First**: Store thumbnails by default, full images on demand

## Testing Plan

1. Test on device with limited localStorage (mobile)
2. Create artificial quota pressure in dev tools
3. Verify migration works with large datasets
4. Confirm rollback works properly
5. Test subsequent operations after successful migration

## Risk Mitigation

- **Rollback Safety**: All cleanup preserves essential pet data
- **Progressive Reduction**: Multiple stages of size reduction
- **Fallback Mode**: System continues working even if migration fails
- **Data Recovery**: 7-day backup window for legacy data restoration