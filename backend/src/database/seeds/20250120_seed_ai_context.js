/**
 * Seed: Initial AI Context Data
 * Populate the AI context system with architecture docs, examples, and patterns
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // 1. Core Architecture Documents
    const documents = [
      {
        type: 'architecture',
        title: 'DainoStore Plugin Architecture Overview',
        content: `# CATALYST PLUGIN ARCHITECTURE

## Tech Stack
- Backend: Node.js + Express
- Frontend: React + Vite
- Database: PostgreSQL with Sequelize ORM
- NO PHP - This is a JavaScript/Node.js system!
- NO jQuery - Use modern JavaScript/React!

## Plugin Structure
Plugins are ES6 JavaScript classes that extend the base Plugin class or use the Simple Plugin pattern.`,
        category: 'core',
        tags: JSON.stringify(['architecture', 'overview', 'getting-started']),
        priority: 100,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        type: 'api_reference',
        title: 'Plugin Base Class API',
        content: `# Plugin Base Class Reference

## Constructor
\`\`\`javascript
constructor(config = {})
\`\`\`

## Required Static Method
\`\`\`javascript
static getMetadata() {
  return {
    name: 'Plugin Name',
    slug: 'plugin-slug',
    version: '1.0.0',
    description: 'What it does',
    author: 'Author Name',
    category: 'commerce|marketing|analytics|integration',
    dependencies: [],
    permissions: []
  };
}
\`\`\`

## Lifecycle Methods
- \`async install()\` - Run database migrations, initialize
- \`async enable()\` - Register hooks, routes, start services
- \`async disable()\` - Stop services, cleanup
- \`async uninstall()\` - Remove plugin data

## Available Hooks
- \`renderHomepageHeader(config, context)\`
- \`renderHomepageContent(config, context)\`
- \`renderProductPage(config, context)\`
- \`renderCheckout(config, context)\`
- \`renderOrderConfirmation(config, context)\``,
        category: 'core',
        tags: JSON.stringify(['api', 'reference', 'hooks', 'methods']),
        priority: 90,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        type: 'best_practices',
        title: 'Plugin Security Best Practices',
        content: `# Plugin Security Guidelines

1. **Always escape user input** when rendering HTML
2. **Validate all input** from configuration and API requests
3. **Use parameterized queries** with Sequelize to prevent SQL injection
4. **Sanitize file uploads** - check file types and sizes
5. **Rate limit API endpoints** to prevent abuse
6. **Never expose sensitive data** in error messages
7. **Use HTTPS** for all external API calls
8. **Store secrets** in environment variables, not in code`,
        category: 'core',
        tags: JSON.stringify(['security', 'best-practices', 'validation']),
        priority: 80,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        type: 'tutorial',
        title: 'Creating Your First Plugin',
        content: `# Creating Your First Plugin

## Step 1: Choose Your Pattern
- **Simple Plugin**: No database, just renders content
- **Full Plugin**: With database, APIs, complex features

## Step 2: Implement Required Methods
Every plugin needs:
- Constructor
- getMetadata() static method
- At least one render hook

## Step 3: Test Your Plugin
- Enable it in the plugin manager
- View output on the page
- Check for errors in console

## Step 4: Add Features
- Database tables (if needed)
- API endpoints (if needed)
- Configuration options`,
        category: 'core',
        tags: JSON.stringify(['tutorial', 'getting-started', 'beginner']),
        priority: 70,
        mode: 'nocode',
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('ai_context_documents', documents);

    // 2. Plugin Examples
    const examples = [
      {
        name: 'Simple Welcome Banner',
        slug: 'simple-welcome-banner',
        description: 'Display a customizable welcome message on homepage',
        category: 'marketing',
        complexity: 'simple',
        code: `class WelcomeBannerPlugin {
  constructor() {
    this.name = 'Welcome Banner';
    this.version = '1.0.0';
  }

  renderHomepageHeader(config, context) {
    const { message = 'Welcome!', bgColor = '#f0f8ff' } = config;
    return \`
      <div style="padding: 20px; background: \${bgColor}; text-align: center;">
        <h2>\${message}</h2>
        <p>Shop our latest collection at \${context.store.name}</p>
      </div>
    \`;
  }

  onEnable() { console.log('Welcome banner enabled'); }
  onDisable() { console.log('Welcome banner disabled'); }
}

module.exports = WelcomeBannerPlugin;`,
        files: JSON.stringify([]),
        features: JSON.stringify(['HTML rendering', 'Configuration support', 'Context access']),
        use_cases: JSON.stringify(['Simple homepage banners', 'Announcements', 'Marketing messages']),
        tags: JSON.stringify(['simple', 'marketing', 'homepage', 'beginner']),
        is_template: true,
        is_active: true,
        rating: 4.5,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('ai_plugin_examples', examples);

    // 3. Code Patterns
    const patterns = [
      {
        name: 'Database Table Creation',
        pattern_type: 'database',
        description: 'Create a Sequelize migration for a new table',
        code: `async runMigrations() {
  const { DataTypes } = require('sequelize');
  const sequelize = require('../database');

  await sequelize.getQueryInterface().createTable('my_plugin_data', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    store_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    data: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  // Add indexes for performance
  await sequelize.getQueryInterface().addIndex('my_plugin_data', ['store_id']);
}`,
        language: 'javascript',
        framework: 'sequelize',
        parameters: JSON.stringify(['table_name', 'columns']),
        example_usage: 'Use in the install() or runMigrations() method',
        tags: JSON.stringify(['database', 'migration', 'sequelize', 'table']),
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'API Route Registration',
        pattern_type: 'api',
        description: 'Register custom API endpoints for your plugin',
        code: `async registerRoutes() {
  const express = require('express');
  const router = express.Router();

  // POST endpoint example
  router.post('/api/my-plugin/data', async (req, res) => {
    try {
      const { name, value } = req.body;

      // Validation
      if (!name || !value) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      // Save to database
      const result = await this.saveData({ name, value });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Plugin API error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });

  // GET endpoint example
  router.get('/api/my-plugin/data/:id', async (req, res) => {
    try {
      const data = await this.getData(req.params.id);

      if (!data) {
        return res.status(404).json({ error: 'Not found' });
      }

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}`,
        language: 'javascript',
        framework: 'express',
        parameters: JSON.stringify(['route_paths', 'handlers']),
        example_usage: 'Use in the registerRoutes() method',
        tags: JSON.stringify(['api', 'routes', 'express', 'endpoints']),
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'Input Validation and Sanitization',
        pattern_type: 'validation',
        description: 'Validate and sanitize user input safely',
        code: `// Helper function for input validation
validateInput(data, rules) {
  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    // Required check
    if (rule.required && !value) {
      errors.push(\`\${field} is required\`);
      continue;
    }

    // Type check
    if (value && rule.type) {
      const actualType = typeof value;
      if (actualType !== rule.type) {
        errors.push(\`\${field} must be a \${rule.type}\`);
      }
    }

    // String length
    if (value && rule.maxLength && value.length > rule.maxLength) {
      errors.push(\`\${field} must be max \${rule.maxLength} characters\`);
    }

    // Pattern match
    if (value && rule.pattern && !rule.pattern.test(value)) {
      errors.push(\`\${field} has invalid format\`);
    }
  }

  return errors.length > 0 ? errors : null;
}

// Usage example:
const errors = this.validateInput(req.body, {
  email: { required: true, type: 'string', pattern: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ },
  name: { required: true, type: 'string', maxLength: 100 },
  age: { type: 'number' }
});

if (errors) {
  return res.status(400).json({ errors });
}`,
        language: 'javascript',
        framework: null,
        parameters: JSON.stringify(['data', 'validation_rules']),
        example_usage: 'Use in API endpoints before saving data',
        tags: JSON.stringify(['validation', 'security', 'input', 'sanitization']),
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'Safe HTML Rendering',
        pattern_type: 'ui_component',
        description: 'Escape user input when rendering HTML to prevent XSS',
        code: `// Helper function to escape HTML
escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Usage in render methods
renderHomepageHeader(config, context) {
  const safeMessage = this.escapeHtml(config.message || '');
  const safeName = this.escapeHtml(context.store.name);

  return \`
    <div class="plugin-header">
      <h2>\${safeMessage}</h2>
      <p>Welcome to \${safeName}</p>
    </div>
  \`;
}`,
        language: 'javascript',
        framework: null,
        parameters: JSON.stringify(['user_input']),
        example_usage: 'Always use when rendering user-provided content',
        tags: JSON.stringify(['security', 'xss', 'html', 'escaping']),
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('ai_code_patterns', patterns);

    console.log('✅ AI Context data seeded successfully');
    console.log(`   - ${documents.length} context documents`);
    console.log(`   - ${examples.length} plugin examples`);
    console.log(`   - ${patterns.length} code patterns`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('ai_code_patterns', null, {});
    await queryInterface.bulkDelete('ai_plugin_examples', null, {});
    await queryInterface.bulkDelete('ai_context_documents', null, {});
    console.log('✅ AI Context seed data removed');
  }
};
