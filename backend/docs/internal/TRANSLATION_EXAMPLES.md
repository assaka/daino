# Real Translation Examples - Practical Guide

This guide shows you **real working examples** for translating specific UI elements, text, and content in your DainoStore platform.

---

## Quick Start: Two Translation Tools

### Option 1: Quick Translate Dialog (Recommended for UI Elements)

**Perfect for:** Translating specific buttons, labels, and UI text with quick questions.

Add to your admin page:

```jsx
import QuickTranslateDialog from '../../components/admin/QuickTranslateDialog';

function YourAdminPage() {
  const [showQuickTranslate, setShowQuickTranslate] = useState(false);

  return (
    <>
      <Button onClick={() => setShowQuickTranslate(true)}>
        <Languages className="w-4 h-4 mr-2" />
        Quick Translate
      </Button>

      <QuickTranslateDialog
        isOpen={showQuickTranslate}
        onClose={() => setShowQuickTranslate(false)}
        onSuccess={() => {
          // Refresh your data if needed
          console.log('Translation completed!');
        }}
      />
    </>
  );
}
```

**Features:**
- ✅ Pre-configured common UI elements (Add to Cart, Checkout, etc.)
- ✅ Multi-select language options with quick presets
- ✅ Instant results with visual feedback
- ✅ Flag emojis for each language
- ✅ 3-step wizard: Select element → Choose languages → See results

**Example workflow:**
1. Click "Quick Translate" button
2. Select "Add to Cart Button" 🛒
3. Choose languages (Dutch 🇳🇱, French 🇫🇷, German 🇩🇪)
4. Click "Translate Now"
5. Done! See all translations instantly ✅

---

### Option 2: Full Translation Wizard (For Bulk Operations)

**Perfect for:** Translating everything at once (products, categories, CMS, etc.)

Add the TranslationWizard to your admin page:

```jsx
import TranslationWizard from '../../components/admin/TranslationWizard';

function YourAdminPage() {
  const [showWizard, setShowWizard] = useState(false);

  return (
    <>
      <Button onClick={() => setShowWizard(true)}>
        <Wand2 className="w-4 h-4 mr-2" />
        Translate Content
      </Button>

      <TranslationWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        storeId={yourStoreId}
      />
    </>
  );
}
```

**Features:**
- ✅ Translate everything or specific content types
- ✅ Preview statistics before translating
- ✅ Detailed progress tracking
- ✅ Estimated time calculation

---

## 🚀 Complete Example: Add Both to Admin Page

```jsx
import React, { useState } from 'react';
import { Languages, Wand2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import QuickTranslateDialog from '../../components/admin/QuickTranslateDialog';
import TranslationWizard from '../../components/admin/TranslationWizard';
import { useStoreSelection } from '../../contexts/StoreSelectionContext';

export default function TranslationsPage() {
  const [showQuickTranslate, setShowQuickTranslate] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { getSelectedStoreId } = useStoreSelection();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Translations</h1>

        {/* Translation Tools */}
        <div className="flex gap-3">
          {/* Quick Translate Button */}
          <Button
            onClick={() => setShowQuickTranslate(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Languages className="w-4 h-4" />
            Quick Translate
          </Button>

          {/* Full Wizard Button */}
          <Button
            onClick={() => setShowWizard(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Translation Wizard
          </Button>
        </div>
      </div>

      {/* Quick Translate Dialog */}
      <QuickTranslateDialog
        isOpen={showQuickTranslate}
        onClose={() => setShowQuickTranslate(false)}
        onSuccess={() => {
          console.log('Translation completed!');
          // Refresh translations or update UI
        }}
      />

      {/* Translation Wizard */}
      <TranslationWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        storeId={getSelectedStoreId()}
      />

      {/* Rest of your translations page content */}
    </div>
  );
}
```

---

## Example 1: Translate "Add to Cart" Button on Category Page

### Scenario
You want to change the "Add to Cart" button text on the category page to Dutch, French, and German.

### Method 1: Using UI Labels (Recommended for buttons/labels)

