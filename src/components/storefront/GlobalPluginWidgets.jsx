/**
 * Global Plugin Widgets
 * Renders floating/global widgets from active plugins on all storefront pages
 * Supports widgets with category "support", "floating", or "global"
 */

import React, { useState, useEffect } from 'react';
import PluginWidgetRenderer from '@/components/plugins/PluginWidgetRenderer';

const GlobalPluginWidgets = () => {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGlobalWidgets();
  }, []);

  const loadGlobalWidgets = async () => {
    try {
      const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
      const headers = {};
      if (storeId) {
        headers['x-store-id'] = storeId;
      }

      // Fetch active plugins with their widgets
      const response = await fetch('/api/plugins/active', { headers });
      const data = await response.json();

      // API returns { success, data: [...plugins] }
      const plugins = data.success ? (data.data || data.plugins || []) : [];

      if (plugins.length > 0) {
        // Collect all global/floating widgets from active plugins
        const globalWidgets = [];

        for (const plugin of plugins) {
          if (plugin.widgets && Array.isArray(plugin.widgets)) {
            for (const widget of plugin.widgets) {
              // Include widgets with specific categories meant for global display
              const category = (widget.category || '').toLowerCase();
              const isGlobalWidget = ['support', 'floating', 'global', 'chat'].includes(category);

              if (isGlobalWidget && widget.is_enabled !== false) {
                globalWidgets.push({
                  id: widget.widgetId || widget.widget_id,
                  pluginId: plugin.id,
                  pluginSlug: plugin.slug,
                  config: widget.defaultConfig || widget.default_config || {},
                  category: widget.category,
                  ...widget
                });
              }
            }
          }
        }

        setWidgets(globalWidgets);
      }
    } catch (error) {
      console.error('Failed to load global widgets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || widgets.length === 0) {
    return null;
  }

  return (
    <>
      {widgets.map((widget) => (
        <PluginWidgetRenderer
          key={widget.id}
          widgetId={widget.id}
          config={widget.config}
          slotData={{}}
        />
      ))}
    </>
  );
};

export default GlobalPluginWidgets;
