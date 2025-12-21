# Translation UI Integration Guide

This guide shows how to integrate translation fields into all admin forms using the reusable `TranslationFields` component.

## Overview

The `TranslationFields` component provides a complete UI for managing multilingual content with:
- Tabbed interface for each language
- Visual indicators for translation completeness
- Support for text, textarea, and rich text fields
- Automatic field initialization for all active languages

## Quick Start

### 1. Import the Component

```jsx
import TranslationFields, { TranslationIndicator, TranslationHelper } from '@/components/admin/TranslationFields';
```

### 2. Add to Your Form State

```jsx
const [formData, setFormData] = useState({
  // ... other fields
  translations: product?.translations || {}
});
```

### 3. Add Translation Fields to Your Form

```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    { name: 'name', label: 'Product Name', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'richtext', rows: 6 },
    { name: 'short_description', label: 'Short Description', type: 'textarea', rows: 2 }
  ]}
/>
```

### 4. Add Translation Indicator to Grid

```jsx
<td className="py-4 px-4">
  <TranslationIndicator
    translations={product.translations}
    requiredLanguages={['en', 'es', 'fr']}
  />
</td>
```

## Integration Examples

### Products Form (`src/components/admin/products/ProductForm.jsx`)

**Step 1: Import the component**
```jsx
import TranslationFields, { TranslationHelper } from '@/components/admin/TranslationFields';
```

**Step 2: Replace name, description, short_description fields with TranslationFields**

Find this section in the form:
```jsx
{/* Old fields - REMOVE THESE */}
<div className="form-group">
  <label>Product Name *</label>
  <input type="text" name="name" value={formData.name} ... />
</div>
<div className="form-group">
  <label>Description</label>
  <textarea name="description" value={formData.description} ... />
</div>
<div className="form-group">
  <label>Short Description</label>
  <textarea name="short_description" value={formData.short_description} ... />
</div>
```

Replace with:
```jsx
{/* Translation Fields */}
<div className="col-span-2">
  <h3 className="text-lg font-semibold mb-2">Product Information</h3>
  <TranslationHelper />
  <div className="mt-4">
    <TranslationFields
      translations={formData.translations}
      onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
      fields={[
        {
          name: 'name',
          label: 'Product Name',
          type: 'text',
          required: true,
          placeholder: 'Enter product name',
          helper: 'This name will appear in your storefront'
        },
        {
          name: 'description',
          label: 'Full Description',
          type: 'richtext',
          rows: 8,
          placeholder: 'Enter detailed product description',
          helper: 'Supports HTML formatting'
        },
        {
          name: 'short_description',
          label: 'Short Description',
          type: 'textarea',
          rows: 3,
          placeholder: 'Enter brief product summary',
          helper: 'Shown in product listings'
        }
      ]}
    />
  </div>
</div>
```

**Step 3: Update form submission**

The `translations` object is already in `formData`, so it will be submitted automatically. Just make sure you're not removing it:

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();

  // formData.translations is already included
  await onSubmit(formData);
};
```

**Step 4: Add translation indicator to Products grid**

In `src/pages/admin/Products.jsx`, add a new column:

```jsx
<thead>
  <tr className="border-b border-gray-200">
    ...
    <th className="text-left py-3 px-4 font-medium text-gray-900">Translations</th>
    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
    ...
  </tr>
</thead>
<tbody>
  {paginatedProducts.map((product) => (
    <tr key={product.id}>
      ...
      <td className="py-4 px-4">
        <TranslationIndicator
          translations={product.translations}
          requiredLanguages={['en']}
        />
      </td>
      <td className="py-4 px-4">
        <Badge className={statusColors[product.status]}>
          {product.status}
        </Badge>
      </td>
      ...
    </tr>
  ))}
</tbody>
```

---

### Categories Form (`src/pages/admin/Categories.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'name',
      label: 'Category Name',
      type: 'text',
      required: true,
      placeholder: 'Enter category name'
    },
    {
      name: 'description',
      label: 'Description',
      type: 'richtext',
      rows: 6,
      placeholder: 'Enter category description',
      helper: 'Shown on category page'
    }
  ]}
/>
```

**Grid Indicator:**
```jsx
<td className="py-4 px-4">
  <TranslationIndicator
    translations={category.translations}
    requiredLanguages={['en']}
  />
</td>
```

---

### CMS Pages Form (`src/pages/admin/CmsPages.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'title',
      label: 'Page Title',
      type: 'text',
      required: true,
      placeholder: 'Enter page title'
    },
    {
      name: 'content',
      label: 'Page Content',
      type: 'richtext',
      rows: 12,
      placeholder: 'Enter page content (HTML supported)',
      helper: 'Full HTML support with inline styles'
    }
  ]}
