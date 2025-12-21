# Clear Cookie Consent Cache

⚠️ **IMPORTANT**: The cookie consent settings are cached for 1 hour for performance.

**If translations are not showing in the storefront**, you MUST clear the cache!

This cache stores:
- All translations (banner text, button text, category translations)
- Button colors
- Cookie categories
- All cookie consent settings

## Method 1: Browser Console (Recommended)

Open browser console (F12) and run:

```javascript
// Clear the cookie consent cache
localStorage.removeItem('storeProviderCache');
localStorage.removeItem('cookie_consent');
localStorage.removeItem('cookie_consent_expiry');

// Reload the page
location.reload();
```

## Method 2: Hard Refresh

1. Close the cookie banner if it's open
2. Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. Or `Ctrl+F5` on Windows

## Method 3: Clear All Site Data

1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear site data" button
4. Reload page

## Verify Translations Are Loading

After clearing cache, open console and look for:

```
🍪 Cookie consent language: {
  currentLang: "nl",
  hasTranslations: true,
  availableLanguages: ["en", "nl"],
  translationsData: { ... }
}

🍪 Sample translation test: {
  necessary_name_en: "Necessary Cookies",
  necessary_name_nl: "Noodzakelijk",
  banner_text_nl: "hamid-test-nl"
}
```

If you see the translations object and the Dutch translations, it's working!

## Test Cookie Consent Translations

1. **Switch language to Dutch** (nl)
2. **Open cookie preferences** (click "Cookie Settings" button)
3. **Check translations:**
   - Banner text should show: "hamid-test-nl"
   - Accept button: "accepteer"
   - Reject button: "weigeren"
   - Settings button: "cookie"
   - Necessary category: "Noodzakelijk"
   - Other categories fall back to English

## Adding More Translations

Go to: **Admin → Cookie Consent → Edit**

In the translations section, add Dutch translations for:
- `analytics_name`: e.g., "Analytics Cookies"
- `analytics_description`: e.g., "Deze cookies helpen ons..."
- `marketing_name`: e.g., "Marketing Cookies"
- `marketing_description`: e.g., "Deze cookies worden gebruikt..."
- `save_preferences_button_text`: e.g., "Voorkeuren opslaan"
