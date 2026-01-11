/**
 * AI Chat with Tool Use
 *
 * A cleaner, tool-based approach to AI chat.
 * Instead of static training data, the AI uses tools to dynamically
 * look up information and perform actions.
 */

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { PLATFORM_TOOLS, executeTool } = require('../services/aiTools');
const authMiddleware = require('../middleware/authMiddleware');

const anthropic = new Anthropic();

/**
 * System prompt that explains the platform to Claude
 */
const SYSTEM_PROMPT = `You are the AI assistant for DainoStore, a visual e-commerce platform builder.

ABOUT THE PLATFORM:
- DainoStore is a multi-tenant SaaS e-commerce platform
- Each store has its own database with products, orders, customers, etc.
- Pages use a SLOT-BASED layout system (not raw HTML) - components called "slots"
- Stores can be customized via settings, themes, and plugins

YOUR CAPABILITIES:
You have tools to help users. Use them proactively:

1. **get_platform_knowledge** - For questions about how things work, pricing, features
   - "how much do credits cost" → use this tool with topic "credits"
   - "what models are available" → use this tool with topic "models"
   - "how do translations work" → use this tool with topic "translations"

2. **query_database** - For data questions about the store
   - "how many products do I have" → query products with count
   - "show recent orders" → query orders with list
   - "which products are low stock" → query inventory

3. **get_store_settings** - To check current configuration
   - "what's my primary color" → get theme settings

4. **update_store_setting** - To change settings
   - "change primary color to blue" → update the setting

5. **modify_page_layout** - To change page appearance
   - "hide the SKU on product page" → hide the slot
   - "make the title red" → style the slot

6. **manage_entity** - To create/update/delete things
   - "create a 10% off coupon" → create entity

7. **translate_content** - For translations

IMPORTANT RULES:
1. For ANY question, try to use a tool first to get accurate information
2. NEVER make up information - use tools to look it up
3. For questions about pricing/credits/models - ALWAYS use get_platform_knowledge
4. Be conversational and helpful
5. If a tool returns an error, explain what went wrong and suggest alternatives

When you don't have enough information, ASK the user for clarification rather than guessing.`;

/**
 * POST /api/ai/chat-tools
 * Tool-based AI chat endpoint
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message, conversationHistory = [], storeId } = req.body;
    const userId = req.user.id;
    const resolvedStoreId = req.headers['x-store-id'] || storeId || req.body.store_id;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 AI CHAT WITH TOOLS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Message:', message?.substring(0, 100));
    console.log('🏪 Store ID:', resolvedStoreId);

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message is required'
      });
    }

    // Build messages array from conversation history
    const messages = [];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) { // Last 10 messages
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          });
        }
      }
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // Call Claude with tools
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: PLATFORM_TOOLS,
      messages
    });

    console.log('🔄 Initial response stop_reason:', response.stop_reason);

    // Track tool calls and credits
    const toolCalls = [];
    let totalInputTokens = response.usage?.input_tokens || 0;
    let totalOutputTokens = response.usage?.output_tokens || 0;

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      // Find tool use blocks
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

      console.log(`🔧 Tool calls: ${toolUseBlocks.length}`);

      // Execute each tool and collect results
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        console.log(`   → ${toolUse.name}:`, JSON.stringify(toolUse.input).substring(0, 100));

        const result = await executeTool(toolUse.name, toolUse.input, {
          storeId: resolvedStoreId,
          userId
        });

        toolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          result
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      // Continue conversation with tool results
      messages.push({
        role: 'assistant',
        content: response.content
      });
      messages.push({
        role: 'user',
        content: toolResults
      });

      // Get next response
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: PLATFORM_TOOLS,
        messages
      });

      totalInputTokens += response.usage?.input_tokens || 0;
      totalOutputTokens += response.usage?.output_tokens || 0;

      console.log('🔄 Continued response stop_reason:', response.stop_reason);
    }

    // Extract final text response
    const textBlocks = response.content.filter(block => block.type === 'text');
    const finalResponse = textBlocks.map(block => block.text).join('\n');

    // Calculate credits (approximate)
    const creditsUsed = Math.ceil((totalInputTokens * 3 + totalOutputTokens * 15) / 1000);

    console.log('✅ Response complete');
    console.log(`   Tokens: ${totalInputTokens} in / ${totalOutputTokens} out`);
    console.log(`   Tool calls: ${toolCalls.length}`);
    console.log(`   Credits: ~${creditsUsed}`);

    return res.json({
      success: true,
      message: finalResponse,
      data: {
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          credits: creditsUsed
        }
      },
      creditsDeducted: creditsUsed
    });

  } catch (error) {
    console.error('AI Chat Tools Error:', error);
    return res.status(500).json({
      success: false,
      message: `AI error: ${error.message}`
    });
  }
});

/**
 * GET /api/ai/chat-tools/tools
 * List available tools (for debugging/documentation)
 */
router.get('/tools', (req, res) => {
  res.json({
    success: true,
    tools: PLATFORM_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema.properties
    }))
  });
});

module.exports = router;
