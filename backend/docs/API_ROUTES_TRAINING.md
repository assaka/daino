# API Routes Training Guide

This document trains the AI on how the platform API routes work, enabling Q&A for developers and admins.

---

## Slot Configurations API

**User Question:** "How do I get the current slot configuration for a page?"

**Answer:** Use the slot configurations API to retrieve page layouts:

### Get Published Configuration (Storefront)
```javascript
GET /api/slot-configurations/published/:storeId/:pageType

// Example:
GET /api/slot-configurations/published/abc-123/product

// Response:
{
  "success": true,
  "data": {
    "id": "config-uuid",
    "configuration": {
      "slots": { ... },
      "metadata": { ... }
    },
    "status": "published",
    "version_number": 5
  }
}
```

### Get Draft Configuration (Editor)
```javascript
GET /api/slot-configurations/draft/:storeId/:pageType

// Example:
GET /api/slot-configurations/draft/abc-123/product

// Returns the user's draft or creates one from published/default config
```

---

**User Question:** "How do I save changes to a page layout?"

**Answer:** Update the draft configuration, then publish:

### 1. Update Draft
```javascript
PUT /api/slot-configurations/draft/:configId
{
  "storeId": "abc-123",
  "configuration": {
    "slots": {
      "product_title": {
        "styles": { "color": "#333", "fontSize": "24px" }
      }
    }
  }
}
```

### 2. Publish Changes
```javascript
POST /api/slot-configurations/publish/:configId
{
  "storeId": "abc-123"
}
```

---

**User Question:** "How do I publish all page changes at once?"

**Answer:** Use the publish-all endpoint:

```javascript
POST /api/slot-configurations/publish-all/:storeId

// Response:
{
  "success": true,
  "data": {
    "publishedCount": 3,
    "published": [
      { "pageType": "product", "id": "uuid-1", "versionNumber": 6 },
      { "pageType": "category", "id": "uuid-2", "versionNumber": 4 },
      { "pageType": "cart", "id": "uuid-3", "versionNumber": 2 }
    ]
  }
}
```

---

**User Question:** "How do I check if there are unpublished changes?"

**Answer:** Use the unpublished-status endpoint:

```javascript
GET /api/slot-configurations/unpublished-status/:storeId

// Response:
{
  "success": true,
  "data": {
    "hasAnyUnpublishedChanges": true,
    "pageTypes": {
      "cart": { "hasDraft": true, "hasUnpublishedChanges": false },
      "product": { "hasDraft": true, "hasUnpublishedChanges": true },
      "category": { "hasDraft": false, "hasUnpublishedChanges": false }
    }
  }
}
```

---

**User Question:** "How do I revert to a previous version?"

**Answer:** Use the revert-draft endpoint to create a draft from a previous version:

```javascript
// 1. Get version history
GET /api/slot-configurations/history/:storeId/:pageType

// 2. Create revert draft
POST /api/slot-configurations/revert-draft/:versionId
{
  "storeId": "abc-123"
}

// 3. Publish the revert draft
POST /api/slot-configurations/publish/:configId
```

---

**User Question:** "How do I reset a page layout to defaults?"

**Answer:** Use the destroy endpoint to delete all versions and start fresh:

```javascript
POST /api/slot-configurations/destroy/:storeId/:pageType

// Response:
{
  "success": true,
  "message": "Layout destroyed successfully. Deleted 5 versions and created fresh draft.",
  "deletedCount": 5
}
```

---

## Store Publishing API

**User Question:** "How do I publish my store?"

**Answer:** Publishing makes your store live and starts billing:

### Check Publishing Status
```javascript
GET /api/store-publishing/:storeId/status

// Response:
{
  "success": true,
  "data": {
    "store": {
      "id": "abc-123",
      "deployment_status": "active",
      "published": false,
      "published_at": null
    },
    "credits": {
      "canPublish": true,
      "estimatedDailyCost": 0.5
    },
    "connections": {
      "supabase": { "connected": true }
    }
  }
}
```