```javascript
// This is a UI label translation (stored in `translations` table)
// Key format: category.location.element

const translateAddToCartButton = async () => {
  // The key for category page "Add to Cart" button
  const key = 'product.add_to_cart';
  const sourceText = 'Add to Cart';

  const languages = [
    { code: 'nl', name: 'Dutch' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' }
  ];

  for (const lang of languages) {
    try {
      const response = await fetch('/api/translations/ai-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          text: sourceText,
          fromLang: 'en',
          toLang: lang.code,
          context: {
            type: 'button',           // It's a button
            location: 'category',     // On category page
            maxLength: 20             // Keep it short for buttons
          }
        })
      });

      const result = await response.json();
      const translatedText = result.data.translated;

      // Save the translated UI label
      await fetch('/api/translations/ui-labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          key: key,
          language_code: lang.code,
          value: translatedText,
          category: 'product',
          type: 'system'
        })
      });

      console.log(`✅ ${lang.name}: "${translatedText}"`);
    } catch (error) {
      console.error(`❌ Failed to translate to ${lang.name}:`, error);
    }
  }
};

// Run it
await translateAddToCartButton();

// Expected output:
// ✅ Dutch: "Toevoegen aan winkelwagen"
// ✅ French: "Ajouter au panier"
// ✅ German: "In den Warenkorb"
```

### Method 2: Auto-translate to all active languages

```javascript
const autoTranslateAddToCart = async () => {
  const response = await fetch('/api/translations/auto-translate-ui-label', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${yourAuthToken}`
    },
    body: JSON.stringify({
      key: 'product.add_to_cart',
      value: 'Add to Cart',
      category: 'product',
      fromLang: 'en'
    })
  });

  const result = await response.json();
  console.log('Translated to:', result.data.translations);
};
```

### Method 3: Using the Translation Wizard

1. Click **"Translate Content"** button
2. Select **"UI Labels"**
3. Choose **From: English**, **To: Dutch, French, German**
4. Click **"Preview"** to see what will be translated
5. Click **"Start Translation"**

---

## Example 2: Translate Cart Title/Heading

### Scenario
You want to translate the "Shopping Cart" heading that appears at the top of the cart page.

### Using UI Labels API

```javascript
const translateCartTitle = async () => {
  const translations = {
    'nl': 'Winkelwagen',
    'fr': 'Panier',
    'de': 'Warenkorb',
    'es': 'Carrito de compras',
    'it': 'Carrello'
  };

  // Save all translations at once
  const labels = Object.entries(translations).map(([lang, value]) => ({
    key: 'cart.title',
    language_code: lang,
    value: value,
    category: 'cart',
    type: 'system'
  }));

  await fetch('/api/translations/ui-labels/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${yourAuthToken}`
    },
    body: JSON.stringify({ labels })
  });

  console.log('✅ Cart title translated to 5 languages!');
};
```

### Or let AI translate it:

```javascript
const aiTranslateCartTitle = async () => {
  const targetLanguages = ['nl', 'fr', 'de', 'es', 'it'];

  for (const toLang of targetLanguages) {
    const response = await fetch('/api/translations/ai-translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${yourAuthToken}`
      },
      body: JSON.stringify({
        text: 'Shopping Cart',
        fromLang: 'en',
        toLang: toLang,
        context: {
          type: 'heading',
          location: 'cart'
        }
      })
    });

    const result = await response.json();

    // Save it
    await fetch('/api/translations/ui-labels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${yourAuthToken}`
      },
      body: JSON.stringify({
        key: 'cart.title',
        language_code: toLang,
        value: result.data.translated,
        category: 'cart'
      })
    });
  }
};
```

---

## Example 3: Translate Product Names Only

### Scenario
You have 100 products and only want to translate the **name** field (not descriptions).

### Using the Script

```bash
node scripts/translate-single-field.js \
  --entity=product \
  --field=name \
  --from=en \
  --to=nl \
  --store=1
