# 🚀 Plugin Creation Guide for Store Owners

## Overview

DainoStore now provides **4 different methods** for store owners to create custom plugins without needing direct access to the codebase. Each method is designed for different skill levels and use cases.

## 🎯 What You Can Create

- **Homepage banners and messages**
- **Custom product displays**
- **Marketing widgets**
- **Store announcements**
- **Custom styling components**
- **Integration widgets**

## 🛠️ Method 1: Web-Based Plugin Builder (Visual Interface)

**Perfect for:** Non-technical store owners who want a visual interface

### How to Use:
1. Go to **Admin Panel → Plugins → Create New Plugin**
2. Select **"Web Builder"** tab
3. Fill out the plugin details:
   - **Name:** "Welcome Banner"
   - **Description:** "Custom welcome message for homepage"
   - **Category:** Display
4. Use the **Visual Builder**:
   - Drag and drop components
   - Set colors, text, and styling
   - Configure where it appears (hooks)
5. **Preview** your plugin in real-time
6. **Save and Enable** for your store

### Example Configuration:
```json
{
  "message": "Welcome to our store!",
  "backgroundColor": "#4a90e2",
  "textColor": "#ffffff",
  "showDiscount": true
}
```

## 📝 Method 2: Code Editor (For Developers)

**Perfect for:** Store owners with coding experience

### How to Use:
1. Go to **Admin Panel → Plugins → Create New Plugin**
2. Select **"Code Editor"** tab
3. Write your plugin code:

```javascript
class MyCustomPlugin {
  constructor() {
    this.name = 'My Custom Plugin';
    this.version = '1.0.0';
  }

  renderHomepageHeader(config, context) {
    const { message, backgroundColor } = config;
    return `
      <div style="background: ${backgroundColor}; padding: 20px;">
        <h2>${message}</h2>
      </div>
    `;
  }
}

module.exports = MyCustomPlugin;
```

4. Define configuration schema
5. Test and save

## 📦 Method 3: ZIP File Upload

**Perfect for:** Store owners who have received plugins from developers

### How to Use:
1. Go to **Admin Panel → Plugins → Create New Plugin**
2. Select **"ZIP Upload"** tab
3. **Upload your ZIP file** containing:
   ```
   my-plugin.zip
   ├── manifest.json
   ├── index.js
   ├── styles.css (optional)
   └── README.md (optional)
   ```
4. System validates the plugin
5. Configure and enable

### Required File Structure:
**manifest.json:**
```json
{
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Custom plugin description",
  "hooks": {
    "homepage_header": "renderHomepageHeader"
  },
  "configSchema": {
    "properties": {
      "message": {
        "type": "string",
        "default": "Hello World"
      }
    }
  }
}
```

## 🤖 Method 4: AI-Powered Plugin Creation

**Perfect for:** Store owners who want to describe what they need

### How to Use:
1. Go to **Admin Panel → Plugins → Create New Plugin**
2. Select **"AI Assistant"** tab
3. **Describe what you want:**
   - "Create a plugin that shows a welcome message with my store logo"
   - "Make a countdown timer for sales"
   - "Add a newsletter signup banner"
4. AI generates the plugin code
5. **Review and customize** the generated plugin
6. Save and enable

### Example AI Prompts:
- *"Create a holiday banner that shows 'Happy Holidays' with snowflake animation"*
- *"Make a plugin that displays our store hours and contact info"*
- *"Build a customer review showcase for the homepage"*

## ⚡ Method 5: CLI Tool (Command Line)

**Perfect for:** Developers and technical users who prefer command-line tools

### Installation:
```bash
npm install -g @daino/plugin-cli
```

### Usage:
```bash
# Create new plugin
daino-plugin create my-awesome-plugin

# Interactive setup
? Plugin name: My Awesome Plugin
? Description: A plugin that does awesome things
? Category: display
? Hooks: homepage_header, product_page

# Generate plugin files
✅ Created plugin structure
✅ Generated manifest.json
✅ Created index.js template
✅ Added configuration schema

# Deploy to store
daino-plugin deploy --store-id your-store-id
```

## 🔧 Plugin Configuration

Once created, all plugins can be configured through the admin panel:

### Configuration Options:
- **Enable/Disable** per store
- **Customize settings** (colors, text, behavior)
- **Choose display locations** (hooks)
- **Preview changes** before going live
- **Schedule activation** (coming soon)

### Available Hooks (Where Plugins Can Appear):
- `homepage_header` - Top of homepage
- `homepage_content` - Main homepage content
- `product_page_header` - Top of product pages
- `product_page_sidebar` - Product page sidebar
- `cart_page_header` - Shopping cart page
- `checkout_header` - Checkout process
- `footer` - Site footer

## 🔒 Security Features

All plugin creation methods include:

- **Code Validation:** Dangerous code patterns are blocked
- **Sandbox Execution:** Plugins run in isolated environment
- **HTML Sanitization:** Prevents XSS attacks
- **Permission System:** Plugins only access what they need
- **Configuration Validation:** Ensures settings are valid
- **Real-time Scanning:** Continuous security monitoring

## 🚀 Getting Started

1. **Choose your method** based on your technical comfort level
2. **Access the Plugin Builder** in your admin panel
3. **Create your first plugin** using any method
4. **Configure it** for your store
5. **Enable and test** on your storefront
6. **Iterate and improve** based on results

## 💡 Tips for Success

- **Start simple** - Create basic plugins first
- **Test thoroughly** - Always preview before enabling
- **Use templates** - Leverage existing examples
- **Ask for help** - Use AI assistant for inspiration
- **Monitor performance** - Check plugin impact on site speed
- **Keep updated** - Regular updates ensure compatibility

## 🆘 Need Help?

- **Documentation:** Full API reference available
- **Community:** Join the DainoStore Plugin Community
- **Support:** Contact support for technical issues
- **Examples:** Browse the plugin marketplace for inspiration

---

**Ready to start building?** Head to your admin panel and create your first plugin today! 🎉