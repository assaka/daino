# Translation System Documentation

## Overview

The DainoStore application uses a dual translation system to support multi-language content across the entire application. This document explains how translations work and how to troubleshoot common issues.

## Architecture

### Two Translation Systems

The application uses **two different translation mechanisms** that work together:

#### 1. Component-Based Translations (`t()` helper)
- **Location**: `src/utils/translationHelper.js`
- **Syntax**: `t('translation_key', settings)`
- **Usage**: Direct function calls in React components
- **Example**:
  ```jsx
  import { t } from '@/utils/translationHelper';

  function MyComponent() {
    const { settings } = useStore();
    return <label>{t('email_address', settings)}</label>;
  }
  ```

#### 2. Template-Based Translations (`{{t "key"}}`)
- **Location**: `src/utils/variableProcessor.js` (processTranslations function)
- **Syntax**: `{{t "translation_key"}}` in slot configuration files
- **Usage**: String templates in slot configs (e.g., login-config.js, product-config.js)
- **Example**:
  ```javascript
  // In login-config.js
  page_header: {
    type: 'text',
    content: '{{t "welcome_back"}}',
    className: 'text-3xl font-bold'
  }
  ```

### Data Flow

```
Database (translations table)
    ↓
StoreProvider API call (/api/store/public/:storeCode)
    ↓
useStore() hook
    ↓
settings.ui_translations = { nl: {...}, en: {...} }
    ↓
Component receives settings prop
    ↓
[Component-based] → t(key, settings)
[Template-based] → UnifiedSlotRenderer → variableProcessor → processTranslations()
```

## Translation Data Structure

### Database Schema
```sql
CREATE TABLE translations (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(key, language_code)
);
```

### Store Settings Structure
```javascript
{
  settings: {
    ui_translations: {
      en: {
        "welcome_back": "Welcome Back",
        "email_address": "Email Address",
        "first_name": "First Name"
      },
      nl: {
        "welcome_back": "Welkom Terug",
        "email_address": "E-mailadres",
        "first_name": "Voornaam"
      }
    },
    default_language: "en"
  }
}
```

## Common Translation Issues and Solutions

### Issue 1: Template Translations Not Working (`{{t "key"}}` showing as raw text)

**Symptoms**:
- Slot configuration has `{{t "welcome_back"}}` but displays "Welcome Back" in all languages
- Component-based translations work fine
- Browser console shows `hasUITranslations: false`

**Root Cause**:
The component rendering slots is not passing `settings` to UnifiedSlotRenderer.

**How to Debug**:
1. Check the component that uses UnifiedSlotRenderer (e.g., CustomerAuth.jsx, CategoryPage.jsx)
2. Look for the prop being passed (productData, categoryData, loginData, etc.)
3. Verify that prop includes `settings` property

**Solution**:
```jsx
// ❌ WRONG - Missing settings
<UnifiedSlotRenderer
  slots={config.slots}
  loginData={{
    loading,
    error,
    handleAuth
    // settings is MISSING!
  }}
/>

// ✅ CORRECT - Includes settings
const { settings } = useStore(); // Extract from store context

<UnifiedSlotRenderer
  slots={config.slots}
  loginData={{
    loading,
    error,
    handleAuth,
    settings,  // ✅ Add this
    store      // ✅ Also useful to include
  }}
/>
```

**Files to Check**:
- `src/pages/storefront/CustomerAuth.jsx` (login page)
- `src/pages/storefront/CategoryPage.jsx` (category pages)
- `src/pages/storefront/ProductPage.jsx` (product pages)
- Any other page using UnifiedSlotRenderer

### Issue 2: Component Translations Not Working (`t()` showing raw keys)

**Symptoms**:
- Form labels show raw keys like "email_address" instead of "Email Address"
- Template translations (`{{t "key"}}`) work fine

**Root Cause**:
The component is not receiving `settings` prop or not passing it to `t()` helper.

**Solution**:
```jsx
// ❌ WRONG - Not extracting settings
function LoginForm() {
  return <label>{t('email_address')}</label>; // Missing settings param!
}

// ✅ CORRECT - Extract and pass settings
function LoginForm() {
  const { settings } = useStore();
  return <label>{t('email_address', settings)}</label>;
}

// ✅ ALSO CORRECT - Receive as prop
function LoginForm({ loginData }) {
  return <label>{t('email_address', loginData.settings)}</label>;
}
```

### Issue 3: Translations Not Loading At All

**Symptoms**:
- All translations show fallback text (formatted keys)
- `settings.ui_translations` is undefined or empty object

**Root Cause**:
Translations not synced from database to store settings.

**Solution**:
1. Check translations exist in database:
   ```sql
   SELECT * FROM translations WHERE language_code IN ('en', 'nl') LIMIT 10;
   ```

2. Run sync script to copy translations to store settings:
   ```bash
   NODE_ENV=production DATABASE_URL="..." node backend/sync-translations-to-store.js
   ```