/>
```

---

### CMS Blocks Form (`src/pages/admin/CmsBlocks.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'title',
      label: 'Block Title',
      type: 'text',
      required: true,
      placeholder: 'Enter block title'
    },
    {
      name: 'content',
      label: 'Block Content',
      type: 'richtext',
      rows: 8,
      placeholder: 'Enter block content (HTML supported)',
      helper: 'Supports HTML and inline styles'
    }
  ]}
/>
```

---

### Product Labels Form (`src/pages/admin/ProductLabels.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'text',
      label: 'Label Text',
      type: 'text',
      required: true,
      placeholder: 'e.g., "NEW", "SALE", "HOT"',
      helper: 'Short text to display on product'
    }
  ]}
/>
```

---

### Product Tabs Form (`src/pages/admin/ProductTabs.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'title',
      label: 'Tab Title',
      type: 'text',
      required: true,
      placeholder: 'Enter tab title'
    },
    {
      name: 'content',
      label: 'Tab Content',
      type: 'richtext',
      rows: 6,
      placeholder: 'Enter tab content',
      helper: 'HTML supported'
    }
  ]}
/>
```

---

### Attributes Form (`src/pages/admin/Attributes.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'label',
      label: 'Attribute Label',
      type: 'text',
      required: true,
      placeholder: 'e.g., "Color", "Size", "Material"'
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 3,
      placeholder: 'Enter attribute description',
      helper: 'Optional description for admin use'
    }
  ]}
/>
```

---

### Custom Options Form (`src/pages/admin/CustomOptions.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'title',
      label: 'Option Title',
      type: 'text',
      required: true,
      placeholder: 'e.g., "Gift Wrapping", "Engraving"'
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 2,
      placeholder: 'Enter option description'
    }
  ]}
/>
```

---

### Cookie Consent Form (`src/pages/admin/CookieConsent.jsx`)

**Field Configuration:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(newTranslations) => setFormData({ ...formData, translations: newTranslations })}
  fields={[
    {
      name: 'title',
      label: 'Banner Title',
      type: 'text',
      required: true,
      placeholder: 'e.g., "Cookie Notice"'
    },
    {
      name: 'message',
      label: 'Banner Message',
      type: 'textarea',
      rows: 4,
      required: true,
      placeholder: 'Enter cookie consent message'
    },
    {
      name: 'accept_button',
      label: 'Accept Button Text',
      type: 'text',
      placeholder: 'e.g., "Accept All"'
    },
    {
      name: 'decline_button',
      label: 'Decline Button Text',
      type: 'text',
      placeholder: 'e.g., "Decline"'
    }
  ]}
/>
```

---

## Field Type Reference

### Available Field Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text input | Product name, SKU |
| `textarea` | Multi-line text input | Short descriptions |
| `richtext` | HTML-enabled textarea | Full descriptions, content |

### Field Configuration Options

```jsx
{
  name: 'field_name',          // Required: field key in translations object
  label: 'Field Label',         // Required: display label
  type: 'text',                 // Required: 'text', 'textarea', or 'richtext'
  required: true,               // Optional: mark as required for default language
  placeholder: 'Placeholder',   // Optional: input placeholder
  rows: 4,                      // Optional: rows for textarea/richtext
  helper: 'Helper text',        // Optional: help text below field
  hint: 'Hint text'            // Optional: small hint in label
}
```

## Component API

### TranslationFields

```jsx
<TranslationFields
  translations={object}         // Current translations object
  onChange={function}           // Callback when translations change
  fields={array}                // Array of field configurations
  defaultLanguage="en"          // Default language code (optional)
  className=""                  // Additional CSS classes (optional)
/>
```

### TranslationIndicator

```jsx
<TranslationIndicator
  translations={object}         // Translations object to check
  requiredLanguages={array}     // Array of required language codes
/>
```

**Visual Indicators:**
- 🟢 Green: All required languages complete
- 🟡 Amber: Some translations missing
- 🔴 Red: No translations found

### TranslationHelper

```jsx
<TranslationHelper />
```

Shows helpful tips about managing translations.

## Best Practices

### 1. Always Include English as Default

```jsx
<TranslationFields
  translations={formData.translations}
  onChange={...}
  fields={...}
  defaultLanguage="en"  // Always use English as base
/>
```

### 2. Mark Important Fields as Required

```jsx
fields={[
  { name: 'name', label: 'Name', type: 'text', required: true },  // ✅ Required
  { name: 'description', label: 'Description', type: 'textarea' }  // Optional
]}
```

### 3. Provide Helpful Placeholders

