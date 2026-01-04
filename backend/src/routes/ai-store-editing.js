/**
 * AI Store Editing Routes
 *
 * Provides AI-powered store editing through natural language commands.
 * Uses LLM function calling (tools) - no custom model training required.
 *
 * FLOW:
 * 1. User sends: "Change the product title to green"
 * 2. AI receives message + tool definitions
 * 3. AI calls: update_element_style(element="product-title", styles={color: "green"})
 * 4. Backend executes tool against database
 * 5. Tool result sent back to AI
 * 6. AI generates human-readable response
 * 7. Response + changes sent to frontend
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { storeResolver } = require('../middleware/storeResolver');
const aiProvider = require('../services/ai-provider-service');
const storeEditingService = require('../services/storeEditingService');
const Anthropic = require('@anthropic-ai/sdk');

// All routes require authentication
router.use(authMiddleware);
router.use(storeResolver);

/**
 * POST /api/ai/store-edit
 * Main endpoint for AI-powered store editing
 *
 * Request body:
 * - message: User's natural language command
 * - history: Previous conversation messages (optional)
 * - modelId: AI model to use (optional, defaults to claude-3-5-sonnet)
 *
 * Response:
 * - success: boolean
 * - response: AI's text response
 * - changes: Array of changes made
 * - refreshPreview: Whether frontend should refresh preview
 */
router.post('/store-edit', async (req, res) => {
  try {
    const { message, history = [], modelId } = req.body;
    const storeId = req.storeId;
    const userId = req.user?.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    console.log('🎨 AI Store Editing Request');
    console.log(`   User: ${userId}, Store: ${storeId}`);
    console.log(`   Message: ${message}`);

    // Get tool definitions
    const tools = storeEditingService.getTools();
    const systemPrompt = storeEditingService.getSystemPrompt();

    // Build conversation messages
    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Call AI with tools - this is the main loop
    const result = await executeAIWithTools({
      messages,
      systemPrompt,
      tools,
      storeId,
      maxIterations: 5 // Prevent infinite loops
    });

    console.log(`   ✅ AI Response generated`);
    console.log(`   Changes: ${result.changes.length}`);

    res.json({
      success: true,
      response: result.response,
      changes: result.changes,
      refreshPreview: result.refreshPreview,
      toolsUsed: result.toolsUsed
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
 * Streaming version for real-time updates
 * Uses Server-Sent Events (SSE)
 */
router.post('/store-edit/stream', async (req, res) => {
  try {
    const { message, history = [], modelId } = req.body;
    const storeId = req.storeId;
    const userId = req.user?.id;

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

    console.log('🎨 AI Store Editing (Streaming)');
    console.log(`   Message: ${message}`);

    const tools = storeEditingService.getTools();
    const systemPrompt = storeEditingService.getSystemPrompt();

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Stream AI response with tool execution
    await streamAIWithTools({
      messages,
      systemPrompt,
      tools,
      storeId,
      res,
      maxIterations: 5
    });

  } catch (error) {
    console.error('❌ AI Store Editing Stream Error:', error);

    // Send error event
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/ai/store-edit/tools
 * Get available editing tools (for documentation/UI)
 */
router.get('/store-edit/tools', async (req, res) => {
  try {
    const tools = storeEditingService.getTools();

    res.json({
      success: true,
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
 * Directly execute a tool (for debugging/manual control)
 */
router.post('/store-edit/execute-tool', async (req, res) => {
  try {
    const { toolName, toolInput } = req.body;
    const storeId = req.storeId;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        message: 'toolName is required'
      });
    }

    const result = await storeEditingService.executeTool(toolName, toolInput || {}, storeId);

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
// HELPER FUNCTIONS
// ============================================

/**
 * Execute AI with tools in a loop
 * Handles tool calls and re-invokes AI until complete
 */
async function executeAIWithTools({ messages, systemPrompt, tools, storeId, maxIterations = 5 }) {
  const client = aiProvider.getProvider('anthropic');

  if (!client) {
    throw new Error('Anthropic client not available. Check API key configuration.');
  }

  let currentMessages = [...messages];
  let allChanges = [];
  let toolsUsed = [];
  let refreshPreview = false;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`   🔄 AI Iteration ${iteration}`);

    // Call Claude with tools
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools,
      messages: currentMessages
    });

    console.log(`   Stop reason: ${response.stop_reason}`);

    // Check if AI wants to use tools
    if (response.stop_reason === 'tool_use') {
      // Process all tool uses in this response
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`   🔧 Tool: ${toolUse.name}`);

        // Execute the tool
        const result = await storeEditingService.executeTool(
          toolUse.name,
          toolUse.input,
          storeId
        );

        toolsUsed.push({
          name: toolUse.name,
          input: toolUse.input,
          success: result.success
        });

        if (result.success && result.changes) {
          allChanges.push({
            tool: toolUse.name,
            ...result.changes
          });
        }

        if (result.refreshPreview) {
          refreshPreview = true;
        }

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
      const responseText = textBlock?.text || 'Changes applied successfully.';

      return {
        response: responseText,
        changes: allChanges,
        toolsUsed,
        refreshPreview
      };
    }
  }

  // Max iterations reached
  return {
    response: 'I made some changes but reached the maximum number of operations. Let me know if you need more adjustments.',
    changes: allChanges,
    toolsUsed,
    refreshPreview
  };
}

/**
 * Stream AI response with tool execution
 * Sends events as they happen for real-time UI updates
 */
async function streamAIWithTools({ messages, systemPrompt, tools, storeId, res, maxIterations = 5 }) {
  const client = aiProvider.getProvider('anthropic');

  if (!client) {
    throw new Error('Anthropic client not available.');
  }

  let currentMessages = [...messages];
  let allChanges = [];
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
      max_tokens: 4096,
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
          currentToolUse = {
            id: block.id,
            name: block.name
          };
          toolInput = '';
          sendEvent('tool_start', { tool: block.name });
        } else if (block.type === 'text') {
          sendEvent('text_start', {});
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
          // Parse tool input and execute
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

          // Execute the tool
          const result = await storeEditingService.executeTool(
            currentToolUse.name,
            parsedInput,
            storeId
          );

          sendEvent('tool_result', {
            tool: currentToolUse.name,
            success: result.success,
            message: result.message
          });

          if (result.success && result.changes) {
            allChanges.push({
              tool: currentToolUse.name,
              ...result.changes
            });
          }

          if (result.refreshPreview) {
            sendEvent('refresh_preview', {});
          }

          // Store for continuing conversation
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
          // AI is done
          sendEvent('complete', {
            changes: allChanges,
            refreshPreview: allChanges.some(c => c.refreshPreview !== false)
          });
          res.end();
          return;
        }

        if (event.delta?.stop_reason === 'tool_use') {
          // Need to continue with tool results
          if (textContent) {
            responseContent.unshift({ type: 'text', text: textContent });
          }

          currentMessages.push({
            role: 'assistant',
            content: responseContent
          });

          // Add tool results
          const toolResults = responseContent
            .filter(c => c.type === 'tool_use')
            .map(c => ({
              type: 'tool_result',
              tool_use_id: c.id,
              content: JSON.stringify({ success: true }) // Simplified for stream
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

  // Max iterations
  sendEvent('complete', {
    changes: allChanges,
    maxIterationsReached: true
  });
  res.end();
}

module.exports = router;
