# Translation System Workflow

This guide explains how to use the DainoStore translation system to make your application multilingual.

## Overview

The DainoStore translation system consists of:

1. **Database**: PostgreSQL `translations` table storing UI labels in multiple languages
2. **Frontend Context**: React context (`TranslationContext`) providing translation functions
3. **Admin UI**: Web interface at `/admin/translations` for managing translations
4. **AI Translation**: Automated translation powered by OpenAI
5. **Text Extraction**: Tools to find and extract translatable strings from codebase

## Quick Start

### 1. Seed Default English Labels

Run the seeding script to populate the database with 114 common English UI labels:

```bash
cd backend
NODE_ENV=production DATABASE_URL="your_database_url" node seed-translations-simple.js
```

This will insert translations for:
- **common** (27 labels): add, edit, delete, save, cancel, submit, home, view_all, search_country, no_country_found, etc.
- **navigation** (13 labels): home, dashboard, products, orders, etc.
- **product** (15 labels): price, stock, add_to_cart, buy_now, etc.
- **checkout** (16 labels): cart, payment, shipping, total, etc.
- **account** (18 labels): email, password, login, register, etc.
- **admin** (12 labels): manage, export, import, translations, etc.
- **messages** (13 labels): success, error, warning, saved, deleted, etc.

**New UI Component Translations Added:**
- `common.home` - "Home" (used in CategoryNav navigation)
- `common.view_all` - "View All" (used in category dropdowns)
- `common.search_country` - "Search country..." (used in CountrySelect component)
- `common.no_country_found` - "No country found." (used in CountrySelect component)

### 2. Add Translations to Components

Import the translation hook and replace hardcoded strings:

```jsx
import { useTranslation } from '@/contexts/TranslationContext';

export default function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.welcome', 'Welcome')}</h1>
      <button>{t('common.save', 'Save')}</button>
      <p>{t('product.add_to_cart', 'Add to Cart')}</p>
    </div>
  );
}
```

**Translation key format**: `category.descriptive_key`

The second parameter is the fallback value if the translation is not found.

### 3. Manage Translations via Admin UI

1. Navigate to `/admin/translations`
2. View all translations organized by language and category
3. Add, edit, or delete individual translations
4. Use filters to find specific translations

### 4. Translate to Multiple Languages

#### Option A: AI Translate All (Recommended)

1. Go to `/admin/translations`
2. Select a target language (e.g., Spanish, French, Arabic)
3. Click **"AI Translate All"** button
4. The system will automatically translate all English labels to the selected language using OpenAI

#### Option B: Manual Translation

1. Go to `/admin/translations`
2. Click **"Add Translation"**
3. Enter:
   - Key: `common.save`
   - Language: `es` (Spanish)
   - Value: `Guardar`
   - Category: `common`
4. Click **Save**

## Text Extraction Tool

Use the extraction script to find translatable strings in your codebase:

```bash
node scripts/extract-translations.js
```

This will:
1. Scan `src/pages` and `src/components` directories
2. Extract translatable text using regex patterns
3. Generate three output files in `scripts/output/`:
   - `extracted-translations.json` - Structured data with all found strings
   - `seed-translations.sql` - SQL migration to insert translations
   - `extraction-report.txt` - Summary report with statistics

### What it extracts:

- Button text and labels
- Placeholder text
- Error/success messages
- JSX text content
- Common UI patterns

### What it ignores:

- Code patterns (function, import, export, etc.)
- Technical terms (API, HTTP, URL, ID, etc.)
- Variables and template literals
- Very short strings (< 2 characters)
- Very long strings (> 200 characters)

## Translation Keys

### Naming Convention

Keys follow the pattern: `category.descriptive_name`

**Examples:**
- `common.add` → "Add"
- `navigation.home` → "Home"
- `product.add_to_cart` → "Add to Cart"
- `checkout.place_order` → "Place Order"
- `account.sign_in` → "Sign In"
- `message.saved` → "Saved successfully"

### Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `common` | General actions & messages | add, edit, delete, save, cancel, loading |
| `navigation` | Menu items & links | home, dashboard, products, orders, settings |
| `product` | Product-related labels | price, stock, sku, add_to_cart, reviews |
| `checkout` | Checkout flow | cart, payment, shipping, total, place_order |
| `account` | User account | email, password, login, register, profile |
| `admin` | Admin panel | manage, create, update, export, import |

## Translation Context API

### Available Functions

