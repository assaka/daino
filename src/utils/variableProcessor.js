/**
 * variableProcessor.js - Handlebars-like Template Engine
 *
 * =====================================================================
 * PURPOSE: Process {{variable}} template syntax in slot content,
 * className, and styles for dynamic content rendering
 * =====================================================================
 *
 * ARCHITECTURE ROLE:
 *
 * Variable processor is the **template engine** that powers dynamic content:
 * 1. Replaces {{variables}} with real data
 * 2. Evaluates {{#if}} conditionals
 * 3. Processes {{#each}} loops
 * 4. Formats prices, dates, stock status automatically
 * 5. Handles nested structures with proper bracket counting
 *
 * DATA FLOW:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ UnifiedSlotRenderer                                         │
 * │ - Receives slot with content: "{{product.name}}"           │
 * │ - Calls processVariables(content, variableContext)         │
 * └────────────────────┬────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │ variableProcessor (THIS FILE)                               │
 * │ 1. Process loops first: {{#each products}}...{{/each}}     │
 * │ 2. Process conditionals: {{#if on_sale}}SALE{{/if}}       │
 * │ 3. Process simple variables: {{product.name}}              │
 * │ 4. Format values (prices, dates, stock status)            │
 * └────────────────────┬────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Result: "Samsung RS66A8101B1 Amerikaanse Koelkast"         │
 * └─────────────────────────────────────────────────────────────┘
 *
 * VARIABLE SYNTAX:
 *
 * **Simple Variables**:
 * - {{product.name}} → "Samsung RS66A8101B1"
 * - {{product.price_formatted}} → "¥1049.00"
 * - {{settings.currency_symbol}} → "¥"
 * - {{this.image_url}} → Current item in loop
 *
 * **Conditionals**:
 * - {{#if product.on_sale}}SALE{{/if}}
 * - {{#if product.on_sale}}SALE{{else}}Regular{{/if}}
 * - {{#if (eq product.status "active")}}Active{{/if}}
 * - {{#if (gt product.stock_quantity 0)}}In Stock{{/if}}
 * - {{#if product.price > 100}}Expensive{{/if}}
 *
 * **Loops**:
 * - {{#each product.images}}<img src="{{this}}"/>{{/each}}
 * - {{#each products}}<div>{{this.name}} - {{this.price_formatted}}</div>{{/each}}
 * - Supports nested loops with proper context isolation
 * - {{@index}} for current loop index
 *
 * **Nested Structures**:
 * - {{#if product.on_sale}}{{#each product.images}}...{{/each}}{{/if}}
 * - Proper bracket counting for nested conditionals/loops
 *
 * **Translation Helpers**:
 * - {{t 'key'}} → Translated text based on current language
 * - {{t "add_to_cart"}} → "Add to Cart" (en) or "Toevoegen aan winkelwagen" (nl)
 * - Fallback chain: currentLang → en → key (formatted)
 * - Uses settings.ui_translations structure
 *
 * PROCESSING ORDER:
 *
 * 1. **Loops First** (processLoops):
 *    - Find {{#each array}}...{{/each}} blocks
 *    - Count brackets to handle nesting
 *    - For each item: build item context, process conditionals, process variables
 *    - Supports up to 10 levels of nesting
 *
 * 2. **Conditionals Second** (processConditionals):
 *    - Find {{#if condition}}...{{/if}} blocks
 *    - Count brackets to handle nesting
 *    - Evaluate condition, select true/false content
 *    - Supports comparison operators (>, <, ==, !=, >=, <=)
 *    - Supports helpers: (eq variable "value"), (gt variable number)
 *
 * 3. **Translations Third** (processTranslations):
 *    - Find {{t 'key'}} translation helpers
 *    - Get current language from localStorage
 *    - Lookup translation in settings.ui_translations
 *    - Fallback: currentLang → en → formatted key
 *
 * 4. **Simple Variables Last** (processSimpleVariables):
 *    - Find {{variable.path}} patterns
 *    - Use getNestedValue() to traverse object path
 *    - Format with formatValue() based on path/type
 *
 * VALUE FORMATTING:
 *
 * **Automatic Formatting**:
 * - Paths with 'price' → formatPrice() from priceUtils
 * - Paths with 'date' → new Date().toLocaleDateString()
 * - Paths with 'stock_status' → getStockLabel() from stockUtils
 * - Arrays → join(', ')
 *
 * **Price Formatting**:
 * - price_formatted: Always pre-formatted by CategorySlotRenderer/ProductSlotRenderer
 * - compare_price_formatted: Only shown if compare_price exists and > 0
 * - Falls back to formatPrice() if not pre-formatted
 *
 * **Stock Status Formatting**:
 * - Uses centralized stockUtils.getStockLabel()
 * - Respects admin settings (in_stock_label, out_of_stock_label)
 * - Returns text only (no HTML/styling)
 *
 * SPECIAL HANDLING:
 *
 * **Short Description Fallback**:
 * - {{product.short_description}} → Falls back to description if empty
 *
 * **Compare Price Conditional**:
 * - {{product.compare_price_formatted}} → Empty string if no compare_price
 * - This allows {{#if product.compare_price_formatted}} to work correctly
 *
 * **Filter Price Values**:
 * - filters.price.min / filters.price.max → NOT formatted (keep as numbers)
 *
 * **Loop Context**:
 * - {{this}} → Current item value
 * - {{this.property}} → Current item property
 * - {{@index}} → Current loop index
 * - Item properties are spread at root: {{name}} works inside {{#each products}}
 *
 * DEMO DATA GENERATION:
 *
 * generateDemoData() creates realistic sample data for editor preview:
 * - Product with images, prices, labels, tabs, related products
 * - Category with product list
 * - Cart with items and totals
 * - Product labels with positioning
 * - Settings with theme colors, currency, stock labels
 *
 * RELATED FILES:
 * - UnifiedSlotRenderer.jsx: Calls processVariables() for content/className/styles
 * - priceUtils.js: formatPrice() for consistent price formatting
 * - stockUtils.js: getStockLabel() for stock status display
 * - CategorySlotRenderer.jsx: Pre-formats product data before passing to variables
 * - ProductSlotRenderer.jsx: Pre-formats product data before passing to variables
 *
 * CRITICAL PATTERNS:
 *
 * 1. **Process order matters**: Loops first, then conditionals, then variables
 *    - This ensures conditionals inside loops get correct item context
 *
 * 2. **Pre-formatted data preferred**: Use price_formatted from context
 *    - Only format raw prices as fallback
 *
 * 3. **Bracket counting for nesting**: Proper handling of nested structures
 *    - Prevents incorrect closing tag matching
 *
 * 4. **Context merging**: pageData overrides context
 *    - Loop item context is passed via pageData
 *
 * @module variableProcessor
 */