### Publish Store
```javascript
POST /api/store-publishing/:storeId/publish

// This will:
// 1. Deploy to Render if not already deployed
// 2. Set store.published = true
// 3. Start daily credit charges
```

### Unpublish Store
```javascript
POST /api/store-publishing/:storeId/unpublish

// This will:
// 1. Set store.published = false
// 2. Stop daily credit charges
// 3. Keep deployment running (can re-publish instantly)
```

---

**User Question:** "How do I deploy without publishing?"

**Answer:** Use the deploy endpoint for testing before going live:

```javascript
POST /api/store-publishing/:storeId/deploy

// This creates the Render deployment and Supabase project
// But doesn't charge credits (store remains unpublished)
```

---

**User Question:** "How do I view deployment logs?"

**Answer:** Use the deployment-logs endpoint:

```javascript
GET /api/store-publishing/:storeId/deployment-logs?limit=100

// Response:
{
  "success": true,
  "data": {
    "logs": [
      { "timestamp": "2024-...", "message": "Build started", "level": "info" },
      { "timestamp": "2024-...", "message": "Dependencies installed", "level": "info" }
    ]
  }
}
```

---

**User Question:** "How do I check credit usage for publishing?"

**Answer:** Use the credit-usage endpoint:

```javascript
GET /api/store-publishing/:storeId/credit-usage?days=30

// Response:
{
  "success": true,
  "data": {
    "publishing_costs": {
      "total_credits_used": 15.0,
      "usage_count": 30
    }
  }
}
```

---

## Store Settings API

**User Question:** "How do I get store settings?"

**Answer:** Use the stores settings endpoint:

```javascript
GET /api/stores/:storeId/settings

// Response:
{
  "success": true,
  "data": {
    "id": "abc-123",
    "name": "My Store",
    "settings": {
      "theme": {
        "primary_color": "#3b82f6",
        "header_bg_color": "#ffffff"
      },
      "currency": "EUR",
      "locale": "en"
    }
  }
}
```

---

**User Question:** "How do I update store settings?"

**Answer:** Use PUT to update settings (merges with existing):

```javascript
PUT /api/stores/:storeId/settings
{
  "settings": {
    "theme": {
      "primary_color": "#ff0000"
    },
    "enable_guest_checkout": true
  }
}

// The settings are deep-merged, so existing values are preserved
```

---

**User Question:** "How do I apply a theme preset?"

**Answer:** Use the apply-theme-preset endpoint:

```javascript
POST /api/stores/:storeId/apply-theme-preset
{
  "presetName": "modern-dark"
}

// Response:
{
  "success": true,
  "message": "Theme preset 'Modern Dark' applied successfully",
  "data": {
    "store_id": "abc-123",
    "preset_name": "modern-dark",
    "theme_settings": {
      "primary_color": "#6366f1",
      "header_bg_color": "#1f2937"
    }
  }
}
```

---

**User Question:** "What's the difference between master and tenant DB updates?"

**Answer:** Some fields are stored in master DB, others in tenant:

### Master DB Fields (stores table in master)
- `published` - Whether store is live
- `published_at` - When it was published
- `status` - active, pending_database, provisioning, suspended
- `is_active` - Whether store is operational
- `slug` - Store URL slug
- `theme_preset` - Selected theme preset name

### Tenant DB Fields (stores table in tenant)
- `name` - Store display name
- `settings` - JSONB with theme, locale, currency, etc.
- `configurations` - JSONB with page-level settings

When you PATCH /api/stores/:id, the system automatically routes fields to the correct database.

---

## Storefronts API

**User Question:** "How do I create multiple storefronts?"

**Answer:** Use the storefronts API to manage multiple versions of your store:

### List Storefronts
```javascript
GET /api/storefronts?store_id=abc-123

// Response:
{
  "success": true,
  "data": [
    { "id": "sf-1", "name": "Main Store", "slug": "main", "is_primary": true },
    { "id": "sf-2", "name": "Summer Sale", "slug": "summer", "is_primary": false }
  ]
}
```

### Create Storefront
```javascript
POST /api/storefronts
{
  "store_id": "abc-123",
  "name": "Black Friday",
  "slug": "blackfriday",
  "settings_override": {
    "theme": { "primary_color": "#000000" }
  }
}
```

---

**User Question:** "How do I set a storefront as primary?"

**Answer:** Use the set-primary endpoint:

```javascript
POST /api/storefronts/:id/set-primary
{
  "store_id": "abc-123"
}
```

---

**User Question:** "How do I schedule a storefront?"

**Answer:** Use publish_start_at and publish_end_at for scheduled activation:

```javascript
PUT /api/storefronts/:id
{
  "store_id": "abc-123",
  "publish_start_at": "2024-11-29T00:00:00Z",
  "publish_end_at": "2024-12-02T23:59:59Z"
}

// The storefront will automatically activate during Black Friday
// and revert to primary after the date range ends
```

---

## Database Connection API

**User Question:** "How do I connect my Supabase database?"

**Answer:** Use OAuth or manual credentials:

### OAuth Flow (Recommended)
```javascript
// 1. Initiate OAuth
GET /api/database-oauth/supabase/connect/:storeId

// 2. User authorizes in Supabase
// 3. Callback stores tokens

// 4. Connect the database
POST /api/stores/:storeId/connect-database
{
  "useOAuth": true,
  "autoProvision": true,
  "storeName": "My Store",
  "storeSlug": "my-store",
  "themePreset": "default"
}
```

### Manual Credentials
```javascript
POST /api/stores/:storeId/connect-database
{
  "projectUrl": "https://xxx.supabase.co",
  "serviceRoleKey": "eyJ...",
  "anonKey": "eyJ...",
  "connectionString": "postgresql://...",
  "storeName": "My Store",
  "storeSlug": "my-store"
}
```

---

**User Question:** "What happens during database provisioning?"

**Answer:** The system runs migrations and seeds data:

1. **Validates credentials** - Tests the service role key
2. **Checks for duplicates** - Ensures database isn't used by another store
3. **Runs migrations** - Creates all required tables (stores, products, etc.)
4. **Seeds default data** - Creates initial store record with settings
5. **Creates user in tenant** - Copies user from master to tenant DB
6. **Activates store** - Sets status to 'active'

---

**User Question:** "How do I reprovision an empty database?"

**Answer:** If the tenant DB was cleared, use reprovision:

```javascript
POST /api/stores/:storeId/reprovision
{
  "storeName": "My Store",
  "storeSlug": "my-store"
}

// This will:
// 1. Get OAuth token from stored credentials
// 2. Re-run all migrations
// 3. Re-seed default data
// 4. Restore the store to working state
```

---

## Store Health API

**User Question:** "How do I check if my store database is healthy?"

**Answer:** Use the health endpoint:

```javascript
GET /api/stores/:storeId/health

// Healthy response:
{
  "success": true,
  "data": { "status": "healthy" }
}

// Unhealthy response:
{
  "success": true,
  "data": {
    "status": "empty",
    "message": "Store database tables missing",
    "actions": ["provision_database", "remove_store"]
  }
}
```

If unhealthy, the system automatically:
1. Updates store status to 'pending_database'
2. Deletes the store_databases record
3. Clears the connection cache

---

## Common Patterns

### Error Handling
All endpoints return consistent error format:
```javascript
{
  "success": false,
  "error": "Human-readable message",
  "code": "ERROR_CODE",  // Optional
  "details": "..."       // Optional debug info
}
```

### Authentication
Most endpoints require JWT authentication via `authMiddleware`:
```javascript
Authorization: Bearer <jwt_token>
```

