# Shopify Integration for SuprShop

## Overview

This document describes the complete Shopify integration implementation that allows SuprShop users to connect their Shopify stores and import data (products, collections, etc.) through OAuth authentication.

## Components

### 1. Database Components

#### Migration
- `backend/src/database/migrations/create-shopify-oauth-tokens-table.sql`
- Creates `shopify_oauth_tokens` table to store OAuth tokens and shop information

#### Model
- `backend/src/models/ShopifyOAuthToken.js`
- Sequelize model with methods for token management
- Includes validation for Shopify domains
- Methods: `findByStore()`, `findByShopDomain()`, `createOrUpdate()`

### 2. Service Components

#### Main Integration Service
- `backend/src/services/shopify-integration.js`
- Handles OAuth flow (authorization URL generation, token exchange)
- Manages connection testing and status checking
- Includes HMAC verification and state parameter security
- Methods:
  - `getAuthorizationUrl()` - Generate OAuth URL
  - `exchangeCodeForToken()` - Exchange code for access token
  - `testConnection()` - Test API connection
  - `getConnectionStatus()` - Get connection status
  - `disconnect()` - Remove integration

#### API Client
- `backend/src/services/shopify-client.js`
- Low-level Shopify API client with rate limiting
- Supports pagination for large datasets
- Methods for products, collections, customers, orders
- Built-in retry logic for rate limits
- Methods:
  - `getProducts()`, `getAllProducts()` - Product management
  - `getCustomCollections()`, `getSmartCollections()` - Collection management
  - `getCustomers()`, `getOrders()` - Customer and order data

#### Import Service
- `backend/src/services/shopify-import-service.js`
- High-level service for importing Shopify data
- Converts Shopify data to SuprShop format
- Progress tracking and error handling
- Import statistics tracking
- Methods:
  - `importCollections()` - Import Shopify collections as categories
  - `importProducts()` - Import Shopify products
  - `fullImport()` - Import both collections and products

### 3. API Endpoints

#### Routes
- `backend/src/routes/shopify.js`
- Complete REST API for Shopify integration

#### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shopify/auth` | Generate OAuth authorization URL |
| GET | `/api/shopify/callback` | Handle OAuth callback (public) |
| GET | `/api/shopify/status` | Get connection status |
| POST | `/api/shopify/test-connection` | Test connection |
| DELETE | `/api/shopify/disconnect` | Disconnect integration |
| POST | `/api/shopify/import/collections` | Import collections |
| POST | `/api/shopify/import/products` | Import products |
| POST | `/api/shopify/import/full` | Full import |
| GET | `/api/shopify/import/stats` | Get import statistics |
| GET | `/api/shopify/shop-info` | Get connected shop info |

## OAuth Flow

### 1. Authorization
```javascript
GET /api/shopify/auth?shop_domain=your-shop.myshopify.com
// Returns: { auth_url: "https://your-shop.myshopify.com/admin/oauth/authorize?..." }
```

### 2. User Authorization
User visits the auth_url and grants permissions to the SuprShop app

### 3. Callback
```javascript
// Shopify redirects to:
GET /api/shopify/callback?code=...&shop=...&state=...
// System exchanges code for access token and redirects to frontend
```

### 4. Connection Verification
```javascript
POST /api/shopify/test-connection
// Returns: { success: true, data: { shop_name, plan_name, etc. } }
```

## Required Environment Variables

```bash
# Shopify OAuth Configuration
SHOPIFY_CLIENT_ID=your_shopify_app_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_app_client_secret
SHOPIFY_REDIRECT_URI=https://your-backend.com/api/shopify/callback

# Optional - defaults to backend URL + /api/shopify/callback
# SHOPIFY_REDIRECT_URI=https://custom-callback-url.com/callback
```

## Shopify App Configuration

### Required Scopes
The integration requires these Shopify API scopes:
- `read_products` - Access product data
- `read_product_listings` - Access product listings
- `read_inventory` - Access inventory data
- `read_customers` - Access customer data
- `read_orders` - Access order data
- `read_content` - Access content/collections
- And others (see service for full list)

### App Settings
1. **App URL**: Your SuprShop frontend URL
2. **Allowed redirection URLs**: 
   - `https://your-backend.com/api/shopify/callback`
   - `https://your-frontend.com/integrations/shopify/success`
   - `https://your-frontend.com/integrations/shopify/error`

## Data Mapping

### Collections → Categories
- Shopify collections (both custom and smart) map to SuprShop categories
- Collection handle → category slug
- Collection title → category name
- Collection body_html → category description
- Collections are imported as root-level categories (flat structure)

### Products → Products
- Shopify products map directly to SuprShop products
- Product handle → product URL key/SKU
- Product variants consolidated into single product
- Product collections → category associations
- Product images → product image gallery
- Custom attributes from metafields and standard fields

### Attributes
The system automatically creates required attributes:
- `vendor` - Product vendor
- `product_type` - Product type
- `tags` - Product tags
- `barcode` - Product barcode
- Options (`option1`, `option2`, `option3`)

## Usage Examples

### Frontend Integration Example
```javascript
// 1. Initiate OAuth flow
const response = await fetch('/api/shopify/auth?shop_domain=test-shop.myshopify.com', {
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'x-store-id': storeId
  }
});
const { auth_url } = await response.json();

// 2. Redirect user to auth_url
window.location.href = auth_url;

// 3. After OAuth callback, test connection
await fetch('/api/shopify/test-connection', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'x-store-id': storeId
  }
});

// 4. Import data
await fetch('/api/shopify/import/full', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'x-store-id': storeId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dry_run: false,
    product_limit: 100
  })
});
```

### Backend Service Usage
```javascript
const ShopifyImportService = require('./services/shopify-import-service');

const importService = new ShopifyImportService(storeId);
await importService.initialize();

// Import with progress tracking
const result = await importService.fullImport({
  progressCallback: (progress) => {
    console.log(`${progress.stage}: ${progress.current}/${progress.total}`);
  }
});
```

## Security Features

1. **State Parameter**: Cryptographically secure state parameter to prevent CSRF
2. **HMAC Verification**: Verify requests come from Shopify (when configured)
3. **Domain Validation**: Validate Shopify domain format
4. **Token Encryption**: Sensitive data encrypted in database
5. **Rate Limiting**: Built-in rate limiting for API calls
6. **Authentication**: All endpoints require valid user authentication

## Error Handling

The integration includes comprehensive error handling:
- OAuth flow errors redirect to error pages
- API rate limiting with automatic retries
- Import errors tracked in statistics
- Connection status monitoring
- Detailed error logging

## Testing

All components have been tested:
- ✅ Database migration successful
- ✅ Models and associations working
- ✅ Services loading correctly
- ✅ API routes registered and functional
- ✅ OAuth flow components ready

## Future Enhancements

Potential future improvements:
1. **Webhooks**: Real-time sync with Shopify webhooks
2. **Incremental Sync**: Only sync changed data
3. **Product Variants**: Full variant support
4. **Orders Import**: Import order history
5. **Customers Import**: Import customer data
6. **Inventory Sync**: Two-way inventory synchronization

## Support

For issues or questions:
1. Check environment variables are set correctly
2. Verify Shopify app configuration
3. Review server logs for detailed error messages
4. Test with Shopify development store first