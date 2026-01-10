/**
 * Dynamic Plugin Admin Page Loader
 * Loads and renders admin pages from plugin_admin_pages table
 * 100% database-driven - no hardcoded components!
 * Supports both JSX and React.createElement syntax via Babel transformation
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

// Load Babel standalone for JSX transformation
let babelLoaded = false;
let babelLoadPromise = null;

const loadBabel = () => {
  if (babelLoaded) return Promise.resolve();
  if (babelLoadPromise) return babelLoadPromise;

  babelLoadPromise = new Promise((resolve, reject) => {
    if (window.Babel) {
      babelLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@babel/standalone/babel.min.js';
    script.async = true;
    script.onload = () => {
      babelLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Babel'));
    document.head.appendChild(script);
  });

  return babelLoadPromise;
};

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

      console.log('Plugin API response:', pluginResponse);

      // apiClient transforms list responses - it returns array directly
      const plugins = Array.isArray(pluginResponse)
        ? pluginResponse
        : (pluginResponse.data || pluginResponse || []);
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

      console.log('Pages API response:', pagesResponse);

      // For single record, apiClient returns { success, data: {...} }
      const pluginData = pagesResponse.data || pagesResponse;
      const adminPages = pluginData.adminPages || [];

      console.log('📋 Admin pages for plugin:', adminPages.length, adminPages);

      const adminPage = adminPages.find(p => p.pageKey === pageKey);

      if (!adminPage) {
        throw new Error(`Admin page not found: ${pageKey}`);
      }

      console.log('✅ Found admin page:', adminPage.pageName);
      console.log('📝 Component code length:', adminPage.componentCode?.length);

      // Create React component from database code
      let componentCode = adminPage.componentCode;

      // Remove import statements (we'll provide dependencies as parameters)
      componentCode = componentCode.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');

      // Extract the default export
      componentCode = componentCode.replace(/export\s+default\s+/, '');

      console.log('📝 Cleaned component code (first 200 chars):', componentCode.substring(0, 200));

      // Check if code contains JSX (has < followed by letter or / )
      const hasJSX = /<[A-Za-z\/]/.test(componentCode);
      console.log('📝 Has JSX:', hasJSX);

      // If JSX, load Babel and transform
      if (hasJSX) {
        console.log('📝 Loading Babel for JSX transformation...');
        await loadBabel();

        try {
          const transformed = window.Babel.transform(componentCode, {
            presets: ['react'],
            filename: 'component.jsx'
          });
          componentCode = transformed.code;
          console.log('📝 Transformed code (first 300 chars):', componentCode.substring(0, 300));
        } catch (babelError) {
          console.error('❌ Babel transformation failed:', babelError);
          throw new Error(`JSX transformation failed: ${babelError.message}`);
        }
      }

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
