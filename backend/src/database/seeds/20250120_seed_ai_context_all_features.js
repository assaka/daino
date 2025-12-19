/**
 * Seed: AI Context for All Features
 * Add context for translations, AI Studio, and other AI features
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // === TRANSLATION CONTEXT ===
    const translationDocuments = [
      {
        type: 'best_practices',
        title: 'Translation Best Practices',
        content: `# Translation Best Practices

## General Guidelines
1. **Maintain context** - Translations should fit the UI context (button, heading, paragraph)
2. **Preserve formatting** - Keep HTML tags, placeholders, variables intact
3. **Cultural adaptation** - Adapt idioms, metaphors, and cultural references
4. **Consistency** - Use consistent terminology across the platform
5. **Tone matching** - Match the tone and formality of the original

## E-commerce Specific
- **Product names**: Often kept in original language or transliterated
- **Brand names**: Never translate unless officially localized
- **SKUs/Codes**: Never translate
- **Measurements**: Convert units appropriately (lb → kg for metric countries)
- **Currency**: Use local currency symbols and formatting

## Technical Guidelines
- **Placeholders**: Preserve {{variable}} and %s patterns
- **HTML**: Keep tags intact: <strong>text</strong>
- **Line breaks**: Preserve \\n patterns
- **Special characters**: Handle RTL languages properly`,
        category: 'translations',
        tags: JSON.stringify(['translation', 'localization', 'best-practices', 'i18n']),
        priority: 100,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        type: 'reference',
        title: 'Common E-commerce Glossary',
        content: `# E-commerce Translation Glossary

## Shopping Terms
- Cart / Shopping Cart = 🛒 (varies by locale)
- Checkout = Process of payment
- Wishlist = Saved items for later
- Add to Cart = Action button
- Buy Now = Immediate purchase action

## Product Terms
- SKU = Stock Keeping Unit (don't translate)
- In Stock = Available
- Out of Stock = Not available
- Pre-order = Order before release
- Backorder = Order when out of stock

## Payment Terms
- Subtotal = Before tax and shipping
- Total = Final amount
- Discount = Price reduction
- Coupon/Promo Code = Discount code
- Tax = Sales tax / VAT

## Shipping Terms
- Shipping = Delivery
- Delivery = Final destination transfer
- Tracking = Order tracking number
- Estimated Delivery = Expected arrival date`,
        category: 'translations',
        tags: JSON.stringify(['glossary', 'terms', 'ecommerce']),
        priority: 90,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        type: 'reference',
        title: 'RTL Language Support',
        content: `# RTL (Right-to-Left) Language Guidelines

## RTL Languages
- Arabic (ar)
- Hebrew (he)
- Persian/Farsi (fa)
- Urdu (ur)

## UI Considerations
1. **Mirror layouts** - Flip horizontal layouts
2. **Text alignment** - Right-align text
3. **Icons** - Mirror directional icons (arrows, chevrons)
4. **Forms** - Labels on the right
5. **Numbers** - Keep left-to-right (123, not ٣٢١)

## CSS Guidelines
\`\`\`css
[dir="rtl"] .element {
  float: right;
  text-align: right;
  margin-right: 0;
  margin-left: 10px;
}
\`\`\`

## Don't Mirror
- Numbers (1234 stays 1234)
- Latin text
- Brand logos
- Video controls
- Mathematical symbols`,
        category: 'translations',
        tags: JSON.stringify(['rtl', 'arabic', 'hebrew', 'ui', 'layout']),
        priority: 80,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    // === AI STUDIO CONTEXT ===
    const aiStudioDocuments = [
      {
        type: 'capabilities',
        title: 'AI Studio - Design Capabilities',
        content: `# AI Studio Design Capabilities

## What AI Studio Can Do
1. **Generate layouts** - Create responsive page layouts
2. **Color schemes** - Generate harmonious color palettes
3. **Component design** - Build custom React components
4. **CSS styling** - Generate Tailwind/CSS code
5. **Theme customization** - Modify existing themes

## Design Principles
- Mobile-first responsive design
- Accessibility (WCAG 2.1 AA)
- Performance optimization
- Brand consistency
- User experience best practices

## Tech Stack
- React components
- Tailwind CSS
- shadcn/ui components
- Lucide icons
- Responsive grid system`,
        category: 'ai-studio',
        tags: JSON.stringify(['design', 'ui', 'layout', 'css']),
        priority: 100,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        type: 'capabilities',
        title: 'AI Studio - Product Management',
        content: `# AI Studio Product Capabilities

## Product Features
1. **Bulk product creation** - Generate multiple products from descriptions
2. **SEO optimization** - Generate meta titles, descriptions, keywords
3. **Product descriptions** - Create compelling, SEO-friendly content
4. **Image optimization** - Suggest alt text and captions
5. **Category suggestions** - Auto-categorize products

## Product Data Structure
- Name (required)
- SKU (unique)
- Description (short & long)
- Price
- Inventory count
- Categories
- Attributes (size, color, etc.)
- Images
- SEO metadata

## Best Practices
- Clear, descriptive titles
- Benefit-focused descriptions
- High-quality images
- Accurate categorization
- Complete attribute data`,
        category: 'ai-studio',
        tags: JSON.stringify(['products', 'catalog', 'seo', 'descriptions']),
        priority: 90,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        type: 'capabilities',
        title: 'AI Studio - Storefront Builder',
        content: `# AI Studio Storefront Capabilities

## Storefront Features
1. **Homepage builder** - Create custom homepage layouts
2. **Product carousels** - Featured products, new arrivals
3. **Navigation menus** - Main nav, mega menus, footer
4. **Promotional banners** - Seasonal campaigns, sales
5. **CMS pages** - About, Contact, Terms, Privacy

## Available Sections
- Hero banners
- Product grids
- Featured collections
- Testimonials
- Newsletter signup
- Social proof
- Trust badges
- Footer sections

## Customization Options
- Layout variations
- Color themes
- Typography
- Spacing
- Animation effects
- Content blocks`,
        category: 'ai-studio',
        tags: JSON.stringify(['storefront', 'homepage', 'layout', 'sections']),
        priority: 85,
        mode: 'all',
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    // === CODE EXAMPLES ===
    const translationExamples = [
      {
        name: 'AI Translation Helper',
        slug: 'ai-translation-helper',
        description: 'Use AI to translate UI labels with context awareness',
        category: 'translations',
        complexity: 'intermediate',
        code: `class TranslationHelper {
  async translateWithContext(text, fromLang, toLang, context = {}) {
    const { type = 'general', location = 'unknown', maxLength } = context;

    const prompt = \`Translate this e-commerce UI text from \${fromLang} to \${toLang}.

Context:
- Type: \${type} (button, heading, label, paragraph)
- Location: \${location} (cart, checkout, product page)
\${maxLength ? \`- Max length: \${maxLength} characters\` : ''}

Text to translate: "\${text}"

Guidelines:
- Preserve HTML tags and placeholders
- Match the tone and formality
- Use e-commerce terminology
- Keep it natural and idiomatic

Translated text:\`;

    const translation = await this.callAI(prompt);
    return translation.trim();
  }
}`,
        files: JSON.stringify([]),
        features: JSON.stringify(['Context-aware translation', 'Length constraints', 'Terminology consistency']),
        use_cases: JSON.stringify(['UI label translation', 'Product description translation', 'Marketing content']),
        tags: JSON.stringify(['translation', 'ai', 'localization', 'context']),
        is_template: true,
        is_active: true,
        rating: 4.8,
        created_at: now,
        updated_at: now
      }
    ];

    // === CODE PATTERNS ===
    const aiPatterns = [
      {
        name: 'Streaming AI Response',
        pattern_type: 'api',
        description: 'Stream AI responses to frontend in real-time',
        code: `// Backend - Streaming AI response
router.post('/ai/chat', async (req, res) => {
  const { message, context } = req.body;

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Get context from database
  const ragContext = await aiContextService.getContextForQuery({
    query: message,
    category: context.type,
    limit: 5
  });

  // Stream response
  const stream = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    system: \`You are a helpful assistant.\\n\\n\${ragContext}\`,
    messages: [{ role: 'user', content: message }],
    stream: true
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      res.write(\`data: \${JSON.stringify({ content: chunk.delta.text })}\\n\\n\`);
    }
  }

  res.write('data: [DONE]\\n\\n');
  res.end();
});`,
        language: 'javascript',
        framework: 'express',
        parameters: JSON.stringify(['message', 'context']),
        example_usage: 'Use for chat interfaces that need real-time AI responses',
        tags: JSON.stringify(['ai', 'streaming', 'sse', 'real-time']),
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'RAG Context Fetching',
        pattern_type: 'database',
        description: 'Fetch relevant context from database for AI prompts',
        code: `// Fetch context optimized for AI prompts
async function getAIContext(query, options = {}) {
  const {
    mode = 'general',
    category = null,
    limit = 5,
    includeExamples = true,
    includePatterns = true
  } = options;

  const context = {};

  // Get relevant documents
  context.documents = await aiContextService.getRelevantDocuments({
    mode,
    category,
    limit
  });

  // Get code examples if needed
  if (includeExamples) {
    context.examples = await aiContextService.getRelevantExamples({
      category,
      query,
      limit: 3
    });
  }

  // Get code patterns if needed
  if (includePatterns) {
    context.patterns = await aiContextService.getRelevantPatterns({
      query,
      limit: 3
    });
  }

  // Format for AI
  return aiContextService.formatContextForAI(context);
}`,
        language: 'javascript',
        framework: null,
        parameters: JSON.stringify(['query', 'options']),
        example_usage: 'Call before every AI request to include relevant context',
        tags: JSON.stringify(['rag', 'context', 'ai', 'database']),
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    // Insert all data
    await queryInterface.bulkInsert('ai_context_documents', [
      ...translationDocuments,
      ...aiStudioDocuments
    ]);

    await queryInterface.bulkInsert('ai_plugin_examples', translationExamples);
    await queryInterface.bulkInsert('ai_code_patterns', aiPatterns);

    console.log('✅ All AI features context seeded successfully');
    console.log(`   - ${translationDocuments.length} translation documents`);
    console.log(`   - ${aiStudioDocuments.length} AI Studio documents`);
    console.log(`   - ${translationExamples.length} translation examples`);
    console.log(`   - ${aiPatterns.length} AI patterns`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('ai_code_patterns', {
      pattern_type: { [Sequelize.Op.in]: ['api'] }
    }, {});
    await queryInterface.bulkDelete('ai_plugin_examples', {
      category: { [Sequelize.Op.in]: ['translations'] }
    }, {});
    await queryInterface.bulkDelete('ai_context_documents', {
      category: { [Sequelize.Op.in]: ['translations', 'ai-studio'] }
    }, {});
    console.log('✅ All features context seed data removed');
  }
};
