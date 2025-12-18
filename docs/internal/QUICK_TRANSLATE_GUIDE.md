# Quick Translate Dialog - User Guide

## 🎯 What is Quick Translate?

Quick Translate is a **3-step interactive dialog** that asks you targeted questions to translate specific UI elements like buttons, labels, and headings. Perfect for when you just want to translate "Add to Cart" or "Shopping Cart" without dealing with complex settings.

---

## ✨ Features

- **10+ Pre-configured UI Elements** - Common buttons and labels ready to translate
- **Multi-language Selection** - Check multiple languages at once
- **Quick Presets** - "Common European" button selects Dutch, French, German, Spanish
- **Instant Results** - See all translations immediately with flag emojis
- **Custom Text** - Enter your own text if it's not in the presets
- **Beautiful UI** - Purple gradient header, visual feedback, smooth animations

---

## 📸 Visual Walkthrough

### Step 1: What to Translate?

You'll see a grid of common UI elements:

```
┌─────────────────────────────────────────────────────────────┐
│  🛒 Add to Cart Button          ⚡ Buy Now Button          │
│  Button on product/category      Quick checkout button      │
│  "Add to Cart"                   "Buy Now"                  │
├─────────────────────────────────────────────────────────────┤
│  🛍️ Shopping Cart Title         💳 Checkout Title          │
│  Cart page heading               Checkout page heading      │
│  "Shopping Cart"                 "Checkout"                 │
├─────────────────────────────────────────────────────────────┤
│  ✅ Place Order Button          ❌ Out of Stock Label       │
│  Final checkout button           Stock status badge         │
│  "Place Order"                   "Out of Stock"             │
├─────────────────────────────────────────────────────────────┤
│  ✓ In Stock Label               🔍 Search Placeholder       │
│  Stock status badge              Search input placeholder   │
│  "In Stock"                      "Search..."                │
├─────────────────────────────────────────────────────────────┤
│  ◀️ Continue Shopping           ➡️ Proceed to Checkout     │
│  Return to shop link            Go to checkout button      │
│  "Continue Shopping"             "Proceed to Checkout"      │
├─────────────────────────────────────────────────────────────┤
│  ✏️ Custom Text                                             │
│  Enter your own text                                        │
└─────────────────────────────────────────────────────────────┘
```

**Example:** Click "🛒 Add to Cart Button"
- The card highlights in purple
- Shows the English text: "Add to Cart"
- "Next" button becomes enabled

---

### Step 2: Which Languages?

Multi-select checkboxes with language names and flags:

```
┌─────────────────────────────────────────────────────────────┐
│  What's being translated:                                   │
│  ┌───────────────────────────────────────────────┐          │
│  │  🛒 Add to Cart Button                        │          │
│  │  "Add to Cart"                                │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
│  Target languages (select multiple):          3 selected    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ☑️ 🇳🇱 Nederlands              ☑️ 🇫🇷 Français        │   │
│  │     Dutch (NL)                      French (FR)       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  ☑️ 🇩🇪 Deutsch                 ☐ 🇪🇸 Español         │   │
│  │     German (DE)                     Spanish (ES)      │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  ☐ 🇮🇹 Italiano                 ☐ 🇵🇹 Português       │   │
│  │     Italian (IT)                    Portuguese (PT)   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [Common European] [Select All] [Clear All]                │
│                                                              │
│  [Back]                             [Translate Now] ──────→ │
└─────────────────────────────────────────────────────────────┘
```

**Quick Presets:**
- **Common European** - Selects Dutch, French, German, Spanish
- **Select All** - All available languages
- **Clear All** - Deselect everything

---

### Step 3: Results

Beautiful results page with flag emojis:

```
┌─────────────────────────────────────────────────────────────┐
│              ✅ Translation Complete!                        │
│        Your UI element has been translated                  │
│                                                              │
│  🛒 Add to Cart Button                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  🇬🇧 English (Original)                  [Source]     │  │
│  │     Add to Cart                                       │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  🇳🇱 Nederlands                          ✓ Translated │  │
│  │     Toevoegen aan winkelwagen                         │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  🇫🇷 Français                            ✓ Translated │  │
│  │     Ajouter au panier                                 │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  🇩🇪 Deutsch                             ✓ Translated │  │
│  │     In den Warenkorb                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Translation Key: product.add_to_cart                        │
│                                                              │
│  [Translate Another]                             [Done]  ─→ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Add to your admin page

```jsx
import React, { useState } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '../../components/ui/button';
import QuickTranslateDialog from '../../components/admin/QuickTranslateDialog';

