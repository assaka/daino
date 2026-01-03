import React, { useState, useRef, useEffect } from 'react';
import { useAIWorkspace } from '@/contexts/AIWorkspaceContext';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Trash2,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Package,
  Code,
  Eye,
  Download,
  Maximize2,
  Minimize2,
  ChevronDown,
  Paperclip,
  ThumbsUp,
  ThumbsDown,
  X,
  Image,
  Brain,
  Database,
  Search,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import aiWorkspaceSlotProcessor from '@/services/aiWorkspaceSlotProcessor';
import apiClient from '@/api/client';
import { User as UserEntity } from '@/api/entities';

// No fallback - models loaded entirely from database via API

const PROVIDER_NAMES = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  groq: 'Groq',
  deepseek: 'DeepSeek'
};

// Plugin AI credit costs by model ID pattern (matches service_credit_costs table)
const PLUGIN_CREDIT_COSTS = {
  // Claude/Anthropic
  'claude-3-haiku': 5,
  'claude-3-5-sonnet': 10,
  'claude-3-sonnet': 10,
  'claude-3-opus': 20,
  // OpenAI
  'gpt-4o-mini': 5,
  'gpt-4o': 12,
  'gpt-4': 15,
  // Gemini
  'gemini-2.0-flash': 3,
  'gemini-1.5-flash': 3,
  'gemini-pro': 8,
  // Groq
  'llama': 2,
  'mixtral': 2,
  // DeepSeek
  'deepseek': 3
};

// Get plugin credit cost for a model
const getPluginCredits = (modelId) => {
  if (!modelId) return 5; // default
  for (const [pattern, cost] of Object.entries(PLUGIN_CREDIT_COSTS)) {
    if (modelId.includes(pattern)) return cost;
  }
  return 5; // default fallback
};

// Get saved model preference
const getSavedModel = (models) => {
  if (!models || models.length === 0) return null;
  try {
    const saved = localStorage.getItem('ai_default_model');
    // Only use saved model if it exists in the available models list
    if (saved && models.find(m => m.id === saved)) return saved;
    // Clear invalid saved model
    if (saved) localStorage.removeItem('ai_default_model');
  } catch (e) {}
  // Return the provider default model, or first model in list
  const defaultModel = models.find(m => m.isProviderDefault);
  return defaultModel?.id || models[0]?.id;
};

/**
 * WorkspaceAIPanel - AI Chat panel for the workspace
 * Handles AI conversations and slot manipulation commands
 */