### Store ID Required
Most tenant-specific endpoints require `store_id` either:
- In URL params: `/api/stores/:storeId/...`
- In query string: `?store_id=abc-123`
- In request body: `{ "storeId": "abc-123" }`

---

## AI Chat Integration

These APIs are used by the AI chat to help users:

| User Request | API Used |
|-------------|----------|
| "Change header color to blue" | PATCH /api/slot-configurations/:storeId/:pageType/slot/:slotId |
| "Publish my changes" | POST /api/slot-configurations/publish-all/:storeId |
| "What settings are available?" | GET /api/stores/:storeId/settings |
| "Enable guest checkout" | PUT /api/stores/:storeId/settings |
| "Show unpublished changes" | GET /api/slot-configurations/unpublished-status/:storeId |
| "Revert to previous version" | POST /api/slot-configurations/revert-draft/:versionId |
| "Apply dark theme" | POST /api/stores/:storeId/apply-theme-preset |
| "List available themes" | GET /api/public/theme-defaults/presets |
| "Save my theme as preset" | POST /api/theme-defaults |

---

## Theme Presets API

**User Question:** "How do I get available theme presets?"

**Answer:** Use the public theme-defaults endpoints:

### List All Presets
```javascript
GET /api/public/theme-defaults/presets

// Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "preset_name": "default",
      "display_name": "Default Theme",
      "description": "Clean and modern default theme",
      "theme_settings": {
        "primary_color": "#3b82f6",
        "header_bg_color": "#ffffff",
        "font_family": "Inter"
      },
      "is_system_default": true,
      "type": "system"
    },
    {
      "id": 2,
      "preset_name": "modern-dark",
      "display_name": "Modern Dark",
      "theme_settings": { ... },
      "type": "system"
    }
  ]
}
```

### Get Specific Preset
```javascript
GET /api/public/theme-defaults/preset/:presetName

// Example:
GET /api/public/theme-defaults/preset/modern-dark
```

---

**User Question:** "How do I save my current theme as a preset?"

**Answer:** Create a user theme preset:

```javascript
POST /api/theme-defaults
{
  "preset_name": "my-brand-theme",
  "display_name": "My Brand Theme",
  "description": "Custom theme for my brand",
  "theme_settings": {
    "primary_color": "#ff6b00",
    "header_bg_color": "#1a1a1a",
    "font_family": "Poppins"
  }
}

// Response:
{
  "success": true,
  "data": {
    "id": 10,
    "preset_name": "my-brand-theme",
    "type": "user",
    "user_id": "user-uuid"
  },
  "message": "Theme created successfully"
}
```

---

**User Question:** "How do I delete a custom theme?"

**Answer:** Delete user-created themes (cannot delete system themes):

```javascript
DELETE /api/theme-defaults/:id

// Response:
{
  "success": true,
  "message": "Theme deleted successfully"
}

// Error if system theme:
{
  "success": false,
  "message": "Cannot delete system themes"
}
```

---

**User Question:** "What theme settings are available?"

**Answer:** Theme settings include:

| Setting | Description | Example |
|---------|-------------|---------|
| `primary_color` | Primary brand color | `#3b82f6` |
| `secondary_color` | Secondary accent color | `#64748b` |
| `header_bg_color` | Header background | `#ffffff` |
| `footer_bg_color` | Footer background | `#1f2937` |
| `font_family` | Primary font | `Inter` |
| `heading_font_family` | Headings font | `Poppins` |
| `add_to_cart_button_color` | Add to cart button | `#3b82f6` |
| `buy_now_button_color` | Buy now button | `#10b981` |
| `breadcrumb_separator` | Breadcrumb separator | `/` or `>` |
| `breadcrumb_item_text_color` | Breadcrumb text | `#666` |
| `pagination_active_bg_color` | Active page button | `#3b82f6` |
| `link_color` | Link text color | `#2563eb` |
| `link_hover_color` | Link hover color | `#1d4ed8` |

