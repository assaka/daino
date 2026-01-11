// src/utils/aiService.js
import apiClient from '@/api/client';

/**
 * Frontend AI Service Utility
 * Communicates with backend AIService for all AI operations
 */
class AIServiceClient {
  /**
   * Generate AI response
   * @param {string} operationType - Type of operation (plugin-generation, translation, etc.)
   * @param {string} prompt - User prompt
   * @param {object} options - Additional options
   */
  async generate(operationType, prompt, options = {}) {
    try {
      const response = await apiClient.post('/ai/generate', {
        operationType,
        prompt,
        systemPrompt: options.systemPrompt || '',
        model: options.model || undefined,
        maxTokens: options.maxTokens || undefined,
        temperature: options.temperature || undefined,
        metadata: options.metadata || {}
      });

      if (response.success) {
        return {
          success: true,
          content: response.content,
          usage: response.usage,
          creditsDeducted: response.creditsDeducted,
          creditsRemaining: response.creditsRemaining
        };
      } else {
        throw new Error(response.message || 'AI generation failed');
      }
    } catch (error) {
      console.error('AI Generation Error:', error);

      // Handle specific error types
      if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
        throw new Error(
          `Insufficient credits. You need ${error.response.data.required} credits but only have ${error.response.data.available}.`
        );
      }

      throw error;
    }
  }

  /**
   * Stream AI response
   * @param {string} operationType - Type of operation
   * @param {string} prompt - User prompt
   * @param {function} onChunk - Callback for each chunk
   * @param {object} options - Additional options
   */
  async generateStream(operationType, prompt, onChunk, options = {}) {
    try {
      const response = await fetch('/api/ai/generate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getToken()}`
        },
        body: JSON.stringify({
          operationType,
          prompt,
          systemPrompt: options.systemPrompt || '',
          model: options.model || undefined,
          maxTokens: options.maxTokens || undefined,
          temperature: options.temperature || undefined,
          metadata: options.metadata || {}
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Streaming failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onChunk(parsed.content);
              }
              if (parsed.usage) {
                // Final usage stats
                onChunk(null, parsed.usage);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('AI Stream Error:', error);
      throw error;
    }
  }

  /**
   * Get operation cost
   * @param {string} operationType - Type of operation
   */
  async getOperationCost(operationType) {
    try {
      const response = await apiClient.get(`/ai/cost/${operationType}`);
      return response.cost || 0;
    } catch (error) {
      console.error('Error fetching operation cost:', error);
      return 0;
    }
  }

  /**
   * Get remaining credits
   */
  async getRemainingCredits() {
    try {
      const response = await apiClient.get('/ai/credits');
      return response.credits || 0;
    } catch (error) {
      console.error('Error fetching credits:', error);
      return 0;
    }
  }

  /**
   * Get usage history
   * @param {number} limit - Number of records to fetch
   */
  async getUsageHistory(limit = 50) {
    try {
      const response = await apiClient.get(`/ai/usage-history?limit=${limit}`);
      return response.history || [];
    } catch (error) {
      console.error('Error fetching usage history:', error);
      return [];
    }
  }

  /**
   * Check if user has sufficient credits
   * @param {string} operationType - Type of operation
   */
  async checkCredits(operationType) {
    try {
      const response = await apiClient.post('/ai/check-credits', {
        operationType
      });
      return {
        hasCredits: response.hasCredits,
        required: response.required,
        available: response.available
      };
    } catch (error) {
      console.error('Error checking credits:', error);
      return {
        hasCredits: false,
        required: 0,
        available: 0
      };
    }
  }

  // ========================================
  // SPECIALIZED OPERATION HELPERS
  // ========================================

  /**
   * Generate plugin with RAG context
   * @param {string} prompt - What the plugin should do
   * @param {object} options - category, storeId, etc.
   */
  async generatePlugin(prompt, options = {}) {
    try {
      const response = await apiClient.post('/ai/plugin/generate', {
        prompt,
        category: options.category,
        storeId: options.storeId
      });

      if (response.success) {
        return {
          success: true,
          plugin: response.plugin,
          usage: response.usage,
          creditsDeducted: response.creditsDeducted
        };
      } else {
        throw new Error(response.message || 'Plugin generation failed');
      }
    } catch (error) {
      console.error('Plugin Generation Error:', error);

      if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
        throw new Error('Insufficient credits for plugin generation');
      }

      throw error;
    }
  }

  /**
   * Modify existing plugin
   * @param {string} prompt - What to change
   * @param {string} existingCode - Current plugin code
   * @param {string} pluginSlug - Plugin identifier
   */
  async modifyPlugin(prompt, existingCode, pluginSlug) {
    try {
      const response = await apiClient.post('/ai/plugin/modify', {
        prompt,
        existingCode,
        pluginSlug
      });

      if (response.success) {
        return {
          success: true,
          plugin: response.plugin,
          usage: response.usage,
          creditsDeducted: response.creditsDeducted
        };
      } else {
        throw new Error(response.message || 'Plugin modification failed');
      }
    } catch (error) {
      console.error('Plugin Modification Error:', error);

      if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
        throw new Error('Insufficient credits for plugin modification');
      }

      throw error;
    }
  }

  /**
   * Generate layout config
   * @param {string} prompt - What layout to generate
   * @param {string} configType - homepage, product, category, etc.
   */
  async generateLayout(prompt, configType) {
    try {
      const response = await apiClient.post('/ai/layout/generate', {
        prompt,
        configType
      });

      if (response.success) {
        return {
          success: true,
          config: response.config,
          usage: response.usage,
          creditsDeducted: response.creditsDeducted
        };
      } else {
        throw new Error(response.message || 'Layout generation failed');
      }
    } catch (error) {
      console.error('Layout Generation Error:', error);

      if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
        throw new Error('Insufficient credits for layout generation');
      }

      throw error;
    }
  }

  /**
   * Translate content
   * @param {string} content - Content to translate
   * @param {array} targetLanguages - ['fr', 'de', 'es']
   */
  async translateContent(content, targetLanguages) {
    try {
      const response = await apiClient.post('/ai/translate', {
        content,
        targetLanguages
      });

      if (response.success) {
        return {
          success: true,
          translations: response.translations,
          usage: response.usage,
          creditsDeducted: response.creditsDeducted
        };
      } else {
        throw new Error(response.message || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation Error:', error);

      if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
        throw new Error('Insufficient credits for translation');
      }

      throw error;
    }
  }

  /**
   * Chat using unified tool-based AI
   * Uses Anthropic's tool_use API for dynamic, intelligent responses.
   * Handles: questions, slot editing, data queries, settings, translations, etc.
   *
   * @param {string} message - User message
   * @param {array} conversationHistory - Previous messages
   * @param {string} storeId - Store ID for context
   * @param {string} mode - 'general', 'workspace', 'plugin' (optional)
   */
  async chat(message, conversationHistory = [], storeId, mode = 'general') {
    try {
      const response = await apiClient.post('/ai/unified-chat', {
        message,
        conversationHistory,
        storeId,
        mode
      });

      if (response.success) {
        return {
          success: true,
          message: response.message,
          data: response.data,
          toolCalls: response.data?.toolCalls,
          refreshPreview: response.data?.refreshPreview,
          creditsDeducted: response.creditsDeducted
        };
      } else {
        throw new Error(response.message || 'Chat failed');
      }
    } catch (error) {
      console.error('Unified Chat Error:', error);

      if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
        throw new Error('Insufficient credits for chat');
      }

      throw error;
    }
  }

  /**
   * @deprecated Use chat() instead
   * Chat using tool-based AI (legacy method)
   */
  async chatWithTools(message, conversationHistory = [], storeId) {
    return this.chat(message, conversationHistory, storeId, 'general');
  }

  /**
   * Generate code patch
   * @param {string} prompt - What to change
   * @param {string} sourceCode - Current code
   * @param {string} filePath - File being edited
   */
  async generateCodePatch(prompt, sourceCode, filePath) {
    try {
      const response = await apiClient.post('/ai/code/patch', {
        prompt,
        sourceCode,
        filePath
      });

      if (response.success) {
        return {
          success: true,
          patch: response.patch,
          usage: response.usage,
          creditsDeducted: response.creditsDeducted
        };
      } else {
        throw new Error(response.message || 'Code patch generation failed');
      }
    } catch (error) {
      console.error('Code Patch Error:', error);

      if (error.response?.data?.code === 'INSUFFICIENT_CREDITS') {
        throw new Error('Insufficient credits for code patch generation');
      }

      throw error;
    }
  }
}

export default new AIServiceClient();
