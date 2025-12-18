# Color Attribute Not Showing in Layered Navigation - Troubleshooting Guide

## Problem
The Color attribute is marked as filterable but doesn't appear in the layered navigation.

## Debugging Steps Added

1. **AttributeDebug Component** - Added to `/src/components/debug/AttributeDebug.jsx`
2. **Enhanced Logging** - Added detailed console logs to trace the issue
3. **Improved Key Matching** - Expanded possible attribute key variations

## Common Causes & Solutions

### 1. Attribute Not Marked as Filterable in Database
**Check:** Look at the AttributeDebug component output - does it show "Filterable: ✅ Yes"?
**Fix:** In admin panel, edit the Color attribute and ensure "Use in Layered Navigation" is checked.

### 2. No Products Have Color Values Assigned
**Check:** AttributeDebug shows if sample products have color values
**Fix:** Assign color values to products in admin panel

### 3. Color Values Stored with Different Key Names
**Check:** Console logs show what keys are being checked
**Common variations handled:**
- `color`, `Color`, `COLOR`
- `colour`, `Colour`, `COLOUR` 
- Keys with/without spaces, hyphens, underscores

### 4. Attribute Has No Options Defined
**Check:** AttributeDebug shows option count
**Fix:** Define color options in the attribute (Red, Blue, Green, etc.)

### 5. Products Store Attributes in Unexpected Format
**Check:** Sample product attributes structure in debug output
**Common formats:**
- `product.attributes.color`
- `product.attribute_values.color`
- `product.color` (direct property)

## How to Use the Debug Component

1. Navigate to any category page in the storefront
2. Look for the blue "🔍 Attribute Debug Tool" card at the top
3. Check each section for issues:
   - Color Attribute Status
   - All Filterable Attributes  
   - Sample Product Attributes

## Next Steps

Based on the debug output:

1. **If Color attribute not found:** Create it in admin with `is_filterable = true`
2. **If found but not filterable:** Edit it to enable layered navigation
3. **If no options:** Add color options (Red, Blue, Green, etc.)
4. **If no product values:** Assign colors to products
5. **If different key format:** Update products or modify LayeredNavigation key matching

## Cleanup

Once the issue is resolved:
1. Remove `<AttributeDebug>` from Storefront.jsx
2. Remove the debug component file
3. Remove excessive console logs from LayeredNavigation.jsx