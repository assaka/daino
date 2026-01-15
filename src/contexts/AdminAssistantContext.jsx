import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * AdminAssistantContext - Simple state management for the admin AI assistant panel
 * Similar to Shopify Sidekick - a floating assistant accessible from anywhere in admin
 */

const AdminAssistantContext = createContext();

export const AdminAssistantProvider = ({ children }) => {
  // Panel visibility state - default open on desktop
  const [isOpen, setIsOpen] = useState(true);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Toggle panel open/closed
   */
  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  /**
   * Open the panel
   */
  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  /**
   * Close the panel
   */
  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Add a message to chat
   */
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, {
      ...message,
      id: Date.now(),
      timestamp: new Date().toISOString()
    }]);
  }, []);

  /**
   * Clear chat history
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const value = useMemo(() => ({
    isOpen,
    messages,
    isProcessing,
    setIsProcessing,
    togglePanel,
    openPanel,
    closePanel,
    addMessage,
    clearMessages
  }), [
    isOpen,
    messages,
    isProcessing,
    togglePanel,
    openPanel,
    closePanel,
    addMessage,
    clearMessages
  ]);

  return (
    <AdminAssistantContext.Provider value={value}>
      {children}
    </AdminAssistantContext.Provider>
  );
};

/**
 * Hook to access Admin Assistant context
 */
export const useAdminAssistant = () => {
  const context = useContext(AdminAssistantContext);
  if (!context) {
    throw new Error('useAdminAssistant must be used within AdminAssistantProvider');
  }
  return context;
};

export default AdminAssistantContext;
