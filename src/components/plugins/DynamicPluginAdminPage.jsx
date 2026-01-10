/**
 * Dynamic Plugin Admin Page Loader
 * Loads and renders admin pages from plugin_admin_pages table
 * 100% database-driven - no hardcoded components!
 * JSX is pre-compiled on the backend, so no runtime transformation needed
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '@/api/client';
import { PageLoader } from '@/components/ui/page-loader';

// Import UI components that plugins can use
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import * as LucideIcons from 'lucide-react';

const DynamicPluginAdminPage = () => {
  const { pluginSlug, pageKey } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [PageComponent, setPageComponent] = useState(null);

  useEffect(() => {
    loadPluginAdminPage();
  }, [pluginSlug, pageKey]);

  const loadPluginAdminPage = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📄 Loading plugin admin page:', { pluginSlug, pageKey });

      // Get plugin ID from slug
      const pluginResponse = await apiClient.get(`plugins/registry`);

      // apiClient transforms list responses - it returns array directly
      const plugins = Array.isArray(pluginResponse)
        ? pluginResponse
        : (pluginResponse.data || pluginResponse || []);

      const plugin = Array.isArray(plugins)
        ? plugins.find(p => p.slug === pluginSlug)
        : null;

      if (!plugin) {
        console.error('❌ Plugin not found:', pluginSlug);
        throw new Error(`Plugin not found: ${pluginSlug}`);
      }

      console.log('✅ Found plugin:', plugin.name, plugin.id);

      // Get admin page from plugin_admin_pages table
      const pagesResponse = await apiClient.get(`plugins/registry/${plugin.id}`);

      // For single record, apiClient returns { success, data: {...} }
      const pluginData = pagesResponse.data || pagesResponse;
      const adminPages = pluginData.adminPages || [];

      console.log('📋 Admin pages for plugin:', adminPages.length);

      const adminPage = adminPages.find(p => p.pageKey === pageKey);

      if (!adminPage) {
        throw new Error(`Admin page not found: ${pageKey}`);
      }

      console.log('✅ Found admin page:', adminPage.pageName);

      // Component code is pre-compiled on the backend (JSX -> React.createElement)
      let componentCode = adminPage.componentCode;

      // Find the function name in the code
      const functionNameMatch = componentCode.match(/(?:function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:\(|function))/);
      const componentName = functionNameMatch ? (functionNameMatch[1] || functionNameMatch[2]) : null;

      if (!componentName) {
        throw new Error('Could not find component function in code');
      }

      console.log('🔍 Found component name:', componentName);

      // Create component using eval with all dependencies
      const Component = eval(`
        (function() {
          const React = arguments[0];
          const useState = arguments[1];
          const useEffect = arguments[2];
          const apiClient = arguments[3];
          const useCallback = arguments[4];
          const useMemo = arguments[5];
          const Card = arguments[6];
          const CardContent = arguments[7];
          const CardHeader = arguments[8];
          const CardTitle = arguments[9];
          const Button = arguments[10];
          const Input = arguments[11];
          const Badge = arguments[12];
          const Checkbox = arguments[13];
          const LucideIcons = arguments[14];

          // Destructure common Lucide icons
          const { MessageCircle, Send, Star, Check, X, MessageSquare, AlertCircle } = LucideIcons;

          ${componentCode}

          // Return the component by its detected name
          return ${componentName};
        })
      `)(
        React, useState, useEffect, apiClient, useCallback, useMemo,
        Card, CardContent, CardHeader, CardTitle,
        Button, Input, Badge, Checkbox, LucideIcons
      );

      console.log('✅ Component created:', typeof Component, Component?.name);

      if (!Component || typeof Component !== 'function') {
        throw new Error('Failed to create component - not a function');
      }

      setPageComponent(() => Component);
      setLoading(false);

    } catch (err) {
      console.error('❌ Failed to load plugin admin page:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoader size="lg" className="h-screen" text="Loading plugin admin page..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <a href="/admin/plugins" className="text-blue-600 hover:underline">
            ← Back to Plugins
          </a>
        </div>
      </div>
    );
  }

  if (!PageComponent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">No component loaded</p>
      </div>
    );
  }

  // Render the dynamic component
  return <PageComponent />;
};

export default DynamicPluginAdminPage;
