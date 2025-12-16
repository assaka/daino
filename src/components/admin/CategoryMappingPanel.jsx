import React, { useState, useEffect, useCallback } from 'react';
import { FolderTree, RefreshCw, Wand2, Check, X, AlertCircle, ChevronDown, ChevronUp, Settings, Sparkles } from 'lucide-react';
import apiClient from '../../utils/api';
import FlashMessage from '@/components/storefront/FlashMessage';

/**
 * CategoryMappingPanel - Reusable component for mapping external categories to store categories
 * Used by Akeneo and Shopify integration pages
 */
const CategoryMappingPanel = ({
  integrationSource, // 'akeneo' or 'shopify'
  onFetchExternalCategories, // Function to fetch categories from external source
  externalCategories = null, // Pre-fetched external categories (optional)
  title = 'Category Mapping'
}) => {
  const [mappings, setMappings] = useState([]);
  const [storeCategories, setStoreCategories] = useState([]);
  const [stats, setStats] = useState({ total: 0, mapped: 0, unmapped: 0 });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'mapped', 'unmapped', 'auto_created'
  const [searchTerm, setSearchTerm] = useState('');
  const [savingMapping, setSavingMapping] = useState(null);

  // Auto-create settings state
  const [autoCreateSettings, setAutoCreateSettings] = useState({
    enabled: false,
    defaultIsActive: true,
    defaultHideInMenu: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  // Fetch mappings from API
  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/integrations/category-mappings/${integrationSource}`);
      if (response.data.success) {
        setMappings(response.data.mappings || []);
        setStoreCategories(response.data.storeCategories || []);
        setStats(response.data.stats || { total: 0, mapped: 0, unmapped: 0 });
      }
    } catch (error) {
      console.error('Error fetching category mappings:', error);
    } finally {
      setLoading(false);
    }
  }, [integrationSource]);

  // Fetch auto-create settings
  const fetchAutoCreateSettings = useCallback(async () => {
    try {
      const response = await apiClient.get(`/integrations/${integrationSource}/category-auto-create-settings`);
      if (response.data.success) {
        setAutoCreateSettings(response.data.settings);
      }
    } catch (error) {
      console.error('Error fetching auto-create settings:', error);
    }
  }, [integrationSource]);

  // Save auto-create settings
  const handleSaveAutoCreateSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await apiClient.put(
        `/integrations/${integrationSource}/category-auto-create-settings`,
        autoCreateSettings
      );
      if (response.data.success) {
        alert('Auto-create settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving auto-create settings:', error);
      alert('Failed to save settings: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchAutoCreateSettings();
  }, [fetchMappings, fetchAutoCreateSettings]);

  // Sync external categories to mappings table
  const handleSync = async () => {
    setSyncing(true);
    try {
      let categories = externalCategories;

      // Fetch from external source if not provided
      if (!categories && onFetchExternalCategories) {
        categories = await onFetchExternalCategories();
      }

      if (!categories || categories.length === 0) {
        alert('No external categories found to sync');
        return;
      }

      // Transform to expected format
      const formattedCategories = categories.map(cat => ({
        id: cat.id || cat.code,
        code: cat.code || cat.id,
        name: cat.name || cat.label || cat.title,
        parent_code: cat.parent || cat.parent_code || cat.parent_id
      }));

      const response = await apiClient.post(`/integrations/category-mappings/${integrationSource}/sync`, {
        categories: formattedCategories
      });

      if (response.data.success) {
        await fetchMappings();
        alert(`Synced ${response.data.results.created} new, ${response.data.results.updated} updated`);
      }
    } catch (error) {
      console.error('Error syncing categories:', error);
      setFlashMessage({ type: 'error', message: 'Failed to sync categories: ' + error.message });
    } finally {
      setSyncing(false);
    }
  };

  // Auto-match unmapped categories
  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const response = await apiClient.post(`/integrations/category-mappings/${integrationSource}/auto-match`);
      if (response.data.success) {
        await fetchMappings();
        alert(`Auto-matched ${response.data.results.matched} categories, ${response.data.results.unmatched} remain unmapped`);
      }
    } catch (error) {
      console.error('Error auto-matching:', error);
      alert('Failed to auto-match: ' + error.message);
    } finally {
      setAutoMatching(false);
    }
  };

  // Update a single mapping
  const handleMappingChange = async (externalCode, internalCategoryId) => {
    setSavingMapping(externalCode);
    try {
      const response = await apiClient.put(
        `/integrations/category-mappings/${integrationSource}/${encodeURIComponent(externalCode)}`,
        { internal_category_id: internalCategoryId || null }
      );

      if (response.data.success) {
        // Update local state
        setMappings(prev => prev.map(m =>
          m.external_category_code === externalCode
            ? { ...m, internal_category_id: internalCategoryId || null }
            : m
        ));
        // Update stats
        const newMapped = mappings.filter(m =>
          m.external_category_code === externalCode ? internalCategoryId : m.internal_category_id
        ).length;
        setStats(prev => ({
          ...prev,
          mapped: newMapped,
          unmapped: prev.total - newMapped
        }));
      }
    } catch (error) {
      console.error('Error updating mapping:', error);
      alert('Failed to update mapping: ' + error.message);
    } finally {
      setSavingMapping(null);
    }
  };

  // Build category tree for dropdown
  const buildCategoryOptions = () => {
    const options = [{ value: '', label: '-- Select Category --' }];

    // Sort by path for hierarchical display
    const sorted = [...storeCategories].sort((a, b) =>
      (a.path || a.name).localeCompare(b.path || b.name)
    );

    for (const cat of sorted) {
      const indent = '  '.repeat(cat.level || 0);
      options.push({
        value: cat.id,
        label: `${indent}${cat.name}`
      });
    }

    return options;
  };

  // Calculate auto-created count for stats
  const autoCreatedCount = mappings.filter(m => m.auto_created).length;

  // Filter mappings
  const filteredMappings = mappings.filter(m => {
    // Filter by status
    if (filter === 'mapped' && !m.internal_category_id) return false;
    if (filter === 'unmapped' && m.internal_category_id) return false;
    if (filter === 'auto_created' && !m.auto_created) return false;

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (m.external_category_code || '').toLowerCase().includes(term) ||
        (m.external_category_name || '').toLowerCase().includes(term)
      );
    }

    return true;
  });

  const categoryOptions = buildCategoryOptions();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-indigo-600" />
          <h3 className="font-medium text-gray-900">{title}</h3>
          {stats.unmapped > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
              {stats.unmapped} unmapped
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            {stats.mapped}/{stats.total} mapped
          </div>
          {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          {/* Auto-Create Settings Section */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowSettings(!showSettings)}
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Auto-Create Settings</h4>
                {autoCreateSettings.enabled && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Enabled
                  </span>
                )}
              </div>
              {showSettings ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </div>

            {showSettings && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-gray-600">
                  When enabled, categories that don't have a mapping will be automatically created during product import.
                </p>

                {/* Enable Auto-Create Toggle */}
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <div>
                    <label className="font-medium text-gray-800">Enable Auto-Creation</label>
                    <p className="text-xs text-gray-500">Automatically create categories when not mapped</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCreateSettings.enabled}
                      onChange={(e) => setAutoCreateSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {autoCreateSettings.enabled && (
                  <>
                    {/* Default Active Status */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <div>
                        <label className="font-medium text-gray-800">Default: Active</label>
                        <p className="text-xs text-gray-500">New categories will be active (visible to customers)</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoCreateSettings.defaultIsActive}
                          onChange={(e) => setAutoCreateSettings(prev => ({ ...prev, defaultIsActive: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {/* Default Hide in Menu */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <div>
                        <label className="font-medium text-gray-800">Default: Hide in Menu</label>
                        <p className="text-xs text-gray-500">New categories will be hidden from navigation menu</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoCreateSettings.defaultHideInMenu}
                          onChange={(e) => setAutoCreateSettings(prev => ({ ...prev, defaultHideInMenu: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </>
                )}

                <button
                  onClick={handleSaveAutoCreateSettings}
                  disabled={savingSettings}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Categories'}
            </button>

            <button
              onClick={handleAutoMatch}
              disabled={autoMatching || stats.unmapped === 0}
              className="inline-flex items-center px-3 py-1.5 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            >
              <Wand2 className={`h-4 w-4 mr-1.5 ${autoMatching ? 'animate-pulse' : ''}`} />
              {autoMatching ? 'Matching...' : 'Auto-Match'}
            </button>

            <div className="flex-1" />

            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All ({stats.total})</option>
              <option value="mapped">Mapped ({stats.mapped})</option>
              <option value="unmapped">Unmapped ({stats.unmapped})</option>
              {autoCreatedCount > 0 && (
                <option value="auto_created">Auto-Created ({autoCreatedCount})</option>
              )}
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-48"
            />
          </div>

          {/* Mappings Table */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading mappings...</div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {mappings.length === 0 ? (
                <div>
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No category mappings yet.</p>
                  <p className="text-sm">Click "Sync Categories" to import from {integrationSource}.</p>
                </div>
              ) : (
                <p>No mappings match your filter.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      External Category
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Store Category
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {mapping.external_category_name || mapping.external_category_code}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 font-mono">
                        {mapping.external_category_code}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={mapping.internal_category_id || ''}
                          onChange={(e) => handleMappingChange(mapping.external_category_code, e.target.value)}
                          disabled={savingMapping === mapping.external_category_code}
                          className={`w-full px-2 py-1 text-sm border rounded-md ${
                            mapping.internal_category_id
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-300'
                          } ${savingMapping === mapping.external_category_code ? 'opacity-50' : ''}`}
                        >
                          {categoryOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {savingMapping === mapping.external_category_code ? (
                          <RefreshCw className="h-4 w-4 mx-auto text-gray-400 animate-spin" />
                        ) : mapping.internal_category_id ? (
                          <div className="flex items-center justify-center gap-1">
                            <Check className="h-4 w-4 text-green-500" />
                            {mapping.auto_created && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                Auto
                              </span>
                            )}
                          </div>
                        ) : (
                          <X className="h-4 w-4 mx-auto text-gray-300" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Info text */}
          <p className="mt-4 text-xs text-gray-500">
            Map external {integrationSource} categories to your store categories.
            Products will be assigned to the mapped store category during import.
            Use "Auto-Match" to automatically match by name/slug.
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryMappingPanel;
