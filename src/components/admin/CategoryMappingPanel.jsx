import React, { useState, useEffect, useCallback } from 'react';
import { FolderTree, RefreshCw, Wand2, Check, X, AlertCircle, ChevronDown, ChevronUp, Plus, Download } from 'lucide-react';
import apiClient from '../../utils/api';
import FlashMessage from '@/components/storefront/FlashMessage';

/**
 * CategoryMappingPanel - Reusable component for mapping external categories to store categories
 * Used by Akeneo and Shopify integration pages
 */
const CategoryMappingPanel = ({
  integrationSource, // 'akeneo' or 'shopify'
  title = 'Category Mapping',
  onJobScheduled = null // Callback when a job is scheduled (to refresh ImportJobProgress)
}) => {
  const [mappings, setMappings] = useState([]);
  const [storeCategories, setStoreCategories] = useState([]);
  const [stats, setStats] = useState({ total: 0, mapped: 0, unmapped: 0 });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'mapped', 'unmapped', 'auto_created'
  const [searchTerm, setSearchTerm] = useState('');
  const [savingMapping, setSavingMapping] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const [targetRootCategoryId, setTargetRootCategoryId] = useState('');

  // External root category filter (for filtering which categories to fetch/create)
  const [externalRootCategories, setExternalRootCategories] = useState([]);
  const [selectedExternalRootFilter, setSelectedExternalRootFilter] = useState('');
  const [loadingExternalRoots, setLoadingExternalRoots] = useState(false);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Get root categories (level 0 or no parent)
  const rootCategories = storeCategories.filter(cat => cat.level === 0 || !cat.parent_id);

  // Fetch mappings from API
  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/integrations/category-mappings/${integrationSource}`);
      if (response.success) {
        setMappings(response.mappings || []);
        setStoreCategories(response.storeCategories || []);
        setStats(response.stats || { total: 0, mapped: 0, unmapped: 0 });
      }
    } catch (error) {
      console.error('Error fetching category mappings:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load mappings' });
    } finally {
      setLoading(false);
    }
  }, [integrationSource]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  // Fetch external root categories (for Akeneo filtering)
  const fetchExternalRootCategories = useCallback(async () => {
    if (integrationSource !== 'akeneo') {
      // Shopify collections are flat, no root filtering needed
      return;
    }

    setLoadingExternalRoots(true);
    try {
      const response = await apiClient.get(`/integrations/akeneo/categories`);
      if (response.success && response.categories) {
        // Get root categories (categories with no parent)
        const roots = response.categories.filter(cat => !cat.parent);
        setExternalRootCategories(roots.map(cat => ({
          code: cat.code,
          name: cat.labels?.en_US || cat.labels?.en_GB || cat.labels?.en || cat.code
        })));
      }
    } catch (error) {
      console.error('Error fetching external root categories:', error);
      // Don't show error - this is optional functionality
    } finally {
      setLoadingExternalRoots(false);
    }
  }, [integrationSource]);

  // Fetch external root categories when component mounts (for Akeneo only)
  useEffect(() => {
    if (integrationSource === 'akeneo') {
      fetchExternalRootCategories();
    }
  }, [integrationSource, fetchExternalRootCategories]);

  // Fetch categories from external integration
  const handleFetchCategories = async () => {
    setFetching(true);
    setFlashMessage(null);
    try {
      // Build filters object
      const filters = {};
      if (selectedExternalRootFilter && integrationSource === 'akeneo') {
        filters.rootCategories = [selectedExternalRootFilter];
      }

      const response = await apiClient.post(`/integrations/category-mappings/${integrationSource}/sync`, { filters });
      if (response.success) {
        await fetchMappings();
        const filterMsg = selectedExternalRootFilter ? ` (filtered by root: ${selectedExternalRootFilter})` : '';
        setFlashMessage({
          type: 'success',
          message: (response.message || `Fetched ${response.results?.created || 0} new, ${response.results?.updated || 0} updated`) + filterMsg
        });
      } else {
        setFlashMessage({
          type: 'error',
          message: response.message || 'Failed to fetch categories'
        });
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setFlashMessage({
        type: 'error',
        message: error.message || 'Failed to fetch categories'
      });
    } finally {
      setFetching(false);
    }
  };

  // Auto-match unmapped categories
  const handleAutoMatch = async () => {
    setAutoMatching(true);
    setFlashMessage(null);
    try {
      const response = await apiClient.post(`/integrations/category-mappings/${integrationSource}/auto-match`);
      if (response.success) {
        await fetchMappings();
        setFlashMessage({
          type: 'success',
          message: `Auto-matched ${response.results?.matched || 0} categories`
        });
      }
    } catch (error) {
      console.error('Error auto-matching:', error);
      setFlashMessage({ type: 'error', message: 'Failed to auto-match categories' });
    } finally {
      setAutoMatching(false);
    }
  };

  // Create categories from unmapped (via background job)
  const handleCreateFromUnmapped = async () => {
    if (!targetRootCategoryId) {
      setFlashMessage({ type: 'error', message: 'Please select a root category first' });
      return;
    }

    setCreating(true);
    setShowConfirmModal(false);
    setFlashMessage(null);
    try {
      // Build filters object for external root category filtering
      const filters = {};
      if (selectedExternalRootFilter && integrationSource === 'akeneo') {
        filters.rootCategories = [selectedExternalRootFilter];
      }

      const response = await apiClient.post(`/integrations/category-mappings/${integrationSource}/create-categories-job`, {
        targetRootCategoryId,
        filters
      });
      if (response.success) {
        setFlashMessage({
          type: 'success',
          message: 'Category creation job started! Track progress in Import Jobs.'
        });
        // Notify parent to refresh ImportJobProgress
        if (onJobScheduled) {
          onJobScheduled(response.jobId);
        }
        // Refresh mappings after a delay to let the job start
        setTimeout(() => fetchMappings(), 3000);
      } else {
        setFlashMessage({ type: 'error', message: response.message || 'Failed to schedule job' });
      }
    } catch (error) {
      console.error('Error scheduling category creation job:', error);
      setFlashMessage({ type: 'error', message: error.message || 'Failed to schedule category creation job' });
    } finally {
      setCreating(false);
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

      if (response.success) {
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
      setFlashMessage({ type: 'error', message: 'Failed to update mapping' });
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
  const sourceLabel = integrationSource === 'akeneo' ? 'Akeneo' : 'Shopify';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Categories</h3>
            <p className="text-gray-600 mb-4">
              You are about to create <span className="font-bold text-indigo-600">{stats.unmapped}</span> new categories from unmapped {sourceLabel} {integrationSource === 'shopify' ? 'collections' : 'categories'}.
              {selectedExternalRootFilter && (
                <span className="block mt-2 text-sm text-indigo-600">
                  Filtered by root: <span className="font-medium">{externalRootCategories.find(r => r.code === selectedExternalRootFilter)?.name || selectedExternalRootFilter}</span>
                </span>
              )}
            </p>

            {/* Root Category Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Root Category <span className="text-red-500">*</span>
              </label>
              <select
                value={targetRootCategoryId}
                onChange={(e) => setTargetRootCategoryId(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-md ${
                  targetRootCategoryId ? 'border-green-300 bg-green-50' : 'border-gray-300'
                }`}
              >
                <option value="">-- Select Root Category --</option>
                {rootCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                All imported categories will be placed under this root category.
              </p>
            </div>

            {rootCategories.length === 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  No root categories found. Please create at least one root category in the Categories section first.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFromUnmapped}
                disabled={!targetRootCategoryId || rootCategories.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create {stats.unmapped} Categories
              </button>
            </div>
          </div>
        </div>
      )}

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
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* External Root Category Filter (Akeneo only) */}
            {integrationSource === 'akeneo' && externalRootCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">Filter by Root:</label>
                <select
                  value={selectedExternalRootFilter}
                  onChange={(e) => setSelectedExternalRootFilter(e.target.value)}
                  disabled={loadingExternalRoots || fetching}
                  className={`px-2 py-1.5 text-sm border rounded-md ${
                    selectedExternalRootFilter ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">All Categories</option>
                  {externalRootCategories.map(root => (
                    <option key={root.code} value={root.code}>{root.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleFetchCategories}
              disabled={fetching}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className={`h-4 w-4 mr-1.5 ${fetching ? 'animate-pulse' : ''}`} />
              {fetching ? 'Fetching...' : 'Fetch Categories'}
            </button>

            {stats.unmapped > 0 && (
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={creating}
                className="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
              >
                <Plus className={`h-4 w-4 mr-1.5 ${creating ? 'animate-spin' : ''}`} />
                {creating ? 'Scheduling...' : `Create ${stats.unmapped} Categories`}
              </button>
            )}

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
                  <p className="text-sm">Click "Fetch Categories" to get {integrationSource === 'shopify' ? 'collections' : 'categories'} from {sourceLabel}.</p>
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
                      {sourceLabel} Category
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
                      <td className="px-4 py-2 text-sm text-gray-500 font-mono text-xs">
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
            Map {sourceLabel} categories to your store categories. Products will be assigned to the mapped category during import.
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryMappingPanel;