export default function MyAdminPage() {
  const [showQuickTranslate, setShowQuickTranslate] = useState(false);

  return (
    <div>
      <Button onClick={() => setShowQuickTranslate(true)}>
        <Languages className="w-4 h-4 mr-2" />
        Quick Translate
      </Button>

      <QuickTranslateDialog
        isOpen={showQuickTranslate}
        onClose={() => setShowQuickTranslate(false)}
        onSuccess={() => {
          toast.success('Translation saved!');
        }}
      />
    </div>
  );
}
```

### 2. Click the button

### 3. Follow the 3 steps

**Step 1:** Select "Add to Cart Button" 🛒
**Step 2:** Check Dutch 🇳🇱, French 🇫🇷, German 🇩🇪
**Step 3:** See results and click "Done"

---

## 📋 Available Presets

| Emoji | Label | English Text | Translation Key | Location |
|-------|-------|--------------|----------------|----------|
| 🛒 | Add to Cart Button | "Add to Cart" | `product.add_to_cart` | Product/Category pages |
| ⚡ | Buy Now Button | "Buy Now" | `product.buy_now` | Product pages |
| 🛍️ | Shopping Cart Title | "Shopping Cart" | `cart.title` | Cart page |
| 💳 | Checkout Title | "Checkout" | `checkout.title` | Checkout page |
| ✅ | Place Order Button | "Place Order" | `checkout.place_order` | Checkout page |
| ❌ | Out of Stock Label | "Out of Stock" | `product.out_of_stock` | Product cards |
| ✓ | In Stock Label | "In Stock" | `product.in_stock` | Product cards |
| 🔍 | Search Placeholder | "Search..." | `common.search` | Header/search bar |
| ◀️ | Continue Shopping | "Continue Shopping" | `cart.continue_shopping` | Cart page |
| ➡️ | Proceed to Checkout | "Proceed to Checkout" | `cart.proceed_to_checkout` | Cart page |
| ✏️ | Custom Text | (your text) | (your key) | Anywhere |

---

## 🎨 Custom Text Option

If your text isn't in the presets, use **Custom Text**:

### Step 1: Select "✏️ Custom Text"

A form appears:

```
┌──────────────────────────────────────────────────────┐
│  Translation Key:                                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ e.g., common.welcome or product.featured       │  │
│  └────────────────────────────────────────────────┘  │
│  Use dot notation: category.key                      │
│                                                      │
│  English Text:                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Enter the text to translate...                 │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Example:

**Translation Key:** `checkout.thank_you`
**English Text:** `Thank you for your order!`

Then proceed to Step 2 (language selection) as normal.

---

## 💡 Real Usage Examples

### Example 1: Translate "Add to Cart" to 4 languages

1. Click **"Quick Translate"** button
2. Select **"🛒 Add to Cart Button"**
3. Click **"Next"**
4. Check: Dutch 🇳🇱, French 🇫🇷, German 🇩🇪, Spanish 🇪🇸
5. Click **"Translate Now"**
6. See results:
   - 🇳🇱 "Toevoegen aan winkelwagen"
   - 🇫🇷 "Ajouter au panier"
   - 🇩🇪 "In den Warenkorb"
   - 🇪🇸 "Añadir al carrito"
7. Click **"Done"**

**Time taken:** ~10 seconds
**Result:** 4 translations saved to database

---

### Example 2: Translate "Out of Stock" badge

1. Click **"Quick Translate"**
2. Select **"❌ Out of Stock Label"**
3. Click **"Next"**
4. Click **"Common European"** (auto-selects 4 languages)
5. Click **"Translate Now"**
6. Results:
   - 🇳🇱 "Uitverkocht"
   - 🇫🇷 "Rupture de stock"
   - 🇩🇪 "Ausverkauft"
   - 🇪🇸 "Agotado"
7. Click **"Done"**

---

### Example 3: Translate custom welcome message

1. Click **"Quick Translate"**
2. Select **"✏️ Custom Text"**
3. Enter:
   - **Key:** `homepage.welcome`
   - **Text:** `Welcome to our store!`
4. Click **"Next"**
5. Check: Dutch, French, German
6. Click **"Translate Now"**
7. Results:
   - 🇳🇱 "Welkom in onze winkel!"
   - 🇫🇷 "Bienvenue dans notre magasin !"
   - 🇩🇪 "Willkommen in unserem Shop!"
8. Click **"Done"**

---

## 🎯 When to Use Quick Translate vs Full Wizard

