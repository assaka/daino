# Plugin Creation Guide for Store Owners

## 🚀 How Store Owners Can Create Custom Plugins

Store owners have several ways to create custom plugins without accessing the server filesystem:

### Option 1: Web-Based Plugin Builder (Easiest)

#### Step 1: Navigate to Plugin Creator
- Go to **Admin Dashboard** → **Plugins** → **Create New Plugin**
- URL: `/admin/plugins/create`

#### Step 2: Choose Creation Method
- **📝 Visual Builder**: Form-based plugin creation (recommended for beginners)
- **💻 Code Editor**: Direct code editing (for advanced users)
- **🤖 AI Assistant**: Chat with AI to generate plugin (coming soon)
- **📁 Upload ZIP**: Upload pre-built plugin files

#### Step 3: Plugin Configuration
Fill out the plugin details:

```
Plugin Name: Hello World Display
Description: Shows a customizable hello message on the homepage
Category: Display
Hooks: homepage_header (where the plugin runs)
```

#### Step 4: Configure Plugin Settings
```
Message Text: "Welcome to our store!"
Background Color: #e3f2fd
Text Color: #1976d2
Position: Top of page
Show Border: Yes
```

#### Step 5: Write Plugin Code (Visual Builder)
The system generates code based on your configuration:

```javascript
function renderHelloWorld(config, context) {
  const { message, backgroundColor, textColor, position } = config;
  
  return `
    <div style="
      background-color: ${backgroundColor};
      color: ${textColor};
      padding: 15px;
      text-align: center;
      border-radius: 8px;
      margin: 10px 0;
    ">
      <h3>${message}</h3>
      <p>Store: ${context.store.name}</p>
    </div>
  `;
}
```

#### Step 6: Test & Install
- **Preview**: See how it looks on your homepage
- **Test**: Verify it works correctly
- **Install**: Enable for your store

---

### Option 2: Upload Plugin ZIP File

#### Step 1: Create Plugin Structure
Create a folder with these files:
```
my-hello-world-plugin/
├── manifest.json          # Plugin information
├── index.js               # Main plugin code
├── styles.css             # Plugin styles (optional)
└── README.md              # Documentation (optional)
```

#### Step 2: Create manifest.json
```json
{
  "name": "My Hello World Plugin",
  "slug": "my-hello-world",
  "version": "1.0.0",
  "description": "Custom hello world message",
  "author": "Your Name",
  "category": "display",
  "hooks": {
    "homepage_header": "renderHelloWorld"
  },
  "configSchema": {
    "properties": {
      "message": {
        "type": "string",
        "default": "Hello World!",
        "description": "Message to display"
      }
    }
  }
}
```

#### Step 3: Create index.js
```javascript
class MyHelloWorldPlugin {
  renderHelloWorld(config, context) {
    return `
      <div class="hello-world-message" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin: 20px 0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      ">
        <h2 style="margin: 0 0 10px 0; font-size: 2em;">
          ${config.message}
        </h2>
        <p style="margin: 0; opacity: 0.9;">
          Welcome to ${context.store.name}!
        </p>
      </div>
    `;
  }
}

module.exports = MyHelloWorldPlugin;
```

#### Step 4: ZIP and Upload
- Compress folder into `my-hello-world-plugin.zip`
- Go to **Admin** → **Plugins** → **Upload Plugin**
- Drag & drop the ZIP file
- System validates and installs automatically

---

### Option 3: AI-Powered Plugin Creation

#### Step 1: Access AI Plugin Assistant
- Go to **Admin** → **Plugins** → **AI Assistant**
- Or click **"Create with AI"** on any plugin page

#### Step 2: Describe Your Plugin
```
You: "I want a plugin that shows a rotating welcome message 
      with different greetings like 'Hello', 'Welcome', 'Hi there' 
      that changes every 3 seconds on my homepage"

AI: "I'll create a Dynamic Welcome plugin with:
     ✅ Rotating messages every 3 seconds
     ✅ Customizable greeting list
     ✅ Smooth fade transitions
     ✅ Homepage placement options
     ✅ Store name integration
     
     Shall I generate this plugin for you?"
```

#### Step 3: Refine and Customize
```
You: "Yes, but make it show in a nice card design with my brand colors"

AI: "Perfect! I'll add:
     ✅ Card-style design with shadow
     ✅ Brand color integration from your store settings
     ✅ Responsive design for mobile
     ✅ Custom CSS for your theme
     
     Generating your plugin now..."
```

#### Step 4: Review and Install
- AI generates complete plugin code
- Preview shows exactly how it will look
- One-click installation to your store

---

## 🛠️ Plugin Hooks Available

Store owners can hook into these areas:

### Frontend Hooks
- `homepage_header` - Top of homepage
- `homepage_content` - Main homepage content area
- `homepage_footer` - Bottom of homepage  
- `product_page_header` - Top of product pages
- `cart_sidebar` - Shopping cart area
- `checkout_steps` - During checkout process

### Backend Hooks
- `order_created` - When new order is placed
- `product_updated` - When product is modified
- `customer_registered` - New customer signup
- `payment_processed` - After payment completion

## 📊 Plugin Configuration Options

Store owners can make plugins configurable:

```javascript
// In manifest.json
"configSchema": {
  "properties": {
    "message": {
      "type": "string",
      "default": "Hello World!",
      "description": "Welcome message text"
    },
    "showAnimation": {
      "type": "boolean", 
      "default": true,
      "description": "Enable fade-in animation"
    },
    "colors": {
      "type": "object",
      "properties": {
        "background": {"type": "string", "default": "#ffffff"},
        "text": {"type": "string", "default": "#333333"}
      }
    }
  }
}
```

## 🔒 Security & Permissions

All store-created plugins run in a secure sandbox:
- ✅ No filesystem access
- ✅ No database direct access  
- ✅ Limited API permissions
- ✅ Content Security Policy enforced
- ✅ Code validation before installation

## 🎯 Getting Started

**Easiest path for beginners:**
1. Go to `/admin/plugins/create`
2. Choose "Visual Builder"
3. Select "Hello World" template
4. Customize message and colors
5. Click "Create & Install"

**For developers:**
1. Use the Code Editor or CLI tool
2. Full JavaScript/CSS control
3. Advanced hook integration
4. Custom API endpoints

Ready to create your first plugin? Let's get started! 🚀