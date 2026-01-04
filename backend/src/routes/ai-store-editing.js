/**
 * AI Store Editing Routes
 *
 * Provides AI-powered store editing through natural language commands.
 * Uses LLM function calling with GENERIC tools - no custom model training required.
 *
 * ARCHITECTURE:
 * 1. User sends: "Create a 20% off coupon for summer sale"
 * 2. AI receives message + generic tool definitions
 * 3. AI decides: create_record(entity="coupons", data={...})
 * 4. Backend executes tool against existing API
 * 5. AI generates human-readable response
 *
 * The AI uses its intelligence + RAG context to figure out which
 * endpoint to call. No need to maintain 100+ specific tools.
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { storeResolver } = require('../middleware/storeResolver');
const genericApiToolService = require('../services/genericApiToolService');

// All routes require authentication
router.use(authMiddleware);
router.use(storeResolver);

/**
 * POST /api/ai/store-edit
 * Main endpoint for AI-powered store editing
 */
router.post('/store-edit', async (req, res) => {
  try {
    const { message, history = [], modelId } = req.body;
    const storeId = req.storeId;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    console.log('🤖 AI Store Editing Request');
    console.log(`   User: ${userId}, Store: ${storeId}`);
    console.log(`   Message: ${message}`);

    // Get generic tools and system prompt
    const tools = genericApiToolService.getTools();
    const systemPrompt = genericApiToolService.getSystemPrompt();

    // Build conversation messages
    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Execute AI with tools
    const result = await executeAIWithTools({
      messages,
      systemPrompt,
      tools,
      context: { storeId, userId, authToken },
      maxIterations: 10
    });

    console.log(`   ✅ AI Response generated`);
    console.log(`   Tools used: ${result.toolsUsed.length}`);

    res.json({
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      results: result.results
    });

  } catch (error) {
    console.error('❌ AI Store Editing Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'AI processing failed'
    });
  }
});

/**
 * POST /api/ai/store-edit/stream
 * Streaming version for real-time updates (SSE)
 */
