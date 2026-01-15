import { useState, useCallback, useRef } from 'react';
import apiClient from '@/api/client';
import { dispatchAIRefresh } from './useAIRefresh';

/**
 * useAIChat - Shared AI chat engine hook
 * Used by WorkspaceAIPanel, AdminAssistantPanel, and any other AI chat interfaces
 *
 * @param {Object} options
 * @param {string} options.storeId - The store ID for context
 * @param {string} options.mode - Chat mode: 'workspace', 'admin', 'plugin'
 * @param {Function} options.onMessage - Callback when a message is added
 * @param {Function} options.onCreditsUpdate - Callback when credits are deducted
 */
export const useAIChat = ({
  storeId,
  mode = 'admin',
  onMessage,
  onCreditsUpdate
} = {}) => {
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputHistory, setInputHistory] = useState([]);
  const sessionIdRef = useRef(`session_${Date.now()}`);

  /**
   * Add a message to the chat
   */
  const addMessage = useCallback((message) => {
    const newMessage = {
      ...message,
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
    onMessage?.(newMessage);
    return newMessage;
  }, [onMessage]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(async () => {
    setMessages([]);
    if (storeId) {
      try {
        await apiClient.delete('/ai/chat/history', {
          params: { store_id: storeId }
        });
      } catch (error) {
        console.error('[useAIChat] Failed to clear chat history:', error);
      }
    }
  }, [storeId]);

  /**
   * Load chat history from backend
   */
  const loadHistory = useCallback(async () => {
    if (!storeId) return;
    try {
      const response = await apiClient.get('/ai/chat/history', {
        params: { store_id: storeId, limit: 50 }
      });
      if (response.success && response.messages?.length > 0) {
        const loadedMessages = response.messages.map(m => ({
          id: m.id || Date.now() + Math.random(),
          role: m.role,
          content: m.content,
          data: m.data,
          credits: m.credits_used,
          error: m.is_error,
          timestamp: m.created_at
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('[useAIChat] Failed to load chat history:', error);
    }
  }, [storeId]);

  /**
   * Load input history for arrow navigation
   */
  const loadInputHistory = useCallback(async () => {
    if (!storeId) return;
    try {
      const response = await apiClient.get('/ai/chat/input-history', {
        params: { store_id: storeId, limit: 30 }
      });
      if (response.success && response.inputs) {
        setInputHistory(response.inputs);
      }
    } catch (error) {
      console.error('[useAIChat] Failed to load input history:', error);
    }
  }, [storeId]);

  /**
   * Save a message to chat history
   */
  const saveMessage = useCallback(async (role, content, data = null, creditsUsed = 0, isError = false) => {
    if (!storeId) return;
    try {
      await apiClient.post('/ai/chat/history', {
        storeId,
        sessionId: sessionIdRef.current,
        role,
        content,
        intent: data?.type,
        data,
        creditsUsed,
        isError
      });
      if (role === 'user') {
        setInputHistory(prev => [content, ...prev.slice(0, 29)]);
      }
    } catch (error) {
      console.error('[useAIChat] Failed to save chat message:', error);
    }
  }, [storeId]);

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(async (userMessage, options = {}) => {
    if (!userMessage?.trim() || isProcessing) return null;

    const {
      images = [],
      conversationHistory = null,
      extraContext = {}
    } = options;

    // Add user message to chat
    addMessage({
      role: 'user',
      content: userMessage,
      images: images.map(img => img.preview)
    });

    // Save user message
    saveMessage('user', userMessage);

    setIsProcessing(true);

    try {
      // Build history from recent messages if not provided
      const history = conversationHistory || messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
        pendingAction: m.pendingAction
      }));

      // Prepare images for API if any
      const imagesForApi = images.length > 0 ? images.map(img => ({
        base64: img.base64,
        type: img.type
      })) : undefined;

      // Call unified AI chat endpoint
      const response = await apiClient.post('ai/unified-chat', {
        message: userMessage,
        conversationHistory: history,
        storeId: storeId,
        mode: mode,
        images: imagesForApi,
        modelId: extraContext.modelId,
        ...extraContext
      });

      // Add AI response
      const assistantMessage = addMessage({
        role: 'assistant',
        content: response.message || 'I processed your request.',
        data: response.data,
        credits: response.creditsDeducted,
        pendingAction: response.pendingAction
      });

      // Save assistant message
      saveMessage('assistant', response.message || 'Processing complete.', response.data, response.creditsDeducted);

      // Dispatch credits update event
      if (typeof response.creditsDeducted === 'number') {
        window.dispatchEvent(new CustomEvent('creditsUpdated'));
        onCreditsUpdate?.(response.creditsDeducted);
      }

      // Dispatch refresh event if AI performed a data-modifying action
      if (response.data?.refreshPage || response.data?.refreshPreview || response.data?.action) {
        setTimeout(() => {
          dispatchAIRefresh(response.data?.action || 'update');
        }, 300);
      }

      return {
        success: true,
        message: assistantMessage,
        response
      };

    } catch (error) {
      console.error('[useAIChat] Error:', error);

      // Check for insufficient credits
      const errorData = error.data || error.response?.data;
      const isInsufficientCredits = errorData?.code === 'INSUFFICIENT_CREDITS' ||
                                     error.status === 402 ||
                                     error.message?.toLowerCase().includes('insufficient credits');

      const errorMessage = addMessage({
        role: 'assistant',
        content: isInsufficientCredits
          ? 'Insufficient credits. Please add more credits to continue using AI features.'
          : (error.message || 'Sorry, I encountered an error. Please try again.'),
        error: true,
        creditError: isInsufficientCredits
      });

      return {
        success: false,
        error: error.message,
        message: errorMessage,
        isInsufficientCredits
      };

    } finally {
      setIsProcessing(false);
    }
  }, [storeId, mode, messages, isProcessing, addMessage, saveMessage, onCreditsUpdate]);

  /**
   * Send with streaming (extended thinking mode)
   */
  const sendWithStreaming = useCallback(async (userMessage, options = {}) => {
    if (!userMessage?.trim() || isProcessing) return null;

    const { onThinking, onToolUse, onText } = options;

    // Add user message
    addMessage({
      role: 'user',
      content: userMessage
    });
    saveMessage('user', userMessage);

    setIsProcessing(true);

    try {
      const token = localStorage.getItem('store_owner_auth_token') ||
                    localStorage.getItem('customer_auth_token');

      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/ai/stream-thinking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-store-id': storeId
        },
        body: JSON.stringify({
          message: userMessage,
          history,
          storeId,
          enableTools: true,
          thinkingBudget: 8000
        })
      });

      if (!response.ok) {
        let errorMessage = 'Stream request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullText = '';
      let currentThinking = '';
      let tools = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const event = JSON.parse(dataStr);

              switch (event.type) {
                case 'thinking':
                  currentThinking += event.text || '';
                  onThinking?.(currentThinking);
                  break;
                case 'tool_start':
                  tools.push({ name: event.tool, status: 'calling', id: event.id });
                  onToolUse?.({ name: event.tool, status: 'calling' });
                  break;
                case 'tool_result':
                  onToolUse?.({ name: event.tool, status: 'complete', result: event.result });
                  break;
                case 'text':
                  fullText += event.text || '';
                  onText?.(fullText);
                  break;
                case 'error':
                  throw new Error(event.error);
              }
            } catch (parseError) {
              // Skip invalid JSON
            }
          }
        }
      }

      const assistantMessage = addMessage({
        role: 'assistant',
        content: fullText || 'Processing complete.',
        thinkingSummary: currentThinking ? `Thought about: ${currentThinking.slice(0, 100)}...` : null,
        toolsUsed: tools.length > 0 ? tools.map(t => t.name) : null
      });

      saveMessage('assistant', fullText || 'Processing complete.');

      // Dispatch refresh event if tools were used (likely data modification)
      if (tools.length > 0) {
        setTimeout(() => {
          dispatchAIRefresh('update');
        }, 300);
      }

      return {
        success: true,
        message: assistantMessage,
        thinking: currentThinking,
        tools
      };

    } catch (error) {
      console.error('[useAIChat] Streaming error:', error);
      const isInsufficientCredits = error.message?.toLowerCase().includes('insufficient credits');

      addMessage({
        role: 'assistant',
        content: error.message || 'Sorry, I encountered an error processing your request.',
        error: true,
        creditError: isInsufficientCredits
      });

      return {
        success: false,
        error: error.message,
        isInsufficientCredits
      };
    } finally {
      setIsProcessing(false);
    }
  }, [storeId, messages, isProcessing, addMessage, saveMessage]);

  return {
    messages,
    isProcessing,
    inputHistory,
    addMessage,
    clearMessages,
    loadHistory,
    loadInputHistory,
    sendMessage,
    sendWithStreaming,
    sessionId: sessionIdRef.current
  };
};

export default useAIChat;