3. Verify store settings updated:
   ```sql
   SELECT settings->'ui_translations' FROM stores WHERE id = 1;
   ```

4. Clear frontend cache and hard refresh (Ctrl+Shift+R)

### Issue 4: New Translation Keys Not Appearing

**Symptoms**:
- Added new keys to database but they don't show in frontend
- Existing translations work fine

**Solution**:
1. Add translations to database using script:
   ```bash
   NODE_ENV=production DATABASE_URL="..." node backend/add-login-translations.js
   ```

2. Sync to store settings:
   ```bash
   NODE_ENV=production DATABASE_URL="..." node backend/sync-translations-to-store.js
   ```

3. Hard refresh frontend (Ctrl+Shift+R)

## Adding Translations to New Pages

### Step-by-Step Checklist

When adding translation support to a new page:

1. **Create translation keys** in `backend/add-[page]-translations.js`:
   ```javascript
   const pageTranslations = {
     'page_title': { en: 'Page Title', nl: 'Paginatitel' },
     'submit_button': { en: 'Submit', nl: 'Verzenden' }
   };
   ```

2. **Run the script** to add to database:
   ```bash
   NODE_ENV=production DATABASE_URL="..." node backend/add-[page]-translations.js
   ```

3. **Sync to store settings**:
   ```bash
   NODE_ENV=production DATABASE_URL="..." node backend/sync-translations-to-store.js
   ```

4. **In slot config** (e.g., `page-config.js`), use template syntax:
   ```javascript
   title: {
     type: 'text',
     content: '{{t "page_title"}}',
     className: 'text-2xl font-bold'
   }
   ```

5. **In React components**, use helper function:
   ```jsx
   const { settings } = useStore();
   return <button>{t('submit_button', settings)}</button>;
   ```

6. **In page component**, ensure settings passed to UnifiedSlotRenderer:
   ```jsx
   const { settings, store } = useStore();

   <UnifiedSlotRenderer
     slots={config.slots}
     [pageName]Data={{
       ...otherData,
       settings,  // ✅ CRITICAL - Must include settings
       store
     }}
   />
   ```

## Debugging Translation Issues

### Console Debugging

Add these logs to track translation flow:

```javascript
// In the page component (e.g., CustomerAuth.jsx)
const { settings } = useStore();
console.log('🔍 Page Component - settings:', {
  hasSettings: !!settings,
  hasUiTranslations: !!settings?.ui_translations,
  languages: Object.keys(settings?.ui_translations || {}),
  sampleKeys: Object.keys(settings?.ui_translations?.en || {}).slice(0, 5)
});

// In UnifiedSlotRenderer.jsx (line ~529)
console.log('🔍 UnifiedSlotRenderer - variableContext.settings:', {
  hasSettings: !!variableContext.settings,
  hasUiTranslations: !!variableContext.settings?.ui_translations,
  source: loginData?.settings ? 'loginData' :
          productData?.settings ? 'productData' :
          categoryData?.settings ? 'categoryData' : 'none'
});

// In variableProcessor.js processTranslations() (line ~265)
console.log('🔧 processTranslations:', {
  key,
  currentLang,
  hasUITranslations: !!uiTranslations,
  hasCurrentLang: !!(uiTranslations[currentLang]),
  hasKey: !!(uiTranslations[currentLang]?.[key]),
  result: uiTranslations[currentLang]?.[key] || 'FALLBACK'
});
```

### What to Look For

✅ **Good Signs**:
```javascript
{
  hasSettings: true,
  hasUiTranslations: true,
  languages: ['en', 'nl'],
  hasKey: true,
  result: "Welkom Terug"
}
```

❌ **Problem Signs**:
```javascript
{
  hasSettings: false,        // Settings not passed!
  hasUiTranslations: false,  // ui_translations missing!
  languages: [],             // No translations loaded!
  hasKey: false,             // Translation key not found!
  result: "FALLBACK"         // Using fallback instead of translation
}
```

## File Reference Guide

### Core Translation Files

| File | Purpose |
|------|---------|
| `src/utils/translationHelper.js` | Component-based translation helper `t()` |
| `src/utils/variableProcessor.js` | Template-based translation processor `{{t "key"}}` |
| `src/contexts/TranslationContext.jsx` | React context for translations |
| `src/components/storefront/StoreProvider.jsx` | Loads store settings with translations |

### Slot Configuration Files

| File | Page | Template Translations? |
|------|------|------------------------|
| `src/components/editor/slot/configs/login-config.js` | Login/Register | ✅ Yes |
| `src/components/editor/slot/configs/product-config.js` | Product Details | ✅ Yes |
| `src/components/editor/slot/configs/category-config.js` | Category Listing | ✅ Yes |
| `src/components/editor/slot/configs/cart-config.js` | Shopping Cart | ✅ Yes |

### Page Components (Must Pass Settings!)

