# Creating Plugins for DainoStore

This guide explains how to create plugins for DainoStore. Plugins let you add custom features to your store.

---

## What is a Plugin?

A plugin is a small package that adds new functionality to your store. For example:
- Display custom messages on your homepage
- Add new admin pages
- Create scheduled tasks (like daily reports)
- Add API endpoints

---

## Plugin Location

All plugins live in the `backend/plugins/` folder. Each plugin has its own folder:

```
backend/plugins/
  ├── my-plugin/
  │   ├── manifest.json    <-- Required: Plugin info
  │   └── index.js         <-- Required: Plugin code
  └── another-plugin/
      ├── manifest.json
      └── index.js
```

---

## Required Files

Every plugin needs **2 files**:

### 1. manifest.json

This file describes your plugin. Here's a simple example:

```json
{
  "name": "My First Plugin",
  "slug": "my-first-plugin",
  "version": "1.0.0",
  "description": "A simple plugin that shows a welcome message",
  "author": "Your Name",
  "category": "display"
}
```

**Required fields:**
| Field | Description |
|-------|-------------|
| `name` | Display name of your plugin |
| `slug` | Unique ID (lowercase, use dashes) |
| `version` | Version number (e.g., "1.0.0") |
| `description` | What your plugin does |
| `author` | Your name |
| `category` | One of: `display`, `analytics`, `payment`, `integration` |

### 2. index.js

This file contains your plugin code. It must export a class:

```javascript
class MyFirstPlugin {
  constructor() {
    this.name = 'My First Plugin';
    this.version = '1.0.0';
  }
}

module.exports = MyFirstPlugin;
```

---

## What Can Plugins Do?

### 1. Display Content with Hooks

Hooks let you add content to specific parts of the page.

**manifest.json:**
```json
{
  "name": "Welcome Banner",
  "slug": "welcome-banner",
  "version": "1.0.0",
  "description": "Shows a welcome message",
  "author": "Your Name",
  "category": "display",
  "hooks": {
    "homepage_header": "showWelcome"
  }
}
```

**index.js:**
```javascript
class WelcomeBannerPlugin {
  constructor() {
    this.name = 'Welcome Banner';
  }

  // This method is called when the homepage_header hook fires
  showWelcome(config, context) {
    return `
      <div style="background: #4CAF50; color: white; padding: 20px; text-align: center;">
        <h2>Welcome to our store!</h2>
      </div>
    `;
  }
}

module.exports = WelcomeBannerPlugin;
```

**Available hooks:**
- `homepage_header` - Top of the homepage
- `homepage_content` - Main content area of homepage

---

### 2. Add Configuration Options

Let store owners customize your plugin through the admin panel.

**manifest.json:**
```json
{
  "name": "Custom Message",
  "slug": "custom-message",
  "version": "1.0.0",
  "description": "Display a custom message",
  "author": "Your Name",
  "category": "display",
  "hooks": {
    "homepage_header": "showMessage"
  },
  "configSchema": {
    "properties": {
      "message": {
        "type": "string",
        "default": "Hello!",
        "description": "The message to display"
      },
      "backgroundColor": {
        "type": "string",
        "default": "#ffffff",
        "description": "Background color"
      },
      "showBorder": {
        "type": "boolean",
        "default": false,
        "description": "Show a border around the message"
      }
    }
  }
}
```

**index.js:**
```javascript
class CustomMessagePlugin {
  showMessage(config, context) {
    // config contains the values set by the store owner
    const message = config.message || 'Hello!';
    const bgColor = config.backgroundColor || '#ffffff';
    const border = config.showBorder ? '2px solid #333' : 'none';

    return `
      <div style="background: ${bgColor}; border: ${border}; padding: 20px;">
        ${message}
      </div>
    `;
  }
}

module.exports = CustomMessagePlugin;
```

**Config types you can use:**
| Type | Description | Example |
|------|-------------|---------|
| `string` | Text input | `"Hello World"` |
| `boolean` | On/Off toggle | `true` or `false` |
| `number` | Number input | `42` |

For dropdowns, use `enum`:
```json
{
  "position": {
    "type": "string",
    "enum": ["left", "center", "right"],
    "default": "center",
    "description": "Text alignment"
  }
}
```

---

### 3. Add API Routes

Create custom API endpoints for your plugin.

**manifest.json:**
```json
{
  "name": "My API Plugin",
  "slug": "my-api-plugin",
  "version": "1.0.0",
  "description": "Adds custom API endpoints",
  "author": "Your Name",
  "category": "integration",
  "routes": [
    {
      "path": "/api/plugins/my-api-plugin/hello",
      "method": "GET",
      "handler": "getHello"
    },
    {
      "path": "/api/plugins/my-api-plugin/data",
      "method": "POST",
      "handler": "saveData"
    }
  ]
}
```

