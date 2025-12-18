# Akeneo PIM Integration

This integration allows you to import categories and products from Akeneo PIM into your DainoStore e-commerce platform.

## Features

- **OAuth2 Authentication**: Secure connection to Akeneo PIM using OAuth2 flow
- **Category Import**: Import hierarchical categories with all metadata
- **Product Import**: Import products with attributes, images, and category assignments
- **Data Mapping**: Flexible mapping system to transform Akeneo data to DainoStore format
- **Batch Processing**: Efficient batch processing for large catalogs
- **Dry Run Mode**: Test imports without making actual changes
- **Error Handling**: Comprehensive error handling and logging
- **Progress Tracking**: Real-time import progress and statistics

## Setup Instructions

### 1. Akeneo PIM Configuration

1. Log into your Akeneo PIM admin panel
2. Go to **System** → **API connections**
3. Create a new connection:
   - **Label**: DainoStore Integration
   - **Flow type**: Other
4. Save the connection and note down:
   - **Client ID**
   - **Secret**
   - **Username**
   - **Password**

### 2. Environment Variables

Add the following environment variables to your backend `.env` file (optional, for convenience):

```bash
AKENEO_BASE_URL=https://your-akeneo-instance.com
AKENEO_CLIENT_ID=your_client_id
AKENEO_CLIENT_SECRET=your_client_secret
AKENEO_USERNAME=your_api_username
AKENEO_PASSWORD=your_api_password
```

### 3. Access the Integration

1. Navigate to your DainoStore admin panel
2. Go to **Store** → **Akeneo Integration**
3. Enter your Akeneo credentials
4. Test the connection
5. Configure import settings
6. Run the import

## API Endpoints

### Test Connection
```bash
POST /api/integrations/akeneo/test-connection
```

### Import Categories
```bash
POST /api/integrations/akeneo/import-categories
```

### Import Products
```bash
POST /api/integrations/akeneo/import-products
```

### Import All
```bash
POST /api/integrations/akeneo/import-all
```

## Data Mapping

### Categories
- `code` → `name` (if labels not available)
- `labels` → `name` (preferred)
- `parent` → `parent_id`
- Hierarchy levels are automatically calculated

### Products
- `identifier` → `sku`
- `family` → `attribute_set_id`
- `categories` → `category_ids`
- `enabled` → `status`
- `values` → `attributes`

### Localization
The integration supports multiple locales. Specify the locale during import to get localized content:
- `en_US` (default)
- `en_GB`
- `fr_FR`
- `de_DE`
- And more...

## Usage Examples

### Frontend (React)
```javascript
import { toast } from 'sonner';
import apiClient from '../api/client';

// Test connection
const testConnection = async () => {
  try {
    const response = await apiClient.post('/integrations/akeneo/test-connection', {
      baseUrl: 'https://your-akeneo.com',
      clientId: 'your_client_id',
      clientSecret: 'your_client_secret',
      username: 'your_username',
      password: 'your_password'
    });
    
    if (response.data.success) {
      toast.success('Connection successful!');
    }
  } catch (error) {
    toast.error('Connection failed');
  }
};

// Import categories
const importCategories = async () => {
  try {
    const response = await apiClient.post('/integrations/akeneo/import-categories', {
      baseUrl: 'https://your-akeneo.com',
      clientId: 'your_client_id',
      clientSecret: 'your_client_secret',
      username: 'your_username',
      password: 'your_password',
      locale: 'en_US',
      dryRun: false
    });
    
    if (response.data.success) {
      toast.success(\`Imported \${response.data.stats.imported} categories\`);
    }
  } catch (error) {
    toast.error('Import failed');
  }
};
```

### Backend (Node.js)
```javascript
const AkeneoIntegration = require('./src/services/akeneo-integration');

const integration = new AkeneoIntegration({
  baseUrl: 'https://your-akeneo.com',
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  username: 'your_username',
  password: 'your_password'
});

// Import everything
const importAll = async (storeId) => {
  try {
    const result = await integration.importAll(storeId, {
      locale: 'en_US',
      dryRun: false
    });
    
    console.log('Import completed:', result);
  } catch (error) {
    console.error('Import failed:', error);
  }
};
```

## Testing

A test script is provided to verify the integration:

```bash
cd backend
node test-akeneo-integration.js
```

Make sure to update the test configuration with your credentials before running.

## Architecture

### Components

1. **AkeneoClient** (`src/services/akeneo-client.js`)
   - Handles OAuth2 authentication
   - Manages API requests with automatic token refresh
   - Provides methods for categories and products endpoints

2. **AkeneoMapping** (`src/services/akeneo-mapping.js`)
   - Transforms Akeneo data structures to DainoStore format
   - Handles localization and attribute mapping
   - Validates transformed data

3. **AkeneoIntegration** (`src/services/akeneo-integration.js`)
   - Main service orchestrating the import process
   - Handles batch processing and progress tracking
   - Manages database operations

4. **API Routes** (`src/routes/integrations.js`)
   - RESTful endpoints for the integration
   - Request validation and error handling
   - Authentication and authorization

5. **Frontend Component** (`src/pages/AkeneoIntegration.jsx`)
   - Admin interface for managing imports
   - Configuration management
   - Real-time progress display

### Security

- OAuth2 authentication with automatic token refresh
- Request validation using express-validator
- Role-based access control (store owners and admins only)
- Secure credential handling

### Performance

- Batch processing for large catalogs
- Pagination handling for API requests
- Efficient database operations with transactions
- Memory-optimized data transformation

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify client ID and secret
   - Check username and password
   - Ensure API user has proper permissions in Akeneo

2. **Connection Timeout**
   - Check network connectivity
   - Verify Akeneo instance URL
   - Check firewall settings

3. **Import Errors**
   - Review error logs in import results
   - Check data validation errors
   - Verify store ID is correct

4. **Missing Data**
   - Check locale settings
   - Verify attribute mappings
   - Review Akeneo data completeness

### Debug Mode

Enable debug mode by setting the environment variable:
```bash
DEBUG=akeneo:*
```

### Support

For issues and support:
1. Check the import results for detailed error messages
2. Review the browser console for frontend errors
3. Check backend logs for API errors
4. Verify Akeneo PIM connectivity and permissions

## Changelog

### v1.0.0
- Initial release
- OAuth2 authentication
- Category and product import
- Data mapping and transformation
- Frontend admin interface
- Batch processing and error handling