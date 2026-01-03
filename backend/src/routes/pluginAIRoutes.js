/**
 * Plugin AI Assistant API Routes
 */

const express = require('express');
const router = express.Router();
const pluginAIService = require('../services/pluginAIService');
const aiModelsService = require('../services/AIModelsService');
const creditService = require('../services/credit-service');

// Credit cost for plugin AI generation (per request)
const PLUGIN_AI_CREDIT_COST = 5;

/**
 * Derive service key from model ID for credit tracking
 * Maps model IDs to service credit cost keys
 * @param {string} modelId - The model ID (e.g., 'claude-3-haiku-20240307', 'gpt-4o-mini')
 * @returns {string|null} Service key or null if unknown
 */
function deriveServiceKey(modelId) {
  if (!modelId) return null;

  // Anthropic/Claude models
  if (modelId.includes('claude')) {
    if (modelId.includes('haiku')) return 'ai_plugin_claude_haiku';
    if (modelId.includes('sonnet')) return 'ai_plugin_claude_sonnet';
    if (modelId.includes('opus')) return 'ai_plugin_claude_opus';
    return 'ai_plugin_claude_sonnet'; // Default Claude
  }

  // OpenAI models
  if (modelId.includes('gpt')) {
    if (modelId.includes('4o-mini')) return 'ai_plugin_openai_gpt4o_mini';
    if (modelId.includes('4o')) return 'ai_plugin_openai_gpt4o';
    if (modelId.includes('4')) return 'ai_plugin_openai_gpt4';
    return 'ai_plugin_openai_gpt4o_mini'; // Default OpenAI
  }

  // Gemini models
  if (modelId.includes('gemini')) {
    if (modelId.includes('flash')) return 'ai_plugin_gemini_flash';
    if (modelId.includes('pro')) return 'ai_plugin_gemini_pro';
    return 'ai_plugin_gemini_flash'; // Default Gemini
  }

  // Groq models
  if (modelId.includes('llama') || modelId.includes('groq')) {
    return 'ai_plugin_groq_llama';
  }

  // DeepSeek models
  if (modelId.includes('deepseek')) {
    return 'ai_plugin_deepseek';
  }

  return null;
}

/**
 * POST /api/plugins/ai/generate
 * Generate plugin from natural language description
 */
router.post('/generate', async (req, res) => {
  try {
    const { mode, prompt, context, modelId, serviceKey } = req.body;
    const userId = req.user?.id;
    const storeId = context?.storeId || req.headers['x-store-id'];

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Check credits before generating
    if (userId) {
      const hasCredits = await creditService.hasEnoughCredits(userId, storeId, PLUGIN_AI_CREDIT_COST);
      if (!hasCredits) {
        const balance = await creditService.getBalance(userId, storeId);
        return res.status(402).json({
          success: false,
          code: 'INSUFFICIENT_CREDITS',
          message: `Insufficient credits. Required: ${PLUGIN_AI_CREDIT_COST}, Available: ${balance.toFixed(2)}`,
          required: PLUGIN_AI_CREDIT_COST,
          available: balance
        });
      }
    }

    const result = await pluginAIService.generatePlugin(mode || 'nocode-ai', prompt, {
      ...context,
      modelId,
      serviceKey
    });

    // Deduct credits after successful generation
    // Use serviceKey from request, fallback to deriving from modelId
    const effectiveServiceKey = serviceKey || deriveServiceKey(modelId) || 'ai_plugin_claude_haiku';
    let creditsDeducted = 0;
    if (userId) {
      await creditService.deduct(
        userId,
        storeId,
        PLUGIN_AI_CREDIT_COST,
        `Plugin AI: ${prompt.substring(0, 50)}...`,  // description
        {  // metadata
          service_type: effectiveServiceKey,
          pluginId: context?.pluginId,
          pluginName: context?.pluginName,
          mode: mode || 'developer',
          modelId: modelId
        }
      );
      creditsDeducted = PLUGIN_AI_CREDIT_COST;
      console.log(`💰 Deducted ${PLUGIN_AI_CREDIT_COST} credits for ${effectiveServiceKey}`);
    }

    // Get remaining balance
    const creditsRemaining = userId ? await creditService.getBalance(userId, storeId) : null;

    res.json({
      ...result,
      creditsDeducted,
      creditsRemaining
    });
  } catch (error) {
    console.error('Error generating plugin:', error);
    res.status(500).json({
      error: 'Failed to generate plugin',
      message: error.message
    });
  }
});