| File | UnifiedSlotRenderer Prop Name | Settings Passed? |
|------|-------------------------------|------------------|
| `src/pages/storefront/CustomerAuth.jsx` | `loginData` | ✅ Yes (fixed) |
| `src/pages/storefront/ProductPage.jsx` | `productData` | ⚠️ Check this |
| `src/pages/storefront/CategoryPage.jsx` | `categoryData` | ⚠️ Check this |
| `src/pages/storefront/CartPage.jsx` | `cartData` | ⚠️ Check this |

### Backend Scripts

| File | Purpose |
|------|---------|
| `backend/add-login-translations.js` | Add login page translation keys |
| `backend/sync-translations-to-store.js` | Sync DB translations to store settings |
| `backend/populate-file-baselines.js` | Initialize baseline data |

## Case Study: Login Page Translation Fix

### Problem
Login page had mixed translation behavior:
- ✅ Form fields (Email, Password, First Name) - **Working**
- ❌ Page headers (Welcome Back, Create Account) - **Not working**

### Root Cause Analysis

1. **Form fields** used component-based translations:
   ```jsx
   <label>{t('email_address', loginData.settings)}</label>
   ```
   These worked because LoginFormSlot received `loginData.settings`.

2. **Page headers** used template-based translations:
   ```javascript
   content: '{{t "welcome_back"}}'
   ```
   These failed because CustomerAuth.jsx was passing `authData` (wrong prop name) without `settings`.

3. **UnifiedSlotRenderer** builds `variableContext`:
   ```javascript
   settings: loginData?.settings || {} // Looking for loginData.settings
   ```
   Without `loginData.settings`, template processor had no translations.

### The Fix

**Before** (`CustomerAuth.jsx` - Lines 265-275):
```jsx
<UnifiedSlotRenderer
  slots={loginLayoutConfig.slots}
  authData={{        // ❌ Wrong prop name!
    loading: authLoading,
    error,
    success,
    handleAuth
    // ❌ settings missing!
  }}
/>
```

**After** (`CustomerAuth.jsx` - Lines 125, 265-275):
```jsx
// Line 125: Extract settings from store
const { settings } = useStore();

// Lines 265-275: Pass to UnifiedSlotRenderer
<UnifiedSlotRenderer
  slots={loginLayoutConfig.slots}
  loginData={{        // ✅ Correct prop name
    loading: authLoading,
    error,
    success,
    handleAuth,
    navigate,
    storeCode,
    createPublicUrl,
    settings,         // ✅ Added settings
    store             // ✅ Added store
  }}
/>
```

### Verification Steps

1. Check console for translation lookup:
   ```javascript
   hasUITranslations: true  // ✅ Now has translations
   ```

2. Verify page renders translated content:
   - English: "Welcome Back"
   - Dutch: "Welkom Terug"

3. Test language switching works correctly

### Commits
- Fix: `b7611bb1` - Add settings to loginData in CustomerAuth.jsx
- Cleanup: `067cf557` - Remove unused Login.jsx file

## Quick Reference: Translation Checklist

When debugging translation issues, check these in order:

- [ ] Translations exist in database (`SELECT * FROM translations`)
- [ ] Translations synced to store settings (`sync-translations-to-store.js`)
- [ ] Page component extracts settings from useStore()
- [ ] Page component passes settings to UnifiedSlotRenderer via `[page]Data` prop
- [ ] UnifiedSlotRenderer uses correct prop name (loginData, productData, etc.)
- [ ] Slot config uses correct syntax: `{{t "key"}}` for templates, `t('key', settings)` for components
- [ ] Translation keys match between database and config files
- [ ] Browser cache cleared (Ctrl+Shift+R)

## Language Switching

Language is stored in localStorage:
```javascript
localStorage.setItem('daino_language', 'nl'); // or 'en'
```

Both translation systems check this:
```javascript
const currentLang = localStorage.getItem('daino_language') || 'en';
```

Fallback chain:
1. Try current language (`nl`)
2. Try English (`en`)
3. Use formatted key (`welcome_back` → "Welcome Back")

## Best Practices

1. **Always pass settings** to UnifiedSlotRenderer via the appropriate data prop
2. **Use consistent prop names**: `loginData`, `productData`, `categoryData`, `cartData`
3. **Test both translation systems**: Component-based AND template-based
4. **Add translations before using them**: Run add-translations script first
5. **Sync after adding**: Always run sync-translations-to-store.js
6. **Use meaningful keys**: `welcome_back` not `text1`
7. **Group by category**: Use category field in translations table
8. **Document new keys**: Update translation scripts with comments

## Future Improvements

- [ ] Consolidate translation systems into one unified approach
- [ ] Add automatic syncing (webhook after translation updates)
- [ ] Create admin UI for managing translations
- [ ] Add translation coverage reports
- [ ] Implement lazy loading for translations
- [ ] Add TypeScript types for translation keys
- [ ] Create translation key linting rules