import { formatPrice } from './priceUtils';
import { getStockLabel } from './stockUtils';

/**
 * processVariables - Main entry point for template variable processing
 *
 * Processes all variable types in correct order:
 * 1. Loops ({{#each}}) - creates item context for each iteration
 * 2. Conditionals ({{#if}}) - evaluates conditions, selects content
 * 3. Simple variables ({{variable}}) - replaces with values
 *
 * @param {string} content - Template content with {{variables}}
 * @param {Object} context - Main data context (product, settings, etc.)
 * @param {Object} pageData - Additional/override data (for loop item context)
 * @returns {string} Processed content with variables replaced
 *
 * @example
 * processVariables(
 *   "{{product.name}} - {{product.price_formatted}}",
 *   { product: { name: "Laptop", price_formatted: "$999" } }
 * ) // "Laptop - $999"
 *
 * @example
 * processVariables(
 *   "{{#if product.on_sale}}SALE{{/if}}",
 *   { product: { on_sale: true } }
 * ) // "SALE"
 *
 * @example
 * processVariables(
 *   "{{#each products}}<div>{{this.name}}</div>{{/each}}",
 *   { products: [{ name: "A" }, { name: "B" }] }
 * ) // "<div>A</div><div>B</div>"
 */
export function processVariables(content, context, pageData = {}) {
  if (typeof content !== 'string') {
    return content;
  }

  let processedContent = content;

  // IMPORTANT: Process loops FIRST, so conditionals inside loops get the correct item context
  // The loops will call processConditionals with itemContext for each item
  processedContent = processLoops(processedContent, context, pageData);

  // Then process any remaining conditionals (those outside loops)
  processedContent = processConditionals(processedContent, context, pageData);

  // Process translation helpers {{t 'key'}} before simple variables
  processedContent = processTranslations(processedContent, context, pageData);

  // Finally process simple variables
  processedContent = processSimpleVariables(processedContent, context, pageData);

  return processedContent;
}

/**
 * processTranslations - Process {{t 'key'}} translation helpers
 *
 * Replaces translation keys with translated text based on current language.
 * Falls back to English if translation not found for current language.
 * Falls back to the key itself if no translation exists at all.
 *
 * Translation data structure in settings.ui_translations:
 * {
 *   en: { add_to_cart: "Add to Cart", price: "Price" },
 *   nl: { add_to_cart: "Toevoegen aan winkelwagen", price: "Prijs" },
 *   fr: { add_to_cart: "Ajouter au panier", price: "Prix" }
 * }
 *
 * @param {string} content - Content with {{t 'key'}} helpers
 * @param {Object} context - Data context with settings
 * @param {Object} pageData - Additional data
 * @returns {string} Content with translations replaced
 *
 * @example
 * // With current language = 'nl'
 * processTranslations("{{t 'add_to_cart'}}", { settings: { ui_translations: { nl: { add_to_cart: "Toevoegen" } } } })
 * // "Toevoegen"
 *
 * @example
 * // Fallback to English when translation missing
 * processTranslations("{{t 'new_key'}}", { settings: { ui_translations: { en: { new_key: "New" } } } })
 * // "New"
 *
 * @example
 * // Fallback to key when no translation exists
 * processTranslations("{{t 'unknown_key'}}", { settings: { ui_translations: {} } })
 * // "unknown_key"
 */
