# Social Media Settings - Consolidated JSON Structure

## Overview

All social media and rich snippet settings are now consolidated into a single `social_media_settings` JSON field in the `seo_settings` table.

## Complete JSON Structure

```json
{
  "social_media_settings": {
    "open_graph": {
      "enabled": true,
      "default_title": "{{store_name}} - Quality Products",
      "default_description": "Discover amazing products at {{store_name}}",
      "default_image_url": "https://example.com/og-image.jpg",
      "facebook_app_id": "1234567890",
      "facebook_page_url": "https://facebook.com/yourstore"
    },
    "twitter": {
      "enabled": true,
      "card_type": "summary_large_image",
      "site_username": "@yourstore",
      "creator_username": "@contentcreator"
    },
    "social_profiles": {
      "facebook": "https://facebook.com/yourstore",
      "twitter": "https://twitter.com/yourstore",
      "instagram": "https://instagram.com/yourstore",
      "linkedin": "https://linkedin.com/company/yourstore",
      "youtube": "https://youtube.com/@yourstore",
      "pinterest": "https://pinterest.com/yourstore",
      "tiktok": "https://tiktok.com/@yourstore",
      "other": [
        "https://custom-social-network.com/yourstore"
      ]
    },
    "schema": {
      "enable_product_schema": true,
      "enable_organization_schema": true,
      "enable_breadcrumb_schema": true,
      "organization_name": "Your Company Name",
      "organization_logo_url": "https://example.com/logo.png",
      "organization_description": "We sell quality products",
      "contact_type": "customer service",
      "contact_telephone": "+1-555-123-4567",
      "contact_email": "support@example.com",
      "price_range": "$$",
      "founded_year": "2020",
      "founder_name": "John Doe"
    }
  }
}
```

## Field Descriptions

### Open Graph Settings (`open_graph`)

Controls how your content appears when shared on Facebook, LinkedIn, and other platforms.

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable/disable Open Graph tags |
| `default_title` | string | Default OG title (supports {{store_name}}, {{page_title}}) |
| `default_description` | string | Default OG description |
| `default_image_url` | string | Default OG image (1200x630px recommended) |
| `facebook_app_id` | string | Facebook App ID for analytics |
| `facebook_page_url` | string | Link to Facebook business page |

### Twitter Card Settings (`twitter`)

Controls how your content appears on Twitter/X.

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable/disable Twitter Cards |
| `card_type` | string | Card type: summary, summary_large_image, app, player |
| `site_username` | string | Twitter handle for the site (@yourstore) |
| `creator_username` | string | Twitter handle for content creator |

### Social Profiles (`social_profiles`)

URLs to your social media profiles (used in Schema.org structured data).

| Field | Type | Description |
|-------|------|-------------|
| `facebook` | string | Facebook profile URL |
| `twitter` | string | Twitter profile URL |
| `instagram` | string | Instagram profile URL |
| `linkedin` | string | LinkedIn company URL |
| `youtube` | string | YouTube channel URL |
| `pinterest` | string | Pinterest profile URL |
| `tiktok` | string | TikTok profile URL |
| `other` | array | Custom social network URLs |

### Schema Markup (`schema`)

Structured data for search engines.

| Field | Type | Description |
|-------|------|-------------|
| `enable_product_schema` | boolean | Enable Product schema markup |
| `enable_organization_schema` | boolean | Enable Organization schema markup |
| `enable_breadcrumb_schema` | boolean | Enable BreadcrumbList schema markup |
| `organization_name` | string | Official organization name |
| `organization_logo_url` | string | Organization logo URL |
| `organization_description` | string | Organization description |
| `contact_type` | string | Contact type (e.g., "customer service") |
| `contact_telephone` | string | Contact phone number |
| `contact_email` | string | Contact email address |
| `price_range` | string | Price range ($, $$, $$$, $$$$) |
| `founded_year` | string | Year organization was founded |
| `founder_name` | string | Founder's name |

## Template Variables

The following template variables can be used in `open_graph.default_title` and `open_graph.default_description`:

