# Shopify Integration Setup Guide

## Quick Setup for Testing

To give DainoStore access to your Shopify shop and start importing data, follow these steps:

## Option 1: Using a Private App (Easiest for Testing)

### Step 1: Create a Private App in Your Shopify Store

1. **Log into your Shopify Admin**
   - Go to your store: `https://your-store.myshopify.com/admin`

2. **Navigate to Apps**
   - Click on "Apps" in the left sidebar
   - Scroll down and click "Manage private apps" (or "App and sales channel settings")

3. **Enable Private App Development**
   - If not already enabled, click "Enable private app development"
   - Accept the terms

4. **Create a Private App**
   - Click "Create private app"
   - Enter app name: `DainoStore Integration`
   - Enter your email address

5. **Configure API Permissions**
   - In the "Admin API" section, set these permissions to **Read access**:
     - Products, variants and collections
     - Product listings
     - Inventory
     - Orders (optional)
     - Customers (optional)

6. **Save and Get Credentials**
   - Click "Save"
   - You'll get:
     - **API Key** (use as SHOPIFY_CLIENT_ID)
     - **Password** (use as SHOPIFY_CLIENT_SECRET)
     - **Shared Secret**

### Step 2: Configure DainoStore Backend

Add these to your backend `.env` file:

```bash
# Using Private App credentials
SHOPIFY_CLIENT_ID=your_api_key_here
SHOPIFY_CLIENT_SECRET=your_password_here
SHOPIFY_APP_TYPE=private

# Optional - your shop domain
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
```

### Step 3: Direct Access Token Method (For Private Apps)

Since private apps have permanent access tokens, you can directly save the connection:

```bash
# Add this to your .env
SHOPIFY_ACCESS_TOKEN=your_password_here
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
```

## Option 2: Using Custom App (Production Ready)

### Step 1: Create a Custom App in Shopify

1. **Go to Shopify Admin**
   - Navigate to Settings → Apps and sales channels

2. **Create a Custom App**
   - Click "Develop apps"
   - Click "Create an app"
   - Name it: `DainoStore Integration`

3. **Configure Admin API Scopes**
   - Click "Configure Admin API scopes"
   - Select these scopes:
     ```
     ✓ read_products
     ✓ read_product_listings
     ✓ read_inventory
     ✓ read_price_rules
     ✓ read_collections
     ✓ read_customers (optional)
     ✓ read_orders (optional)
     ```

4. **Install the App**
   - Click "Install app"
   - You'll get an Admin API access token

### Step 2: Configure DainoStore

```bash
# Add to backend .env file
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2024-01
```

## Option 3: Using OAuth (Full Integration)

### Prerequisites
1. **Shopify Partner Account** (free)
   - Sign up at: https://partners.shopify.com

2. **Create an App in Partner Dashboard**
   - Log into Partner Dashboard
   - Apps → Create app
   - Choose "Public app"

### App Configuration

1. **Basic Information**
   - App name: `DainoStore Integration`
   - App URL: `https://your-daino-frontend.com/admin/shopify-integration`

2. **App Setup**
   - Redirect URLs:
     ```
     https://your-backend.com/api/shopify/callback
     https://your-frontend.com/integrations/shopify/success
     https://your-frontend.com/integrations/shopify/error
     ```

3. **Get OAuth Credentials**
   - Client ID: `xxxxxxxxxxxx`
   - Client Secret: `xxxxxxxxxxxx`

4. **Configure DainoStore Backend**
   ```bash
   SHOPIFY_CLIENT_ID=your_client_id
   SHOPIFY_CLIENT_SECRET=your_client_secret
   ```

## Testing the Connection

### For Development/Testing

The easiest way to test is using **Option 1 (Private App)** or **Option 2 (Custom App)** because they provide immediate access without OAuth flow.

### Quick Test Script

Create a file `test-shopify-connection.js` in your backend:

```javascript
const axios = require('axios');

const SHOPIFY_SHOP_DOMAIN = 'your-store.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = 'your-access-token';

async function testConnection() {
  try {
    const response = await axios.get(
      `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Connection successful!');
    console.log('Shop Info:', response.data.shop);
  } catch (error) {
    console.error('❌ Connection failed:', error.response?.data || error.message);
  }
}

testConnection();
```

Run with: `node test-shopify-connection.js`

## For Your Immediate Testing

Since you want to import data into DainoStore quickly, I recommend:

1. **Use Option 2 (Custom App)** - It's the quickest
2. Create a Custom App in your Shopify admin
3. Get the access token
4. Add it to your `.env` file
5. The integration will work immediately

### Environment Variables You Need:

```bash
# Minimum required for testing
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx  # From your Custom App
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2024-01

# Optional but recommended
SHOPIFY_CLIENT_ID=not_needed_for_custom_app
SHOPIFY_CLIENT_SECRET=not_needed_for_custom_app
```

## Import Data via API

Once configured, you can import data using these endpoints:

```bash
# Test connection
curl -X POST http://localhost:5000/api/shopify/test-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-store-id: YOUR_STORE_ID"

# Import collections
curl -X POST http://localhost:5000/api/shopify/import/collections \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-store-id: YOUR_STORE_ID"

# Import products
curl -X POST http://localhost:5000/api/shopify/import/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-store-id: YOUR_STORE_ID" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

## Troubleshooting

### Common Issues:

1. **"401 Unauthorized"**
   - Check your access token is correct
   - Ensure it starts with `shpat_` for custom apps

2. **"Shop domain required"**
   - Add `SHOPIFY_SHOP_DOMAIN` to your .env file

3. **"Invalid API version"**
   - Use a valid version like `2024-01` or `2023-10`

4. **Rate Limiting**
   - The integration handles this automatically
   - For large imports, it will slow down as needed

## Need Help?

- Shopify API Docs: https://shopify.dev/api/admin-rest
- Custom Apps: https://help.shopify.com/en/manual/apps/custom-apps
- Partner Dashboard: https://partners.shopify.com