function processTranslations(content, context, pageData) {
  // Match {{t 'key'}} or {{t "key"}}
  const translationRegex = /\{\{t\s+['"]([^'"]+)['"]\}\}/g;

  return content.replace(translationRegex, (match, key) => {
    const currentLang = typeof localStorage !== 'undefined'
      ? localStorage.getItem('daino_language') || 'en'
      : 'en';

    const uiTranslations = context?.settings?.ui_translations || pageData?.settings?.ui_translations || {};

    // Helper function to get nested value from dotted key
    const getNestedTranslation = (translations, dottedKey) => {
      if (!translations) return null;
      const keys = dottedKey.split('.');
      let current = translations;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return null;
        }
      }
      return current;
    };

    // Try current language first
    const currentLangValue = getNestedTranslation(uiTranslations[currentLang], key);
    if (currentLangValue) {
      return currentLangValue;
    }

    // Fallback to English
    const enValue = getNestedTranslation(uiTranslations.en, key);
    if (enValue) {
      return enValue;
    }

    // Fallback to key itself - format nicely
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  });
}

/**
 * processConditionals - Process {{#if}} conditional blocks
 *
 * Handles nested conditionals by running multiple passes from inside out.
 * Supports {{else}} for alternative content.
 *
 * @param {string} content - Content with {{#if}} blocks
 * @param {Object} context - Data context
 * @param {Object} pageData - Additional data
 * @returns {string} Content with conditionals evaluated
 *
 * @example
 * // Simple conditional
 * processConditionals("{{#if product.on_sale}}SALE{{/if}}", { product: { on_sale: true } })
 * // "SALE"
 *
 * @example
 * // With else
 * processConditionals("{{#if product.on_sale}}SALE{{else}}Regular{{/if}}", { product: { on_sale: false } })
 * // "Regular"
 *
 * @example
 * // Nested conditionals
 * processConditionals("{{#if a}}{{#if b}}Both{{/if}}{{/if}}", { a: true, b: true })
 * // "Both"
 */
function processConditionals(content, context, pageData) {
  let result = content;
  let hasMatches = true;

  // Process nested conditionals by running multiple passes
  while (hasMatches) {
    hasMatches = false;

    // Find and process {{#if}} conditionals from inside out (deepest first)
    result = processConditionalsStep(result, context, pageData);

    // Also process {{#unless}} conditionals (inverted logic)
    result = processUnlessStep(result, context, pageData);

    // Continue until no more conditionals found
    hasMatches = result.includes('{{#if') || result.includes('{{#unless');
  }

  return result;
}

/**
 * processConditionalsStep - Single pass of conditional processing
 *
 * Uses bracket counting to properly match {{#if}} with {{/if}} in nested structures.
 * Finds the next {{#if}}, counts brackets to find matching {{/if}}, evaluates condition.
 *
 * @param {string} content - Content to process
 * @param {Object} context - Data context
 * @param {Object} pageData - Additional data
 * @returns {string} Content with one level of conditionals processed
 * @private
 */
function processConditionalsStep(content, context, pageData) {
  let result = content;
  let startIndex = 0;

  while (true) {
    // Find the next {{#if
    const ifIndex = result.indexOf('{{#if', startIndex);
    if (ifIndex === -1) break;

    // Extract condition
    const conditionStart = ifIndex + 5; // after {{#if
    const conditionEnd = result.indexOf('}}', conditionStart);
    if (conditionEnd === -1) break;

    const condition = result.substring(conditionStart, conditionEnd).trim();

    // Find matching {{/if}} by counting brackets
    let bracketCount = 1;
    let searchIndex = conditionEnd + 2; // after }}
    let elseIndex = -1;
    let endIndex = -1;

    while (bracketCount > 0 && searchIndex < result.length) {
      // Find all potential tags from current position
      const nextIf = result.indexOf('{{#if', searchIndex);
      const nextElse = result.indexOf('{{else}}', searchIndex);
      const nextEndif = result.indexOf('{{/if}}', searchIndex);

      // Build candidates list with proper filtering
      const candidates = [];
      if (nextIf !== -1) candidates.push({ pos: nextIf, type: 'if', len: 5 });
      if (nextElse !== -1) candidates.push({ pos: nextElse, type: 'else', len: 8 });
      if (nextEndif !== -1) candidates.push({ pos: nextEndif, type: 'endif', len: 7 });

      // If no candidates found, break out of the loop
      if (candidates.length === 0) {
        break;
      }

      // Sort by position to process in order
      candidates.sort((a, b) => a.pos - b.pos);

      const nextTag = candidates[0];

      if (nextTag.type === 'if') {
        // Nested if - increase bracket count
        bracketCount++;
        searchIndex = nextTag.pos + nextTag.len;
      } else if (nextTag.type === 'else' && bracketCount === 1 && elseIndex === -1) {
        // This else belongs to our current if (not a nested one)
        elseIndex = nextTag.pos;
        searchIndex = nextTag.pos + nextTag.len;
      } else if (nextTag.type === 'endif') {
        // Closing if - decrease bracket count
        bracketCount--;
        if (bracketCount === 0) {
          // This is our matching closing tag
          endIndex = nextTag.pos;
          break;
        }
        searchIndex = nextTag.pos + nextTag.len;
      } else {
        // else for a nested if - skip it
        searchIndex = nextTag.pos + nextTag.len;
      }
    }

    if (endIndex === -1) {
      startIndex = ifIndex + 1;
      continue;
    }

    // Extract content parts
    let trueContent, falseContent = '';

    if (elseIndex !== -1) {
      trueContent = result.substring(conditionEnd + 2, elseIndex);
      falseContent = result.substring(elseIndex + 8, endIndex);
    } else {
      trueContent = result.substring(conditionEnd + 2, endIndex);
    }

    // Evaluate condition and select content
    const isTrue = evaluateCondition(condition, context, pageData);
    const selectedContent = isTrue ? trueContent : falseContent;

    // Replace the entire conditional block with the selected content
    result = result.substring(0, ifIndex) + selectedContent + result.substring(endIndex + 7);

    // Continue from the beginning to handle any newly exposed conditionals
    startIndex = 0;
  }

  return result;
}