router.post('/store-edit/stream', async (req, res) => {
  try {
    const { message, history = [], modelId } = req.body;
    const storeId = req.storeId;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log('🤖 AI Store Editing (Streaming)');
    console.log(`   Message: ${message}`);

    const tools = genericApiToolService.getTools();
    const systemPrompt = genericApiToolService.getSystemPrompt();

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Stream AI response with tool execution
    await streamAIWithTools({
      messages,
      systemPrompt,
      tools,
      context: { storeId, userId, authToken },
      res,
      maxIterations: 10
    });

  } catch (error) {
    console.error('❌ AI Store Editing Stream Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/ai/store-edit/tools
 * Get available tools (for documentation/debugging)
 */
router.get('/store-edit/tools', async (req, res) => {
  try {
    const tools = genericApiToolService.getTools();

    res.json({
      success: true,
      count: tools.length,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/ai/store-edit/execute-tool
 * Directly execute a tool (for testing/debugging)
 */
router.post('/store-edit/execute-tool', async (req, res) => {
  try {
    const { toolName, input } = req.body;
    const storeId = req.storeId;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    if (!toolName) {
      return res.status(400).json({
        success: false,
        message: 'toolName is required'
      });
    }

    const result = await genericApiToolService.executeTool(
      toolName,
      input || {},
      { storeId, userId, authToken }
    );

    res.json({
      success: result.success,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// AI EXECUTION HELPERS
// ============================================

/**
 * Execute AI with tools in a loop
 */
async function executeAIWithTools({ messages, systemPrompt, tools, context, maxIterations = 10 }) {
  // Dynamic import for Anthropic
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();

  let currentMessages = [...messages];
  let allResults = [];
  let toolsUsed = [];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`   🔄 AI Iteration ${iteration}`);

    // Call Claude with tools
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      tools: tools,
      messages: currentMessages
    });

    console.log(`   Stop reason: ${response.stop_reason}`);

    // Check if AI wants to use tools
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`   🔧 Tool: ${toolUse.name}`);

        // Execute the tool
        const result = await genericApiToolService.executeTool(
          toolUse.name,
          toolUse.input,
          context
        );

        toolsUsed.push({
          name: toolUse.name,
          input: toolUse.input,
          success: result.success
        });

        allResults.push({
          tool: toolUse.name,
          result
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      // Add assistant response and tool results to messages
      currentMessages.push({
        role: 'assistant',
        content: response.content
      });

      currentMessages.push({
        role: 'user',
        content: toolResults
      });

    } else {
      // AI is done - extract text response
      const textBlock = response.content.find(block => block.type === 'text');
      const responseText = textBlock?.text || 'Operation completed.';

      return {
        response: responseText,
        toolsUsed,
        results: allResults
      };
    }
  }

  // Max iterations reached
  return {
    response: 'I completed some operations but reached the maximum number of steps. Let me know if you need more help.',
    toolsUsed,
    results: allResults
  };
}

/**
 * Stream AI response with tool execution
 */
async function streamAIWithTools({ messages, systemPrompt, tools, context, res, maxIterations = 10 }) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();

  let currentMessages = [...messages];
  let allResults = [];
  let iteration = 0;

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  while (iteration < maxIterations) {
    iteration++;
    sendEvent('iteration', { number: iteration });

    // Stream the response
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      tools: tools,
      messages: currentMessages
    });

    let currentToolUse = null;
    let toolInput = '';
    let textContent = '';
    let responseContent = [];

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;

        if (block.type === 'tool_use') {
          currentToolUse = { id: block.id, name: block.name };
          toolInput = '';
          sendEvent('tool_start', { tool: block.name });
        }
      }

      if (event.type === 'content_block_delta') {
        const delta = event.delta;

        if (delta.type === 'text_delta') {
          textContent += delta.text;
          sendEvent('text', { text: delta.text });
        } else if (delta.type === 'input_json_delta') {
          toolInput += delta.partial_json;
        }
      }

      if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          // Parse and execute tool
          let parsedInput = {};
          try {
            parsedInput = JSON.parse(toolInput);
          } catch (e) {
            console.error('Failed to parse tool input:', e);
          }

          sendEvent('tool_executing', {
            tool: currentToolUse.name,
            input: parsedInput
          });

          const result = await genericApiToolService.executeTool(
            currentToolUse.name,
            parsedInput,
            context
          );

          sendEvent('tool_result', {
            tool: currentToolUse.name,
            success: result.success,
            message: result.message || (result.success ? 'Success' : 'Failed')
          });

          allResults.push({ tool: currentToolUse.name, result });

          responseContent.push({
            type: 'tool_use',
            id: currentToolUse.id,
            name: currentToolUse.name,
            input: parsedInput
          });

          currentToolUse = null;
        }
      }

      if (event.type === 'message_delta') {
        if (event.delta?.stop_reason === 'end_turn') {
          sendEvent('complete', { results: allResults });
          res.end();
          return;
        }

        if (event.delta?.stop_reason === 'tool_use') {
          // Continue with tool results
          if (textContent) {
            responseContent.unshift({ type: 'text', text: textContent });
          }

          currentMessages.push({
            role: 'assistant',
            content: responseContent
          });

          const toolResults = responseContent
            .filter(c => c.type === 'tool_use')
            .map(c => ({
              type: 'tool_result',
              tool_use_id: c.id,
              content: JSON.stringify(allResults.find(r => r.tool === c.name)?.result || { success: true })
            }));

          currentMessages.push({
            role: 'user',
            content: toolResults
          });

          responseContent = [];
          textContent = '';
        }
      }
    }
  }

  sendEvent('complete', { results: allResults, maxIterationsReached: true });
  res.end();
}

module.exports = router;