| Scenario | Use Quick Translate | Use Full Wizard |
|----------|-------------------|-----------------|
| Translate a single button/label | ✅ YES | ❌ No |
| Translate all products | ❌ No | ✅ YES |
| Translate "Add to Cart" button | ✅ YES | ❌ No |
| Translate checkout labels | ✅ YES (one at a time) | ✅ YES (all at once) |
| Translate 100 categories | ❌ No | ✅ YES |
| Quick UI fix | ✅ YES | ❌ No |
| Migrate entire store | ❌ No | ✅ YES |

**Rule of thumb:**
- **Quick Translate** = 1 UI element at a time
- **Full Wizard** = Bulk operations (10+ items)

---

## 🔧 Technical Details

### API Endpoint Used

```javascript
POST /api/translations/auto-translate-ui-label
{
  "key": "product.add_to_cart",
  "value": "Add to Cart",
  "category": "product",
  "fromLang": "en"
}
```

This endpoint:
1. Translates the text to **all active languages** using AI
2. Saves translations to the `translations` table
3. Uses RAG context for e-commerce terminology
4. Returns results with success/error status per language

### Where Translations are Stored

```sql
-- translations table
┌──────────────────────┬──────────────┬────────────────────────┬──────────┐
│ key                  │ language_code│ value                  │ category │
├──────────────────────┼──────────────┼────────────────────────┼──────────┤
│ product.add_to_cart  │ en           │ Add to Cart            │ product  │
│ product.add_to_cart  │ nl           │ Toevoegen aan winkl... │ product  │
│ product.add_to_cart  │ fr           │ Ajouter au panier      │ product  │
│ product.add_to_cart  │ de           │ In den Warenkorb       │ product  │
└──────────────────────┴──────────────┴────────────────────────┴──────────┘
```

### How Frontend Uses Translations

```jsx
import { useTranslation } from '../../contexts/TranslationContext';

function ProductCard() {
  const { t } = useTranslation();

  return (
    <button>
      {t('product.add_to_cart')} {/* Automatically uses current language */}
    </button>
  );
}

// English: "Add to Cart"
// Dutch: "Toevoegen aan winkelwagen"
// French: "Ajouter au panier"
```

---

## ⚡ Performance

- **Translation Speed:** ~2 seconds per language
- **Batch Support:** Translates all languages simultaneously
- **Rate Limiting:** Built-in delays to prevent API throttling
- **Error Handling:** Individual language failures don't stop others

### Example Timing:

```
Translating "Add to Cart" to 4 languages:
├─ Dutch:    ✓ 1.8s
├─ French:   ✓ 2.1s
├─ German:   ✓ 1.9s
└─ Spanish:  ✓ 2.0s
───────────────────────
Total: ~8 seconds
```

---

## 🎨 UI/UX Features

### Visual Feedback

- ✅ **Progress indicators** - See which step you're on
- ✅ **Hover effects** - Cards highlight on hover
- ✅ **Selected state** - Purple border on selected items
- ✅ **Loading states** - Spinning icon while translating
- ✅ **Success animation** - Green checkmark on completion
- ✅ **Flag emojis** - Visual language identification

### Accessibility

- ✅ Keyboard navigation supported
- ✅ Clear focus indicators
- ✅ Descriptive labels and ARIA attributes
- ✅ Large click targets (cards, buttons)

---

## 🐛 Troubleshooting

### "No languages available"
**Solution:** Make sure you have active languages in your database:
```sql
SELECT * FROM languages WHERE is_active = true;
```

### "Translation failed"
**Solution:** Check your `.env` file for API keys:
```bash
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
```

### "Translation key already exists"
**Solution:** This is normal! The system updates existing translations. If you want to see the updated value, refresh your page.

### Custom text not saving
**Solution:** Make sure both fields are filled:
- Translation Key (required, no spaces, use dots)
- English Text (required, the text to translate)

---

## 📚 Related Documentation

- **`TRANSLATION_GUIDE.md`** - Complete translation system documentation
- **`TRANSLATION_EXAMPLES.md`** - 10 real code examples
- **`scripts/bulk-translate.js`** - Bulk translation script
- **`scripts/translate-single-field.js`** - Single field translation script

---

## 🎉 Summary

Quick Translate is your **fastest way** to translate individual UI elements:

1. **Click button** → Opens dialog
2. **Select preset** → 10+ common elements
3. **Check languages** → Multi-select with flags
4. **Click translate** → AI-powered translation
5. **See results** → Instant visual feedback

**Perfect for:**
- Quick UI fixes
- Translating buttons and labels
- Testing translations before bulk operations
- Non-technical users (no coding required)

**Not suitable for:**
- Bulk product translations (use Full Wizard)
- Migrating entire stores (use bulk scripts)
- Automated workflows (use API directly)

---

Ready to translate? Click **"Quick Translate"** and follow the 3 steps! 🚀