/**
 * POST /api/plugins/ai/suggest-code
 * Get code suggestions for developer mode
 */
router.post('/suggest-code', async (req, res) => {
  try {
    const { fileName, currentCode, prompt } = req.body;

    if (!fileName || !prompt) {
      return res.status(400).json({ error: 'fileName and prompt are required' });
    }

    const suggestion = await pluginAIService.generateCodeSuggestion(
      fileName,
      currentCode || '',
      prompt
    );

    res.json({ suggestion });
  } catch (error) {
    console.error('Error generating code suggestion:', error);
    res.status(500).json({
      error: 'Failed to generate code suggestion',
      message: error.message
    });
  }
});

/**
 * POST /api/plugins/ai/ask
 * Ask a question about plugin development
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, pluginContext } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const answer = await pluginAIService.answerQuestion(question, pluginContext || {});

    res.json({ answer });
  } catch (error) {
    console.error('Error answering question:', error);
    res.status(500).json({
      error: 'Failed to answer question',
      message: error.message
    });
  }
});

/**
 * POST /api/plugins/ai/template
 * Generate plugin from template
 */
router.post('/template', async (req, res) => {
  try {
    const { templateId, customization } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    const result = await pluginAIService.generateFromTemplate(templateId, customization);

    res.json(result);
  } catch (error) {
    console.error('Error generating from template:', error);
    res.status(500).json({
      error: 'Failed to generate from template',
      message: error.message
    });
  }
});

/**
 * POST /api/plugins/ai/chat
 * Chat with AI assistant (streaming)
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, mode, conversationHistory, pluginConfig, currentStep } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await pluginAIService.chatWithContext({
      message,
      mode: mode || 'nocode',
      conversationHistory: conversationHistory || [],
      pluginConfig: pluginConfig || {},
      currentStep: currentStep || 'start'
    });

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response
    if (result.stream) {
      for await (const chunk of result.stream) {
        if (chunk.type === 'content_block_delta') {
          const text = chunk.delta.text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }
    }

    // Send final metadata
    res.write(`data: ${JSON.stringify({
      config: result.config,
      step: result.step,
      suggestions: result.suggestions
    })}\n\n`);

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('Error in chat:', error);

    // If streaming hasn't started, send error as JSON
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to chat with AI',
        message: error.message
      });
    } else {
      // If streaming has started, send error as SSE
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/plugins/ai/smart-suggestions
 * Generate smart contextual suggestions for next steps
 */
router.post('/smart-suggestions', async (req, res) => {
  try {
    const { context, currentStep, pluginConfig, recentMessages, userMessage } = req.body;

    const suggestions = await pluginAIService.generateSmartSuggestions({
      context: context || 'initial',
      currentStep: currentStep || 'start',
      pluginConfig: pluginConfig || {},
      recentMessages: recentMessages || [],
      userMessage: userMessage || ''
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating smart suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      message: error.message
    });
  }
});

/**
 * GET /api/plugins/ai/status
 * Check if AI service is available
 */
router.get('/status', async (req, res) => {
  try {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    const apiKey = process.env.ANTHROPIC_API_KEY || '';

    // Debug: Show key format without exposing full key
    const keyPreview = apiKey ? `${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}` : 'not set';
    const keyLength = apiKey.length;
    const hasWhitespace = apiKey !== apiKey.trim();

    // Get default model from database
    let defaultModel = 'claude-3-5-sonnet-20241022';
    try {
      const modelConfig = await aiModelsService.getModelConfig('claude-sonnet');
      if (modelConfig?.model) {
        defaultModel = modelConfig.model;
      }
    } catch (err) {
      console.warn('Failed to fetch model from database, using fallback:', err.message);
    }

    res.json({
      available: hasApiKey,
      model: defaultModel,
      message: hasApiKey
        ? 'AI service is ready'
        : 'ANTHROPIC_API_KEY not configured',
      debug: {
        keyPreview,
        keyLength,
        hasWhitespace,
        startsWithCorrectPrefix: apiKey.startsWith('sk-ant-')
      }
    });
  } catch (error) {
    res.status(500).json({
      available: false,
      error: error.message
    });
  }
});

module.exports = router;
