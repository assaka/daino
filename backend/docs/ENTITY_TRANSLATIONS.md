# Entity Translation Guide

This guide explains how to manage multilingual content for Products, Categories, CMS Pages, and CMS Blocks in DainoStore.

## Overview

Unlike UI labels (which use the `translations` database table), entity translations are stored directly in each entity's `translations` JSON column. This provides better performance and keeps related content together.

### Translation Structure

Each entity has a `translations` JSON column with the following structure:

```json
{
  "en": {
    "name": "Product Name",
    "description": "Product description...",
    "short_description": "Short description"
  },
  "es": {
    "name": "Nombre del Producto",
    "description": "Descripción del producto...",
    "short_description": "Descripción corta"
  },
  "fr": {
    "name": "Nom du Produit",
    "description": "Description du produit...",
    "short_description": "Description courte"
  }
}
```

## Entity Types

### 1. Products

**Fields translated:**
- `name` - Product name
- `description` - Full product description (supports HTML)
- `short_description` - Short product description for listings

**Example:**
```json
{
  "en": {
    "name": "Organic Cotton T-Shirt",
    "description": "<p>Made from 100% organic cotton...</p>",
    "short_description": "Comfortable organic cotton tee"
  },
  "es": {
    "name": "Camiseta de Algodón Orgánico",
    "description": "<p>Hecha de 100% algodón orgánico...</p>",
    "short_description": "Camiseta cómoda de algodón orgánico"
  }
}
```

### 2. Categories

**Fields translated:**
- `name` - Category name
- `description` - Category description (supports HTML)

**Example:**
```json
{
  "en": {
    "name": "Men's Clothing",
    "description": "<p>Browse our collection of men's apparel...</p>"
  },
  "es": {
    "name": "Ropa de Hombre",
    "description": "<p>Explora nuestra colección de ropa masculina...</p>"
  }
}
```

### 3. CMS Pages

**Fields translated:**
- `title` - Page title
- `content` - Page content (supports HTML)

**Example:**
```json
{
  "en": {
    "title": "About Us",
    "content": "<h1>About Our Company</h1><p>We are...</p>"
  },
  "es": {
    "title": "Sobre Nosotros",
    "content": "<h1>Sobre Nuestra Empresa</h1><p>Somos...</p>"
  }
}
```

### 4. CMS Blocks

**Fields translated:**
- `title` - Block title
- `content` - Block content (supports HTML)

**Example:**
```json
{
  "en": {
    "title": "Free Shipping Banner",
    "content": "<div class=\"banner\">Free shipping on orders over $50!</div>"
  },
  "es": {
    "title": "Banner de Envío Gratis",
    "content": "<div class=\"banner\">¡Envío gratis en pedidos superiores a $50!</div>"
  }
}
```

## Translation Workflow

### Step 1: Extract Existing Content

If you have existing entities with content in old columns (name, description, etc.), run the extraction script to migrate to the translations structure:

```bash
cd backend
NODE_ENV=production DATABASE_URL="your_database_url" node scripts/extract-existing-entity-content.js
```

This will:
- Check for old schema columns (name, description, title, content)
- Migrate existing content to `translations.en`
- Skip entities that already have translations

### Step 2: Populate Translations

Use AI to automatically translate all entity content to target languages:

#### Translate Products

```bash
# Translate all products from English to Spanish
NODE_ENV=production DATABASE_URL="your_db_url" OPENAI_API_KEY="your_key" \
  node scripts/populate-entity-translations.js --entity=products --language=es

# Translate to French
NODE_ENV=production DATABASE_URL="your_db_url" OPENAI_API_KEY="your_key" \
  node scripts/populate-entity-translations.js --entity=products --language=fr

# Translate to Arabic (RTL)
NODE_ENV=production DATABASE_URL="your_db_url" OPENAI_API_KEY="your_key" \
  node scripts/populate-entity-translations.js --entity=products --language=ar
```

#### Translate Categories

```bash
NODE_ENV=production DATABASE_URL="your_db_url" OPENAI_API_KEY="your_key" \
  node scripts/populate-entity-translations.js --entity=categories --language=es
```

#### Translate CMS Pages

```bash
NODE_ENV=production DATABASE_URL="your_db_url" OPENAI_API_KEY="your_key" \
  node scripts/populate-entity-translations.js --entity=cms_pages --language=es
```

#### Translate CMS Blocks

```bash
NODE_ENV=production DATABASE_URL="your_db_url" OPENAI_API_KEY="your_key" \
  node scripts/populate-entity-translations.js --entity=cms_blocks --language=es
```

#### Translate All Entities at Once

```bash
NODE_ENV=production DATABASE_URL="your_db_url" OPENAI_API_KEY="your_key" \
  node scripts/populate-entity-translations.js --entity=all --language=es
```

### Step 3: Use Translations in Frontend

#### Using the Translation Context

