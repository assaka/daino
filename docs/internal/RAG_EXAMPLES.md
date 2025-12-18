# RAG Query Examples

This document provides practical, copy-paste examples of how to use the RAG system in different scenarios.

---

## Quick Start

```javascript
const aiContextService = require('./services/aiContextService');

// Basic usage - let RAG fetch everything relevant
const context = await aiContextService.getContextForQuery({
  mode: 'nocode',
  category: 'commerce',
  query: 'user wants to create a wishlist',
  limit: 8
});

// context is now a formatted markdown string ready for AI prompt
console.log(context);
```

---

## Plugin Generation Examples

### Example 1: No-Code User Building a Reviews Plugin

```javascript
// In pluginAIService.js or API endpoint
const aiContextService = require('./aiContextService');

async function generateReviewsPlugin(userPrompt) {
  // Fetch context: architecture docs + review examples + patterns
  const context = await aiContextService.getContextForQuery({
    mode: 'nocode',           // No-code user, so get beginner-friendly docs
    category: 'commerce',     // Commerce category for product reviews
    query: userPrompt,        // "I want customers to leave product reviews"
    limit: 8                  // 5 docs + 3 examples + 5 patterns (splits internally)
  });

  // Use context in AI prompt
  const systemPrompt = `You are a DainoStore plugin builder.

${context}

Generate a plugin based on the user's request.`;

  // ... send to Claude API
}
```

### Example 2: Developer Building a Complex Marketing Plugin

```javascript
async function generateMarketingPlugin(userPrompt, storeId) {
  const context = await aiContextService.getContextForQuery({
    mode: 'developer',        // Developer mode - show advanced patterns
    category: 'marketing',    // Marketing plugins
    query: userPrompt,        // "Build an A/B testing plugin with analytics"
    storeId: storeId,         // Optional: store-specific context
    limit: 10                 // More context for complex features
  });

  // context now includes:
  // - Developer-level architecture docs
  // - Marketing plugin examples
  // - Database/API patterns for analytics

  return context;
}
```

---

## Translation Examples

### Example 3: Translate Product Description

```javascript
// In translation-service.js
const aiContextService = require('./aiContextService');

async function translateProductDescription(text, fromLang, toLang) {
  // Fetch translation context: glossaries + best practices
  const ragContext = await aiContextService.getContextForQuery({
    mode: 'all',                  // Translation guidelines apply to all users
    category: 'translations',     // Translation-specific context
    query: `translate from ${fromLang} to ${toLang}`,
    limit: 3                      // Light context for fast translation
  });

  const systemPrompt = `You are a professional translator.

${ragContext}

Guidelines:
- Preserve HTML tags
- Use e-commerce terminology
- Consider cultural adaptation`;

  // ... send to AI
}
```

### Example 4: Batch Translation with Context

```javascript
async function batchTranslate(texts, fromLang, toLang, type) {
  // Fetch context once for entire batch
  const ragContext = await aiContextService.getContextForQuery({
    mode: 'all',
    category: 'translations',
    query: `batch translate ${type} from ${fromLang} to ${toLang}`,
    limit: 3
  });

  // ragContext includes:
  // - E-commerce glossary for consistent terminology
  // - Best practices for the target language
  // - Special handling for RTL languages if applicable

  // Use same context for all translations in batch
  for (const text of texts) {
    // ... translate with ragContext
  }
}
```

---

## AI Studio Examples

### Example 5: Design Assistance

```javascript
// In ai-studio-service.js
const aiContextService = require('./aiContextService');

async function helpWithDesign(userMessage, capabilities) {
  const ragContext = await aiContextService.getContextForQuery({
    mode: 'all',                  // AI Studio for all users
    category: 'ai-studio',        // AI Studio context
    query: `design ${userMessage}`,
    limit: 5                      // Moderate context for chat
  });

  const systemPrompt = `You are DainoStore AI Studio.

${ragContext}

Available capabilities:
- Generate color schemes
- Create layouts
- Design UI components

Help the user with their design request.`;

  // ragContext includes:
  // - Design capabilities documentation
  // - UI/UX best practices
  // - Example color schemes and layouts
}
```

### Example 6: Product Management

```javascript
async function helpWithProducts(userMessage) {
  const ragContext = await aiContextService.getContextForQuery({
    mode: 'all',
    category: 'ai-studio',
    query: `product management ${userMessage}`,
    limit: 5
  });

  // ragContext includes:
  // - Product management features
  // - Bulk operations guides
  // - SEO optimization tips

  return ragContext;
}
```

---

## Advanced Examples

### Example 7: Get Specific Document Types Only

```javascript
// Only fetch architecture documentation
const architectureDocs = await aiContextService.getRelevantDocuments({
  mode: 'developer',
  category: 'core',
  limit: 10
});