/**
 * processUnlessStep - Single pass of {{#unless}} processing (inverted conditional)
 *
 * Similar to processConditionalsStep but with inverted logic:
 * - Shows content when condition is FALSE (or undefined/null)
 * - {{#unless condition}}show this{{/unless}} → shows "show this" when condition is falsy
 *
 * @param {string} content - Content to process
 * @param {Object} context - Data context
 * @param {Object} pageData - Additional data
 * @returns {string} Content with one level of unless blocks processed
 * @private
 */
function processUnlessStep(content, context, pageData) {
  let result = content;
  let startIndex = 0;

  while (true) {
    // Find the next {{#unless
    const unlessIndex = result.indexOf('{{#unless', startIndex);
    if (unlessIndex === -1) break;

    // Extract condition
    const conditionStart = unlessIndex + 9; // after {{#unless
    const conditionEnd = result.indexOf('}}', conditionStart);
    if (conditionEnd === -1) break;

    const condition = result.substring(conditionStart, conditionEnd).trim();

    // Find matching {{/unless}} by counting brackets
    let bracketCount = 1;
    let searchIndex = conditionEnd + 2; // after }}
    let elseIndex = -1;
    let endIndex = -1;

    while (bracketCount > 0 && searchIndex < result.length) {
      // Find all potential tags from current position
      const nextUnless = result.indexOf('{{#unless', searchIndex);
      const nextElse = result.indexOf('{{else}}', searchIndex);
      const nextEndunless = result.indexOf('{{/unless}}', searchIndex);

      // Build candidates list with proper filtering
      const candidates = [];
      if (nextUnless !== -1) candidates.push({ pos: nextUnless, type: 'unless', len: 9 });
      if (nextElse !== -1) candidates.push({ pos: nextElse, type: 'else', len: 8 });
      if (nextEndunless !== -1) candidates.push({ pos: nextEndunless, type: 'endunless', len: 11 });

      // If no candidates found, break out of the loop
      if (candidates.length === 0) {
        break;
      }

      // Sort by position to process in order
      candidates.sort((a, b) => a.pos - b.pos);

      const nextTag = candidates[0];

      if (nextTag.type === 'unless') {
        // Nested unless - increase bracket count
        bracketCount++;
        searchIndex = nextTag.pos + nextTag.len;
      } else if (nextTag.type === 'else' && bracketCount === 1 && elseIndex === -1) {
        // This else belongs to our current unless (not a nested one)
        elseIndex = nextTag.pos;
        searchIndex = nextTag.pos + nextTag.len;
      } else if (nextTag.type === 'endunless') {
        // Closing unless - decrease bracket count
        bracketCount--;
        if (bracketCount === 0) {
          // This is our matching closing tag
          endIndex = nextTag.pos;
          break;
        }
        searchIndex = nextTag.pos + nextTag.len;
      } else {
        // else for a nested unless - skip it
        searchIndex = nextTag.pos + nextTag.len;
      }
    }

    if (endIndex === -1) {
      startIndex = unlessIndex + 1;
      continue;
    }

    // Extract content parts
    let falseContent, trueContent = '';

    if (elseIndex !== -1) {
      falseContent = result.substring(conditionEnd + 2, elseIndex);
      trueContent = result.substring(elseIndex + 8, endIndex);
    } else {
      falseContent = result.substring(conditionEnd + 2, endIndex);
    }

    // Evaluate condition and select content (INVERTED from #if - show falseContent when condition is falsy)
    const isTrue = evaluateCondition(condition, context, pageData);
    const selectedContent = isTrue ? trueContent : falseContent;

    // Replace the entire unless block with the selected content
    result = result.substring(0, unlessIndex) + selectedContent + result.substring(endIndex + 11);

    // Continue from the beginning to handle any newly exposed conditionals
    startIndex = 0;
  }

  return result;
}

/**
 * processLoops - Process {{#each}} loop blocks
 *
 * Iterates over arrays and processes template for each item.
 * Uses bracket counting to handle nested loops properly.
 *
 * Special variables:
 * - {{this}} → Current item value
 * - {{this.property}} → Current item property
 * - {{@index}} → Current loop index
 *
 * @param {string} content - Content with {{#each}} blocks
 * @param {Object} context - Data context
 * @param {Object} pageData - Additional data
 * @param {number} depth - Recursion depth (max 10)
 * @returns {string} Content with loops expanded
 *
 * @example
 * // Simple loop
 * processLoops(
 *   "{{#each products}}<div>{{this.name}}</div>{{/each}}",
 *   { products: [{ name: "A" }, { name: "B" }] }
 * ) // "<div>A</div><div>B</div>"
 *
 * @example
 * // With index
 * processLoops(
 *   "{{#each items}}{{@index}}: {{this}}{{/each}}",
 *   { items: ["a", "b"] }
 * ) // "0: a1: b"
 */