```jsx
const {
  // State
  currentLanguage,        // Current language code (e.g., 'en', 'es', 'ar')
  availableLanguages,     // Array of active languages from database
  loading,                // Boolean indicating if translations are loading
  isRTL,                  // Boolean indicating if current language is RTL

  // Functions
  t,                      // Main translation function
  changeLanguage,         // Change the current language
  getEntityTranslation,   // Get translation for entities (products, categories)
  formatNumber,           // Format numbers according to locale
  formatCurrency,         // Format currency according to locale
  formatDate,             // Format dates according to locale
} = useTranslation();
```

### Examples

#### Basic Translation

```jsx
const title = t('product.name', 'Product Name');
```

#### Nested Keys (Dot Notation)

```jsx
const label = t('checkout.order.summary', 'Order Summary');
```

#### Change Language

```jsx
<button onClick={() => changeLanguage('es')}>
  Español
</button>
```

#### Format Currency

```jsx
const price = formatCurrency(99.99, 'USD');
// Output (en): "$99.99"
// Output (es): "99,99 US$"
```

#### Format Date

```jsx
const date = formatDate(new Date(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
// Output (en): "January 16, 2025"
// Output (es): "16 de enero de 2025"
```

#### Entity Translation (for Products/Categories)

```jsx
const productName = getEntityTranslation(product, 'name', 'en');
```

## Language Support

### Supported Languages

The system supports any language with an entry in the `languages` table:

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Arabic (ar) - RTL supported
- Hebrew (he) - RTL supported
- And more...

### Add a New Language

1. Go to `/admin/languages` (Languages management page)
2. Click **"Add Language"**
3. Enter language details:
   - Code: ISO 639-1 code (e.g., `ja` for Japanese)
   - Name: English name (e.g., `Japanese`)
   - Native Name: Native language name (e.g., `日本語`)
   - RTL: Check if right-to-left language
4. Click **Save**
5. Use **"AI Translate All"** to translate all UI labels

### RTL (Right-to-Left) Support

The system automatically handles RTL languages like Arabic and Hebrew:

```jsx
// The context automatically sets `isRTL` based on current language
const { isRTL } = useTranslation();

// HTML attributes are automatically updated:
// <html dir="rtl" lang="ar">
```

## Best Practices

### 1. Always Provide Fallback Values

```jsx
// ✅ Good
{t('common.save', 'Save')}

// ❌ Bad
{t('common.save')}
```

### 2. Use Descriptive Keys

```jsx
// ✅ Good
{t('checkout.proceed_to_checkout', 'Proceed to Checkout')}

// ❌ Bad
{t('btn1', 'Proceed to Checkout')}
```

### 3. Group by Category

```jsx
// ✅ Good - All common actions in 'common' category
t('common.add')
t('common.edit')
t('common.delete')

// ❌ Bad - Inconsistent categorization
t('actions.add')
t('common.edit')
t('buttons.delete')
```

### 4. Keep Keys Short but Meaningful

```jsx
// ✅ Good
t('product.out_of_stock', 'Out of Stock')

// ❌ Bad - Too verbose
t('product.this_product_is_currently_out_of_stock', 'Out of Stock')
```

### 5. Don't Translate Dynamic Content

```jsx
// ✅ Good
{t('product.price', 'Price')}: ${product.price}

// ❌ Bad - Don't translate user-generated content
{t(product.name)}
```

## Migration Scripts

### Running Migrations

The included migration can be run through Sequelize or directly:

```bash
# Using Sequelize CLI (if configured)
npx sequelize-cli db:migrate

# Using custom script
node backend/seed-translations-simple.js
```

### Migration Structure

```javascript
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Insert translations
    await queryInterface.bulkInsert('translations', translations, {
      updateOnDuplicate: ['value', 'category', 'updated_at']
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove translations
    await queryInterface.bulkDelete('translations', {
      language_code: 'en'
    }, {});
  }
};
```

## API Endpoints

### Get UI Labels

```http
GET /api/translations/ui-labels?lang=en
```

Response:
```json
{
  "success": true,
  "data": {
    "labels": {
      "common": {
        "add": "Add",
        "edit": "Edit",
        "delete": "Delete"
      },
      "navigation": {
        "home": "Home",
        "dashboard": "Dashboard"
      }
    }
  }
}
```

### Get All Translations

```http
GET /api/admin/translations
```

### Create Translation

```http
POST /api/admin/translations
Content-Type: application/json

{
  "key": "common.save",
  "language_code": "es",
  "value": "Guardar",
  "category": "common"
}
```

### AI Translate All

```http
POST /api/admin/translations/translate-all
Content-Type: application/json

{
  "targetLanguage": "es",
  "sourceLanguage": "en"
}
```

## Troubleshooting

### Translation Not Showing

1. **Check if translation exists in database:**
   ```sql
   SELECT * FROM translations WHERE key = 'common.save' AND language_code = 'en';
   ```