// Returns array of document objects
architectureDocs.forEach(doc => {
  console.log(`${doc.type}: ${doc.title}`);
});
```

### Example 8: Get Plugin Examples by Complexity

```javascript
// Get simple plugin examples for beginners
const simpleExamples = await aiContextService.getRelevantExamples({
  category: 'marketing',
  query: 'banner announcement',
  limit: 3
});

// simpleExamples are sorted by:
// 1. is_template = true (templates first)
// 2. usage_count DESC (most used)
// 3. rating DESC (highest rated)
```

### Example 9: Get Code Patterns for Specific Task

```javascript
// Get database migration patterns
const patterns = await aiContextService.getRelevantPatterns({
  query: 'database table creation migration',
  limit: 5
});

patterns.forEach(pattern => {
  console.log(`${pattern.pattern_type}: ${pattern.name}`);
  console.log(`Framework: ${pattern.framework}`);
  console.log(`Code:\n${pattern.code}`);
});
```

---

## Tracking Usage (Analytics)

### Example 10: Track Context Usage After Plugin Generation

```javascript
async function generateAndTrack(userPrompt, userId, sessionId) {
  // 1. Fetch context
  const context = await aiContextService.getContextForQuery({
    mode: 'nocode',
    category: 'commerce',
    query: userPrompt,
    limit: 8
  });

  // 2. Generate plugin with AI
  const plugin = await generatePlugin(context, userPrompt);

  // 3. Track which context was used
  await aiContextService.trackContextUsage({
    documentId: 5,           // Which doc helped (get from context metadata)
    exampleId: 2,            // Which example was referenced
    userId: userId,
    sessionId: sessionId,
    query: userPrompt,
    wasHelpful: true         // Can add feedback button later
  });

  return plugin;
}
```

### Example 11: Track User Feedback

```javascript
async function savePluginFeedback(pluginId, wasHelpful, contextIds, userId) {
  // User clicked "This was helpful" or "Not helpful"
  for (const contextId of contextIds) {
    await aiContextService.trackContextUsage({
      documentId: contextId.documentId,
      exampleId: contextId.exampleId,
      userId: userId,
      wasHelpful: wasHelpful,
      generatedPluginId: pluginId
    });
  }
}
```

---

## User Preferences

### Example 12: Store User's Preferred Coding Style

```javascript
async function saveUserCodingPreferences(userId, sessionId) {
  await aiContextService.saveUserPreferences({
    userId: userId,
    sessionId: sessionId,
    preferredMode: 'developer',
    codingStyle: {
      indentation: 2,
      quotes: 'single',
      semicolons: true
    },
    favoritePatterns: [1, 5, 12],  // Pattern IDs
    recentPlugins: ['wishlist', 'reviews'],
    categoriesInterest: ['commerce', 'marketing']
  });
}
```

### Example 13: Load User Preferences and Personalize Context

```javascript
async function getPersonalizedContext(userId, sessionId, query) {
  // 1. Load user preferences
  const prefs = await aiContextService.getUserPreferences({
    userId,
    sessionId
  });

  // 2. Use preferences to tailor context
  const context = await aiContextService.getContextForQuery({
    mode: prefs?.preferredMode || 'nocode',
    category: prefs?.categoriesInterest?.[0] || 'core',
    query: query,
    limit: 8
  });

  // 3. Context is now personalized based on user's history
  return context;
}
```

---

## Adding New Context (Admin)

### Example 14: Add a New Documentation Article

```javascript
async function addNewFeatureDoc(title, content) {
  const doc = await aiContextService.addContextDocument({
    type: 'best_practices',
    title: title,
    content: content,             // Markdown supported
    category: 'commerce',
    tags: ['new-feature', 'tutorial'],
    priority: 80,                 // High priority
    mode: 'all',                  // Show to everyone
    isActive: true
  });

  // IMPORTANT: Clear cache to see changes immediately
  aiContextService.clearCache();

  return doc;
}
```

### Example 15: Add Plugin Example from Existing Plugin

```javascript
// When admin marks a plugin as "featured example"
async function addPluginAsExample(pluginCode, pluginMetadata) {
  await sequelize.query(`
    INSERT INTO ai_plugin_examples (
      name, slug, description, category, complexity,
      code, features, use_cases, tags, is_template, is_active
    ) VALUES (
      :name, :slug, :description, :category, :complexity,
      :code, :features, :useCases, :tags, :isTemplate, true
    )
  `, {
    replacements: {
      name: pluginMetadata.name,
      slug: pluginMetadata.slug,
      description: pluginMetadata.description,
      category: pluginMetadata.category,
      complexity: 'intermediate',
      code: pluginCode,
      features: JSON.stringify(pluginMetadata.features),
      useCases: JSON.stringify(pluginMetadata.useCases),
      tags: JSON.stringify(pluginMetadata.tags),
      isTemplate: true
    }
  });

  aiContextService.clearCache();
}
```

---

## Error Handling

### Example 16: Handle RAG Fetch Failures Gracefully

```javascript
async function generatePluginWithFallback(userPrompt) {
  let context = null;

  try {
    // Try to fetch RAG context
    context = await aiContextService.getContextForQuery({
      mode: 'nocode',
      category: 'commerce',
      query: userPrompt,
      limit: 8
    });
  } catch (error) {
    console.error('RAG fetch failed, using fallback:', error);
    // context remains null, getSystemPrompt() will use hardcoded fallback
  }

  // getSystemPrompt handles null context with fallback
  const systemPrompt = await pluginAIService.getSystemPrompt('nocode', context);

  // Continue with generation...
}
```

---

## Debugging

### Example 17: Debug What Context Was Fetched

```javascript
async function debugContext(mode, category, query) {
  const context = await aiContextService.getContextForQuery({
    mode,
    category,
    query,
    limit: 8
  });

  console.log('=== RAG CONTEXT DEBUG ===');
  console.log('Mode:', mode);
  console.log('Category:', category);
  console.log('Query:', query);
  console.log('\n--- FORMATTED CONTEXT ---');
  console.log(context);
  console.log('\n=== END DEBUG ===');

  return context;
}

