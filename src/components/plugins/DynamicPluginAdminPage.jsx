/**
 * Dynamic Plugin Admin Page Loader
 * Loads and renders admin pages from plugin_admin_pages table
 * 100% database-driven - no hardcoded components!
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '@/api/client';
import { PageLoader } from '@/components/ui/page-loader';

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

      // Get plugin ID from slug - try multiple API response formats
      const pluginResponse = await apiClient.get(`plugins/registry`);

      console.log('Plugin API response:', pluginResponse);
      console.log('Response data:', pluginResponse.data);

      // Try different response structures
      const plugins = pluginResponse.data?.data || pluginResponse.data || [];
      console.log('Plugins array:', plugins);
      console.log('Looking for slug:', pluginSlug);

      const plugin = Array.isArray(plugins)
        ? plugins.find(p => p.slug === pluginSlug)
        : null;

      if (!plugin) {
        console.error('❌ Plugin not found in response');
        if (Array.isArray(plugins)) {
          console.error('Available plugins:');
          plugins.forEach((p, i) => {
            console.error(`  ${i + 1}. Name: "${p.name}", Slug: "${p.slug}", ID: ${p.id}`);
          });
          console.error(`\nSearching for: "${pluginSlug}"`);
          console.error('Slug matches:', plugins.map(p => p.slug === pluginSlug));
        } else {
          console.error('Plugins is not an array:', plugins);
        }
        throw new Error(`Plugin not found: ${pluginSlug}`);
      }

      console.log('✅ Found plugin:', plugin.name, plugin.id);

      // Get admin page from plugin_admin_pages table
      const pagesResponse = await apiClient.get(`plugins/registry/${plugin.id}`);
      const adminPages = pagesResponse.data?.adminPages || [];

      console.log('📋 Admin pages for plugin:', adminPages.length);

      const adminPage = adminPages.find(p => p.page_key === pageKey);

      if (!adminPage) {
        throw new Error(`Admin page not found: ${pageKey}`);
      }

      console.log('✅ Found admin page:', adminPage.page_name);
      console.log('📝 Component code length:', adminPage.component_code?.length);

      // Create React component from database code
      let componentCode = adminPage.component_code;

      // Remove import statements (we'll provide dependencies as parameters)
      componentCode = componentCode.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');

      // Extract the default export
      // Pattern: export default function ComponentName() { ... }
      // Result: function ComponentName() { ... }
      componentCode = componentCode.replace(/export\s+default\s+/, '');

      console.log('📝 Cleaned component code (first 200 chars):', componentCode.substring(0, 200));

      // Find the function name in the code
      // Match patterns like: function FunctionName() or const FunctionName =
      const functionNameMatch = componentCode.match(/(?:function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:\(|function))/);
      const componentName = functionNameMatch ? (functionNameMatch[1] || functionNameMatch[2]) : null;

      if (!componentName) {
        throw new Error('Could not find component function in code');
      }

      console.log('🔍 Found component name:', componentName);

      // Create component using eval
      // Need to return the component function by its dynamic name
      const Component = eval(`
        (function() {
          const React = arguments[0];
          const useState = arguments[1];
          const useEffect = arguments[2];
          const apiClient = arguments[3];
          const useCallback = arguments[4];
          const useMemo = arguments[5];

          ${componentCode}

          // Return the component by its detected name
          return ${componentName};
        })
      `)(React, useState, useEffect, apiClient, React.useCallback, React.useMemo);

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