```

### Using API

```javascript
const translateProductNamesOnly = async (storeId) => {
  // Get all products
  const productsResponse = await fetch(`/api/products?store_id=${storeId}`);
  const products = await productsResponse.json();

  for (const product of products.data) {
    try {
      // Check if English name exists
      if (!product.translations?.en?.name) {
        console.log(`⏭️  Skipping product ${product.id}: No English name`);
        continue;
      }

      // Check if Dutch translation already exists
      if (product.translations?.nl?.name) {
        console.log(`⏭️  Skipping product ${product.id}: Already has Dutch name`);
        continue;
      }

      const englishName = product.translations.en.name;
      console.log(`🔄 Translating: "${englishName}"`);

      // Translate just the name
      const response = await fetch('/api/translations/ai-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          text: englishName,
          fromLang: 'en',
          toLang: 'nl',
          context: {
            type: 'heading',
            location: 'product'
          }
        })
      });

      const result = await response.json();
      const dutchName = result.data.translated;
      console.log(`   → "${dutchName}"`);

      // Save only the name field
      await fetch(`/api/translations/entity/product/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          language_code: 'nl',
          translations: {
            name: dutchName
            // Note: NOT including description or other fields
          }
        })
      });

      console.log(`   ✅ Saved\n`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
};

// Run it
await translateProductNamesOnly(1);
```

---

## Example 4: Translate Category Page Content

### Scenario
You want to translate category names and descriptions for display on category pages.

### Using the Wizard

1. Click **"Translate Content"**
2. Select **"Categories"** (📁 icon)
3. Choose **From: English**, **To: Your target languages**
4. Click **"Preview"** → Shows how many categories will be translated
5. Click **"Start Translation"**

### Using Script

```bash
# Translate all fields (name + description)
node scripts/bulk-translate.js \
  --type=category \
  --from=en \
  --to=nl \
  --store=1
```

### Using API for a Single Category

```javascript
const translateSingleCategory = async (categoryId) => {
  // Translate the entire category (name + description)
  const response = await fetch('/api/translations/ai-translate-entity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${yourAuthToken}`
    },
    body: JSON.stringify({
      entityType: 'category',
      entityId: categoryId,
      fromLang: 'en',
      toLang: 'fr'
    })
  });

  const result = await response.json();
  console.log('✅ Category translated:', result.data);
};

// Translate category #5
await translateSingleCategory(5);
```

---

## Example 5: Translate Checkout Page Labels

### Scenario
You want to translate all checkout-related labels (billing address, payment method, place order, etc.).

### Using Bulk Translation

```javascript
const translateCheckoutLabels = async () => {
  const checkoutLabels = {
    'checkout.billing_address': 'Billing Address',
    'checkout.shipping_address': 'Shipping Address',
    'checkout.payment_method': 'Payment Method',
    'checkout.shipping_method': 'Shipping Method',
    'checkout.order_summary': 'Order Summary',
    'checkout.place_order': 'Place Order',
    'checkout.subtotal': 'Subtotal',
    'checkout.shipping': 'Shipping',
    'checkout.tax': 'Tax',
    'checkout.total': 'Total',
    'checkout.continue': 'Continue',
    'checkout.back': 'Back'
  };

  const targetLanguages = ['nl', 'fr', 'de'];

  for (const [key, englishText] of Object.entries(checkoutLabels)) {
    for (const toLang of targetLanguages) {
      try {
        console.log(`🔄 Translating "${key}" to ${toLang}...`);

        // Translate
        const response = await fetch('/api/translations/ai-translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${yourAuthToken}`
          },
          body: JSON.stringify({
            text: englishText,
            fromLang: 'en',
            toLang: toLang,
            context: {
              type: key.includes('place_order') || key.includes('continue') ? 'button' : 'label',
              location: 'checkout'
            }
          })
        });

        const result = await response.json();
        const translatedText = result.data.translated;

        // Save
        await fetch('/api/translations/ui-labels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${yourAuthToken}`
          },
          body: JSON.stringify({
            key: key,
            language_code: toLang,
            value: translatedText,
            category: 'checkout',
            type: 'system'
          })
        });

        console.log(`   ✅ ${toLang}: "${translatedText}"`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
  }

  console.log('\n✅ All checkout labels translated!');
};

// Run it
await translateCheckoutLabels();
```

### Expected Output

```
🔄 Translating "checkout.billing_address" to nl...
   ✅ nl: "Factuuradres"
🔄 Translating "checkout.billing_address" to fr...
   ✅ fr: "Adresse de facturation"