**index.js:**
```javascript
class MyApiPlugin {
  getHello(req, res) {
    return { message: 'Hello from my plugin!' };
  }

  saveData(req, res) {
    const data = req.body;
    // Save the data...
    return { success: true };
  }
}

module.exports = MyApiPlugin;
```

---

### 4. Add Admin Menu Items

Add a page to the admin panel.

**manifest.json:**
```json
{
  "name": "My Admin Plugin",
  "slug": "my-admin-plugin",
  "version": "1.0.0",
  "description": "Adds an admin page",
  "author": "Your Name",
  "category": "display",
  "adminNavigation": {
    "enabled": true,
    "label": "My Plugin",
    "icon": "Settings",
    "route": "/admin/my-admin-plugin",
    "order": 100
  }
}
```

---

### 5. Schedule Tasks (Cron Jobs)

Run tasks automatically on a schedule.

**manifest.json:**
```json
{
  "name": "Daily Report",
  "slug": "daily-report",
  "version": "1.0.0",
  "description": "Sends daily reports",
  "author": "Your Name",
  "category": "analytics",
  "cron": [
    {
      "name": "Send Daily Report",
      "schedule": "0 9 * * *",
      "handler": "sendReport",
      "description": "Runs every day at 9:00 AM"
    }
  ]
}
```

**index.js:**
```javascript
class DailyReportPlugin {
  async sendReport() {
    console.log('Sending daily report...');
    // Your report logic here
  }
}

module.exports = DailyReportPlugin;
```

**Common schedules:**
| Schedule | Description |
|----------|-------------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 0 * * 0` | Weekly on Sunday at midnight |

---

## Plugin Lifecycle

Your plugin can respond to these events:

```javascript
class MyPlugin {
  // Called when plugin is enabled
  onEnable() {
    console.log('Plugin enabled!');
  }

  // Called when plugin is disabled
  onDisable() {
    console.log('Plugin disabled!');
  }

  // Called when config changes
  onConfigUpdate(newConfig, oldConfig) {
    console.log('Config changed!', newConfig);
  }
}

module.exports = MyPlugin;
```

---

## Complete Example

Here's a complete plugin with hooks, config, and lifecycle methods:

**backend/plugins/store-announcement/manifest.json:**
```json
{
  "name": "Store Announcement",
  "slug": "store-announcement",
  "version": "1.0.0",
  "description": "Display announcements on your store",
  "author": "Your Name",
  "category": "display",
  "hooks": {
    "homepage_header": "showAnnouncement"
  },
  "configSchema": {
    "properties": {
      "text": {
        "type": "string",
        "default": "Welcome to our store!",
        "description": "Announcement text"
      },
      "bgColor": {
        "type": "string",
        "default": "#4CAF50",
        "description": "Background color"
      },
      "textColor": {
        "type": "string",
        "default": "#ffffff",
        "description": "Text color"
      },
      "enabled": {
        "type": "boolean",
        "default": true,
        "description": "Show the announcement"
      }
    }
  },
  "adminNavigation": {
    "enabled": true,
    "label": "Announcements",
    "icon": "Megaphone",
    "route": "/admin/store-announcement",
    "order": 100
  }
}
```

**backend/plugins/store-announcement/index.js:**
```javascript
class StoreAnnouncementPlugin {
  constructor() {
    this.name = 'Store Announcement';
    this.version = '1.0.0';
  }

  showAnnouncement(config, context) {
    // Don't show if disabled
    if (!config.enabled) {
      return '';
    }

    const text = config.text || 'Welcome!';
    const bgColor = config.bgColor || '#4CAF50';
    const textColor = config.textColor || '#ffffff';

    return `
      <div style="
        background: ${bgColor};
        color: ${textColor};
        padding: 15px;
        text-align: center;
        font-weight: bold;
      ">
        ${this.escapeHTML(text)}
      </div>
    `;
  }

  // Prevent XSS attacks
  escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  onEnable() {
    console.log('Store Announcement plugin enabled');
  }

  onDisable() {
    console.log('Store Announcement plugin disabled');
  }
}

module.exports = StoreAnnouncementPlugin;
```

---

## Tips

1. **Always escape HTML** - Use the `escapeHTML` helper to prevent security issues
2. **Provide defaults** - Always set default values in your config
3. **Use clear names** - Make your plugin slug unique and descriptive
4. **Test locally** - Test your plugin before deploying
5. **Keep it simple** - Start small and add features as needed

---

## Using the CLI Tool

You can create plugins faster using the CLI:

```bash
# Create a new plugin
npx daino-plugin create my-plugin

# Validate your plugin
npx daino-plugin validate ./backend/plugins/my-plugin

# Build for production
npx daino-plugin build
```

---

## Need More Examples?

Check out the example plugins in `backend/plugins/`:
- `hello-world/` - Minimal example
- `hello-world-example/` - Full-featured example with animations