function processLoops(content, context, pageData, depth = 0) {
  // Prevent infinite recursion - max 10 levels of nesting
  if (depth > 10) {
    console.warn('processLoops: Max recursion depth reached');
    return content;
  }

  let result = content;
  let startIndex = 0;

  while (true) {
    // Find the next {{#each
    const eachIndex = result.indexOf('{{#each', startIndex);
    if (eachIndex === -1) break;

    // Extract array path
    const pathStart = eachIndex + 7; // after {{#each
    const pathEnd = result.indexOf('}}', pathStart);
    if (pathEnd === -1) break;

    const arrayPath = result.substring(pathStart, pathEnd).trim();

    // Find matching {{/each}} by counting brackets
    let bracketCount = 1;
    let searchIndex = pathEnd + 2; // after }}
    let endIndex = -1;

    while (bracketCount > 0 && searchIndex < result.length) {
      const nextEach = result.indexOf('{{#each', searchIndex);
      const nextEndEach = result.indexOf('{{/each}}', searchIndex);

      // Build candidates list
      const candidates = [];
      if (nextEach !== -1) candidates.push({ pos: nextEach, type: 'each', len: 7 });
      if (nextEndEach !== -1) candidates.push({ pos: nextEndEach, type: 'endeach', len: 9 });

      if (candidates.length === 0) break;

      // Sort by position
      candidates.sort((a, b) => a.pos - b.pos);
      const nextTag = candidates[0];

      if (nextTag.type === 'each') {
        bracketCount++;
        searchIndex = nextTag.pos + nextTag.len;
      } else if (nextTag.type === 'endeach') {
        bracketCount--;
        if (bracketCount === 0) {
          endIndex = nextTag.pos;
          break;
        }
        searchIndex = nextTag.pos + nextTag.len;
      }
    }

    if (endIndex === -1) {
      startIndex = eachIndex + 1;
      continue;
    }

    // Extract template content between {{#each ...}} and {{/each}}
    const template = result.substring(pathEnd + 2, endIndex);
    const array = getNestedValue(arrayPath, context, pageData);

    let replacement = '';
    if (Array.isArray(array) && array.length > 0) {
      replacement = array.map((item, index) => {
        let itemContent = template;

        // Replace {{this}} with current item
        const itemValue = typeof item === 'string' ? item : String(item);
        itemContent = itemContent.replace(/\{\{this\}\}/g, itemValue);

        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, index);

        // Build item context - preserve parent context for nested loops
        // IMPORTANT: Spread item properties AFTER context to avoid overwriting parent data like settings
        const itemContext = typeof item === 'object' && item !== null
          ? { ...context, ...pageData, this: item, ...item }
          : { ...context, ...pageData, this: item };

        // Process conditionals with item context
        itemContent = processConditionals(itemContent, context, itemContext);

        // Process nested loops recursively
        itemContent = processLoops(itemContent, context, itemContext, depth + 1);

        // CRITICAL: Process translations BEFORE simple variables
        // Translation helpers like {{t "common.show_more"}} must be processed in loop items
        itemContent = processTranslations(itemContent, context, itemContext);

        // Process simple variables - pass full merged context
        // CRITICAL: Pass itemContext as BOTH context and pageData to ensure settings are accessible
        const finalContent = processSimpleVariables(itemContent, itemContext, {});

        return finalContent;
      }).join('');
    } else if (arrayPath === 'product.labels') {
      replacement = ''; // Don't show anything if no labels
    }

    // Replace the entire loop block with the processed content
    result = result.substring(0, eachIndex) + replacement + result.substring(endIndex + 9);

    // Continue from the beginning
    startIndex = 0;
  }

  return result;
}

/**
 * processSimpleVariables - Process {{variable.path}} replacements
 *
 * Finds {{variable}} patterns (excluding {{#if}}, {{#each}}, {{/if}}, {{/each}})
 * and replaces with values from context using getNestedValue().
 *
 * Special handling:
 * - {{product.short_description}} → Falls back to description if empty
 * - {{product.compare_price_formatted}} → Empty if no compare_price
 * - {{product.stock_status}} → Returns HTML template with data-bind
 *
 * @param {string} content - Content with {{variables}}
 * @param {Object} context - Data context
 * @param {Object} pageData - Additional data
 * @returns {string} Content with variables replaced
 * @private
 */