```jsx
fields={[
  {
    name: 'title',
    label: 'Page Title',
    type: 'text',
    placeholder: 'Enter a descriptive title for your page',  // ✅ Helpful
    helper: 'Used in browser tabs and search results'        // ✅ More context
  }
]}
```

### 4. Use Appropriate Field Types

```jsx
// ✅ Good
{ name: 'name', type: 'text' }           // Short text
{ name: 'summary', type: 'textarea' }    // Paragraph
{ name: 'content', type: 'richtext' }    // HTML content

// ❌ Avoid
{ name: 'name', type: 'richtext' }       // Overkill for short text
{ name: 'content', type: 'text' }        // Too limiting for long content
```

### 5. Group Related Fields

```jsx
<div className="space-y-6">
  {/* Basic Information */}
  <div>
    <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
    <TranslationFields fields={basicFields} ... />
  </div>

  {/* Detailed Content */}
  <div>
    <h3 className="text-lg font-semibold mb-4">Detailed Content</h3>
    <TranslationFields fields={contentFields} ... />
  </div>
</div>
```

## Styling

The component uses Tailwind CSS and can be customized:

```jsx
<TranslationFields
  className="my-custom-class"
  translations={...}
  fields={...}
/>
```

### Custom Styles

```css
/* Override tab active color */
.translation-fields button[class*="border-blue-500"] {
  border-color: your-color !important;
}

/* Override complete indicator color */
.translation-fields .text-green-500 {
  color: your-success-color !important;
}
```

## Migration Strategy

### For Existing Forms

1. **Backup your current form component**
2. **Add TranslationFields import**
3. **Replace hardcoded name/description/title fields**
4. **Test with existing data**
5. **Add Translation Indicator to grid**
6. **Deploy and verify**

### Example Migration

**Before:**
```jsx
<input
  type="text"
  name="name"
  value={formData.name}
  onChange={handleChange}
/>
```

**After:**
```jsx
<TranslationFields
  translations={formData.translations}
  onChange={(t) => setFormData({...formData, translations: t})}
  fields={[{ name: 'name', label: 'Name', type: 'text', required: true }]}
/>
```

## Troubleshooting

### Issue: Translations not saving

**Solution:** Ensure `translations` is included in form submission:
```jsx
const handleSubmit = async (e) => {
  e.preventDefault();

  const dataToSubmit = {
    ...formData,
    translations: formData.translations  // ✅ Make sure this is included
  };

  await onSubmit(dataToSubmit);
};
```

### Issue: No languages showing

**Solution:** Verify languages are active in the database:
```sql
SELECT * FROM languages WHERE is_active = true;
```

### Issue: Translation indicator always shows red

**Solution:** Check that translations object has the correct structure:
```jsx
// ✅ Correct
{
  "en": { "name": "Product Name" },
  "es": { "name": "Nombre del Producto" }
}

// ❌ Wrong
{
  "name": "Product Name"  // Missing language code
}
```

### Issue: Rich text not rendering

**Solution:** The `richtext` type is a textarea with HTML support. For WYSIWYG editing, integrate a rich text editor like TinyMCE or Quill in a future update.

## Complete Example

Here's a complete example of integrating into a product form:

```jsx
import React, { useState } from 'react';
import TranslationFields, { TranslationHelper } from '@/components/admin/TranslationFields';

export default function ProductForm({ product, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    sku: product?.sku || '',
    price: product?.price || '',
    translations: product?.translations || {}
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Non-translatable fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">SKU *</label>
          <input
            type="text"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price *</label>
          <input
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Translatable fields */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Product Information</h3>
        <TranslationHelper />
        <div className="mt-4">
          <TranslationFields
            translations={formData.translations}
            onChange={(newTranslations) =>
              setFormData({ ...formData, translations: newTranslations })
            }
            fields={[
              {
                name: 'name',
                label: 'Product Name',
                type: 'text',
                required: true,
                placeholder: 'Enter product name'
              },
              {
                name: 'description',
                label: 'Full Description',
                type: 'richtext',
                rows: 8,
                placeholder: 'Enter detailed description'
              },
              {
                name: 'short_description',
                label: 'Short Description',
                type: 'textarea',
                rows: 3,
                placeholder: 'Enter brief summary'
              }
            ]}
          />
        </div>
      </div>

      {/* Form actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Save Product
        </button>
      </div>
    </form>
  );
}
```

## Next Steps

1. Start with the Products form (most important)
2. Then Categories (second most important)
3. Then CMS Pages and Blocks
4. Finally, other entities (Attributes, Custom Options, etc.)

Each integration should take about 15-30 minutes once you're familiar with the pattern.
