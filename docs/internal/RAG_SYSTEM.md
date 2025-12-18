# RAG System Documentation

## Overview

The RAG (Retrieval-Augmented Generation) system provides database-backed context for all AI features in DainoStore. Instead of hardcoded prompts, AI features fetch relevant knowledge from PostgreSQL tables.

---

## 📚 Database Tables

### 1. `ai_context_documents` - Main Knowledge Base

**Purpose:** Core documentation, architecture guides, best practices, tutorials

**When to use:**
- Plugin generation needs architecture knowledge
- Translations need terminology guidelines
- AI Studio needs design principles

**What to look for:**
```javascript
{
  type: 'architecture' | 'api_reference' | 'best_practices' | 'tutorial' | 'reference' | 'capabilities',
  category: 'core' | 'translations' | 'ai-studio' | 'commerce' | 'marketing',
  mode: 'nocode' | 'developer' | 'all',
  priority: 0-100 (higher = more important)
}
```

**Example Query:**
```javascript
const docs = await aiContextService.getRelevantDocuments({
  mode: 'nocode',           // Which builder mode
  category: 'translations', // What feature
  limit: 5                  // How many docs
});
```

---

### 2. `ai_plugin_examples` - Working Code Examples

**Purpose:** Real, working plugin code that AI can reference and adapt

**When to use:**
- User wants to build a similar plugin
- Need to show code structure patterns
- Learning from existing implementations

**What to look for:**
```javascript
{
  category: 'marketing' | 'commerce' | 'analytics' | 'integration' | 'translations',
  complexity: 'simple' | 'intermediate' | 'advanced',
  is_template: true/false,  // Can be used as starting point
  features: ['what it does'],
  use_cases: ['when to use it']
}
```

**Example Query:**
```javascript
const examples = await aiContextService.getRelevantExamples({
  category: 'marketing',
  query: 'banner announcement',
  limit: 3
});
```

---

### 3. `ai_code_patterns` - Reusable Snippets

**Purpose:** Common coding patterns and solutions for specific tasks

**When to use:**
- Need database migration code
- Need API endpoint pattern
- Need validation logic
- Need specific technical solution

**What to look for:**
```javascript
{
  pattern_type: 'database' | 'api' | 'validation' | 'ui_component' | 'email' | 'security',
  framework: 'sequelize' | 'express' | 'react' | null,
  language: 'javascript' | 'sql' | 'css',
  parameters: ['what inputs needed']
}
```

**Example Query:**
```javascript
const patterns = await aiContextService.getRelevantPatterns({
  query: 'database table create migration',
  limit: 5
});
```

---

### 4. `ai_user_preferences` - User Personalization

**Purpose:** Remember user's coding style, preferences, frequently used patterns

**When to use:**
- User has used the system before
- Want to personalize suggestions
- Track favorite patterns

**What to store:**
```javascript
{
  user_id: 123,
  preferred_mode: 'developer',
  coding_style: {
    indentation: 2,
    quotes: 'single',
    semicolons: true
  },
  favorite_patterns: [1, 5, 12],
  recent_plugins: ['wishlist', 'reviews'],
  categories_interest: ['commerce', 'marketing']
}
```

---

### 5. `ai_context_usage` - Analytics

**Purpose:** Track which context was helpful for improving RAG over time

**When to log:**
- After AI generates a plugin
- When user provides feedback
- Track document/example/pattern usage

**What to track:**
```javascript
{
  document_id: 5,           // Which doc was used
  example_id: 2,            // Which example was used
  pattern_id: null,
  query: 'create reviews',  // User's original query
  was_helpful: true,        // Did it help?
  generated_plugin_id: 42   // What was created
}
```

---

## 🔍 When to Use RAG

### Always Use RAG For:

1. **Plugin Generation** (`pluginAIService.js`)
   ```javascript
   const context = await aiContextService.getContextForQuery({
     mode: 'nocode',
     category: 'commerce',
     query: userPrompt,
     storeId: store.id,
     limit: 8
   });
   ```

