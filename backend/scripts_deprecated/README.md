# DainoStore Backend API

A comprehensive Node.js/Express backend API for the DainoStore e-commerce platform.

## Features

- **Complete E-commerce Backend**: Full REST API for products, categories, orders, users, and more
- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Database Models**: Sequelize ORM with PostgreSQL support
- **Entity Management**: 13+ core entities including Products, Categories, Orders, Coupons, etc.
- **Store Multi-tenancy**: Each store owner can only access their own data
- **Security**: Rate limiting, CORS, helmet, input validation
- **Comprehensive API**: RESTful endpoints for all e-commerce operations

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express-validator, Joi
- **Security**: Helmet, CORS, Rate limiting
- **File Upload**: Multer with Sharp for image processing
- **Email**: Nodemailer
- **Payment**: Stripe integration ready

## Quick Start

### 1. Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

### 2. Installation

```bash
# Clone the repository
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=daino_db
# DB_USERNAME=postgres
# DB_PASSWORD=your_password
# JWT_SECRET=your_jwt_secret
```

### 3. Database Setup

```bash
# Create database
createdb daino_db

# Run the server (will auto-sync tables in development)
npm run dev
```

### 4. API Usage

The server will start on `http://localhost:5000`

**Health Check**: `GET /health`

**Authentication**:
- Register: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Get User: `GET /api/auth/me`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### Stores
- `GET /api/stores` - Get user's stores
- `GET /api/stores/:id` - Get store by ID
- `POST /api/stores` - Create new store
- `PUT /api/stores/:id` - Update store
- `DELETE /api/stores/:id` - Delete store

### Products
- `GET /api/products` - Get products (with pagination, search, filters)
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Categories
- `GET /api/categories` - Get categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Orders
- `GET /api/orders` - Get orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id` - Update order

### Coupons
- `GET /api/coupons` - Get coupons
- `GET /api/coupons/:id` - Get coupon by ID
- `POST /api/coupons` - Create new coupon
- `PUT /api/coupons/:id` - Update coupon
- `DELETE /api/coupons/:id` - Delete coupon

### Attributes
- `GET /api/attributes` - Get attributes
- `GET /api/attributes/:id` - Get attribute by ID
- `POST /api/attributes` - Create new attribute
- `PUT /api/attributes/:id` - Update attribute
- `DELETE /api/attributes/:id` - Delete attribute

### CMS Pages
- `GET /api/cms` - Get CMS pages
- `GET /api/cms/:id` - Get CMS page by ID
- `POST /api/cms` - Create new CMS page
- `PUT /api/cms/:id` - Update CMS page
- `DELETE /api/cms/:id` - Delete CMS page

### Shipping Methods
- `GET /api/shipping` - Get shipping methods
- `GET /api/shipping/:id` - Get shipping method by ID
- `POST /api/shipping` - Create new shipping method
- `PUT /api/shipping/:id` - Update shipping method
- `DELETE /api/shipping/:id` - Delete shipping method

### Tax Rules
- `GET /api/tax` - Get tax rules
- `GET /api/tax/:id` - Get tax rule by ID
- `POST /api/tax` - Create new tax rule
- `PUT /api/tax/:id` - Update tax rule
- `DELETE /api/tax/:id` - Delete tax rule

### Delivery Settings
- `GET /api/delivery` - Get delivery settings
- `GET /api/delivery/:id` - Get delivery settings by ID
- `POST /api/delivery` - Create new delivery settings
- `PUT /api/delivery/:id` - Update delivery settings
- `DELETE /api/delivery/:id` - Delete delivery settings

## Database Schema

### Core Entities

1. **Users** - Authentication and user management
2. **Stores** - Multi-tenant store management
3. **Products** - Product catalog with variants, pricing, inventory
4. **Categories** - Hierarchical product categorization
5. **Attributes** - Dynamic product attributes (color, size, etc.)
6. **AttributeSets** - Grouping of attributes
7. **Orders** - Order management with full lifecycle
8. **OrderItems** - Individual items within orders
9. **Coupons** - Discount codes and promotions
10. **CmsPages** - Content management for static pages
11. **Tax** - Tax rules and calculations
12. **ShippingMethods** - Shipping options and rates
13. **DeliverySettings** - Delivery date and time configuration

### Key Features

- **Multi-tenancy**: Store owners can only access their own data
- **Role-based Access**: Admin, store_owner, customer roles
- **Soft Deletes**: Preserved data integrity
- **Audit Trails**: Created/updated timestamps
- **JSON Fields**: Flexible data storage for complex attributes
- **Relationships**: Proper foreign key relationships between entities

## Security

- JWT authentication required for all protected endpoints
- Role-based authorization (admin, store_owner, customer)
- Rate limiting (100 requests per 15 minutes)
- Input validation and sanitization
- CORS protection
- Helmet security headers
- SQL injection prevention via Sequelize ORM

## Development

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start

# Run migrations (if needed)
npm run migrate

# Seed database (if needed)
npm run seed
```

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=daino_db
DB_USERNAME=postgres
DB_PASSWORD=password

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  },
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total": 100,
    "total_pages": 10
  }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    // Validation errors if applicable
  ]
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details