```jsx
import { useTranslation } from '@/contexts/TranslationContext';

export default function ProductDetails({ product }) {
  const { getEntityTranslation, currentLanguage } = useTranslation();

  // Get translated product name
  const productName = getEntityTranslation(product, 'name', 'en');

  // Get translated description
  const productDescription = getEntityTranslation(product, 'description', 'en');

  return (
    <div>
      <h1>{productName}</h1>
      <div dangerouslySetInnerHTML={{ __html: productDescription }} />
    </div>
  );
}
```

#### Helper Function

The `getEntityTranslation` function automatically:
1. Checks for translation in current language
2. Falls back to English if translation not found
3. Returns empty string if neither exists

**Signature:**
```typescript
getEntityTranslation(entity: Object, field: string, fallbackLang?: string): string
```

**Example with custom fallback:**
```jsx
// Try Spanish first, fall back to English
const name = getEntityTranslation(product, 'name', 'es');
```

## Script Options

### populate-entity-translations.js

**Parameters:**
- `--entity` - Entity type: `products`, `categories`, `cms_pages`, `cms_blocks`, or `all` (default: `products`)
- `--language` - Target language code (default: `es`)
- `--source` - Source language code (default: `en`)
- `--batch` - Batch size for processing (default: `5`)

**Examples:**

```bash
# Translate products from English to German, 10 at a time
node scripts/populate-entity-translations.js \
  --entity=products \
  --language=de \
  --source=en \
  --batch=10

# Translate all entities to Arabic
node scripts/populate-entity-translations.js \
  --entity=all \
  --language=ar

# Translate from Spanish to French (not from English)
node scripts/populate-entity-translations.js \
  --entity=products \
  --source=es \
  --language=fr
```

### extract-existing-entity-content.js

**No parameters needed** - automatically detects and migrates all entities.

```bash
node scripts/extract-existing-entity-content.js
```

## Admin UI Management

### Managing Product Translations

1. Go to `/admin/products`
2. Click "Edit" on a product
3. You'll see translation tabs for each active language
4. Enter content for each language manually
5. Click "Save"

### Managing Category Translations

1. Go to `/admin/categories`
2. Click "Edit" on a category
3. Use translation tabs for each language
4. Save changes

### Managing CMS Page Translations

1. Go to `/admin/cms/pages`
2. Click "Edit" on a page
3. Use translation tabs or JSON editor
4. Save changes

### Managing CMS Block Translations

1. Go to `/admin/cms/blocks`
2. Click "Edit" on a block
3. Use translation tabs
4. Save changes

## API Usage

### Get Product with Translations

```http
GET /api/products/:id
```

Response includes full `translations` object:
```json
{
  "id": "uuid",
  "slug": "organic-tshirt",
  "price": 29.99,
  "translations": {
    "en": {
      "name": "Organic Cotton T-Shirt",
      "description": "<p>Made from 100% organic cotton...</p>",
      "short_description": "Comfortable organic cotton tee"
    },
    "es": {
      "name": "Camiseta de Algodón Orgánico",
      "description": "<p>Hecha de 100% algodón orgánico...</p>",
      "short_description": "Camiseta cómoda de algodón orgánico"
    }
  }
}
```

### Update Product Translations

```http
PUT /api/products/:id
Content-Type: application/json

{
  "translations": {
    "en": {
      "name": "Updated Product Name",
      "description": "Updated description",
      "short_description": "Updated short description"
    },
    "es": {
      "name": "Nombre Actualizado del Producto",
      "description": "Descripción actualizada",
      "short_description": "Descripción corta actualizada"
    }
  }
}
```

### Create Product with Multiple Languages

```http
POST /api/products
Content-Type: application/json

{
  "sku": "PROD-001",
  "price": 29.99,
  "translations": {
    "en": {
      "name": "New Product",
      "description": "Product description",
      "short_description": "Short desc"
    },
    "es": {
      "name": "Nuevo Producto",
      "description": "Descripción del producto",
      "short_description": "Descripción corta"
    }
  },
  "store_id": "uuid"
}
```

## Database Schema

### Products Table

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  slug VARCHAR UNIQUE NOT NULL,
  sku VARCHAR UNIQUE NOT NULL,
  price DECIMAL(10,2),
  -- ... other fields
  translations JSON DEFAULT '{}',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Categories Table

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY,
  slug VARCHAR UNIQUE NOT NULL,
  -- ... other fields
  translations JSON DEFAULT '{}',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### CMS Pages Table

