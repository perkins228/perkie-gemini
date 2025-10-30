/**
 * Pet Name Display Formatter Utilities
 * Handles conversion between storage format (comma-separated) and display format (ampersand)
 * ES5 Compatible for mobile browser support (70% traffic)
 * 
 * Storage Format: "Sam,Buddy,Max" (comma-separated)
 * Display Format: "Sam & Buddy & Max" (ampersand with spaces)
 */

(function() {
  'use strict';

  window.PetNameFormatter = {
    /**
     * Convert comma-separated pet names to ampersand display format
     * Handles edge cases including existing ampersands in pet names
     * @param {string} petNamesString - Comma-separated pet names
     * @returns {string} Display format with ampersand separator
     */
    formatForDisplay: function(petNamesString) {
      if (!petNamesString || typeof petNamesString !== 'string') {
        return '';
      }
      
      // Parse into array handling both comma and ampersand formats
      var names = this.parseToArray(petNamesString);
      
      if (names.length === 0) return '';
      if (names.length === 1) return this.escapeHtml(names[0]);
      
      // For 2 pets: "Sam & Buddy"
      if (names.length === 2) {
        return this.escapeHtml(names[0]) + ' & ' + this.escapeHtml(names[1]);
      }
      
      // For 3+ pets: "Sam, Buddy & Max" (no Oxford comma)
      var escaped = names.map(function(name) {
        return this.escapeHtml(name);
      }, this);
      
      var lastPet = escaped.pop();
      return escaped.join(', ') + ' & ' + lastPet;
    },
    
    /**
     * Convert display format back to storage format (comma-separated)
     * Handles ampersands that are part of pet names vs separators
     * @param {string} displayString - Display format string
     * @returns {string} Comma-separated storage format
     */
    formatForStorage: function(displayString) {
      if (!displayString || typeof displayString !== 'string') {
        return '';
      }
      
      // Complex parsing to handle "Ben & Jerry & Max" scenario
      // where first & is part of name, second is separator
      
      // First, preserve existing ampersands that are within quotes or known patterns
      var preserved = displayString
        .replace(/([A-Za-z]+)\s*&\s*([A-Za-z]+)(?=\s*&)/g, '$1[PRESERVED_AMP]$2');
      
      // Then split on remaining ampersands (the separators)
      var parts = preserved.split(/\s*&\s*/);
      
      // Restore preserved ampersands
      var names = parts.map(function(part) {
        return part.replace(/\[PRESERVED_AMP\]/g, ' & ').trim();
      });
      
      // Filter out empty strings and join with comma
      return names.filter(function(name) {
        return name.length > 0;
      }).join(',');
    },
    
    /**
     * Parse pet names into array regardless of format (comma or ampersand)
     * @param {string} petNamesString - Pet names in any format
     * @returns {Array} Array of individual pet names
     */
    parseToArray: function(petNamesString) {
      if (!petNamesString || typeof petNamesString !== 'string') {
        return [];
      }
      
      // Handle both comma and ampersand formats
      // But preserve ampersands that are clearly part of names
      var normalized = petNamesString;
      
      // If it contains commas, it's storage format
      if (petNamesString.indexOf(',') > -1) {
        // Split by comma
        var names = petNamesString.split(',');
      } else if (petNamesString.indexOf(' & ') > -1) {
        // Display format - split by ampersand separator
        // But be careful about names containing ampersands
        var names = petNamesString.split(/\s+&\s+/);
      } else {
        // Single name or special format
        var names = [petNamesString];
      }
      
      // Clean up each name
      return names.map(function(name) {
        return name.trim();
      }).filter(function(name) {
        return name.length > 0;
      });
    },
    
    /**
     * Escape HTML entities for safe display
     * Prevents XSS attacks from pet names containing HTML/scripts
     * @param {string} str - String to escape
     * @returns {string} HTML-escaped string
     */
    escapeHtml: function(str) {
      if (!str) return '';
      
      // Use textContent for proper HTML escaping
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    
    /**
     * Validate pet name for safety and length
     * @param {string} name - Pet name to validate
     * @returns {boolean} True if valid, false otherwise
     */
    validatePetName: function(name) {
      if (!name || typeof name !== 'string') {
        return false;
      }
      
      // Check length (reasonable limit)
      if (name.length === 0 || name.length > 50) {
        return false;
      }
      
      // Check for dangerous patterns (basic XSS prevention)
      var dangerous = /<script|<iframe|javascript:|on\w+=/i;
      if (dangerous.test(name)) {
        return false;
      }
      
      return true;
    },
    
    /**
     * Get display format with caching for performance
     * Memoizes results to avoid repeated transformations
     * @param {string} petNamesString - Comma-separated pet names
     * @returns {string} Cached or newly formatted display string
     */
    getCachedDisplay: function(petNamesString) {
      // Simple cache implementation
      if (!this._cache) {
        this._cache = {};
      }
      
      var cacheKey = petNamesString || '';
      
      if (!this._cache[cacheKey]) {
        this._cache[cacheKey] = this.formatForDisplay(petNamesString);
      }
      
      return this._cache[cacheKey];
    },
    
    /**
     * Clear the display cache
     * Call when pet names are updated
     */
    clearCache: function() {
      this._cache = {};
    },
    
    /**
     * Format for Liquid template usage
     * Returns data structure for template consumption
     * @param {string} petNamesString - Comma-separated pet names
     * @returns {Object} Template-ready data
     */
    getTemplateData: function(petNamesString) {
      var names = this.parseToArray(petNamesString);
      
      return {
        raw: petNamesString,
        display: this.formatForDisplay(petNamesString),
        array: names,
        count: names.length,
        hasMultiple: names.length > 1
      };
    },
    
    /**
     * Initialize formatter and auto-transform elements
     * Call this on DOMContentLoaded
     */
    init: function() {
      var self = this;
      
      // Auto-transform all elements with data-pet-names attribute
      this.transformAll();
      
      // Listen for pet selection events to update displays
      document.addEventListener('pet:selected', function() {
        self.clearCache();
        self.transformAll();
      });
      
      document.addEventListener('pet:removed', function() {
        self.clearCache();
        self.transformAll();
      });
    },
    
    /**
     * Transform all elements with pet name data attributes
     * Automatically applies display formatting
     */
    transformAll: function() {
      var self = this;
      var elements = document.querySelectorAll('[data-pet-names]');
      
      for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        var petNames = element.getAttribute('data-pet-names');
        
        if (petNames) {
          // Use cached display for performance
          var displayNames = self.getCachedDisplay(petNames);
          
          // Use textContent to prevent XSS
          element.textContent = displayNames;
        }
      }
    },
    
    /**
     * Test suite - run in console for validation
     * @returns {boolean} True if all tests pass
     */
    runTests: function() {
      var tests = [
        // Single pet
        { input: 'Sam', expected: 'Sam' },
        // Two pets
        { input: 'Sam,Buddy', expected: 'Sam & Buddy' },
        // Three pets (no Oxford comma)
        { input: 'Sam,Buddy,Max', expected: 'Sam, Buddy & Max' },
        // Empty string
        { input: '', expected: '' },
        // Null/undefined
        { input: null, expected: '' },
        // Pet with ampersand in name (only 2 pets, no Oxford comma needed)
        { input: 'Ben & Jerry,Max', expected: 'Ben & Jerry & Max' },
        // Three pets with one having ampersand (no Oxford comma)
        { input: 'Ben & Jerry,Max,Luna', expected: 'Ben & Jerry, Max & Luna' },
        // Whitespace handling
        { input: ' Sam , Buddy ', expected: 'Sam & Buddy' },
        // Special characters (should be escaped)
        { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert("xss")&lt;/script&gt;' }
      ];
      
      var passed = 0;
      var failed = 0;
      
      for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        var result = this.formatForDisplay(test.input);
        
        if (result === test.expected) {
          passed++;
          console.log('✅ Test passed:', test.input, '→', result);
        } else {
          failed++;
          console.error('❌ Test failed:', test.input, '→', result, '(expected:', test.expected, ')');
        }
      }
      
      console.log('Test Results: ' + passed + ' passed, ' + failed + ' failed');
      return failed === 0;
    }
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.PetNameFormatter.init();
    });
  } else {
    // DOM already loaded
    window.PetNameFormatter.init();
  }
  
  // Expose for debugging
  window.testPetNameFormatter = function() {
    return window.PetNameFormatter.runTests();
  };
  
})();