2. **Verify TranslationProvider wraps your app:**
   ```jsx
   // In App.jsx or main entry point
   <TranslationProvider>
     <YourApp />
   </TranslationProvider>
   ```

3. **Check browser console for errors**

4. **Verify API response structure:**
   - Open Developer Tools (F12) → Network tab
   - Look for request to `/api/translations/ui-labels?lang=nl`
   - Response should have structure: `{ success: true, data: { language: 'nl', labels: {...} } }`
   - Labels should be nested: `{ common: { home: "Home", view_all: "View All" } }`

5. **Common issues:**
   - **Backend not restarted:** Translation service changes require backend restart
   - **Wrong response path:** API client has special handling for translation endpoints - ensure you access `response.data.labels` not `response.data.data.labels`
   - **Flat keys instead of nested:** Database keys must follow dot notation (e.g., `common.home`) and API must convert to nested structure

### Language Not Changing

1. Verify language is active in database:
   ```sql
   SELECT * FROM languages WHERE code = 'es' AND is_active = true;
   ```

2. Check localStorage:
   ```javascript
   localStorage.getItem('daino_language')
   ```

3. Clear cache and reload

### RTL Not Working

1. Verify language has `is_rtl = true` in database
2. Check HTML attributes: `<html dir="rtl" lang="ar">`
3. Ensure CSS supports RTL (use logical properties: `margin-inline-start` instead of `margin-left`)

### Missing Translations for New Languages

If you add a new language but translations are not showing:

1. **Check if translations exist for the new language:**
   ```sql
   SELECT COUNT(*) FROM translations WHERE language_code = 'nl';
   ```

2. **Verify all required keys are translated:**
   ```sql
   -- Check which keys are missing for a specific language
   SELECT key FROM translations WHERE language_code = 'en'
   AND key NOT IN (
     SELECT key FROM translations WHERE language_code = 'nl'
   );
   ```

3. **Add missing translations manually:**
   ```sql
   INSERT INTO translations (id, key, language_code, value, category, created_at, updated_at)
   VALUES
     (gen_random_uuid(), 'common.home', 'nl', 'Home', 'common', NOW(), NOW()),
     (gen_random_uuid(), 'common.view_all', 'nl', 'Bekijk alles', 'common', NOW(), NOW());
   ```

4. **Or use AI Translate All** to automatically translate all missing keys:
   - Go to `/admin/translations`
   - Select the target language
   - Click "AI Translate All"

**Example: Adding Dutch (nl) translations for UI components**
```javascript
const dutchTranslations = [
  { key: 'common.home', value: 'Home', category: 'common' },
  { key: 'common.view_all', value: 'Bekijk alles', category: 'common' },
  { key: 'common.search_country', value: 'Zoek land...', category: 'common' },
  { key: 'common.no_country_found', value: 'Geen land gevonden.', category: 'common' }
];
```

## Implementation Notes

### API Response Structure

The API client (`src/api/client.js`) has **special handling for translation endpoints** (lines 381-395) that returns the full backend response without transformation:

```javascript
// Backend response structure
{
  "success": true,
  "data": {
    "language": "nl",
    "labels": {
      "common": {
        "home": "Home",
        "view_all": "Bekijk alles",
        "search_country": "Zoek land..."
      },
      "navigation": { ... },
      "product": { ... }
    }
  }
}
```

When consuming this in your components, access translations as:
```javascript
const response = await api.get(`/translations/ui-labels?lang=${lang}`);
const labels = response.data.labels; // NOT response.data.data.labels
```

### Database Key Format

All translation keys **must** follow dot notation:
- ✅ `common.home`, `common.view_all`, `checkout.payment`
- ❌ `home`, `view_all`, `payment`

The translation service converts these flat keys to nested objects for the API response.

### Migration from Flat Keys

If you have existing flat keys in the database, run the migration script:
```bash
cd backend
NODE_ENV=production DATABASE_URL="your_db_url" node fix-translation-keys.js
```

This will rename all single-level keys to follow the dot notation pattern.

## Future Enhancements

- [ ] Add translation memory to reuse common translations
- [ ] Support for pluralization rules
- [ ] Context-aware translations (formal vs informal)
- [ ] Translation validation and quality checks
- [ ] Export/import translations as CSV/JSON
- [ ] Translation versioning and history
- [ ] Automatic detection of missing translations
- [ ] Translation coverage reports

## Resources

- [React Internationalization (i18n) Best Practices](https://react.i18next.com/)
- [ISO 639-1 Language Codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
- [MDN: Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [W3C: RTL Best Practices](https://www.w3.org/International/questions/qa-html-dir)
