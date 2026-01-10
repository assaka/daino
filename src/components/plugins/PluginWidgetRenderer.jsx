/**
 * Plugin Widget Renderer
 * Loads and renders widget components from plugin_widgets table
 * Widget code is pre-compiled on the backend (JSX -> React.createElement)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '@/api/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

// Import UI components that widgets can use
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import * as LucideIcons from 'lucide-react';

export default function PluginWidgetRenderer({ widgetId, config, slotData }) {
  const [Widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWidget();
  }, [widgetId]);

  const loadWidget = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get(`/plugins/widgets/${widgetId}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to load widget');
      }

      // Widget code is pre-compiled on the backend (JSX -> React.createElement)
      const componentCode = response.widget.componentCode;
      const compiledComponent = compileWidgetComponent(componentCode);

      setWidget(() => compiledComponent);
    } catch (err) {
      console.error('Failed to load widget:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const compileWidgetComponent = (code) => {
    try {
      // Remove 'export default' from code if present
      let cleanCode = code.trim().replace(/^export\s+default\s+/, '');

      // Find the function name in the code
      const functionNameMatch = cleanCode.match(/(?:function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:\(|function))/);
      const componentName = functionNameMatch ? (functionNameMatch[1] || functionNameMatch[2]) : null;

      if (!componentName) {
        // If no named function found, try to wrap as anonymous function
        if (cleanCode.startsWith('function')) {
          cleanCode = `(${cleanCode})`;
        }

        // Create component with just React dependency
        const createComponent = new Function('React', `
          'use strict';
          return ${cleanCode};
        `);
        return createComponent(React);
      }

      // Create component with all dependencies
      const Component = eval(`
        (function() {
          const React = arguments[0];
          const useState = arguments[1];
          const useEffect = arguments[2];
          const useCallback = arguments[3];
          const useMemo = arguments[4];
          const Card = arguments[5];
          const CardContent = arguments[6];
          const CardHeader = arguments[7];
          const CardTitle = arguments[8];
          const Button = arguments[9];
          const Input = arguments[10];
          const Badge = arguments[11];
          const LucideIcons = arguments[12];

          // Destructure common Lucide icons
          const { Star, Check, X, Gift, ShoppingCart, Heart, User, Settings } = LucideIcons;

          ${cleanCode}

          return ${componentName};
        })
      `)(
        React, useState, useEffect, useCallback, useMemo,
        Card, CardContent, CardHeader, CardTitle,
        Button, Input, Badge, LucideIcons
      );

      return Component;
    } catch (error) {
      console.error('Failed to compile widget:', error);
      console.error('Widget code:', code);
      throw new Error(`Invalid widget code: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load plugin widget: {error}</AlertDescription>
      </Alert>
    );
  }

  if (!Widget) {
    return (
      <Alert>
        <AlertDescription>Widget not found</AlertDescription>
      </Alert>
    );
  }

  // Render the plugin widget with error boundary
  return (
    <ErrorBoundary>
      <Widget config={config} slotData={slotData} />
    </ErrorBoundary>
  );
}

// Error boundary for plugin widgets
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertDescription>Widget crashed: {this.state.error?.message}</AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
