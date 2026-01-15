import React, { useState, useRef, useEffect } from 'react';
import { useAdminAssistant } from '@/contexts/AdminAssistantContext';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import useAIChat from '@/hooks/useAIChat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import apiClient from '@/api/client';
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Brain,
  Zap,
  ChevronDown,
  Paperclip,
  Image
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PROVIDER_NAMES = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  groq: 'Groq',
  deepseek: 'DeepSeek'
};

// Get saved model preference
const getSavedModel = (models) => {
  if (!models || models.length === 0) return null;
  try {
    const saved = localStorage.getItem('ai_default_model');
    if (saved && models.find(m => m.id === saved)) return saved;
    if (saved) localStorage.removeItem('ai_default_model');
  } catch (e) {}
  const defaultModel = models.find(m => m.isProviderDefault);
  return defaultModel?.id || models[0]?.id;
};

/**
 * AdminAssistantPanel - Fixed right sidebar on desktop, floating on mobile
 * Uses the shared useAIChat hook for the same AI engine as WorkspaceAIPanel
 */
const AdminAssistantPanel = ({ className }) => {
  const { isOpen, closePanel, togglePanel } = useAdminAssistant();
  const { getSelectedStoreId } = useStoreSelection();
  const storeId = getSelectedStoreId();

  // Use shared AI chat engine
  const {
    messages,
    isProcessing,
    inputHistory,
    clearMessages,
    loadHistory,
    loadInputHistory,
    sendMessage,
    sendWithStreaming
  } = useAIChat({
    storeId,
    mode: 'admin'
  });

  const [inputValue, setInputValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Model selection state
  const [aiModels, setAiModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // File attachment state
  const [attachedImages, setAttachedImages] = useState([]);

  // Extended thinking mode state
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [streamingText, setStreamingText] = useState('');

  // Get current model object
  const currentModel = aiModels.find(m => m.id === selectedModel) || aiModels[0] || null;

  // Fetch AI models from API on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await apiClient.get('/ai/models');
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
          const defaultModel = getSavedModel(models);
          setSelectedModel(defaultModel);
        }
      } catch (error) {
        console.error('Failed to fetch AI models:', error.message);
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModels();
  }, []);

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

  // Load history on mount
  useEffect(() => {
    if (storeId) {
      loadHistory();
      loadInputHistory();
    }
  }, [storeId, loadHistory, loadInputHistory]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle send message
  const handleSend = async () => {
    if ((!inputValue.trim() && attachedImages.length === 0) || isProcessing) return;

    const message = inputValue.trim();
    setInputValue('');
    setHistoryIndex(-1);

    await sendMessage(message, {
      images: attachedImages,
      extraContext: {
        modelId: selectedModel
      }
    });

    // Clear attached images after sending
    attachedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setAttachedImages([]);
  };

  // Handle send with extended thinking
  const handleSendWithThinking = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const message = inputValue.trim();
    setInputValue('');
    setHistoryIndex(-1);
    setThinkingText('');
    setStreamingText('');

    await sendWithStreaming(message, {
      onThinking: (text) => setThinkingText(text),
      onText: (text) => setStreamingText(text),
      onToolUse: (tool) => console.log('Tool:', tool)
    });

    setThinkingText('');
    setStreamingText('');
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

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
    e.target.value = '';
  };

  // Remove attached image
  const removeAttachedImage = (index) => {
    setAttachedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (extendedThinkingEnabled) {
        handleSendWithThinking();
      } else {
        handleSend();
      }
    }
    // Arrow up for input history
    if (e.key === 'ArrowUp' && inputHistory.length > 0) {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
      setHistoryIndex(newIndex);
      setInputValue(inputHistory[newIndex] || '');
    }
    // Arrow down for input history
    if (e.key === 'ArrowDown' && historyIndex > -1) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setInputValue(newIndex >= 0 ? inputHistory[newIndex] : '');
    }
  };

  return (
    <>
      {/* Desktop: Fixed right panel */}
      <div
        className={cn(
          "hidden lg:flex flex-col bg-white border-l border-gray-200 transition-all duration-300",
          isOpen ? "w-80 xl:w-96" : "w-0",
          className
        )}
      >
        {isOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 border-b">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">ASI Assistant</h3>
                  <p className="text-white/70 text-xs">AI-powered help</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                onClick={closePanel}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages Area */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                    <Bot className="w-7 h-7 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Hi there!</h4>
                  <p className="text-sm text-gray-500 max-w-xs mb-4">
                    I can help with products, orders, settings, and more.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      'Show sales today',
                      'Help with SEO',
                      'Create coupon'
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-full text-blue-700 transition-colors border border-blue-200"
                        onClick={() => setInputValue(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-2",
                        message.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                          message.role === 'user'
                            ? "bg-blue-600"
                            : message.error
                              ? "bg-red-100"
                              : "bg-gray-100"
                        )}
                      >
                        {message.role === 'user' ? (
                          <User className="w-3 h-3 text-white" />
                        ) : (
                          <Bot className={cn(
                            "w-3 h-3",
                            message.error ? "text-red-600" : "text-gray-600"
                          )} />
                        )}
                      </div>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                          message.role === 'user'
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : message.error
                              ? "bg-red-50 text-red-800 rounded-bl-sm border border-red-200"
                              : "bg-gray-100 text-gray-800 rounded-bl-sm"
                        )}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        {message.credits && (
                          <p className="text-xs mt-1 opacity-60">
                            <Zap className="w-3 h-3 inline mr-1" />
                            {message.credits} credits
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Processing indicator */}
                  {isProcessing && (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                        <Bot className="w-3 h-3 text-gray-600" />
                      </div>
                      <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          <span className="text-sm text-gray-500">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
              {/* Clear button and credit info */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  {currentModel && (
                    <>
                      <Zap className="w-3 h-3" />
                      <span>{currentModel.credits} credits/msg</span>
                    </>
                  )}
                </div>
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-xs text-gray-400 hover:text-gray-600 px-2"
                    onClick={clearMessages}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Attached Images Preview */}
              {attachedImages.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {attachedImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.preview}
                        alt={`Attached ${idx + 1}`}
                        className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => removeAttachedImage(idx)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Thinking indicator */}
              {extendedThinkingEnabled && isProcessing && thinkingText && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-1 text-xs text-amber-700 mb-1">
                    <Brain className="w-3 h-3" />
                    <span className="font-medium">Thinking...</span>
                  </div>
                  <p className="text-xs text-amber-600 line-clamp-2">{thinkingText}</p>
                </div>
              )}

              {/* Input row with controls */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    className="min-h-[40px] max-h-24 resize-none text-sm bg-white"
                    disabled={isProcessing}
                  />

                  {/* Control buttons row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1" ref={dropdownRef}>
                      {/* Model Selector */}
                      <div className="relative">
                        <button
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          disabled={isProcessing || !currentModel}
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-all",
                            "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                          title="Select AI Provider"
                        >
                          <span>{currentModel?.icon || '🤖'}</span>
                          <span className="font-medium">{currentModel ? PROVIDER_NAMES[currentModel.provider] : 'Loading...'}</span>
                          <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", showModelDropdown && "rotate-180")} />
                        </button>

                        {showModelDropdown && (
                          <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                            <div className="p-1.5 border-b border-gray-100">
                              <p className="text-[10px] font-medium text-gray-500 px-2">Select AI Provider</p>
                            </div>
                            <div className="py-1 max-h-48 overflow-y-auto">
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
                                      ? "bg-blue-50"
                                      : "hover:bg-gray-50"
                                  )}
                                >
                                  <span className="text-base">{model.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <span className={cn(
                                      "text-xs font-medium block",
                                      selectedModel === model.id ? "text-blue-600" : "text-gray-800"
                                    )}>
                                      {PROVIDER_NAMES[model.provider]}
                                    </span>
                                    <span className="text-[10px] text-gray-500">{model.name}</span>
                                  </div>
                                  <span className="text-[10px] font-medium text-gray-500">
                                    {model.credits} cr
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
                        disabled={isProcessing}
                        className={cn(
                          "p-1 rounded transition-all flex items-center gap-0.5",
                          extendedThinkingEnabled
                            ? "text-amber-600 bg-amber-50"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        title={extendedThinkingEnabled ? "Extended thinking ON" : "Enable extended thinking"}
                      >
                        <Brain className="w-3.5 h-3.5" />
                        {extendedThinkingEnabled && <Zap className="w-2.5 h-2.5" />}
                      </button>

                      {/* Upload Button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing || attachedImages.length >= 4}
                        className={cn(
                          "p-1 rounded transition-all",
                          "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        title="Upload image (max 4)"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  size="icon"
                  className={cn(
                    "h-10 w-10 shrink-0",
                    extendedThinkingEnabled
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                  onClick={extendedThinkingEnabled ? handleSendWithThinking : handleSend}
                  disabled={(!inputValue.trim() && attachedImages.length === 0) || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : extendedThinkingEnabled ? (
                    <Brain className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop: Collapsed toggle tab */}
      {!isOpen && (
        <button
          onClick={togglePanel}
          className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-gradient-to-b from-blue-600 to-indigo-600 text-white px-1.5 py-4 rounded-l-lg shadow-lg hover:shadow-xl transition-all items-center gap-1 group"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="writing-vertical text-xs font-medium">ASI Assistant</span>
        </button>
      )}

      {/* Mobile: Floating panel */}
      <div
        className={cn(
          "lg:hidden fixed right-4 bottom-4 z-50 flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 transition-all duration-300",
          isOpen ? "w-[calc(100vw-2rem)] max-w-md h-[70vh]" : "w-14 h-14"
        )}
      >
        {isOpen ? (
          <>
            {/* Mobile Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-white" />
                <h3 className="text-white font-semibold">ASI Assistant</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                onClick={closePanel}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Mobile Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-6">
                  <Bot className="w-12 h-12 text-blue-600 mb-3" />
                  <p className="text-sm text-gray-500">How can I help you?</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-2",
                        message.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                          message.role === 'user'
                            ? "bg-blue-600 text-white"
                            : message.error
                              ? "bg-red-50 text-red-800 border border-red-200"
                              : "bg-gray-100 text-gray-800"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.credits && message.role === 'assistant' && (
                          <p className="text-xs mt-1 opacity-60">
                            <Zap className="w-3 h-3 inline mr-1" />
                            {message.credits} credits
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex gap-2">
                      <div className="bg-gray-100 rounded-xl px-3 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Mobile Input */}
            <div className="p-3 border-t bg-gray-50 rounded-b-xl space-y-2">
              {/* Credit info */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  {currentModel && (
                    <>
                      <Zap className="w-3 h-3" />
                      <span>{currentModel.credits} cr/msg</span>
                    </>
                  )}
                </div>
                {messages.length > 0 && (
                  <button
                    className="text-xs text-gray-400 hover:text-gray-600"
                    onClick={clearMessages}
                  >
                    <Trash2 className="w-3 h-3 inline mr-1" />
                    Clear
                  </button>
                )}
              </div>

              {/* Attached Images Preview */}
              {attachedImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {attachedImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.preview}
                        alt={`Attached ${idx + 1}`}
                        className="w-10 h-10 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => removeAttachedImage(idx)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input and controls */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    className="min-h-[40px] max-h-20 resize-none text-sm"
                    disabled={isProcessing}
                  />
                  {/* Control buttons */}
                  <div className="flex items-center gap-1">
                    {/* Model selector */}
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      disabled={isProcessing || !currentModel}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded"
                    >
                      <span>{currentModel?.icon || '🤖'}</span>
                      <span>{currentModel ? PROVIDER_NAMES[currentModel.provider] : '...'}</span>
                    </button>
                    {/* Thinking toggle */}
                    <button
                      onClick={() => setExtendedThinkingEnabled(!extendedThinkingEnabled)}
                      disabled={isProcessing}
                      className={cn(
                        "p-1 rounded",
                        extendedThinkingEnabled ? "text-amber-600 bg-amber-50" : "text-gray-400"
                      )}
                    >
                      <Brain className="w-3.5 h-3.5" />
                    </button>
                    {/* Upload */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing || attachedImages.length >= 4}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <Button
                  size="icon"
                  className={cn(
                    "h-10 w-10 shrink-0",
                    extendedThinkingEnabled ? "bg-amber-600 hover:bg-amber-700" : ""
                  )}
                  onClick={extendedThinkingEnabled ? handleSendWithThinking : handleSend}
                  disabled={(!inputValue.trim() && attachedImages.length === 0) || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : extendedThinkingEnabled ? (
                    <Brain className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <button
            onClick={togglePanel}
            className="w-full h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center"
          >
            <Sparkles className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </>
  );
};

export default AdminAssistantPanel;