- `{{store_name}}` - Your store's name
- `{{page_title}}` - Current page title
- `{{product_name}}` - Product name (on product pages)
- `{{category_name}}` - Category name (on category pages)
- `{{year}}` - Current year

## Example Usage

### Save via API

```javascript
await SeoSetting.update(settingsId, {
  store_id: 'your-store-id',
  social_media_settings: {
    open_graph: {
      enabled: true,
      default_title: '{{store_name}} - Quality Products',
      default_description: 'Shop at {{store_name}}',
      default_image_url: 'https://cdn.example.com/og-image.jpg',
      facebook_app_id: '123456789',
      facebook_page_url: 'https://facebook.com/mystore'
    },
    twitter: {
      enabled: true,
      card_type: 'summary_large_image',
      site_username: '@mystore',
      creator_username: '@john'
    },
    social_profiles: {
      facebook: 'https://facebook.com/mystore',
      twitter: 'https://twitter.com/mystore',
      instagram: 'https://instagram.com/mystore',
      linkedin: 'https://linkedin.com/company/mystore',
      youtube: 'https://youtube.com/@mystore',
      pinterest: 'https://pinterest.com/mystore',
      tiktok: 'https://tiktok.com/@mystore',
      other: []
    },
    schema: {
      enable_product_schema: true,
      enable_organization_schema: true,
      enable_breadcrumb_schema: true,
      organization_name: 'My Store Inc',
      organization_logo_url: 'https://cdn.example.com/logo.png',
      organization_description: 'We sell quality products',
      contact_type: 'customer service',
      contact_telephone: '+1-555-123-4567',
      contact_email: 'support@mystore.com',
      price_range: '$$',
      founded_year: '2020',
      founder_name: 'John Doe'
    }
  }
});
```

### Read from Database

```sql
SELECT social_media_settings FROM seo_settings WHERE store_id = 'your-store-id';
```

### Access in Frontend

```javascript
const { social_media_settings } = seoSettings;

// Open Graph
const ogTitle = social_media_settings.open_graph.default_title;
const ogImage = social_media_settings.open_graph.default_image_url;

// Twitter
const twitterCard = social_media_settings.twitter.card_type;
const twitterSite = social_media_settings.twitter.site_username;

// Social Profiles
const facebookUrl = social_media_settings.social_profiles.facebook;
const instagramUrl = social_media_settings.social_profiles.instagram;

// Schema
const orgName = social_media_settings.schema.organization_name;
const enableProductSchema = social_media_settings.schema.enable_product_schema;
```

## Migration

### Running the Migration

```bash
cd backend
node src/database/migrations/run-consolidate-social-media.js
```

### Migration Steps

1. **Adds new column**: `social_media_settings` JSONB
2. **Migrates data**: Copies from old columns to new consolidated structure
3. **Preserves old columns**: For safety (manual cleanup required)

### Cleanup (After Verification)

Once you've verified the migration worked correctly, you can drop the old columns:

```sql
ALTER TABLE seo_settings DROP COLUMN IF EXISTS open_graph_settings;
ALTER TABLE seo_settings DROP COLUMN IF EXISTS twitter_card_settings;
ALTER TABLE seo_settings DROP COLUMN IF EXISTS social_profiles;
ALTER TABLE seo_settings DROP COLUMN IF EXISTS schema_settings;
```

## Benefits

1. **Single Source of Truth**: All social/schema settings in one place
2. **Easier Management**: Update one JSON field instead of multiple
3. **Better Performance**: Single column read instead of multiple
4. **Extensibility**: Easy to add new social networks or schema fields
5. **Type Safety**: Consistent structure across the application
6. **Versioning**: Can version the entire social media config

## Best Practices

1. **Always validate JSON** before saving
2. **Use template variables** for dynamic content
3. **Test social sharing** with Facebook Debugger and Twitter Card Validator
4. **Keep URLs complete** (not just usernames)
5. **Update all platforms** when changing social handles
6. **Enable schemas** that match your business type
7. **Use high-quality images** (1200x630px for OG, 1200x628px for Twitter)
