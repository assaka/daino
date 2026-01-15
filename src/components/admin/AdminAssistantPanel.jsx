import React, { useState, useRef, useEffect } from 'react';
import { useAdminAssistant } from '@/contexts/AdminAssistantContext';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import useAIChat from '@/hooks/useAIChat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    sendMessage
  } = useAIChat({
    storeId,
    mode: 'admin'
  });

  const [inputValue, setInputValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);

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
    if (!inputValue.trim() || isProcessing) return;

    const message = inputValue.trim();
    setInputValue('');
    setHistoryIndex(-1);

    await sendMessage(message);
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
              {messages.length > 0 && (
                <div className="flex justify-end mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-xs text-gray-400 hover:text-gray-600 px-2"
                    onClick={clearMessages}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  className="min-h-[40px] max-h-24 resize-none text-sm bg-white"
                  disabled={isProcessing}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
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
            <div className="p-3 border-t bg-gray-50 rounded-b-xl">
              <div className="flex gap-2">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  className="min-h-[40px] max-h-20 resize-none text-sm"
                  disabled={isProcessing}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isProcessing}
                >
                  <Send className="w-4 h-4" />
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