2. **Translations** (`translation-service.js`)
   ```javascript
   const ragContext = await aiContextService.getContextForQuery({
     mode: 'all',
     category: 'translations',
     query: `translate from ${fromLang} to ${toLang}`,
     limit: 3
   });
   ```

3. **AI Studio** (`ai-studio-service.js`)
   ```javascript
   const ragContext = await aiContextService.getContextForQuery({
     mode: 'all',
     category: 'ai-studio',
     query: `${context} ${message}`,
     limit: 5
   });
   ```

### When NOT to Use RAG:

- ❌ Simple greetings or acknowledgments
- ❌ Error messages
- ❌ Status confirmations
- ❌ Non-AI operations

---

## 📝 What to Look For

### By Use Case:

#### Building a Plugin
**Look for:**
- Documents: `type='architecture'` or `type='api_reference'`
- Examples: `category` matches plugin type
- Patterns: `pattern_type='database'` for data storage, `pattern_type='api'` for endpoints

#### Translating Content
**Look for:**
- Documents: `category='translations'`, `type='best_practices'` or `type='reference'`
- Examples: `category='translations'`
- Patterns: N/A

#### Designing Layouts
**Look for:**
- Documents: `category='ai-studio'`, `type='capabilities'`
- Examples: `category='design'` or `category='ui'`
- Patterns: `pattern_type='ui_component'`

---

## 🎯 How to Query RAG

### Simple Query (Recommended)

```javascript
const context = await aiContextService.getContextForQuery({
  mode: 'nocode',      // Which builder mode
  category: 'core',     // Feature category
  query: userMessage,   // User's input
  storeId: 123,        // Optional: store-specific context
  limit: 5             // How many results
});

// Returns formatted string ready for AI prompt:
// "# KNOWLEDGE BASE\n\n## Document Title\nContent...\n\n# PLUGIN EXAMPLES..."
```

### Advanced Queries

**Get specific document types:**
```javascript
const docs = await aiContextService.getRelevantDocuments({
  mode: 'developer',
  category: 'core',
  limit: 10
});
```

**Get examples by complexity:**
```javascript
const [examples] = await sequelize.query(`
  SELECT * FROM ai_plugin_examples
  WHERE category = :category
  AND complexity = :complexity
  AND is_active = true
  ORDER BY usage_count DESC
  LIMIT :limit
`, {
  replacements: { category: 'commerce', complexity: 'simple', limit: 3 }
});
```

**Get patterns by framework:**
```javascript
const [patterns] = await sequelize.query(`
  SELECT * FROM ai_code_patterns
  WHERE framework = :framework
  AND is_active = true
  ORDER BY usage_count DESC
`, {
  replacements: { framework: 'express' }
});
```

---

## 🚀 Adding New Context

### Add Documentation

```javascript
await aiContextService.addContextDocument({
  type: 'best_practices',
  title: 'SEO Optimization Guide',
  content: 'Detailed markdown content...',
  category: 'marketing',
  tags: ['seo', 'optimization', 'metadata'],
  priority: 85,
  mode: 'all',
  isActive: true
});
```

### Add Plugin Example

```sql
INSERT INTO ai_plugin_examples (name, slug, description, category, complexity, code, files, features, use_cases, tags, is_template)
VALUES (
  'Email Campaigns',
  'email-campaigns',
  'Send newsletters and promotional emails',
  'marketing',
  'intermediate',
  '/* Complete plugin code */',
  '[]'::jsonb,
  '["Email builder", "Template system", "Subscriber management"]'::jsonb,
  '["Send newsletters", "Promotional campaigns", "Automated emails"]'::jsonb,
  '["email", "marketing", "campaigns"]'::jsonb,
  true
);
```

### Add Code Pattern

```sql
INSERT INTO ai_code_patterns (name, pattern_type, description, code, language, framework, parameters, tags)
VALUES (
  'Send Email with Template',
  'email',
  'Send templated emails using Nodemailer',
  '/* Complete code pattern */',
  'javascript',
  'nodemailer',
  '["to", "subject", "template_name", "data"]'::jsonb,
  '["email", "nodemailer", "templates"]'::jsonb
);
```