function processSimpleVariables(content, context, pageData) {
  // Match both {{variable}} and {{{variable}}} for escaped and unescaped HTML
  // First process triple braces (unescaped HTML), then double braces (escaped)
  const tripleBraceRegex = /\{\{\{([^#\/][^}]*)\}\}\}/g;
  const doubleBraceRegex = /\{\{([^#\/][^}]*)\}\}/g;

  // Process triple braces first (unescaped HTML) - don't escape the result
  let result = content.replace(tripleBraceRegex, (match, variablePath) => {
    const trimmedPath = variablePath.trim();
    const value = getNestedValue(trimmedPath, context, pageData);
    const formattedValue = formatValue(value, trimmedPath, context, pageData);
    // Return raw HTML without escaping
    return formattedValue;
  });

  // Then process double braces (escaped) - this will escape any HTML
  return result.replace(doubleBraceRegex, (match, variablePath) => {
    const trimmedPath = variablePath.trim();

    // Handle formatted price paths directly when they don't exist in data
    if (trimmedPath === 'product.compare_price_formatted' || trimmedPath === 'product.price_formatted') {
      const value = getNestedValue(trimmedPath, context, pageData);

      // Always call formatValue for formatted prices, even if null
      return formatValue(value, trimmedPath, context, pageData);
    }

    // Handle short_description fallback to description
    if (trimmedPath === 'product.short_description') {
      const product = context.product || pageData.product;
      if (product) {
        const shortDesc = product.short_description;
        if (shortDesc && shortDesc.trim()) {
          return formatValue(shortDesc, trimmedPath, context, pageData);
        } else {
          // Fallback to full description if short_description is null/empty
          const fullDesc = product.description;
          if (fullDesc && fullDesc.trim()) {
            return formatValue(fullDesc, trimmedPath, context, pageData);
          }
        }
      }
      return '';
    }

    // Handle stock_status to return proper HTML with JavaScript binding
    if (trimmedPath === 'product.stock_status') {
      // Return HTML template with data-bind for JavaScript controller to update
      return '<span class="stock-badge w-fit inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600" data-bind="stock-status">Loading...</span>';
    }

    const value = getNestedValue(trimmedPath, context, pageData);
    const result = formatValue(value, trimmedPath, context, pageData);

    return result;
  });
}

/**
 * evaluateCondition - Evaluate {{#if}} condition expressions
 *
 * Supports:
 * - Helper functions: (eq var "value"), (gt var number)
 * - Comparison operators: >, <, >=, <=, ==, !=
 * - Simple property existence: {{#if product.on_sale}}
 *
 * @param {string} condition - Condition expression
 * @param {Object} context - Data context
 * @param {Object} pageData - Additional data
 * @returns {boolean} Evaluation result
 *
 * @example
 * evaluateCondition("product.on_sale", { product: { on_sale: true } }) // true
 * evaluateCondition("(eq product.status \"active\")", { product: { status: "active" } }) // true
 * evaluateCondition("product.price > 100", { product: { price: 150 } }) // true
 * @private
 */
function evaluateCondition(condition, context, pageData) {
  try {

    // Handle eq helper function: (eq variable "value") - Clean double quote only approach
    const eqMatch = condition.match(/\(eq\s+([^"\s]+)\s+"([^"]+)"\)/);

    if (eqMatch) {
      const [, variablePath, expectedValue] = eqMatch;
      const actualValue = getNestedValue(variablePath, context, pageData);
      return actualValue === expectedValue;
    }

    // Handle gt helper function: (gt variable value)
    const gtMatch = condition.match(/\(gt\s+([^"\s]+)\s+(\d+)\)/);

    if (gtMatch) {
      const [, variablePath, compareValue] = gtMatch;
      const actualValue = getNestedValue(variablePath, context, pageData);
      return parseFloat(actualValue) > parseFloat(compareValue);
    }

    // Handle simple property checks
    if (condition.includes('>') || condition.includes('<') || condition.includes('==')) {
      // Parse comparison operators
      const operators = ['>=', '<=', '>', '<', '==', '!='];

      for (const op of operators) {
        if (condition.includes(op)) {
          const [left, right] = condition.split(op).map(s => s.trim());
          const leftValue = getNestedValue(left, context, pageData);
          const rightValue = isNaN(right) ? getNestedValue(right, context, pageData) : parseFloat(right);

          switch (op) {
            case '>': return leftValue > rightValue;
            case '<': return leftValue < rightValue;
            case '>=': return leftValue >= rightValue;
            case '<=': return leftValue <= rightValue;
            case '==': return leftValue == rightValue;
            case '!=': return leftValue != rightValue;
          }
        }
      }
    }

    // Simple property existence check
    const value = getNestedValue(condition, context, pageData);
    return !!value;
  } catch (error) {
    console.warn('Error evaluating condition:', condition, error);
    return false;
  }
}

/**
 * getNestedValue - Traverse object path to get value
 *
 * Handles dot notation (product.name, product.images.0) and special 'this' keyword.
 * Merges context and pageData (pageData overrides context for loop item context).
 *
 * @param {string} path - Dot-notated path (e.g., 'product.name', 'this.price')
 * @param {Object} context - Main data context
 * @param {Object} pageData - Additional data (loop item context)
 * @returns {*} Value at path or null
 *
 * @example
 * getNestedValue("product.name", { product: { name: "Laptop" } }) // "Laptop"
 * getNestedValue("this.price", {}, { this: { price: 99 } }) // 99
 * @private
 */
function getNestedValue(path, context, pageData) {
  // Merge data: pageData should override context (pageData has loop item context)
  const fullData = { ...context, ...pageData };

  // Helper function to traverse path with array bracket notation support
  const traverse = (obj, pathStr) => {
    // Handle array bracket notation like "images.[0].url" or "images[0].url"
    const parts = pathStr.split('.').flatMap(part => {
      // Check if part contains array index like "[0]" or ".[0]"
      const arrayMatch = part.match(/^(.*)?\[(\d+)\]$/);
      if (arrayMatch) {
        // Split "images[0]" into ["images", "0"]
        const [, prefix, index] = arrayMatch;
        return prefix ? [prefix, index] : [index];
      }
      return part;
    }).filter(Boolean);

    return parts.reduce((current, key) => {
      if (current === null || current === undefined) return null;

      // Handle numeric indices for arrays
      const numKey = Number(key);
      if (!isNaN(numKey) && Array.isArray(current)) {
        return current[numKey] !== undefined ? current[numKey] : null;
      }

      // Handle object properties
      return current[key] !== undefined ? current[key] : null;
    }, obj);
  };

  // Handle 'this' keyword - inside {{#each}} loops, 'this' refers to current item
  if (path.startsWith('this.')) {
    const propertyPath = path.substring(5); // Remove 'this.'

    // Try to find 'this' object in the data first (loop creates { this: item, ...item })
    if (fullData.this) {
      const result = traverse(fullData.this, propertyPath);
      if (result !== null) return result;
    }

    // Fallback: try direct property access (when item properties are spread at root)
    return traverse(fullData, propertyPath);
  }

  // For non-'this' paths, use standard lookup with array bracket support
  return traverse(fullData, path);
}

/**
 * formatValue - Format value based on type and path
 *
 * Applies automatic formatting:
 * - Paths with 'price' → formatPrice() (except filters.price)
 * - Paths with 'stock_status' → getStockLabel()
 * - Paths with 'date' → toLocaleDateString()
 * - Arrays → join(', ')
 *
 * Special handling:
 * - compare_price_formatted: Empty if no compare_price
 * - price_formatted: Uses pre-formatted value or formats raw price
 *
 * @param {*} value - Value to format
 * @param {string} path - Variable path (used to determine formatting)
 * @param {Object} context - Data context
 * @param {Object} pageData - Additional data
 * @returns {string} Formatted value
 * @private
 */
function formatValue(value, path, context, pageData) {
  if (value === null || value === undefined) {
    // Don't return empty for formatted prices - process them
    if (!path.includes('price_formatted')) {
      return '';
    }
  }

  // Special handling for compare_price_formatted
  if (path.trim() === 'product.compare_price_formatted') {
    const product = pageData.product || context.product;
    if (!product || !product.compare_price) {
      return ''; // Don't show compare price if it doesn't exist
    }

    // Check if we already have a formatted version
    if (product.compare_price_formatted && typeof product.compare_price_formatted === 'string' &&
        product.compare_price_formatted !== '[Text placeholder]' && product.compare_price_formatted !== '') {
      return product.compare_price_formatted;
    }

    // Otherwise format the raw compare_price with centralized utility
    const price = typeof product.compare_price === 'number' ? product.compare_price : parseFloat(product.compare_price);
    if (!isNaN(price) && price > 0) {
      return formatPrice(price);
    }

    return '';
  }

  // Handle price_formatted (original price, shown with strikethrough when compare_price exists)
  if (path.trim() === 'product.price_formatted') {
    const product = pageData.product || context.product;
    if (!product || !product.price) {
      return '';
    }

    // Check if we already have a formatted version
    if (product.price_formatted && typeof product.price_formatted === 'string' &&
        product.price_formatted !== '[Text placeholder]' && product.price_formatted !== '') {
      return product.price_formatted;
    }

    // Otherwise format the raw price with centralized utility
    const price = typeof product.price === 'number' ? product.price : parseFloat(product.price);
    if (!isNaN(price) && price > 0) {
      return formatPrice(price);
    }

    return '';
  }

  // Handle raw price numbers (but NOT filter min/max prices - keep those as clean numbers)
  if (path.includes('price') && typeof value === 'number' && !path.includes('filters.price')) {
    return formatPrice(value);
  }

  if (path.includes('stock_status')) {
    return formatStockStatus(pageData.product || context.product, context, pageData);
  }

  if (path.includes('labels') && Array.isArray(value)) {
    return value.join(', ');
  }

  if (path.includes('date')) {
    return new Date(value).toLocaleDateString();
  }

  // CRITICAL: Ensure we never return an object - React error #300
  // Objects (including arrays, React elements, etc.) are not valid as React children
  if (value && typeof value === 'object') {
    console.warn('[variableProcessor] Object detected:', { path, value, typeofValue: typeof value, keys: Object.keys(value) });
    // Try to get a string representation
    if (value.toString && value.toString !== Object.prototype.toString) {
      const str = value.toString();
      console.log('[variableProcessor] Using toString():', str);
      return str;
    }
    // Last resort - return empty string for objects
    return '';
  }

  const result = String(value);
  if (result === '[object Object]') {
    console.error('[variableProcessor] String(value) returned [object Object]:', { path, value });
    return '';
  }
  return result;
}

/**
 * formatStockStatus - Format stock status using centralized utility
 *
 * Uses stockUtils.getStockLabel() for consistency with other stock displays.
 * Respects admin settings (in_stock_label, out_of_stock_label, low_stock_label).
 * Supports global translations from translations table.
 *
 * @param {Object} product - Product object
 * @param {Object} context - Data context with settings and translations
 * @param {Object} pageData - Additional data
 * @returns {string} Stock status text (no HTML/styling)
 * @private
 */
function formatStockStatus(product, context, pageData) {
  if (!product) return '';

  const settings = context.settings || {};
  const translations = context.translations || null;

  // Use centralized stock label utility with translations
  const stockLabelInfo = getStockLabel(product, settings, null, translations);

  // Return just the text (no color styling in template variables)
  return stockLabelInfo?.text || '';
}

/**
 * generateDemoData - Generate realistic sample data for editor preview
 *
 * Creates complete demo context with product, category, cart, labels, and settings.
 * Used in editor mode to preview slot designs without real data.
 *
 * @param {string} pageType - Page type identifier (not currently used, reserved for future)
 * @param {Object} settings - Settings to override defaults
 * @returns {Object} Demo data object with:
 *   - product: Sample product with images, prices, labels, tabs, attributes
 *   - category: Sample category with product list
 *   - cart: Sample cart with items and totals
 *   - productLabels: Sample labels with positioning/colors
 *   - settings: Store settings (currency, theme, stock labels)
 *
 * @example
 * const demoData = generateDemoData('product', { currency_symbol: '€' });
 * // { product: {...}, settings: { currency_symbol: '€', ... } }
 */
export const generateDemoData = (pageType, settings = {}) => {
  const demoData = {
    product: {
      name: 'Sample Product Name',
      price: 1349.00,  // Original price (shown with strikethrough)
      price_formatted: '$1349.00',
      compare_price: 1049.00,  // Special/sale price (shown as main price)
      compare_price_formatted: '$1049.00',
      on_sale: true,
      stock_quantity: 15,
      stock_status: 'In Stock',
      sku: 'PROD-123',
      short_description: 'This is a sample product description showing how the content will appear.',
      labels: ['Sale', 'New Arrival', 'Popular'],
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=150&h=150&fit=crop',
        'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=150&h=150&fit=crop',
        'https://images.unsplash.com/photo-1545127398-14699f92334b?w=150&h=150&fit=crop'
      ],
      tabs: [
        { name: 'Description', tab_type: 'text', content: 'This is a detailed product description...' },
        { name: 'Specifications', tab_type: 'attributes', content: '' },
        { name: 'Reviews', tab_type: 'text', content: 'Customer reviews will appear here...' }
      ],
      related_products: [
        { name: 'Smart Watch', price: 199.99, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop' },
        { name: 'Camera Lens', price: 349.99, image: 'https://images.unsplash.com/photo-1606318801954-d46d46d3360a?w=300&h=300&fit=crop' },
        { name: 'Laptop', price: 1299.99, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=300&fit=crop' }
      ],
      attributes: {
        brand: 'Sample Brand',
        material: 'Premium Material',
        color: 'Blue',
        size: 'Medium'
      }
    },

    category: {
      name: 'Electronics',
      description: 'This is a sample category description.',
      product_count: 24,
      products: [
        { name: 'Wireless Headphones', price: 89.99, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', in_stock: true },
        { name: 'Smart Watch', price: 199.99, image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', in_stock: true },
        { name: 'Camera Lens', price: 349.99, image_url: 'https://images.unsplash.com/photo-1606318801954-d46d46d3360a?w=400&h=400&fit=crop', in_stock: true },
        { name: 'Laptop', price: 1299.99, image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop', in_stock: true },
        { name: 'Smartphone', price: 799.99, image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop', in_stock: true },
        { name: 'Sunglasses', price: 149.99, image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop', in_stock: true },
        { name: 'Sneakers', price: 119.99, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', in_stock: true },
        { name: 'Backpack', price: 79.99, image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', in_stock: true }
      ]
    },

    cart: {
      item_count: 3,
      subtotal: 249.97,
      tax: 20.00,
      shipping: 9.99,
      total: 279.96,
      items: [
        { name: 'Cart Item 1', price: 99.99, quantity: 1 },
        { name: 'Cart Item 2', price: 149.98, quantity: 2 }
      ]
    },

    // Product Labels with admin-configurable positioning
    productLabels: [
      {
        id: 1,
        text: 'SALE',
        position: 'top-right',
        background_color: '#ef4444',
        text_color: '#ffffff',
        is_active: true,
        priority: 1
      },
      {
        id: 2,
        text: 'NEW',
        position: 'top-left',
        background_color: '#22c55e',
        text_color: '#ffffff',
        is_active: true,
        priority: 2
      },
      {
        id: 3,
        text: 'POPULAR',
        position: 'bottom-right',
        background_color: '#3b82f6',
        text_color: '#ffffff',
        is_active: true,
        priority: 3
      }
    ],

    settings: {
      currency_symbol: '234',
      display_low_stock_threshold: 10,
      product_gallery_layout: 'horizontal',
      vertical_gallery_position: 'left',
      mobile_gallery_layout: 'below',
      stock_settings: {
        show_stock_label: true,
        in_stock_label: 'In Stock',
        out_of_stock_label: 'Out of Stock',
        low_stock_label: 'Only {quantity} left!'
      },
      theme: {
        add_to_cart_button_color: '#3B82F6',
        primary_color: '#3B82F6',
        secondary_color: '#10B981'
      },
      ...settings // Merge any passed-in settings to override defaults
    }
  };

  return demoData;
};

export default { processVariables, generateDemoData };