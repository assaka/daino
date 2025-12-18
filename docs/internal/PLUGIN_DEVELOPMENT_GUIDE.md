# Safe Plugin Development & Installation Guide

## Overview

This guide shows users how to create and install plugins safely without breaking the DainoStore system. We provide multiple approaches for different skill levels.

## 🎯 Three Ways to Create Plugins

### 1. **AI-Generated Plugins** (Easiest - No Coding Required)
### 2. **Template-Based Development** (Intermediate - Some Coding)
### 3. **Custom Development** (Advanced - Full Control)

---

## Method 1: AI-Generated Plugins 🤖

### Step 1: Describe Your Plugin
```
Navigate to: Admin → Plugins → "Generate Plugin"

Example descriptions:
- "Create a loyalty points system that gives customers 1 point per dollar spent"
- "Add SMS notifications when orders are shipped using Twilio"
- "Build a product wishlist feature with email reminders"
- "Create a subscription box management system"
```

### Step 2: AI Generation Process
```javascript
// User input processed by AI
const userInput = "I need a plugin that sends birthday discounts to customers";

// AI analyzes and generates:
{
  "pluginType": "marketing",
  "features": ["birthday tracking", "discount generation", "email automation"],
  "database": ["customer_birthdays", "birthday_campaigns"],
  "integrations": ["email service"],
  "ui": ["birthday settings", "campaign dashboard"]
}

// Complete plugin code generated automatically
```

### Step 3: Review & Install
- Preview generated plugin features
- Customize settings if needed
- Install with one click
- Test in safe environment

---

## Method 2: Template-Based Development 📋

### Step 1: Choose a Template
```bash
# Using DainoStore Plugin CLI
npx @daino/pdk create my-plugin --template=payment-gateway

Available templates:
- payment-gateway
- analytics
- shipping-provider
- marketing-automation
- inventory-management
- customer-service
```

### Step 2: Plugin Structure Created
```
my-plugin/
├── manifest.json          # Plugin metadata
├── index.js              # Main plugin class
├── migrations/           # Database changes
│   └── 001-create-tables.js
├── components/           # React UI components
│   ├── Settings.jsx
│   └── Dashboard.jsx
├── tests/               # Test files
│   └── plugin.test.js
├── README.md           # Documentation
└── package.json        # Dependencies
```

### Step 3: Customize Your Plugin
```javascript
// Example: Custom Payment Plugin
class MyPaymentPlugin extends Plugin {
  static getMetadata() {
    return {
      name: 'My Payment Gateway',
      slug: 'my-payment',
      version: '1.0.0',
      description: 'Custom payment integration',
      author: 'Your Name',
      category: 'payment'
    };
  }

  async processPayment(orderData) {
    // Your custom payment logic
    try {
      const result = await this.callPaymentAPI(orderData);
      return { success: true, transactionId: result.id };
    } catch (error) {
      this.log('error', 'Payment failed', error);
      throw error;
    }
  }

  // Required method - called during plugin installation
  async install() {
    await super.install(); // Runs migrations, sets up DB
    
    // Custom installation logic
    await this.setupWebhooks();
    await this.validateAPIKeys();
  }
}
```

### Step 4: Test Locally
```bash
# Test your plugin
npm run test

# Validate plugin structure
npx @daino/pdk validate

# Start development server with hot reload
npm run dev
```

---

## Method 3: Custom Development 🔧

### Step 1: Clone Starter Template
```bash
git clone https://github.com/daino-plugins/starter-template my-custom-plugin
cd my-custom-plugin
npm install
```

### Step 2: Create Plugin Manifest
```json
{
  "name": "My Custom Plugin",
  "slug": "my-custom-plugin",
  "version": "1.0.0",
  "description": "Detailed description of what this plugin does",
  "author": "Your Name <your.email@example.com>",
  "category": "integration",
  "type": "plugin",
  "main": "index.js",
  "permissions": {
    "database": ["products", "orders"],
    "api": ["external-service"],
    "filesystem": ["uploads/my-plugin"],
    "hooks": ["order.created", "product.updated"]
  },
  "dependencies": {
    "daino": ">=1.0.0",
    "axios": "^1.0.0"
  },
  "config": {
    "apiKey": {
      "type": "string",
      "required": true,
      "description": "API key for external service"
    },
    "webhookUrl": {
      "type": "url",
      "required": false,
      "description": "Webhook endpoint URL"
    }
  }
}
```

### Step 3: Implement Plugin Class
```javascript
const Plugin = require('@daino/plugin-base');
const axios = require('axios');

class MyCustomPlugin extends Plugin {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.webhookUrl = config.webhookUrl;
  }

  static getMetadata() {
    return require('./manifest.json');
  }

  // Plugin lifecycle methods
  async install() {
    console.log('Installing My Custom Plugin...');
    
    // Run database migrations
    await this.runMigrations();
    
    // Set up external integrations
    await this.setupExternalService();
    
    // Validate configuration
    await this.validateConfig();
    
    await super.install();
  }

  async enable() {
    console.log('Enabling My Custom Plugin...');
    
    // Register event hooks
    await this.registerHooks();
    
    // Start background services
    await this.startServices();
    
    await super.enable();
  }

  async disable() {
    console.log('Disabling My Custom Plugin...');
    
    // Stop background services
    await this.stopServices();
    
    // Clean up resources
    await this.cleanup();
    
    await super.disable();
  }

  // Custom plugin methods
  async setupExternalService() {
    if (!this.apiKey) {
      throw new Error('API key is required');
    }
    
    // Test API connection
    try {
      await axios.get('https://api.example.com/health', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
    } catch (error) {
      throw new Error('Failed to connect to external service');
    }
  }

  async registerHooks() {
    // Listen for order events
    this.pluginManager.registerHook('order.created', async (data) => {
      await this.handleNewOrder(data.order);
    });
  }

  async handleNewOrder(order) {
    // Custom business logic
    try {
      await this.sendToExternalService(order);
    } catch (error) {
      this.log('error', 'Failed to process order', error);
    }
  }
}

module.exports = MyCustomPlugin;
```