const WorkspaceAIPanel = () => {
  const {
    chatMessages,
    addChatMessage,
    clearChatHistory,
    isProcessingAi,
    setIsProcessingAi,
    selectedPageType,
    applyAiSlotChange,
    undoLastAiOperation,
    lastAiOperation,
    currentConfiguration,
    slotHandlers,
    openPluginEditor,
    chatMaximized,
    toggleChatMaximized,
    refreshPreview,
    triggerConfigurationRefresh,
    // Plugin editing context
    pluginToEdit,
    showPluginEditor,
    pluginFiles,
    selectedPluginFile
  } = useAIWorkspace();

  const { getSelectedStoreId } = useStoreSelection();
  const [inputValue, setInputValue] = useState('');
  const [commandStatus, setCommandStatus] = useState(null); // 'success', 'error', null
  const [aiModels, setAiModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Fetch AI models from API on mount (only provider defaults for dropdown)
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await apiClient.get('/ai/models');
        // Response structure: { success: true, models: [...] }
        if (response.models && response.models.length > 0) {
          const models = response.models.map(m => ({
            id: m.model_id,
            name: m.name,
            provider: m.provider,
            credits: parseFloat(m.credits_per_use),
            icon: m.icon || '🤖',
            serviceKey: m.service_key,
            isProviderDefault: m.is_provider_default
          }));
          setAiModels(models);
          // Set selected model from saved preference or first available
          const defaultModel = getSavedModel(models);
          setSelectedModel(defaultModel);
        } else {
          console.warn('No AI models returned from API:', response);
        }
      } catch (error) {
        console.error('Failed to fetch AI models:', error.message);
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModels();
  }, []);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedImages, setAttachedImages] = useState([]); // [{file, preview, base64, type}]
  const [inputHistory, setInputHistory] = useState([]); // Previous user inputs for arrow navigation
  const [historyIndex, setHistoryIndex] = useState(-1); // Current position in history (-1 = not navigating)
  const [sessionId] = useState(() => `session_${Date.now()}`); // Session ID for grouping messages

  // Extended thinking mode state
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [activeTool, setActiveTool] = useState(null); // { name, status: 'calling' | 'complete' }
  const [streamingText, setStreamingText] = useState('');
  const [toolResults, setToolResults] = useState([]); // Array of tool execution results

  // Get current model object
  const currentModel = aiModels.find(m => m.id === selectedModel) || aiModels[0] || null;

  // Plugin-related state
  const [starterTemplates, setStarterTemplates] = useState([]);
  const [cloningTemplate, setCloningTemplate] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [templateToClone, setTemplateToClone] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [pluginGenerationCost, setPluginGenerationCost] = useState(50);


  // Get storeId from context
  const storeId = getSelectedStoreId();

  // Load starter templates, plugin cost, chat history, and input history
  useEffect(() => {
    loadStarterTemplates();
    loadPluginGenerationCost();
    loadChatHistory();
    loadInputHistory();
  }, [storeId]);

  // Load chat history from tenant DB
  const loadChatHistory = async () => {
    if (!storeId) return;
    try {
      const response = await apiClient.get('/ai/chat/history', {
        params: { store_id: storeId, limit: 50 }
      });
      if (response.success && response.messages?.length > 0) {
        response.messages.forEach(m => {
          addChatMessage({
            role: m.role,
            content: m.content,
            data: m.data,
            credits: m.credits_used,
            error: m.is_error
          });
        });
      }
    } catch (error) {
      console.error('[WorkspaceAIPanel] Failed to load chat history:', error);
    }
  };

  // Load input history for arrow navigation
  const loadInputHistory = async () => {
    if (!storeId) return;
    try {
      const response = await apiClient.get('/ai/chat/input-history', {
        params: { store_id: storeId, limit: 30 }
      });
      if (response.success && response.inputs) {
        setInputHistory(response.inputs);
      }
    } catch (error) {
      console.error('[WorkspaceAIPanel] Failed to load input history:', error);
    }
  };

  // Save message to chat history
  const saveChatMessage = async (role, content, data = null, creditsUsed = 0, isError = false) => {
    if (!storeId) return;
    try {
      await apiClient.post('/ai/chat/history', {
        storeId,
        sessionId,
        role,
        content,
        intent: data?.type,
        data,
        creditsUsed,
        isError
      });
      // Update local input history if it's a user message
      if (role === 'user') {
        setInputHistory(prev => [content, ...prev.slice(0, 29)]);
      }
    } catch (error) {
      console.error('[WorkspaceAIPanel] Failed to save chat message:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPluginGenerationCost = async () => {
    try {
      const response = await apiClient.get('service-credit-costs/key/custom_plugin_creation');
      if (response.success && response.service) {
        setPluginGenerationCost(response.service.cost_per_unit);
      }
    } catch (error) {
      console.error('Error loading plugin generation cost:', error);
    }
  };

  const loadStarterTemplates = async () => {
    try {
      const response = await apiClient.get('/plugins/starters');
      if (response.success && response.starters) {
        setStarterTemplates(response.starters);
      }
    } catch (error) {
      console.error('Failed to load starter templates:', error);
      setStarterTemplates([]);
    }
  };

  const handleCloneTemplate = (template) => {
    setTemplateToClone(template);
    setCloneName(`My ${template.name}`);
    setShowCloneModal(true);
  };

  const confirmCloneTemplate = async () => {
    if (!cloneName.trim()) {
      return;
    }

    setShowCloneModal(false);
    setCloningTemplate(true);

    try {
      const currentUser = await UserEntity.me();
      const exportData = await apiClient.get(`plugins/${templateToClone.id}/export`);

      exportData.plugin.name = cloneName.trim();
      exportData.plugin.slug = cloneName.trim().toLowerCase().replace(/\s+/g, '-');
      exportData.userId = currentUser?.id;

      const result = await apiClient.post('plugins/import', exportData);

      addChatMessage({
        role: 'assistant',
        content: `✅ Created "${cloneName}" from ${templateToClone.name} template!\n\nYour plugin is ready. Opening in editor...`,
        data: { type: 'plugin', plugin: result.plugin }
      });

      // Open plugin editor
      openPluginEditor(result.plugin);

    } catch (error) {
      console.error('Failed to clone template:', error);
      addChatMessage({
        role: 'assistant',
        content: `❌ Error cloning template: ${error.message}`,
        error: true
      });
    } finally {
      setCloningTemplate(false);
      setTemplateToClone(null);
      setCloneName('');
    }
  };

  const handleInstallPlugin = async (pluginData) => {
    try {
      console.log('🔌 Creating plugin with data:', pluginData);
      const response = await apiClient.post('/ai/plugin/create', { pluginData });
      console.log('🔌 Plugin create response:', response);

      if (response.success) {
        const pluginId = response.pluginId || response.plugin?.id;
        const pluginSlug = response.plugin?.slug || response.slug;

        console.log('🔌 Extracted pluginId:', pluginId, 'slug:', pluginSlug);

        if (!pluginId) {
          throw new Error('Plugin created but no ID returned');
        }

        addChatMessage({
          role: 'assistant',
          content: `✅ Plugin "${pluginData.name}" created successfully!\n\nOpening in editor...`,
        });

        openPluginEditor({
          ...pluginData,
          id: pluginId,
          slug: pluginSlug
        });
      } else {
        throw new Error(response.message || 'Failed to create plugin');
      }
    } catch (error) {
      console.error('Failed to create plugin:', error);
      addChatMessage({
        role: 'assistant',
        content: `❌ Error creating plugin: ${error.message}`,
        error: true
      });
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [chatMessages]);

  // Execute slot commands from AI response
  const executeSlotCommands = (commands) => {
    if (!commands || commands.length === 0 || !slotHandlers) return { success: false, error: 'No commands to execute' };

    let executedCount = 0;
    const errors = [];

    for (const command of commands) {
      // Validate command against current configuration
      const validation = aiWorkspaceSlotProcessor.validateCommand(command, currentConfiguration);
      if (!validation.valid) {
        errors.push(...validation.errors);
        continue;
      }

      try {
        // Execute the command using slot handlers
        const currentSlots = currentConfiguration?.slots || {};
        const updatedSlots = aiWorkspaceSlotProcessor.executeCommand(command, currentSlots, slotHandlers);

        // Apply the change through context
        if (updatedSlots && applyAiSlotChange) {
          applyAiSlotChange(updatedSlots, command);
          executedCount++;
        }
      } catch (err) {
        console.error('Error executing slot command:', err);
        errors.push(err.message);
      }
    }

    return {
      success: executedCount > 0,
      executed: executedCount,
      total: commands.length,
      errors
    };
  };

  // Generate plugin via AI (after user confirms)
  const handleGeneratePlugin = async (prompt) => {
    setIsProcessingAi(true);

    try {
      const response = await apiClient.post('/ai/chat', {
        message: prompt,
        conversationHistory: chatMessages.slice(-10),
        storeId: storeId,
        modelId: selectedModel,
        serviceKey: currentModel?.serviceKey,
        confirmedPlugin: true  // This tells backend to actually generate, not ask again
      });

      if (response.success) {
        addChatMessage({
          role: 'assistant',
          content: response.message,
          data: response.data,
          credits: response.creditsDeducted
        });

        // Auto-refresh preview and editor after styling or layout changes
        const refreshTypes = ['styling_applied', 'styling_preview', 'layout_modified', 'multi_intent'];
        if (refreshTypes.includes(response.data?.type)) {
          setTimeout(() => {
            refreshPreview?.();
            triggerConfigurationRefresh?.();

            // Dispatch localStorage event to trigger reload in page editors
            localStorage.setItem('slot_config_updated', JSON.stringify({
              storeId,
              pageType: response.data?.pageType || selectedPageType,
              timestamp: Date.now()
            }));
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'slot_config_updated',
              newValue: JSON.stringify({ storeId, pageType: response.data?.pageType || selectedPageType, timestamp: Date.now() })
            }));
          }, 500);
        }
      } else {
        addChatMessage({
          role: 'assistant',
          content: `Error: ${response.message || 'Failed to generate plugin'}`,
          error: true
        });
      }
    } catch (error) {
      console.error('Plugin generation error:', error);
      addChatMessage({
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to generate plugin'}`,
        error: true
      });
    } finally {
      setIsProcessingAi(false);
    }
  };

  // Handle sending a message
  const handleSend = async () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || isProcessingAi) return;

    const userMessage = inputValue.trim();
    const imagesToSend = [...attachedImages];
    setInputValue('');
    setAttachedImages([]); // Clear images after sending
    setCommandStatus(null);
    setHistoryIndex(-1); // Reset history navigation

    // Add user message to chat (with image previews)
    addChatMessage({
      role: 'user',
      content: userMessage || '(Image attached)',
      images: imagesToSend.map(img => img.preview)
    });

    // Save user message to chat history
    saveChatMessage('user', userMessage || '(Image attached)');

    // Send all requests to backend - AI determines intent
    setIsProcessingAi(true);

    try {
      // Check if we're in plugin editing mode
      const isPluginEditMode = showPluginEditor && pluginToEdit;

      if (isPluginEditMode) {
        // === PLUGIN EDITING MODE ===
        // Route to plugin AI service for code generation/modification
        console.log('🔌 Plugin editing mode - routing to plugin AI', pluginToEdit);

        // Get recent conversation history for context (last 6 messages)
        const recentHistory = chatMessages.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        }));

        const response = await apiClient.post('plugins/ai/generate', {
          mode: 'developer',
          prompt: userMessage,
          modelId: selectedModel,
          serviceKey: currentModel?.serviceKey,
          context: {
            pluginId: pluginToEdit.id,
            pluginName: pluginToEdit.name,
            pluginSlug: pluginToEdit.slug,
            category: pluginToEdit.category,
            storeId: storeId,
            // Include existing plugin files with content so AI can modify them properly
            existingFiles: pluginFiles?.map(f => ({
              path: f.path,
              name: f.name,
              content: f.content || ''
            })) || [],
            // Include conversation history so AI knows what was just created/modified
            conversationHistory: recentHistory
          }
        });

        // Debug: Log full response to understand structure
        console.log('🤖 Plugin AI Response:', JSON.stringify(response, null, 2));

        // Handle plugin AI response
        // Check if AI is asking a clarifying question
        if (response.question) {
          const questionText = response.options
            ? `${response.question}\n\nOptions:\n${response.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
            : response.question;

          addChatMessage({
            role: 'assistant',
            content: questionText
          });
          saveChatMessage('assistant', questionText);
          setIsProcessingAi(false);
          return;
        }

        // Check for various response structures the AI might return
        const hasGeneratedFiles = response.generatedFiles && response.generatedFiles.length > 0;
        const hasPluginStructure = response.plugin_structure?.main_file;
        const messageContent = response.message || response.explanation || response.content || '';

        // Check if response contains code blocks (even in "conversational" responses)
        const codeBlockMatch = messageContent.match(/```(?:javascript|js|jsx)?\n([\s\S]*?)```/);
        let hasCodeBlock = !!codeBlockMatch;

        // Check if message contains embedded JSON with generatedFiles
        let embeddedJson = null;
        let embeddedFiles = null;
        const jsonMatch = messageContent.match(/\{\s*"name"[\s\S]*?"generatedFiles"[\s\S]*?\[\s*\{[\s\S]*?\}\s*\]\s*[,\}]/);
        if (jsonMatch) {
          try {
            // Try to extract and parse the JSON object from the message
            const jsonStr = messageContent.match(/\{[\s\S]*"generatedFiles"[\s\S]*\]/)?.[0];
            if (jsonStr) {
              // Find the complete JSON object
              let braceCount = 0;
              let jsonEndIndex = 0;
              for (let i = 0; i < messageContent.length; i++) {
                if (messageContent[i] === '{') braceCount++;
                if (messageContent[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    jsonEndIndex = i + 1;
                    break;
                  }
                }
              }
              const startIndex = messageContent.indexOf('{');
              if (startIndex !== -1 && jsonEndIndex > startIndex) {
                const fullJson = messageContent.substring(startIndex, jsonEndIndex);
                embeddedJson = JSON.parse(fullJson);
                embeddedFiles = embeddedJson.generatedFiles;
                console.log('📦 Found embedded JSON in message:', embeddedJson);
              }
            }
          } catch (e) {
            console.log('⚠️ Failed to parse embedded JSON:', e.message);
          }
        }

        // Update flags based on embedded JSON
        const actualGeneratedFiles = response.generatedFiles || embeddedFiles;
        const actualHasGeneratedFiles = actualGeneratedFiles && actualGeneratedFiles.length > 0;

        console.log('🔍 Response analysis:', {
          hasGeneratedFiles: actualHasGeneratedFiles,
          hasPluginStructure,
          hasCodeBlock,
          hasEmbeddedJson: !!embeddedJson,
          responseType: response.type
        });

        if (actualHasGeneratedFiles || hasPluginStructure) {
          // Code was generated in structured format - show success and dispatch event
          const files = actualGeneratedFiles || [];
          const explanation = embeddedJson?.explanation || response.explanation || 'Plugin code generated successfully.';

          console.log('✅ Structured code generated - dispatching event with:', {
            pluginId: pluginToEdit.id,
            filesCount: files.length,
            hasPluginStructure: !!response.plugin_structure,
            fromEmbeddedJson: !!embeddedJson
          });

          addChatMessage({
            role: 'assistant',
            content: `✅ ${explanation}\n\n${files.length > 0 ? `Generated ${files.length} file(s). Saving to plugin...` : 'Saving code to plugin...'}`,
            data: {
              type: 'plugin_code_generated',
              files: files,
              pluginStructure: response.plugin_structure || embeddedJson?.plugin_structure
            }
          });

          // Dispatch event so DeveloperPluginEditor can pick up the generated code
          window.dispatchEvent(new CustomEvent('plugin-ai-code-generated', {
            detail: {
              pluginId: pluginToEdit.id,
              files: files,
              pluginStructure: response.plugin_structure || embeddedJson?.plugin_structure,
              code: response.plugin_structure?.main_file || embeddedJson?.plugin_structure?.main_file || (files[0]?.code)
            }
          }));
        } else if (hasCodeBlock) {
          // Response contains code block in markdown - extract and save
          console.log('📝 Found code block in response, extracting and saving...');
          const extractedCode = codeBlockMatch[1];

          addChatMessage({
            role: 'assistant',
            content: `✅ Code generated. Saving to plugin...\n\n${messageContent}`,
            data: { type: 'plugin_code_generated' }
          });

          // Dispatch event with extracted code
          console.log('🚀 Dispatching plugin-ai-code-generated event with extracted code');
          window.dispatchEvent(new CustomEvent('plugin-ai-code-generated', {
            detail: {
              pluginId: pluginToEdit.id,
              files: [{ name: 'hook.js', code: extractedCode }],
              code: extractedCode
            }
          }));
        } else {
          // Pure conversational response - just show the message
          console.log('💬 Conversational response (no code detected)');
          addChatMessage({
            role: 'assistant',
            content: messageContent || 'I can help you modify this plugin. What would you like to add or change?',
            data: response
          });
        }

        saveChatMessage('assistant', response.message || response.explanation || 'Plugin response');

        // Dispatch credits update event to refresh balance in header
        if (response.creditsDeducted) {
          console.log(`💰 Credits deducted: ${response.creditsDeducted}, remaining: ${response.creditsRemaining}`);
          window.dispatchEvent(new CustomEvent('creditsUpdated'));
        }

        setIsProcessingAi(false);
        return;
      }

      // === NORMAL SLOT EDITING MODE ===
      // Generate slot context for AI
      const slotContext = aiWorkspaceSlotProcessor.generateSlotContext(
        selectedPageType,
        currentConfiguration
      );

      // Prepare images for API (base64 format)
      const imagesForApi = imagesToSend.length > 0 ? imagesToSend.map(img => ({
        base64: img.base64,
        type: img.type
      })) : undefined;

      // Build history with pendingAction for "yes" confirmation flow
      const historyWithPending = chatMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
        pendingAction: m.pendingAction // Include any pending action
      }));

      // Use Smart Chat (RAG + learned examples + real-time data)
      const response = await apiClient.post('ai/smart-chat', {
        message: userMessage || 'Please analyze this image.',
        context: selectedPageType,
        history: historyWithPending,
        capabilities: [
          'Add slots', 'Modify slots', 'Remove slots',
          'Resize slots', 'Move slots', 'Reorder slots',
          'Create plugins', 'Edit plugins'
        ],
        storeId: storeId,
        modelId: selectedModel,
        serviceKey: currentModel?.serviceKey,
        slotContext, // Pass current layout info
        images: imagesForApi // Pass images for vision support
      });

      // Check if this is a plugin confirmation request from backend
      if (response.data?.type === 'plugin_confirmation') {
        addChatMessage({
          role: 'assistant',
          content: response.message,
          confirmAction: {
            type: 'generate-plugin',
            prompt: response.data.prompt,
            category: response.data.category
          }
        });
        setIsProcessingAi(false);
        return;
      }

      // Check if response contains slot commands
      let commands = response.commands || [];

      // Also try to parse commands from AI message (fallback)
      if (commands.length === 0 && response.message) {
        commands = aiWorkspaceSlotProcessor.parseAIResponse(response.message);
      }

      // Execute commands if any
      let executionResult = null;
      if (commands.length > 0) {
        executionResult = executeSlotCommands(commands);
        setCommandStatus(executionResult.success ? 'success' : 'error');

        // Auto-clear status after 3 seconds
        setTimeout(() => setCommandStatus(null), 3000);
      }

      // Add AI response to chat (include pendingAction for "yes" confirmation flow)
      addChatMessage({
        role: 'assistant',
        content: response.message || 'Processing complete.',
        slotCommand: commands.length > 0 ? commands : null,
        executionResult,
        data: response.data,
        pendingAction: response.pendingAction // Store for confirmation flow
      });

      // Save assistant message to chat history
      saveChatMessage('assistant', response.message || 'Processing complete.', response.data, response.creditsDeducted);

      // Auto-refresh preview and editor after styling or layout changes
      const refreshTypes = ['styling_applied', 'styling_preview', 'layout_modified', 'multi_intent'];
      console.log('🎨 Response data type check:', response.data?.type, 'in refreshTypes:', refreshTypes.includes(response.data?.type));
      console.log('🎨 refreshPreview available:', !!refreshPreview, 'triggerConfigurationRefresh available:', !!triggerConfigurationRefresh);
      if (refreshTypes.includes(response.data?.type)) {
        console.log('🎨 Triggering preview refresh for type:', response.data?.type);
        setTimeout(() => {
          console.log('🎨 Calling refreshPreview and triggerConfigurationRefresh NOW');
          refreshPreview?.();
          triggerConfigurationRefresh?.();

          // Dispatch localStorage event to trigger reload in page editors
          localStorage.setItem('slot_config_updated', JSON.stringify({
            storeId,
            pageType: response.data?.pageType || selectedPageType,
            timestamp: Date.now()
          }));
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'slot_config_updated',
            newValue: JSON.stringify({ storeId, pageType: response.data?.pageType || selectedPageType, timestamp: Date.now() })
          }));
          console.log('🎨 localStorage and StorageEvent dispatched');
        }, 500);
      }

    } catch (error) {
      console.error('AI processing error:', error);
      setCommandStatus('error');

      // Check for insufficient credits error
      const errorResponse = error.response?.data;
      if (errorResponse?.code === 'INSUFFICIENT_CREDITS' || error.response?.status === 402) {
        addChatMessage({
          role: 'assistant',
          content: `⚠️ Insufficient credits. ${errorResponse?.message || 'Please add more credits to continue using AI features.'}`,
          error: true
        });
        setIsProcessingAi(false);
        return;
      }

      // Fallback to local processing if backend fails
      const localCommands = aiWorkspaceSlotProcessor.parseAIResponse(userMessage);

      if (localCommands.length > 0) {
        const result = executeSlotCommands(localCommands);
        addChatMessage({
          role: 'assistant',
          content: result.success
            ? `Applied ${result.executed} change(s) based on your request.`
            : `Could not apply changes: ${result.errors.join(', ')}`,
          slotCommand: localCommands,
          executionResult: result,
          error: !result.success
        });
      } else {
        addChatMessage({
          role: 'assistant',
          content: error.message || 'Sorry, I encountered an error processing your request. Please try again.',
          error: true
        });
      }
    } finally {
      setIsProcessingAi(false);
    }
  };

  // Handle sending with extended thinking (streaming with thinking/tool display)
  const handleSendWithThinking = async () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || isProcessingAi) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setAttachedImages([]);
    setCommandStatus(null);
    setHistoryIndex(-1);

    // Reset streaming state
    setThinkingText('');
    setActiveTool(null);
    setStreamingText('');
    setToolResults([]);

    // Add user message to chat
    addChatMessage({
      role: 'user',
      content: userMessage || '(Image attached)'
    });

    // Save user message
    saveChatMessage('user', userMessage || '(Image attached)');

    setIsProcessingAi(true);

    try {
      // Get auth token (same logic as apiClient)
      const token = localStorage.getItem('store_owner_auth_token') ||
                    localStorage.getItem('customer_auth_token');

      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Build history from recent messages
      const history = chatMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Start streaming request
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
          // Response might not be JSON, use status text
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullText = '';
      let currentThinking = '';
      let tools = [];

      // Show initial processing state
      setThinkingText('Connecting...');

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

              // Handle different event types
              switch (event.type) {
                case 'thinking_start':
                  setThinkingText('Processing...');
                  break;

                case 'thinking':
                  // Extended thinking text (if available)
                  currentThinking += event.text || '';
                  break;

                case 'tool_start':
                  setActiveTool({ name: event.tool, status: 'calling' });
                  tools.push({ name: event.tool, status: 'calling', id: event.id });
                  break;

                case 'tool_input':
                  // Tool is receiving input (still calling)
                  break;

                case 'tool_result':
                  setActiveTool({ name: event.tool, status: 'complete' });
                  setToolResults(prev => [...prev, {
                    name: event.tool,
                    result: event.result,
                    id: event.id
                  }]);
                  // Clear active tool after a moment
                  setTimeout(() => setActiveTool(null), 1000);
                  break;

                case 'tool_error':
                  setActiveTool(null);
                  break;

                case 'block_stop':
                  if (event.blockType === 'thinking') {
                    setThinkingText('');
                  }
                  break;

                case 'text_start':
                  // Text response starting
                  break;

                case 'text':
                  fullText += event.text || '';
                  setStreamingText(fullText);
                  break;

                case 'complete':
                  // Stream complete
                  break;

                case 'styling_applied':
                  // Styling was applied via stream - trigger refresh
                  console.log('🎨 Styling applied via stream, refreshing preview');
                  setTimeout(() => {
                    refreshPreview?.();
                    triggerConfigurationRefresh?.();
                    localStorage.setItem('slot_config_updated', JSON.stringify({
                      storeId,
                      pageType: event.pageType || selectedPageType,
                      timestamp: Date.now()
                    }));
                    window.dispatchEvent(new StorageEvent('storage', {
                      key: 'slot_config_updated',
                      newValue: JSON.stringify({ storeId, pageType: event.pageType || selectedPageType, timestamp: Date.now() })
                    }));
                  }, 300);
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

      // Add final message
      addChatMessage({
        role: 'assistant',
        content: fullText || 'Processing complete.',
        thinkingSummary: currentThinking ? `Thought about: ${currentThinking.slice(0, 100)}...` : null,
        toolsUsed: tools.length > 0 ? tools.map(t => t.name) : null
      });

      // Save to history
      saveChatMessage('assistant', fullText || 'Processing complete.');

      // Clear streaming state
      setStreamingText('');
      setThinkingText('');
      setActiveTool(null);

    } catch (error) {
      console.error('Extended thinking error:', error);
      addChatMessage({
        role: 'assistant',
        content: error.message || 'Sorry, I encountered an error processing your request.',
        error: true
      });
    } finally {
      setIsProcessingAi(false);
    }
  };

  // Handle keyboard shortcuts (Enter to send, Arrow Up/Down for history)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (extendedThinkingEnabled) {
        handleSendWithThinking();
      } else {
        handleSend();
      }
    } else if (e.key === 'ArrowUp' && inputHistory.length > 0 && !inputValue.includes('\n')) {
      // Arrow up for input history navigation
      e.preventDefault();
      const newIndex = historyIndex < inputHistory.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInputValue(inputHistory[newIndex] || '');
    } else if (e.key === 'ArrowDown' && historyIndex >= 0 && !inputValue.includes('\n')) {
      // Arrow down for input history navigation
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(inputHistory[newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInputValue('');
      }
    }
  };

  // Quick action suggestions
  const quickActions = [
    { label: 'Add banner', prompt: 'Add a promotional banner at the top' },
    { label: 'Change layout', prompt: 'Change the layout to 2 columns' },
    { label: 'Add section', prompt: 'Add a new section below the main content' },
    { label: 'Create plugin', prompt: 'Create a plugin that...' }
  ];

  // Handle confirmation action from message
  const handleConfirmAction = async (message) => {
    if (message.confirmAction?.type === 'generate-plugin') {
      // Remove confirmAction from message
      message.confirmAction = null;
      await handleGeneratePlugin(message.confirmAction?.prompt || inputValue);
    } else if (message.confirmAction?.type === 'create-plugin') {
      message.confirmAction = null;
      await handleInstallPlugin(message.confirmAction?.pluginData);
    }
  };

  const handleCancelConfirmation = () => {
    addChatMessage({
      role: 'assistant',
      content: '❌ Cancelled. What else can I help you with?'
    });
  };

  // Handle feedback on AI responses
  const handleFeedback = async (message, wasHelpful) => {
    const candidateId = message.data?.candidateId;
    if (!candidateId) return;

    try {
      await apiClient.post(`ai/training/candidates/${candidateId}/feedback`, {
        wasHelpful,
        feedbackText: wasHelpful ? 'User marked as helpful' : 'User marked as not helpful'
      });

      // Update message to show feedback was recorded
      message.feedbackGiven = wasHelpful ? 'positive' : 'negative';
      // Force re-render by updating state
      addChatMessage({ ...message, feedbackGiven: wasHelpful ? 'positive' : 'negative' });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-3 h-12 border-b bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-sm">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {lastAiOperation && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={undoLastAiOperation}
              title="Undo last AI change"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {chatMessages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={clearChatHistory}
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleChatMaximized}
            title={chatMaximized ? 'Restore' : 'Maximize'}
          >
            {chatMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 px-4">
        <div className="py-4 space-y-4">
          {chatMessages.length === 0 ? (
            // Empty state with suggestions
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                AI Layout & Plugin Assistant
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-[200px] mx-auto">
                Edit {selectedPageType} page layout or create plugins
              </p>

              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setInputValue(action.prompt)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>

              {/* Starter templates */}
              {starterTemplates.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Or start with a template:
                  </p>
                  <div className="space-y-2">
                    {starterTemplates.slice(0, 3).map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleCloneTemplate(template)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                      >
                        <span className="text-lg">{template.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs text-gray-900 truncate">{template.name}</div>
                          <div className="text-xs text-gray-500 truncate">{template.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Chat messages
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                )}

                <div className="max-w-[85%] flex flex-col gap-2">
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : message.error
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    )}
                  >
                    {/* Display attached images */}
                    {message.images && message.images.length > 0 && (
                      <div className="flex gap-1.5 mb-2 flex-wrap">
                        {message.images.map((imgSrc, idx) => (
                          <img
                            key={idx}
                            src={imgSrc}
                            alt={`Attached ${idx + 1}`}
                            className="max-w-[100px] max-h-[100px] object-cover rounded border border-blue-300"
                          />
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Tools Used Badge */}
                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Database className="h-3 w-3 text-blue-500" />
                          <span className="text-xs text-gray-500">Used:</span>
                          {message.toolsUsed.map((tool, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium"
                            >
                              {tool.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Credits Used */}
                    {message.credits && message.role !== 'user' && (
                      <p className="text-xs mt-2 opacity-70">
                        {message.credits} credits used
                      </p>
                    )}

                    {/* Confirmation Actions */}
                    {message.confirmAction && message.role !== 'user' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={async () => {
                            const action = message.confirmAction;
                            message.confirmAction = null;
                            if (action.type === 'generate-plugin') {
                              await handleGeneratePlugin(action.prompt);
                            } else if (action.type === 'create-plugin') {
                              await handleInstallPlugin(action.pluginData);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md font-medium"
                        >
                          ✓ Yes, Proceed
                        </button>
                        <button
                          onClick={handleCancelConfirmation}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded-md font-medium"
                        >
                          ✗ Cancel
                        </button>
                      </div>
                    )}

                    {/* Clarification Options - Interactive Selection */}
                    {message.data?.type === 'clarification_needed' && message.data?.clarification && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                          {message.data.clarification.question}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {message.data.clarification.options.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                // Send the action as a new message
                                setInputValue(option.action);
                                setTimeout(() => handleSend(), 100);
                              }}
                              className={cn(
                                "flex flex-col items-start px-3 py-1.5 rounded-md transition-colors text-left border",
                                option.isCreate
                                  ? "bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 border-green-300 dark:border-green-700"
                                  : "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 border-purple-200 dark:border-purple-700"
                              )}
                            >
                              <span className={cn(
                                "text-xs font-medium",
                                option.isCreate
                                  ? "text-green-700 dark:text-green-300"
                                  : "text-purple-700 dark:text-purple-300"
                              )}>
                                {option.isCreate && '+ '}{option.label}
                              </span>
                              {option.sublabel && (
                                <span className="text-[10px] text-purple-500 dark:text-purple-400">
                                  {option.sublabel}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Slot command execution result */}
                    {message.executionResult && (
                      <div className={cn(
                        'mt-2 pt-2 border-t flex items-center gap-2 text-xs',
                        message.executionResult.success
                          ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                          : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                      )}>
                        {message.executionResult.success ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Applied {message.executionResult.executed} change(s)</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{message.executionResult.errors?.[0] || 'Failed to apply changes'}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Slot command preview (when AI returns a command) */}
                    {message.slotCommand && !message.executionResult && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs font-medium mb-1">Proposed change:</p>
                        <pre className="text-xs bg-gray-200 dark:bg-gray-800 rounded p-2 overflow-x-auto max-h-32">
                          {JSON.stringify(message.slotCommand, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Feedback buttons - show for AI responses with candidateId */}
                    {message.role === 'assistant' && message.data?.candidateId && !message.feedbackGiven && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Was this helpful?</span>
                        <button
                          onClick={() => handleFeedback(message, true)}
                          className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-gray-400 hover:text-green-600 transition-colors"
                          title="Yes, helpful"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(message, false)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 transition-colors"
                          title="Not helpful"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Feedback submitted confirmation */}
                    {message.feedbackGiven && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center gap-1 text-xs text-gray-500">
                        {message.feedbackGiven === 'positive' ? (
                          <>
                            <ThumbsUp className="h-3 w-3 text-green-500" />
                            <span>Thanks for the feedback!</span>
                          </>
                        ) : (
                          <>
                            <ThumbsDown className="h-3 w-3 text-red-500" />
                            <span>Thanks, we'll improve!</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Generated Plugin Preview */}
                  {message.data?.type === 'plugin' && message.role !== 'user' && (
                    <PluginPreview
                      plugin={message.data.plugin}
                      onInstall={handleInstallPlugin}
                      onOpenEditor={openPluginEditor}
                    />
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Extended Thinking & Tool Usage Display */}
          {isProcessingAi && extendedThinkingEnabled && (
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 space-y-2">
                {/* Processing indicator */}
                {thinkingText && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs font-medium">Processing...</span>
                    </div>
                  </div>
                )}

                {/* Active tool indicator */}
                {activeTool && (
                  <div className={cn(
                    "border rounded-lg px-3 py-2",
                    activeTool.status === 'calling'
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  )}>
                    <div className="flex items-center gap-2">
                      {activeTool.status === 'calling' ? (
                        <>
                          <Database className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            Querying: {activeTool.name.replace(/_/g, ' ')}
                          </span>
                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-medium text-green-700 dark:text-green-300">
                            Retrieved data from: {activeTool.name.replace(/_/g, ' ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Tool results summary */}
                {toolResults.length > 0 && !activeTool && (
                  <div className="flex flex-wrap gap-1">
                    {toolResults.map((tool, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300"
                      >
                        <Search className="h-2.5 w-2.5" />
                        {tool.name.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Streaming response text */}
                {streamingText && (
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {streamingText}
                      <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-0.5" />
                    </p>
                  </div>
                )}

                {/* Default loading if nothing else shows */}
                {!thinkingText && !activeTool && !streamingText && (
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    <span className="text-xs text-gray-500">Initializing extended thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Standard loading indicator (non-extended mode) */}
          {isProcessingAi && !extendedThinkingEnabled && (
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            </div>
          )}

          {/* Cloning indicator */}
          {cloningTemplate && (
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cloning template...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-white dark:bg-gray-800 shrink-0">
        {/* Clear Chat Link */}
        {chatMessages.length > 0 && (
          <div className="flex justify-end mb-1">
            <button
              onClick={clearChatHistory}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Clear chat
            </button>
          </div>
        )}
        {/* Image Previews */}
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedImages.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={img.preview}
                  alt={`Attached ${index + 1}`}
                  className="w-12 h-12 object-cover rounded border border-gray-300 dark:border-gray-600"
                />
                <button
                  onClick={() => {
                    URL.revokeObjectURL(img.preview);
                    setAttachedImages(prev => prev.filter((_, i) => i !== index));
                  }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Describe changes for ${selectedPageType} page...`}
            className="min-h-[70px] max-h-[120px] resize-none text-sm pb-9 pr-12"
            disabled={isProcessingAi}
          />
          {/* Bottom toolbar inside textarea */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
            {/* Left side: Model selector & Upload */}
            <div className="flex items-center gap-1">
              {/* Model Selection Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  disabled={isProcessingAi || !currentModel}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-all",
                    showPluginEditor && pluginToEdit
                      ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={showPluginEditor && pluginToEdit ? 'Select AI Provider for Plugin' : 'Select AI Provider for Editor'}
                >
                  <span>{currentModel?.icon || '🤖'}</span>
                  <span className="font-medium">{currentModel ? PROVIDER_NAMES[currentModel.provider] : 'Loading...'}</span>
                  <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", showModelDropdown && "rotate-180")} />
                </button>

                {showModelDropdown && (
                  <div className="absolute bottom-full left-0 mb-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="p-1.5 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 px-2">
                        {showPluginEditor && pluginToEdit ? 'Select AI Provider for Plugin' : 'Select AI Provider for Editor'}
                      </p>
                    </div>
                    <div className="py-1">
                      {aiModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            localStorage.setItem('ai_default_model', model.id);
                            setShowModelDropdown(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                            selectedModel === model.id
                              ? "bg-purple-50 dark:bg-purple-900/30"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          )}
                        >
                          <span className="text-base">{model.icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "text-xs font-medium block",
                              selectedModel === model.id ? "text-purple-600 dark:text-purple-400" : "text-gray-800 dark:text-gray-200"
                            )}>
                              {PROVIDER_NAMES[model.provider]}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{model.name}</span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-medium",
                            showPluginEditor && pluginToEdit
                              ? "text-purple-500 dark:text-purple-400"
                              : "text-gray-500 dark:text-gray-400"
                          )}>
                            {showPluginEditor && pluginToEdit
                              ? getPluginCredits(model.id)
                              : model.credits} cr
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Extended Thinking Toggle */}
              <button
                onClick={() => setExtendedThinkingEnabled(!extendedThinkingEnabled)}
                disabled={isProcessingAi}
                className={cn(
                  "p-1 rounded transition-all flex items-center gap-0.5",
                  extendedThinkingEnabled
                    ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title={extendedThinkingEnabled ? "Extended thinking ON (shows reasoning & tools)" : "Enable extended thinking"}
              >
                <Brain className="w-3.5 h-3.5" />
                {extendedThinkingEnabled && <Zap className="w-2.5 h-2.5" />}
              </button>

              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingAi}
                className={cn(
                  "p-1 rounded transition-all",
                  "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title="Upload file"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;

                  // Limit to 4 images
                  const maxImages = 4;
                  const remainingSlots = maxImages - attachedImages.length;
                  const filesToProcess = files.slice(0, remainingSlots);

                  const newImages = await Promise.all(
                    filesToProcess.map(async (file) => {
                      const preview = URL.createObjectURL(file);
                      const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(file);
                      });
                      return { file, preview, base64, type: file.type };
                    })
                  );

                  setAttachedImages(prev => [...prev, ...newImages]);
                  e.target.value = ''; // Reset to allow same file selection
                }}
              />
            </div>

            {/* Right side: Submit Button */}
            <button
              onClick={extendedThinkingEnabled ? handleSendWithThinking : handleSend}
              disabled={(!inputValue.trim() && attachedImages.length === 0) || isProcessingAi}
              className={cn(
                "p-1.5 rounded-md transition-all",
                extendedThinkingEnabled
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
                "disabled:bg-gray-300 disabled:cursor-not-allowed"
              )}
              title={extendedThinkingEnabled ? "Send with extended thinking" : "Send message"}
            >
              {isProcessingAi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : extendedThinkingEnabled ? (
                <Brain className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Clone Template Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-80">
            <h3 className="text-sm font-semibold mb-3">Clone Template Plugin</h3>

            <div className="space-y-3">
              <div className="p-2 bg-purple-50 border border-purple-200 rounded flex items-center gap-2">
                <span className="text-lg">{templateToClone?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{templateToClone?.name}</div>
                  <div className="text-xs text-gray-500 truncate">{templateToClone?.description}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New Plugin Name
                </label>
                <Input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Enter plugin name"
                  className="text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmCloneTemplate();
                    if (e.key === 'Escape') {
                      setShowCloneModal(false);
                      setTemplateToClone(null);
                      setCloneName('');
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={confirmCloneTemplate}
                disabled={!cloneName.trim()}
                size="sm"
                className="flex-1"
              >
                Clone
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCloneModal(false);
                  setTemplateToClone(null);
                  setCloneName('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * PluginPreview - Renders a preview card for generated plugins
 */
const PluginPreview = ({ plugin, onInstall, onOpenEditor }) => {
  const [showCode, setShowCode] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await onInstall(plugin);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {plugin.name}
          </h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {plugin.description}
        </p>
      </div>

      {/* Plugin Actions */}
      <div className="p-2 flex items-center justify-between bg-white dark:bg-gray-800">
        <button
          onClick={() => setShowCode(!showCode)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          {showCode ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
          {showCode ? 'Hide' : 'View'} Code
        </button>
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs rounded-md"
        >
          <Download className="w-3 h-3" />
          {isInstalling ? 'Creating...' : 'Create Plugin'}
        </button>
      </div>

      {/* Code View */}
      {showCode && plugin.generatedFiles && (
        <div className="border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-auto">
          {plugin.generatedFiles.map((file, idx) => (
            <div key={idx}>
              <div className="px-2 py-1 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {file.name}
                </span>
              </div>
              <pre className="p-2 bg-gray-900 text-gray-100 text-xs overflow-x-auto">
                <code>{file.code?.substring(0, 500)}{file.code?.length > 500 ? '...' : ''}</code>
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkspaceAIPanel;