// Usage:
await debugContext('nocode', 'commerce', 'create wishlist plugin');
```

### Example 18: Verify RAG Data in Database

```javascript
// backend/src/database/migrations/verify-rag-data.js
const { sequelize } = require('../connection');

async function verifyRAGData() {
  const [docs] = await sequelize.query('SELECT type, title, category FROM ai_context_documents');
  const [examples] = await sequelize.query('SELECT name, category FROM ai_plugin_examples');
  const [patterns] = await sequelize.query('SELECT name, pattern_type FROM ai_code_patterns');

  console.log(`Documents: ${docs.length}`);
  console.log(`Examples: ${examples.length}`);
  console.log(`Patterns: ${patterns.length}`);
}
```

---

## Best Practices

### ✅ DO:
- Always use `getContextForQuery()` for simplicity
- Limit to 3-10 items depending on use case
- Track usage for analytics
- Clear cache after adding new content
- Handle RAG fetch errors gracefully

### ❌ DON'T:
- Don't fetch more than 10 items (too expensive)
- Don't skip tracking usage (loses analytics)
- Don't forget to clear cache after updates
- Don't hardcode prompts when RAG is available
- Don't use RAG for simple greetings/errors

---

## Performance Tips

1. **Cache Results**: aiContextService has built-in 5-minute cache
2. **Batch Operations**: Fetch context once, use for multiple operations
3. **Limit Appropriately**:
   - Translations: 3 items
   - AI Studio: 5 items
   - Plugin generation: 8-10 items
4. **Async Operations**: Context fetching is async, don't block

---

## Future: Vector Embeddings

When vector embeddings are enabled:

```javascript
// Will automatically use semantic similarity
const context = await aiContextService.getContextForQuery({
  mode: 'nocode',
  category: 'commerce',
  query: 'users saving items for later',  // Finds "wishlist" examples
  limit: 8
});

// The query "saving items for later" will match "wishlist" via embeddings
// even though the exact word "wishlist" isn't used
```

See `RAG_SYSTEM.md` for vector embeddings setup instructions.