🔄 Translating "checkout.billing_address" to de...
   ✅ de: "Rechnungsadresse"
...
✅ All checkout labels translated!
```

---

## Example 6: Translate "Out of Stock" Label

### Scenario
You want to translate the "Out of Stock" badge that appears on product cards.

```javascript
const translateOutOfStockLabel = async () => {
  const languages = {
    'nl': 'Uitverkocht',
    'fr': 'Rupture de stock',
    'de': 'Ausverkauft',
    'es': 'Agotado',
    'it': 'Esaurito',
    'pt': 'Fora de estoque'
  };

  const labels = Object.entries(languages).map(([lang, value]) => ({
    key: 'product.out_of_stock',
    language_code: lang,
    value: value,
    category: 'product',
    type: 'system'
  }));

  await fetch('/api/translations/ui-labels/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${yourAuthToken}`
    },
    body: JSON.stringify({ labels })
  });

  console.log('✅ "Out of Stock" translated to 6 languages!');
};
```

---

## Example 7: Translate CMS Homepage Content

### Scenario
You want to translate your homepage content (hero text, features, etc.) to multiple languages.

### Using the Wizard

1. Click **"Translate Content"**
2. Select **"CMS Content"** (📄 icon)
3. Select target languages
4. Click **"Preview"** to see which pages will be translated
5. Click **"Start Translation"**

### Using API for Specific Page

```javascript
const translateHomepage = async () => {
  // Assume homepage is CMS page with ID 1
  const homepageId = 1;

  const targetLanguages = ['nl', 'fr', 'de'];

  for (const toLang of targetLanguages) {
    try {
      console.log(`🔄 Translating homepage to ${toLang}...`);

      const response = await fetch('/api/translations/ai-translate-entity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          entityType: 'cms_page',
          entityId: homepageId,
          fromLang: 'en',
          toLang: toLang
        })
      });

      const result = await response.json();
      console.log(`✅ Homepage translated to ${toLang}!`);

      // Rate limiting for large content
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Error translating to ${toLang}:`, error);
    }
  }

  console.log('\n✅ Homepage translated to all languages!');
};

await translateHomepage();
```

---

## Example 8: Translate Navigation Menu Items

### Scenario
You want to translate main navigation items like "Home", "Shop", "About Us", "Contact".

```javascript
const translateNavigation = async () => {
  const navItems = {
    'navigation.home': 'Home',
    'navigation.shop': 'Shop',
    'navigation.about': 'About Us',
    'navigation.contact': 'Contact',
    'navigation.my_account': 'My Account',
    'navigation.cart': 'Cart',
    'navigation.wishlist': 'Wishlist',
    'navigation.search': 'Search'
  };

  const targetLanguages = ['nl', 'fr', 'de', 'es'];

  for (const [key, englishText] of Object.entries(navItems)) {
    console.log(`\n🔄 Translating "${englishText}"...`);

    for (const toLang of targetLanguages) {
      try {
        const response = await fetch('/api/translations/ai-translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${yourAuthToken}`
          },
          body: JSON.stringify({
            text: englishText,
            fromLang: 'en',
            toLang: toLang,
            context: {
              type: 'label',
              location: 'navigation',
              maxLength: 20
            }
          })
        });

        const result = await response.json();

        await fetch('/api/translations/ui-labels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${yourAuthToken}`
          },
          body: JSON.stringify({
            key: key,
            language_code: toLang,
            value: result.data.translated,
            category: 'navigation'
          })
        });

        console.log(`   ✅ ${toLang}: "${result.data.translated}"`);
      } catch (error) {
        console.error(`   ❌ ${toLang}: Error`);
      }
    }
  }

  console.log('\n✅ All navigation items translated!');
};

await translateNavigation();
```

---

## Example 9: Translate Product Attributes (Size, Color, etc.)

### Scenario
You want to translate attribute names like "Size", "Color", "Material".

```javascript
const translateProductAttributes = async (storeId) => {
  // Get all attributes
  const response = await fetch(`/api/attributes?store_id=${storeId}`);
  const attributes = await response.json();

  for (const attribute of attributes.data) {
    try {
      console.log(`\n🔄 Translating attribute: ${attribute.code}`);

      // Translate to Dutch
      await fetch('/api/translations/ai-translate-entity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify({
          entityType: 'attribute',
          entityId: attribute.id,
          fromLang: 'en',
          toLang: 'nl'
        })
      });

      console.log(`   ✅ Translated`);

      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
};