---

## 🔮 Future: Vector Embeddings

The `embedding_vector` column in all tables is ready for semantic search:

```javascript
// Future implementation:
const embedding = await generateEmbedding(userQuery);

const [results] = await sequelize.query(`
  SELECT *,
    embedding_vector <-> :queryEmbedding as distance
  FROM ai_context_documents
  WHERE is_active = true
  ORDER BY distance
  LIMIT 5
`, {
  replacements: { queryEmbedding: JSON.stringify(embedding) }
});
```

**To enable:**
1. Install pgvector extension in Supabase
2. Generate embeddings using OpenAI/Anthropic API
3. Store as JSON array in `embedding_vector`
4. Use vector similarity operators (`<->`, `<=>`, `<#>`)

---

## 📊 Monitoring RAG Usage

### Track Context Effectiveness

```javascript
await aiContextService.trackContextUsage({
  documentId: 5,
  exampleId: 2,
  userId: 123,
  sessionId: 'abc-def',
  query: 'create wishlist plugin',
  wasHelpful: true,
  generatedPluginId: 42
});
```

### View Usage Analytics

```sql
-- Most helpful documents
SELECT d.title, COUNT(*) as usage_count,
       SUM(CASE WHEN cu.was_helpful THEN 1 ELSE 0 END) as helpful_count
FROM ai_context_documents d
JOIN ai_context_usage cu ON cu.document_id = d.id
GROUP BY d.id, d.title
ORDER BY helpful_count DESC
LIMIT 10;

-- Most referenced examples
SELECT e.name, COUNT(*) as usage_count
FROM ai_plugin_examples e
JOIN ai_context_usage cu ON cu.example_id = e.id
GROUP BY e.id, e.name
ORDER BY usage_count DESC
LIMIT 10;
```

---

## 🛠️ Debugging RAG Queries

### Check What Context Was Fetched

```javascript
const context = await aiContextService.getContextForQuery({
  mode: 'nocode',
  category: 'translations',
  query: 'translate to French',
  limit: 5
});

console.log('=== RAG CONTEXT DEBUG ===');
console.log(context);
console.log('=== END DEBUG ===');
```

### Verify Database Connection

```javascript
const { sequelize } = require('./database/connection');

sequelize.authenticate()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database error:', err));
```

### Test RAG Service

```bash
node backend/src/database/migrations/verify-rag-data.js
```

---

## 📚 Quick Reference

| Feature | Category | Mode | Fetch Limit |
|---------|----------|------|-------------|
| Plugin Builder | `core` | `nocode/developer` | 8 |
| Translations | `translations` | `all` | 3-5 |
| AI Studio | `ai-studio` | `all` | 5 |
| Code Suggestions | `core` | `developer` | 5 |

**Default Priority:**
- 100 = Critical (always include)
- 80-99 = High priority
- 50-79 = Medium priority
- 0-49 = Low priority (rarely used)

---

## 🎓 Best Practices

1. **Always format context** - Use `aiContextService.formatContextForAI()` to convert DB results to AI-readable strings
2. **Limit results** - Don't fetch more than 10 items total (tokens are expensive)
3. **Track usage** - Always log what context was used for analytics
4. **Cache when possible** - aiContextService has built-in caching (5 min TTL)
5. **Category-specific** - Always specify category for better results
6. **Mode-aware** - Use correct mode ('nocode' vs 'developer') for appropriate docs

---

## 🔗 Related Files

- **Service:** `backend/src/services/aiContextService.js`
- **Plugin AI:** `backend/src/services/pluginAIService.js`
- **Translation:** `backend/src/services/translation-service.js`
- **AI Studio:** `backend/src/services/ai-studio-service.js`
- **Migration:** `backend/src/migrations/create-ai-context-tables.sql`
- **Seed Data:** `backend/src/migrations/seeds/20250120_seed_ai_context*.js`