```sql
CREATE TABLE cms_pages (
  id UUID PRIMARY KEY,
  slug VARCHAR UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- ... other fields
  translations JSON DEFAULT '{}',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### CMS Blocks Table

```sql
CREATE TABLE cms_blocks (
  id UUID PRIMARY KEY,
  identifier VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- ... other fields
  translations JSON DEFAULT '{}',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Best Practices

### 1. Always Include English Content

English (`en`) should be your base language. All entities should have at least English content:

```json
{
  "en": {
    "name": "Product Name",
    "description": "..."
  }
}
```

### 2. Preserve HTML Formatting

When translating content with HTML, ensure tags are preserved:

```json
{
  "en": {
    "description": "<p>This is <strong>bold</strong> text</p>"
  },
  "es": {
    "description": "<p>Este es texto en <strong>negrita</strong></p>"
  }
}
```

### 3. Use Consistent Terminology

Maintain brand terms and product names across languages when appropriate:

```json
{
  "en": {
    "name": "iPhone 15 Pro Case"
  },
  "es": {
    "name": "Funda para iPhone 15 Pro"  // Keep "iPhone 15 Pro" unchanged
  }
}
```

### 4. Test with RTL Languages

For Arabic, Hebrew, and other RTL languages, test the UI carefully:

```json
{
  "ar": {
    "name": "اسم المنتج",
    "description": "<p>وصف المنتج...</p>"
  }
}
```

### 5. Handle Missing Translations Gracefully

Always provide fallbacks:

```jsx
const productName = getEntityTranslation(product, 'name', 'en') || 'Untitled Product';
```

## Troubleshooting

### Translation Not Showing

1. **Check database:**
   ```sql
   SELECT slug, translations
   FROM products
   WHERE slug = 'your-product-slug';
   ```

2. **Verify JSON structure:**
   ```json
   {
     "en": { "name": "..." },
     "es": { "name": "..." }
   }
   ```

3. **Check frontend implementation:**
   ```jsx
   const { getEntityTranslation } = useTranslation();
   const name = getEntityTranslation(product, 'name');
   ```

### AI Translation Failed

1. **Check OpenAI API key:**
   ```bash
   echo $OPENAI_API_KEY
   ```

2. **Check API quotas:**
   - Visit OpenAI dashboard
   - Verify you have sufficient credits

3. **Review error logs:**
   - Translation errors are logged to console
   - Original content is preserved on error

### Slow Translation Performance

1. **Adjust batch size:**
   ```bash
   node scripts/populate-entity-translations.js --entity=products --language=es --batch=10
   ```

2. **Rate limiting is built-in:**
   - 500ms delay between translations
   - Prevents API rate limit errors

3. **Translate in stages:**
   ```bash
   # First translate products
   node scripts/populate-entity-translations.js --entity=products --language=es

   # Then categories
   node scripts/populate-entity-translations.js --entity=categories --language=es
   ```

## Examples

### Complete Product Translation Example

```javascript
// Backend - Creating a product with translations
const product = await Product.create({
  sku: 'TSHIRT-001',
  slug: 'organic-cotton-tshirt',
  price: 29.99,
  translations: {
    en: {
      name: 'Organic Cotton T-Shirt',
      description: '<p>Made from 100% certified organic cotton</p>',
      short_description: 'Soft, comfortable organic tee'
    },
    es: {
      name: 'Camiseta de Algodón Orgánico',
      description: '<p>Hecha de 100% algodón orgánico certificado</p>',
      short_description: 'Camiseta orgánica suave y cómoda'
    },
    fr: {
      name: 'T-Shirt en Coton Biologique',
      description: '<p>Fabriqué à partir de coton biologique 100% certifié</p>',
      short_description: 'T-shirt bio doux et confortable'
    }
  },
  store_id: storeId
});
```

```jsx
// Frontend - Displaying translated product
import { useTranslation } from '@/contexts/TranslationContext';

export default function ProductCard({ product }) {
  const { getEntityTranslation, currentLanguage, formatCurrency } = useTranslation();

  return (
    <div className="product-card">
      <h3>{getEntityTranslation(product, 'name', 'en')}</h3>
      <p>{getEntityTranslation(product, 'short_description', 'en')}</p>
      <span className="price">{formatCurrency(product.price, 'USD')}</span>
    </div>
  );
}
```

## Migration from Old Schema

If you're migrating from an old schema with separate columns:

### Before (Old Schema)
```sql
CREATE TABLE products (
  id UUID,
  name VARCHAR,           -- Single language
  description TEXT,       -- Single language
  short_description TEXT  -- Single language
);
```

### After (New Schema)
```sql
CREATE TABLE products (
  id UUID,
  translations JSON  -- Multi-language
);
```

### Migration Script

Run the extraction script to automatically migrate:

```bash
node scripts/extract-existing-entity-content.js
```

This will:
1. Read old columns (name, description, etc.)
2. Create `translations.en` with that content
3. Preserve existing data
4. Skip if translations already exist

Then remove old columns:

```sql
ALTER TABLE products DROP COLUMN IF EXISTS name;
ALTER TABLE products DROP COLUMN IF EXISTS description;
ALTER TABLE products DROP COLUMN IF EXISTS short_description;
```

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [JSON Data Type in PostgreSQL](https://www.postgresql.org/docs/current/datatype-json.html)
- [React Internationalization](https://react.i18next.com/)
- [MDN: Working with JSON](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON)