await translateProductAttributes(1);
```

---

## Example 10: Using the Translation Wizard in Your Admin UI

### Add to Translations Page

```jsx
// src/pages/admin/Translations.jsx

import TranslationWizard from '../../components/admin/TranslationWizard';

export default function Translations() {
  const [showWizard, setShowWizard] = useState(false);
  const { getSelectedStoreId } = useStoreSelection();

  return (
    <div className="p-6">
      {/* Existing content */}

      <div className="mb-6">
        <Button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          Translation Wizard
        </Button>
      </div>

      {/* Translation Wizard */}
      <TranslationWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        storeId={getSelectedStoreId()}
      />

      {/* Rest of your content */}
    </div>
  );
}
```

---

## Common Translation Keys Reference

Here are the most common UI label keys you'll translate:

### Common Actions
```
common.add          → "Add"
common.edit         → "Edit"
common.delete       → "Delete"
common.save         → "Save"
common.cancel       → "Cancel"
common.close        → "Close"
common.view         → "View"
common.search       → "Search"
common.filter       → "Filter"
```

### Product Page
```
product.add_to_cart        → "Add to Cart"
product.buy_now            → "Buy Now"
product.out_of_stock       → "Out of Stock"
product.in_stock           → "In Stock"
product.sku                → "SKU"
product.price              → "Price"
product.quantity           → "Quantity"
product.description        → "Description"
product.reviews            → "Reviews"
product.related_products   → "Related Products"
```

### Cart Page
```
cart.title                 → "Shopping Cart"
cart.remove                → "Remove"
cart.update                → "Update Cart"
cart.continue_shopping     → "Continue Shopping"
cart.proceed_to_checkout   → "Proceed to Checkout"
cart.empty                 → "Your cart is empty"
cart.subtotal              → "Subtotal"
```

### Checkout Page
```
checkout.billing_address   → "Billing Address"
checkout.shipping_address  → "Shipping Address"
checkout.payment_method    → "Payment Method"
checkout.shipping_method   → "Shipping Method"
checkout.place_order       → "Place Order"
checkout.total             → "Total"
```

---

## Quick Reference: Translation Methods

| Method | Best For | Example |
|--------|----------|---------|
| **Translation Wizard** | Bulk translations, guided process | Click button, select options, done |
| **Auto-translate endpoint** | Single UI label to all languages | `/api/translations/auto-translate-ui-label` |
| **AI translate endpoint** | Single text translation | `/api/translations/ai-translate` |
| **Bulk script** | Large migrations, all content types | `node scripts/bulk-translate.js` |
| **Single field script** | Just names or just descriptions | `node scripts/translate-single-field.js` |

---

## Testing Your Translations

### Check if a translation exists:

```javascript
const checkTranslation = async (key, language) => {
  const response = await fetch(`/api/translations/ui-labels?lang=${language}`);
  const data = await response.json();

  const value = data.data.labels[key];
  console.log(`${key} in ${language}:`, value || 'NOT FOUND');
};

await checkTranslation('product.add_to_cart', 'nl');
// Output: product.add_to_cart in nl: "Toevoegen aan winkelwagen"
```

### Get translation stats:

```javascript
const getStats = async (storeId) => {
  const response = await fetch(`/api/translations/entity-stats?store_id=${storeId}`);
  const stats = await response.json();

  console.log('Translation completion:');
  stats.data.stats.forEach(stat => {
    console.log(`${stat.name}: ${stat.completionPercentage}%`);
  });
};

await getStats(1);
```

---

## Summary

You now have **10 real working examples** covering:
- UI button translations (Add to Cart)
- Page title translations (Cart, Checkout)
- Product name translations
- Category content translations
- Checkout labels
- Stock status labels
- CMS homepage content
- Navigation menu items
- Product attributes
- Using the Translation Wizard

**Choose the method that fits your workflow!**