---

## 🛡️ Safe Installation Process

### Built-in Safety Checks

#### 1. **Pre-Installation Validation**
```javascript
// Automatic checks before installation
const validationResults = {
  manifestValid: true,
  dependenciesSatisfied: true,
  permissionsAcceptable: true,
  securityScanPassed: true,
  codeQualityScore: 85
};

if (validationResults.securityScanPassed && validationResults.codeQualityScore > 70) {
  proceedWithInstallation();
} else {
  showWarningsToUser();
}
```

#### 2. **Sandbox Testing**
```javascript
// Plugin tested in isolated environment first
const sandboxResult = await testPluginInSandbox(plugin);

if (sandboxResult.success) {
  console.log('✅ Plugin passed sandbox testing');
  allowInstallation();
} else {
  console.log('❌ Plugin failed sandbox testing');
  showErrors(sandboxResult.errors);
}
```

#### 3. **Dependency Resolution**
```javascript
// Check all dependencies before installation
const dependencyCheck = await checkDependencies(plugin);

if (dependencyCheck.conflicts.length > 0) {
  showConflictResolution(dependencyCheck.conflicts);
} else {
  proceedWithInstallation();
}
```

### User-Friendly Installation Flow

#### Step 1: Plugin Discovery
```
Sources:
✅ Official DainoStore Plugin Store
✅ GitHub Repositories (validated)
✅ AI-Generated Plugins
✅ Local Development
```

#### Step 2: Safety Overview
```
Before Installation - Safety Report:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 Security Scan:     ✅ PASSED
⚡ Performance:       ✅ GOOD (Score: 85/100)
🔧 Dependencies:      ✅ SATISFIED
⚠️  Permissions:      ⚠️  REQUIRES DATABASE ACCESS
📊 Compatibility:     ✅ COMPATIBLE

Estimated Impact:
• Database tables: +2 new tables
• API endpoints: +5 new routes  
• Memory usage: +15MB estimated
• Startup time: +200ms estimated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Step 3: Installation Options
```
Installation Options:
□ Create backup before installation (Recommended)
□ Install in development mode first
□ Enable monitoring for 24 hours
□ Rollback automatically if errors detected
```

---

## 🔧 Development Tools & CLI

### Plugin Development Kit (PDK)
```bash
# Install global CLI
npm install -g @daino/pdk

# Create new plugin
daino-pdk create my-plugin --template=analytics

# Validate plugin
daino-pdk validate

# Test plugin
daino-pdk test --coverage

# Package for distribution
daino-pdk build

# Publish to store
daino-pdk publish
```

### Local Development Server
```bash
# Start DainoStore with plugin hot-reload
npm run dev:plugins

# Watch for plugin changes
npm run watch:plugins

# Run plugin tests
npm run test:plugins
```

---

## 📋 Plugin Submission Checklist

### Before Publishing
- [ ] Plugin tested in local environment
- [ ] All tests passing (unit + integration)
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Manifest file valid
- [ ] Dependencies declared
- [ ] Error handling implemented
- [ ] Logging properly configured
- [ ] Cleanup methods implemented

### Submission Process
1. **Upload to GitHub** (public repository)
2. **Submit to Plugin Store** (automated review)
3. **Community Testing** (beta testers)
4. **Final Approval** (DainoStore team review)
5. **Publication** (available in store)

---

## 🚨 Common Pitfalls & How to Avoid Them

### 1. **Memory Leaks**
```javascript
// ❌ Bad: Creates memory leak
setInterval(() => {
  processData();
}, 1000);

// ✅ Good: Clean up resources
async disable() {
  if (this.intervalId) {
    clearInterval(this.intervalId);
  }
  await super.disable();
}
```

### 2. **Blocking Operations**
```javascript
// ❌ Bad: Blocks event loop
const result = syncHeavyOperation();

// ✅ Good: Non-blocking
const result = await asyncHeavyOperation();
```

### 3. **Missing Error Handling**
```javascript
// ❌ Bad: Unhandled errors crash system
await externalAPI.call();

// ✅ Good: Proper error handling
try {
  await externalAPI.call();
} catch (error) {
  this.log('error', 'API call failed', error);
  // Graceful degradation
}
```

### 4. **Improper Cleanup**
```javascript
// ✅ Always implement cleanup
async uninstall() {
  // Close database connections
  await this.closeConnections();
  
  // Remove temporary files
  await this.cleanupFiles();
  
  // Unregister hooks
  this.unregisterHooks();
  
  await super.uninstall();
}
```

---

## 🎉 Success! Your Plugin is Ready

Once your plugin passes all checks:
1. **Automatic installation** in safe sandbox
2. **Real-time monitoring** for first 24 hours
3. **Performance metrics** tracking
4. **Easy rollback** if issues arise
5. **Community feedback** collection

This system ensures plugins enhance your store without compromising stability or security!