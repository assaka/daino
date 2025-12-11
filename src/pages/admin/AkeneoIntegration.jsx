import React, { useState, useEffect, useMemo } from 'react';

// Add global error handler to catch minified errors
if (typeof window !== 'undefined' && !window.__akeneoErrorHandlerInstalled) {
  window.__akeneoErrorHandlerInstalled = true;
  
  window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes("can't access property")) {
      console.error('🚨 CAUGHT GLOBAL ERROR:', {
        message: event.error.message,
        stack: event.error.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
      
      // Try to identify the source by looking for common patterns
      const errorMsg = event.error.message;
      if (errorMsg.includes('attributes')) {
        console.error('🔍 Error involves "attributes" property access');
        console.error('🔍 Current URL:', window.location.href);
        console.error('🔍 Error occurred in file:', event.filename);
        
        // Log current state if available
        if (window.__currentAkeneoState) {
          console.error('🔍 Current Akeneo component state:', window.__currentAkeneoState);
        }
      }
    }
  });
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Download,
  Settings,
  Database,
  Info,
  Package,
  Clock,
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  Power,
  BarChart3,
  Activity,
  Unlink,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useStoreSlug } from '@/hooks/useStoreSlug';
import SaveButton from '@/components/ui/save-button';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import apiClient from '@/api/client';
import { MultiSelect } from '@/components/ui/multi-select';
import FlashMessage from '@/components/storefront/FlashMessage';

// Error Boundary to catch component crashes
class AkeneoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Only show error boundary for critical errors
    const isCriticalError = error.message && (
      error.message.includes('Cannot read properties of null') ||
      error.message.includes('Cannot read properties of undefined') ||
      error.message.includes('is not a function') ||
      error.message.includes('Maximum update depth exceeded') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network Error')
    );
    
    if (isCriticalError) {
      console.error('🚨 Critical error detected, showing error boundary:', error.message);
      return { hasError: true };
    } else {
      console.warn('🚨 Non-critical error detected, continuing execution:', error.message);
      return { hasError: false };
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 AkeneoIntegration Error Boundary caught an error:', error);
    console.error('🚨 Error Info:', errorInfo);
    console.error('🚨 Error Stack:', error.stack);
    console.error('🚨 Component Stack:', errorInfo.componentStack);
    
    // Set error details for critical errors only
    if (this.state.hasError) {
      this.setState({
        error: error,
        errorInfo: errorInfo
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Component Error
                </CardTitle>
                <CardDescription>
                  The Akeneo Integration page encountered an error and crashed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-50 p-3 rounded border text-sm">
                  <strong>Error:</strong> {this.state.error?.message}
                </div>
                <Button 
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                    window.location.reload();
                  }}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const AkeneoIntegration = () => {
  try {
    let storeSlugData;
    try {
      storeSlugData = useStoreSlug();
    } catch (hookError) {
      console.error('❌ useStoreSlug hook failed:', hookError);
      console.error('Stack:', hookError.stack);
      throw hookError;
    }

    const { storeSlug } = storeSlugData;

    // Get store selection context
    const { selectedStore } = useStoreSelection();
  
  // Configuration state
  const [config, setConfig] = useState({
    baseUrl: '',
    clientId: '',
    clientSecret: '',
    username: '',
    password: '',
    locale: 'en_US',
    version: '7' // Default to latest version
  });
  const [lastImportDates, setLastImportDates] = useState({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importing, setImporting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  // Separate import results for each tab
  const [importResults, setImportResults] = useState({
    categories: null,
    products: null,
    attributes: null,
    families: null
  });
  const [dryRun, setDryRun] = useState(true);
  const [locales, setLocales] = useState([]);
  const [activeTab, setActiveTab] = useState('configuration');
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [channels, setChannels] = useState([]);
  const [families, setFamilies] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedRootCategories, setSelectedRootCategories] = useState([]);
  const [selectedFamilies, setSelectedFamilies] = useState([]);
  const [selectedFamiliesToImport, setSelectedFamiliesToImport] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Progress tracking for import operations
  const [importProgress, setImportProgress] = useState({
    categories: { current: 0, total: 0, isActive: false },
    attributes: { current: 0, total: 0, isActive: false },
    families: { current: 0, total: 0, isActive: false },
    products: { current: 0, total: 0, isActive: false }
  });
  
  // Store current state globally for error debugging (moved after state declarations)
  if (typeof window !== 'undefined') {
    window.__currentAkeneoState = {
      stats,
      statsType: typeof stats,
      familiesLength: families?.length,
      attributesLength: attributes?.length,
      importResults,
      activeTab
    };
  }

  // Helper function to enhance import responses with detailed error info
  const enhanceImportResponse = (responseData, importType) => {
    if (!responseData) return responseData;
    
    if (responseData.details?.errors) {
      return {
        ...responseData,
        stats: {
          ...responseData.stats,
          failedItems: responseData.details.errors.slice(0, 10).map(item => {
            let errorMessage = 'Unknown error';
            
            // Handle different error formats
            if (Array.isArray(item.errors) && item.errors.length > 0) {
              // Validation errors array: ["Product name is required", "Product SKU is required"]
              errorMessage = item.errors.join(', ');
            } else if (item.error) {
              // Single error message
              errorMessage = item.error;
            } else if (item.message) {
              // Alternative error message field
              errorMessage = item.message;
            } else if (typeof item === 'string') {
              // Direct string error
              errorMessage = item;
            }
            
            return {
              code: item.akeneo_identifier || item.akeneo_code || item.code || `Item ${Math.random().toString(36).substr(2, 5)}`,
              error: errorMessage
            };
          }),
          timestamp: new Date().toISOString()
        }
      };
    } else {
      return {
        ...responseData,
        stats: {
          ...responseData.stats,
          timestamp: new Date().toISOString()
        }
      };
    }
  };
  
  // Memoized family options to prevent excessive re-renders
  const familyOptions = useMemo(() => {
    if (!families || families.length === 0) return [];

    return families
      .filter(family => family != null) // Filter out any null/undefined entries
      .map((family) => {
        const value = family?.code || '';
        const label = (family?.labels && Object.values(family?.labels)[0]) || family?.code || '';
        return { value, label };
      });
  }, [families]);
  
  // Advanced settings
  const [categorySettings, setCategorySettings] = useState({
    hideFromMenu: false,
    setNewActive: true,
    preventUrlKeyOverride: true, // Enabled by default to preserve existing URLs
    akeneoUrlField: 'url_key' // Default Akeneo field for URL generation
  });

  
  const [productSettings, setProductSettings] = useState({
    mode: 'standard', // standard, advanced
    completeness: 100,
    productModel: 'all_variants_complete', // at_least_one, all_variants_complete
    updatedInterval: 0, // hours
    status: 'enabled', // enabled, disabled
    includeImages: true,
    includeFiles: true,
    stockFilter: 'disabled', // disabled, in_stock, out_of_stock
    preventUrlKeyOverride: true, // Enabled by default to preserve existing URLs
    importProductModels: true, // Enabled by default - import product models as configurable products
    akeneoUrlField: 'url_key' // Default Akeneo field for URL generation
  });
  
  const [attributeSettings, setAttributeSettings] = useState({
    updatedInterval: 0, // hours
    selectedFamilies: [],
    includeAttributeOptions: true // Default to true for importing attribute options
  });

  // Custom mapping configurations - now stored in database
  const [customMappings, setCustomMappings] = useState({
    attributes: [],
    images: [],
    files: []
  });
  const [mappingsLoaded, setMappingsLoaded] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [storageConnected, setStorageConnected] = useState(true);
  const [storageError, setStorageError] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    import_type: 'attributes',
    schedule_type: 'once',
    schedule_time: '',
    schedule_date: '',
    is_active: true,
    filters: {
      channels: [],
      families: [],
      categoryIds: [],
      attributes: {}
    },
    options: {
      locale: 'en_US',
      dryRun: false,
      batchSize: 50
    }
  });
  const [scheduleValidationErrors, setScheduleValidationErrors] = useState({});
  
  // Debug dry run changes
  const handleDryRunChange = (checked) => {
    setDryRun(checked);
  };

  // Functions to manage per-tab import results
  const setTabImportResults = (tab, results) => {
    const newResults = { ...importResults, [tab]: results };
    setImportResults(newResults);
    // Persist to localStorage
    localStorage.setItem('akeneo_import_results', JSON.stringify(newResults));
  };

  const loadImportResults = () => {
    try {
      const savedResults = localStorage.getItem('akeneo_import_results');
      if (savedResults) {
        const parsedResults = JSON.parse(savedResults);
        setImportResults(parsedResults);
      }
    } catch (error) {
      console.warn('Failed to load saved import results:', error);
    }
  };

  // Helper functions for custom mapping
  const updateMapping = (type, index, field, value) => {
    setCustomMappings(prev => ({
      ...prev,
      [type]: prev[type].map((mapping, i) => 
        i === index ? { ...mapping, [field]: value } : mapping
      )
    }));
  };

  const addMapping = (type) => {
    setCustomMappings(prev => {
      const newMapping = {
        akeneoAttribute: '',
        dainoField: '',
        enabled: true
      };
      
      // Add priority for images
      if (type === 'images') {
        const maxPriority = Math.max(...(prev[type]?.map(m => m.priority || 0) || [0]));
        newMapping.priority = maxPriority + 1;
      }
      
      return {
        ...prev,
        [type]: [...(prev[type] || []), newMapping]
      };
    });
  };

  const removeMapping = (type, index) => {
    setCustomMappings(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  // Load import statistics with enhanced error handling
  const loadStats = async () => {
    // Use storeId from context instead of localStorage
    const storeId = selectedStore?.id;

    if (!storeId) {
      return;
    }

    setLoadingStats(true);
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await apiClient.get('/integrations/akeneo/stats', {
        'x-skip-transform': 'true'  // Don't transform this response
      });

      clearTimeout(timeoutId);

      // With x-skip-transform, we get the raw response
      if (response?.success && response?.stats) {
        // Set stats directly from the response
        setStats({
          categories: response.stats.categories ?? 0,
          attributes: response.stats.attributes ?? 0,
          families: response.stats.families ?? 0,
          products: response.stats.products ?? 0
        });
        
        // Update importResults with detailed stats that include failed items and timestamps
        if (response?.detailed_stats) {
          const detailedImportResults = {};
          Object.keys(response.detailed_stats).forEach(type => {
            const detail = response.detailed_stats[type];
            if (detail) {
              detailedImportResults[type] = {
                success: true,
                message: `Last import: ${detail.successful_imports || 0} imported, ${detail.failed_imports || 0} failed`,
                stats: {
                  total: detail.total_processed || 0,
                  imported: detail.successful_imports || 0,
                  failed: detail.failed_imports || 0,
                  skipped: detail.skipped_imports || 0,
                  duration: detail.processing_time_seconds ? `${detail.processing_time_seconds}s` : null,
                  timestamp: detail.import_date,
                  failedItems: detail.error_details ? (() => {
                    try {
                      const parsed = JSON.parse(detail.error_details);
                      if (Array.isArray(parsed)) {
                        return parsed.slice(0, 10).map(item => {
                          let errorMessage = 'Unknown error';
                          
                          // Handle different error formats
                          if (Array.isArray(item.errors) && item.errors.length > 0) {
                            // Validation errors array: ["Product name is required", "Product SKU is required"]
                            errorMessage = item.errors.join(', ');
                          } else if (item.error) {
                            // Single error message
                            errorMessage = item.error;
                          } else if (item.message) {
                            // Alternative error message field
                            errorMessage = item.message;
                          } else if (typeof item === 'string') {
                            // Direct string error
                            errorMessage = item;
                          }
                          
                          return {
                            code: item.akeneo_identifier || item.akeneo_code || item.code || `Item ${Math.random().toString(36).substr(2, 5)}`,
                            error: errorMessage
                          };
                        });
                      }
                      return [];
                    } catch (e) {
                      return [{ code: 'Parse Error', error: detail.error_details }];
                    }
                  })() : []
                }
              };
            }
          });
          setImportResults(prev => ({ ...prev, ...detailedImportResults }));
        }
      }
      // Keep existing stats on error instead of resetting
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Keep existing stats on error instead of resetting to empty
    } finally {
      setLoadingStats(false);
    }
  };

  // Load schedules
  const loadSchedules = async () => {
    if (!connectionStatus?.success) return;
    
    setLoadingSchedules(true);
    try {
      const storeId = selectedStore?.id;
      if (!storeId) return;

      const response = await apiClient.get('/integrations/akeneo/schedules');

      if (response.data?.success || response.success) {
        const responseData = response.data || response;
        setSchedules(responseData.schedules || []);
      }
    } catch (error) {
      console.error('Failed to load schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Load custom mappings from database
  const loadCustomMappings = async () => {
    if (!selectedStore?.id) return;
    
    try {
      const response = await apiClient.get('/integrations/akeneo/custom-mappings');
      
      if (response.success) {
        const mappings = response.mappings;
        
        // If no mappings in database, use defaults
        const shouldUseDefaults = !mappings.attributes?.length && !mappings.images?.length && !mappings.files?.length;
        
        if (shouldUseDefaults) {
          const defaultMappings = {
            attributes: [
              { akeneoAttribute: 'name', dainoField: 'name', enabled: true },
              { akeneoAttribute: 'description', dainoField: 'description', enabled: true },
              { akeneoAttribute: 'price', dainoField: 'price', enabled: true },
              { akeneoAttribute: 'sku', dainoField: 'sku', enabled: true }
            ],
            images: [
              { akeneoAttribute: 'image', dainoField: 'main_image', enabled: true, priority: 1 },
              { akeneoAttribute: 'gallery', dainoField: 'image_gallery', enabled: true, priority: 2 }
            ],
            files: []
          };
          setCustomMappings(defaultMappings);
          // Save defaults to database
          await saveCustomMappingsToDb(defaultMappings);
        } else {
          setCustomMappings(mappings);
        }
        setMappingsLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load custom mappings:', error);
      
      // Fall back to defaults on error
      const fallbackMappings = {
        attributes: [
          { akeneoAttribute: 'name', dainoField: 'name', enabled: true },
          { akeneoAttribute: 'description', dainoField: 'description', enabled: true },
          { akeneoAttribute: 'price', dainoField: 'price', enabled: true },
          { akeneoAttribute: 'sku', dainoField: 'sku', enabled: true }
        ],
        images: [
          { akeneoAttribute: 'image', dainoField: 'main_image', enabled: true, priority: 1 },
          { akeneoAttribute: 'gallery', dainoField: 'image_gallery', enabled: true, priority: 2 }
        ],
        files: []
      };
      setCustomMappings(fallbackMappings);
      setMappingsLoaded(true);
    }
  };

  // Save custom mappings to database
  const saveCustomMappingsToDb = async (mappings) => {
    if (!selectedStore?.id) return;
    
    try {
      await apiClient.post('/integrations/akeneo/custom-mappings', mappings);
    } catch (error) {
      console.error('Failed to save custom mappings to database:', error);
      toast.error('Failed to save custom mappings');
    }
  };

  // Load channels for filtering
  const loadChannels = async () => {
    if (!connectionStatus?.success) return;
    
    try {
      const storeId = selectedStore?.id;
      if (!storeId) return;

      const response = await apiClient.get('/integrations/akeneo/channels');

      if (response.data?.success || response.success) {
        const responseData = response.data || response;
        setChannels(responseData.channels || []);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const loadAvailableCategories = async () => {
    if (!connectionStatus?.success) {
      return;
    }

    setLoadingCategories(true);
    try {
      const storeId = selectedStore?.id;
      if (!storeId) {
        return;
      }

      const response = await apiClient.get('/integrations/akeneo/categories');

      if (response.data?.success || response.success) {
        const responseData = response.data || response;
        const categories = responseData.categories || [];

        // Filter to only root categories (no parent)
        const rootCategories = categories.filter(cat => {
          const isRoot = !cat.parent || cat.parent === null || cat.parent === undefined || cat.parent === '';
          return isRoot;
        });
        
        setAvailableCategories(rootCategories);

        if (rootCategories.length === 0) {
          toast.info('No root categories found in Akeneo. All categories appear to have parent categories.');
        }
      } else {
        toast.error('Failed to load categories from Akeneo API');
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error(`Failed to load categories: ${error.message}`);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Load families for filtering - try local database first, then Akeneo
  const loadFamiliesForFilter = async () => {
    try {
      const storeId = selectedStore?.id;

      if (!storeId) {
        return;
      }

      setLoadingFamilies(true);

      // First try to load families from local database (imported AttributeSets)
      try {
        const localResponse = await apiClient.get(`/attribute-sets?store_id=${storeId}`);

        // Handle both wrapped and raw array response formats
        let attributeSets = [];
        
        if (localResponse.success && localResponse.data?.attribute_sets?.length > 0) {
          // Wrapped response format (authenticated)
          attributeSets = localResponse.data.attribute_sets;
        } else if (Array.isArray(localResponse) && localResponse.length > 0) {
          // Raw array response format (public/unauthenticated)
          attributeSets = localResponse;
        }
        
        if (attributeSets.length > 0) {
          const localFamilies = attributeSets
            .filter(attributeSet => attributeSet && attributeSet.name) // Filter out null/undefined entries
            .map(attributeSet => ({
              code: attributeSet.name,
              labels: { en_US: attributeSet.name },
              attributes: attributeSet.attribute_ids || [],
              source: 'local'
            }));
          setFamilies(localFamilies);
          return; // Use local families if available
        }
      } catch (localError) {
        console.error('Failed to load families from local database:', localError);
      }

      // Fallback to loading families directly from Akeneo if connection is successful
      if (connectionStatus?.success) {
        const response = await apiClient.get('/integrations/akeneo/families');

        if (response.success) {
          const familyData = response.families?.map(family => ({
            ...family,
            source: 'akeneo'
          })) || [];
          setFamilies(familyData);
        }
      }
    } catch (error) {
      console.error('Failed to load families:', error);
      // Silently fail - families are optional for filtering
    } finally {
      setLoadingFamilies(false);
    }
  };

  // Validate schedule form
  const validateScheduleForm = () => {
    const errors = {};
    
    if (scheduleForm.schedule_type === 'once') {
      if (!scheduleForm.schedule_date || scheduleForm.schedule_date.trim() === '') {
        errors.schedule_date = 'Schedule Date & Time is required for one-time schedules';
      } else {
        // Validate that the date is in the future
        const scheduleDate = new Date(scheduleForm.schedule_date);
        const now = new Date();
        if (scheduleDate <= now) {
          errors.schedule_date = 'Schedule Date & Time must be in the future';
        }
      }
    } else {
      if (!scheduleForm.schedule_time || scheduleForm.schedule_time.trim() === '') {
        errors.schedule_time = 'Schedule Time is required for recurring schedules';
      } else {
        // Validate time format based on schedule type
        if (scheduleForm.schedule_type === 'hourly') {
          if (!/^:[0-5][0-9]$/.test(scheduleForm.schedule_time)) {
            errors.schedule_time = 'Time must be in :MM format (e.g., :00, :30)';
          }
        } else if (scheduleForm.schedule_type === 'daily') {
          if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(scheduleForm.schedule_time)) {
            errors.schedule_time = 'Time must be in HH:MM format (e.g., 09:00)';
          }
        } else if (scheduleForm.schedule_type === 'weekly') {
          if (!/^(MON|TUE|WED|THU|FRI|SAT|SUN)-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(scheduleForm.schedule_time)) {
            errors.schedule_time = 'Time must be in DAY-HH:MM format (e.g., MON-09:00)';
          }
        } else if (scheduleForm.schedule_type === 'monthly') {
          if (!/^([1-9]|[12][0-9]|3[01])-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(scheduleForm.schedule_time)) {
            errors.schedule_time = 'Time must be in DD-HH:MM format (e.g., 1-09:00)';
          }
        }
      }
    }
    
    setScheduleValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save schedule
  const saveSchedule = async () => {
    try {
      const storeId = selectedStore?.id;
      if (!storeId) return;

      // Validation
      if (!validateScheduleForm()) {
        toast.error('Please fix the validation errors before saving');
        return;
      }

      const response = await apiClient.post('/integrations/akeneo/schedules', scheduleForm);

      if (response.data?.success || response.success) {
        toast.success('Schedule saved successfully');
        setShowScheduleForm(false);
        setEditingSchedule(null);
        setScheduleForm({
          import_type: 'attributes',
          schedule_type: 'once',
          schedule_time: '',
          schedule_date: '',
          is_active: true,
          filters: { channels: [], families: [], categoryIds: [], attributes: {} },
          options: { locale: 'en_US', dryRun: false, batchSize: 50 }
        });
        setScheduleValidationErrors({});
        await loadSchedules();
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error('Failed to save schedule');
    }
  };

  // Delete schedule
  const deleteSchedule = async (scheduleId) => {
    try {
      const storeId = selectedStore?.id;
      if (!storeId) return;

      const response = await apiClient.delete(`/integrations/akeneo/schedules/${scheduleId}`);

      if (response.data?.success || response.success) {
        toast.success('Schedule deleted successfully');
        await loadSchedules();
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  // Load configuration and locales on component mount
  useEffect(() => {
    // Add a small delay to ensure localStorage is ready
    const loadData = async () => {
      // Wait a bit for localStorage to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Load saved connection status
      const savedConnectionStatus = localStorage.getItem('akeneo_connection_status');
      if (savedConnectionStatus) {
        try {
          const parsedStatus = JSON.parse(savedConnectionStatus);
          setConnectionStatus(parsedStatus);
        } catch (error) {
          // Ignore parse errors
        }
      }

      // Load saved category selections
      const savedCategories = localStorage.getItem('akeneo_selected_categories');
      if (savedCategories) {
        try {
          const parsedCategories = JSON.parse(savedCategories);
          setSelectedRootCategories(parsedCategories);
        } catch (error) {
          // Ignore parse errors
        }
      }

      // Load saved family selections
      const savedFamilies = localStorage.getItem('akeneo_selected_families');
      if (savedFamilies) {
        try {
          const parsedFamilies = JSON.parse(savedFamilies);
          setSelectedFamilies(parsedFamilies);
        } catch (error) {
          // Ignore parse errors
        }
      }

      // Load saved advanced settings
      const savedCategorySettings = localStorage.getItem('akeneo_category_settings');
      if (savedCategorySettings) {
        try {
          const parsedSettings = JSON.parse(savedCategorySettings);
          setCategorySettings(parsedSettings);
        } catch (error) {
          // Ignore parse errors
        }
      }

      const savedProductSettings = localStorage.getItem('akeneo_product_settings');
      if (savedProductSettings) {
        try {
          const parsedSettings = JSON.parse(savedProductSettings);
          setProductSettings(parsedSettings);
        } catch (error) {
          // Ignore parse errors
        }
      }

      const savedAttributeSettings = localStorage.getItem('akeneo_attribute_settings');
      if (savedAttributeSettings) {
        try {
          const parsedSettings = JSON.parse(savedAttributeSettings);
          setAttributeSettings(parsedSettings);
        } catch (error) {
          // Ignore parse errors
        }
      }

      // Load custom mappings from database instead of localStorage
      loadCustomMappings();

      // Load saved import results
      loadImportResults();
      
      await loadConfigStatus();
      await loadLocales();
      await loadStats();
      await checkStorageConnection();
    };
    
    loadData();
  }, []);

  // Load families on component mount (from local database)
  useEffect(() => {
    loadFamiliesForFilter();
  }, []);

  // Load additional data when connection becomes successful
  useEffect(() => {
    if (connectionStatus?.success) {
      loadSchedules();
      loadChannels();
      loadFamiliesForFilter(); // Reload to get Akeneo families if available
      loadAvailableCategories();
      loadCustomMappings(); // Load custom mappings when connection is successful
    }
  }, [connectionStatus?.success]);

  // Save selections to localStorage when they change
  useEffect(() => {
    if (selectedRootCategories.length > 0) {
      localStorage.setItem('akeneo_selected_categories', JSON.stringify(selectedRootCategories));
    } else {
      localStorage.removeItem('akeneo_selected_categories');
    }
  }, [selectedRootCategories]);

  useEffect(() => {
    if (selectedFamilies.length > 0) {
      localStorage.setItem('akeneo_selected_families', JSON.stringify(selectedFamilies));
    } else {
      localStorage.removeItem('akeneo_selected_families');
    }
  }, [selectedFamilies]);

  // Save advanced settings to localStorage
  useEffect(() => {
    localStorage.setItem('akeneo_category_settings', JSON.stringify(categorySettings));
  }, [categorySettings]);

  useEffect(() => {
    localStorage.setItem('akeneo_product_settings', JSON.stringify(productSettings));
  }, [productSettings]);

  useEffect(() => {
    localStorage.setItem('akeneo_attribute_settings', JSON.stringify(attributeSettings));
  }, [attributeSettings]);

  // Save custom mappings to database when they change (with debounce)
  useEffect(() => {
    if (!mappingsLoaded) return; // Don't save until initial load is complete
    
    const timeoutId = setTimeout(() => {
      saveCustomMappingsToDb(customMappings);
    }, 1000); // Debounce for 1 second
    
    return () => clearTimeout(timeoutId);
  }, [customMappings, mappingsLoaded]);


  // Add global error handlers to catch any unhandled errors that might cause blank page
  useEffect(() => {
    const handleWindowError = (event) => {
      console.error('🚨 Global window error caught:', event.error);
      console.error('🚨 Error details:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    };

    const handleUnhandledRejection = (event) => {
      console.error('🚨 Unhandled promise rejection caught:', event.reason);
      console.error('🚨 Rejection details:', {
        reason: event.reason,
        promise: event.promise
      });
      // Prevent default behavior (logging to console)
      event.preventDefault();
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Load saved connection status on page load
  const loadConnectionStatus = async () => {
    try {
      const storeId = selectedStore?.id;
      if (!storeId) {
        return;
      }

      const response = await apiClient.get('/integrations/akeneo/connection-status');

      const responseData = response.data || response;
      if (responseData.success && responseData.connectionStatus) {
        const { status, message, testedAt } = responseData.connectionStatus;

        if (status === 'success') {
          setConnectionStatus({
            success: true,
            message: 'Connection verified',
            testedAt
          });
        } else if (status === 'failed') {
          setConnectionStatus({
            success: false,
            message: message || 'Connection failed',
            testedAt
          });
        }
      }
    } catch (error) {
      console.error('Failed to load connection status:', error);
    }
  };

  const checkStorageConnection = async () => {
    try {
      const storeId = selectedStore?.id;
      if (!storeId) return;
      
      const response = await apiClient.get('/storage/providers');
      
      if (response.success && response.data) {
        const currentProvider = response.data.current;
        const isAvailable = response.data.providers[currentProvider?.provider]?.available;
        
        if (isAvailable) {
          setStorageConnected(true);
          setStorageError(null);
        } else {
          setStorageConnected(false);
          setStorageError(`${currentProvider?.name || 'Storage provider'} is not properly configured`);
        }
      }
    } catch (error) {
      console.error('Error checking storage connection:', error);
      setStorageConnected(false);
      setStorageError('Unable to check storage connection status');
    }
  };

  const loadConfigStatus = async () => {
    try {
      // Get store_id from context
      const storeId = selectedStore?.id;

      if (!storeId) {
        return;
      }

      setLoading(true);
      const response = await apiClient.get('/integrations/akeneo/config-status');

      // Handle different response structures
      const responseData = response.data || response;

      if (responseData.success && responseData.config) {
        setConfig(prev => ({
          ...prev,
          ...responseData.config
        }));

        // Set last import dates if available
        if (responseData.config.lastImportDates) {
          setLastImportDates(responseData.config.lastImportDates);
        }

        // If we have a complete configuration, set configSaved to true
        const loadedConfig = responseData.config;
        if (loadedConfig.baseUrl && loadedConfig.clientId && loadedConfig.clientSecret &&
            loadedConfig.username && loadedConfig.password) {
          setConfigSaved(true);

          // Load saved connection status after config is loaded
          await loadConnectionStatus();
        }
      }
    } catch (error) {
      console.error('Failed to load config status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLocales = async () => {
    try {
      const response = await apiClient.get('/integrations/akeneo/locales');

      // Handle both wrapped and direct response formats
      const responseData = response.data || response;

      if (responseData?.success) {
        setLocales(responseData.locales);
      }
    } catch (error) {
      console.error('Failed to load locales:', error);
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setConfigSaved(false); // Reset saved status when config changes
    setConnectionStatus(null); // Reset connection status when config changes
    localStorage.removeItem('akeneo_connection_status'); // Clear saved connection status
    // Clear validation error for this field when user types
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const testConnection = async () => {
    // Check if we have placeholder values - if so, we need actual values
    if (!config.baseUrl || !config.clientId || !config.clientSecret || !config.username || !config.password) {
      toast.error('Please fill in all configuration fields');
      return;
    }

    // Check if we have placeholder values - we can still test if config is saved
    const hasPlaceholders = config.clientSecret === '••••••••' || config.password === '••••••••';

    if (hasPlaceholders && !configSaved) {
      toast.error('Please enter your actual Client Secret and Password to test the connection');
      return;
    }

    // Get store_id from context
    const storeId = selectedStore?.id;

    if (!storeId) {
      toast.error('No store selected. Please select a store first.');
      return;
    }

    setTesting(true);
    setConnectionStatus(null);

    try {
      // Prepare the request payload
      let requestPayload;
      if (hasPlaceholders && configSaved) {
        // Send empty body to trigger stored config usage
        requestPayload = {};
      } else {
        // Send full config
        requestPayload = config;
      }

      const response = await apiClient.post('/integrations/akeneo/test-connection', requestPayload);

      // Handle different response structures
      const responseData = response.data || response;

      const success = responseData.success;
      const message = responseData.message || 'Connection test completed';

      if (success) {
        const successStatus = { success: true, message };
        setConnectionStatus(successStatus);
        localStorage.setItem('akeneo_connection_status', JSON.stringify(successStatus));
        toast.success('Connection successful!');
      } else {
        const failureStatus = { success: false, message };
        setConnectionStatus(failureStatus);
        localStorage.setItem('akeneo_connection_status', JSON.stringify(failureStatus));
        toast.error('Connection failed');
      }
    } catch (error) {
      console.error('Connection test error:', error);

      const message = error.response?.data?.error || error.response?.data?.message || error.message;
      const errorStatus = { success: false, message };
      setConnectionStatus(errorStatus);
      localStorage.setItem('akeneo_connection_status', JSON.stringify(errorStatus));
      toast.error(`Connection failed: ${message}`);
    } finally {
      setTesting(false);
    }
  };

  const validateConfiguration = () => {
    const errors = {};

    // Required field validation
    if (!config.baseUrl?.trim()) {
      errors.baseUrl = 'Base URL is required';
    } else {
      // URL format validation
      try {
        const url = new URL(config.baseUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.baseUrl = 'URL must start with http:// or https://';
        }
      } catch {
        errors.baseUrl = 'Please enter a valid URL (e.g., https://your-akeneo.com)';
      }
    }

    if (!config.clientId?.trim()) {
      errors.clientId = 'Client ID is required';
    } else if (config.clientId.trim().length < 5) {
      errors.clientId = 'Client ID seems too short';
    }

    if (!config.clientSecret?.trim()) {
      errors.clientSecret = 'Client Secret is required';
    } else if (config.clientSecret === '••••••••') {
      errors.clientSecret = 'Please enter your actual Client Secret';
    }

    if (!config.username?.trim()) {
      errors.username = 'Username is required';
    }

    if (!config.password?.trim()) {
      errors.password = 'Password is required';
    } else if (config.password === '••••••••') {
      errors.password = 'Please enter your actual Password';
    }

    return errors;
  };

  const saveConfiguration = async () => {
    // Run validation
    const errors = validateConfiguration();
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Show first error as toast
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }

    // Get store_id from context
    const storeId = selectedStore?.id;
    if (!storeId) {
      toast.error('No store selected. Please select a store first.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const response = await apiClient.post('/integrations/akeneo/save-config', config);

      // Handle different response structures
      const responseData = response.data || response;
      const success = responseData.success;
      const message = responseData.message || 'Configuration operation completed';

      if (success) {
        setConfigSaved(true);
        setSaveSuccess(true);
        setFlashMessage({ type: 'success', message: 'Configuration saved and connection verified successfully!' });
        setTimeout(() => setSaveSuccess(false), 2000);
        loadConfigStatus(); // Reload config status
      } else {
        setFlashMessage({ type: 'error', message: `Failed to save configuration: ${message}` });
      }
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || error.message;
      setFlashMessage({ type: 'error', message: `Connection failed: ${message}` });
    } finally {
      setSaving(false);
    }
  };

  // Disconnect handlers
  const handleDisconnectClick = () => {
    setShowDisconnectModal(true);
  };

  const handleDisconnectCancel = () => {
    setShowDisconnectModal(false);
  };

  const handleDisconnectConfirm = async () => {
    try {
      setDisconnecting(true);
      const response = await apiClient.post('/integrations/akeneo/disconnect');

      if (response.success) {
        toast.success('Akeneo disconnected successfully');
        setShowDisconnectModal(false);
        // Reset all related state
        setConfig({
          baseUrl: '',
          clientId: '',
          clientSecret: '',
          username: '',
          password: ''
        });
        setConfigSaved(false);
        setConnectionStatus(null);
        setStats({});
        setFamilies([]);
        setAttributes([]);
        setAvailableCategories([]);
        setSelectedRootCategories([]);
        setSelectedFamilies([]);
        setSelectedFamiliesToImport([]);
        // Reload config status
        loadConfigStatus();
      } else {
        throw new Error(response.message || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const importCategories = async () => {
    try {
      // Debug authentication state
      const authToken = localStorage.getItem('store_owner_auth_token');
      const storeId = selectedStore?.id;

      if (!authToken) {
        toast.error('Authentication required. Please refresh the page and log in again.');
        return;
      }

      if (!connectionStatus?.success) {
        toast.error('Please test the connection first');
        return;
      }

      // Validate that at least one category is selected
      if (selectedRootCategories.length === 0) {
        toast.error('Please select at least 1 category to import');
        return;
      }

      if (!storeId) {
        toast.error('No store selected. Please select a store first.');
        return;
      }

      setImporting(true);
      setImportResults(null);

      // Initialize progress tracking for categories
      setImportProgress(prev => ({
        ...prev,
        categories: { current: 0, total: 0, isActive: true }
      }));

      try {
        // Prepare the request payload for import
        const hasPlaceholders = config.clientSecret === '••••••••' || config.password === '••••••••';
        let requestPayload;

        if (hasPlaceholders && configSaved) {
          // Use stored config for import
          requestPayload = {
            dryRun,
            filters: {
              rootCategories: selectedRootCategories.length > 0 ? selectedRootCategories : undefined
            },
            settings: {
              hideFromMenu: categorySettings.hideFromMenu,
              setNewActive: categorySettings.setNewActive,
              preventUrlKeyOverride: categorySettings.preventUrlKeyOverride,
              akeneoUrlField: categorySettings.akeneoUrlField
            }
          };
        } else {
          // Use provided config
          requestPayload = {
            ...config,
            dryRun,
            filters: {
              rootCategories: selectedRootCategories.length > 0 ? selectedRootCategories : undefined
            },
            settings: {
              hideFromMenu: categorySettings.hideFromMenu,
              setNewActive: categorySettings.setNewActive,
              preventUrlKeyOverride: categorySettings.preventUrlKeyOverride,
              akeneoUrlField: categorySettings.akeneoUrlField
            }
          };
        }

        const response = await apiClient.post('/integrations/akeneo/import-categories', requestPayload);

        const responseData = response.data || response;
        // Enhance with error details and timestamp
        const enhancedResponseData = enhanceImportResponse(responseData, 'categories');
        setTabImportResults('categories', enhancedResponseData);

        if (responseData?.success) {
          const stats = responseData?.stats || {};
          toast.success(`Categories import completed! ${stats?.imported || 0} categories imported`);
          // Reload stats and config to reflect changes
          await loadStats();
          await loadConfigStatus();
        } else {
          toast.error(`Categories import failed: ${responseData.error}`);
        }
      } catch (error) {
        console.error('Categories import error:', error);

        // Handle authentication errors specifically
        if (error.status === 401) {
          toast.error('Authentication expired. Please refresh the page and log in again.');
          setImportResults({ success: false, error: 'Authentication expired' });
          return;
        }

        const message = error.response?.data?.error || error.response?.data?.message || error.message;
        setImportResults({ success: false, error: message });
        toast.error(`Import failed: ${message}`);
      } finally {
        // Reset progress tracking for categories
        setImportProgress(prev => ({
          ...prev,
          categories: { current: 0, total: 0, isActive: false }
        }));

        setImporting(false);
      }
    } catch (unexpectedError) {
      console.error('Unexpected error in importCategories function:', unexpectedError);
      toast.error('An unexpected error occurred during import. Check console for details.');
      setImporting(false);
      setImportResults({ success: false, error: 'Unexpected error: ' + unexpectedError?.message });
    }
  };

  const importAttributes = async () => {
    // Debug authentication state
    const authToken = localStorage.getItem('store_owner_auth_token');
    const storeId = selectedStore?.id;

    if (!authToken) {
      toast.error('Authentication required. Please refresh the page and log in again.');
      return;
    }

    if (!connectionStatus?.success) {
      toast.error('Please test the connection first');
      return;
    }

    if (!storeId) {
      toast.error('No store selected. Please select a store first.');
      return;
    }

    setImporting(true);
    setImportResults(null);

    // Initialize progress tracking for attributes
    setImportProgress(prev => ({
      ...prev,
      attributes: { current: 0, total: 0, isActive: true }
    }));

    try {
      // Prepare the request payload for import
      const hasPlaceholders = config.clientSecret === '••••••••' || config.password === '••••••••';
      let requestPayload;

      if (hasPlaceholders && configSaved) {
        // Use stored config for import with attribute settings
        requestPayload = {
          dryRun,
          filters: {
            families: attributeSettings.selectedFamilies.length > 0 ? attributeSettings.selectedFamilies : undefined,
            updatedSince: attributeSettings.updatedInterval
          },
          settings: attributeSettings
        };
      } else {
        // Use provided config with attribute settings
        requestPayload = {
          ...config,
          dryRun,
          filters: {
            families: attributeSettings.selectedFamilies.length > 0 ? attributeSettings.selectedFamilies : undefined,
            updatedSince: attributeSettings.updatedInterval
          },
          settings: attributeSettings
        };
      }

      const response = await apiClient.post('/integrations/akeneo/import-attributes', requestPayload);

      const responseData = response.data || response;
      // Ensure responseData is not null before setting
      if (responseData) {
        const enhancedResponseData = enhanceImportResponse(responseData, 'attributes');
        setTabImportResults('attributes', enhancedResponseData);
      } else {
        setTabImportResults('attributes', { success: false, error: 'Invalid response from server' });
      }

      if (responseData?.success) {
        const stats = responseData?.stats || {};
        toast.success(`Attributes import completed! ${stats?.imported || 0} attributes imported`);
        // Reload stats and config to reflect changes
        try {
          await loadStats();
        } catch (statsError) {
          console.error('Error reloading stats:', statsError);
        }
        try {
          await loadConfigStatus();
        } catch (configError) {
          console.error('Error reloading config status:', configError);
        }
      } else {
        toast.error(`Attributes import failed: ${responseData.error}`);
      }
    } catch (error) {
      console.error('❌ Attributes import error:', error);
      
      // Handle authentication errors specifically
      if (error.status === 401) {
        console.error('🚨 Authentication error detected - token may be expired');
        toast.error('Authentication expired. Please refresh the page and log in again.');
        setTabImportResults('attributes', { success: false, error: 'Authentication expired' });
        return;
      }
      
      const message = error.response?.data?.error || error.response?.data?.message || error.message;
      setTabImportResults('attributes', { success: false, error: message });
      toast.error(`Import failed: ${message}`);
    } finally {
      setImporting(false);

      // Reset progress tracking for attributes
      setImportProgress(prev => ({
        ...prev,
        attributes: { current: 0, total: 0, isActive: false }
      }));
    }
  };

  const importFamilies = async () => {
    const storeId = selectedStore?.id;

    if (!connectionStatus?.success) {
      toast.error('Please test the connection first');
      return;
    }

    if (!storeId) {
      toast.error('No store selected. Please select a store first.');
      return;
    }

    setImporting(true);
    setImportResults(null);

    // Initialize progress tracking for families
    setImportProgress(prev => ({
      ...prev,
      families: { current: 0, total: 0, isActive: true }
    }));

    try {
      // Prepare the request payload for import
      const hasPlaceholders = config.clientSecret === '••••••••' || config.password === '••••••••';
      let requestPayload;

      if (hasPlaceholders && configSaved) {
        // Use stored config for import
        requestPayload = {
          dryRun,
          filters: {
            families: selectedFamiliesToImport.length > 0 ? selectedFamiliesToImport : undefined
          }
        };
      } else {
        // Use provided config
        requestPayload = {
          ...config,
          dryRun,
          filters: {
            families: selectedFamiliesToImport.length > 0 ? selectedFamiliesToImport : undefined
          }
        };
      }

      const response = await apiClient.post('/integrations/akeneo/import-families', requestPayload);

      const responseData = response.data || response;
      const enhancedResponseData = enhanceImportResponse(responseData, 'families');
      setTabImportResults('families', enhancedResponseData);

      if (responseData?.success) {
        const stats = responseData?.stats || {};
        toast.success(`Families import completed! ${stats?.imported || 0} families imported`);
        // Reload stats and config to reflect changes
        await loadStats();
        await loadConfigStatus();
      } else {
        toast.error(`Families import failed: ${responseData.error}`);
      }
    } catch (error) {
      console.error('Families import error:', error);

      const message = error.response?.data?.error || error.response?.data?.message || error.message;
      setImportResults({ success: false, error: message });
      toast.error(`Import failed: ${message}`);
    } finally {
      setImporting(false);

      // Reset progress tracking for families
      setImportProgress(prev => ({
        ...prev,
        families: { current: 0, total: 0, isActive: false }
      }));
    }
  };

  const importProducts = async () => {
    // Debug authentication state
    const authToken = localStorage.getItem('store_owner_auth_token');
    const storeId = selectedStore?.id;

    if (!authToken) {
      toast.error('Authentication required. Please refresh the page and log in again.');
      return;
    }

    if (!connectionStatus?.success) {
      toast.error('Please test the connection first');
      return;
    }

    if (!storeId) {
      toast.error('No store selected. Please select a store first.');
      return;
    }

    setImporting(true);
    setImportResults(null);

    // Initialize progress tracking for products
    setImportProgress(prev => ({
      ...prev,
      products: { current: 0, total: 0, isActive: true }
    }));

    try {
      const requestPayload = {
        ...config,
        dryRun,
        filters: {
          families: selectedFamilies.length > 0 ? selectedFamilies : undefined,
          completeness: productSettings.completeness,
          updatedSince: productSettings.updatedInterval,
          productModel: productSettings.productModel
        },
        settings: {
          mode: productSettings.mode,
          status: productSettings.status,
          includeImages: productSettings.includeImages,
          includeFiles: productSettings.includeFiles,
          stockFilter: productSettings.stockFilter,
          preventUrlKeyOverride: productSettings.preventUrlKeyOverride,
          importProductModels: productSettings.importProductModels,
          akeneoUrlField: productSettings.akeneoUrlField
        },
        customMappings: customMappings
      };

      const response = await apiClient.post('/integrations/akeneo/import-products', requestPayload);

      const responseData = response.data || response;

      // Ensure responseData has the expected structure
      const finalResults = {
        success: responseData?.success ?? false,
        stats: responseData?.stats || {},
        message: responseData?.message || '',
        error: responseData?.error || '',
        ...responseData
      };

      setTabImportResults('products', finalResults);

      if (responseData?.success) {
        const stats = responseData?.stats || {};
        toast.success(`Products import completed! ${stats?.imported || 0} products imported`);
        // Reload stats and config to reflect changes with enhanced error handling

        // Reload stats with isolation
        setTimeout(async () => {
          try {
            await loadStats();
          } catch (statsError) {
            console.error('Error reloading stats after products import:', statsError);
            // Continue even if stats reload fails
          }
        }, 100);

        // Reload config with isolation
        setTimeout(async () => {
          try {
            await loadConfigStatus();
          } catch (configError) {
            console.error('Error reloading config status after products import:', configError);
            // Continue even if config reload fails
          }
        }, 200);
      } else {
        toast.error(`Products import failed: ${responseData.error}`);
      }
    } catch (error) {
      console.error('Products import failed with error:', error);

      const message = error.response?.data?.error || error.response?.data?.message || error.message;
      setTabImportResults('products', { success: false, error: message });
      toast.error(`Import failed: ${message}`);
    } finally {
      // Reset progress tracking for products
      setImportProgress(prev => ({
        ...prev,
        products: { current: 0, total: 0, isActive: false }
      }));

      setImporting(false);
    }
  };

  const importAll = async () => {
    if (!connectionStatus?.success) {
      toast.error('Please test the connection first');
      return;
    }

    // Get store_id from context
    const storeId = selectedStore?.id;
    if (!storeId) {
      toast.error('No store selected. Please select a store first.');
      return;
    }

    setImporting(true);
    setImportResults(null);

    try {
      const response = await apiClient.post('/integrations/akeneo/import-all', {
        ...config,
        dryRun
      });

      // Handle both wrapped and direct response formats
      const responseData = response.data || response;
      setImportResults(responseData);
      
      if (responseData?.success) {
        const categoryStats = responseData?.results?.categories?.stats || {};
        const productStats = responseData?.results?.products?.stats || {};
        toast.success(`Full import completed! ${categoryStats?.imported || 0} categories and ${productStats?.imported || 0} products imported`);
        // Reload stats and config to reflect changes
        await loadStats();
        await loadConfigStatus();
      } else {
        toast.error(`Import failed: ${responseData?.error || 'Unknown error'}`);
      }
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || error.message;
      setImportResults({ success: false, error: message });
      toast.error(`Import failed: ${message}`);
    } finally {
      setImporting(false);
    }
  };

  const formatLastImportDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const renderConnectionStatus = () => {
    if (!connectionStatus) return null;

    return (
      <Alert className={connectionStatus.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        {connectionStatus.success ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600" />
        )}
        <AlertDescription className={connectionStatus.success ? 'text-green-800' : 'text-red-800'}>
          {connectionStatus.message}
        </AlertDescription>
      </Alert>
    );
  };

  // Render tab-specific import results
  const renderTabImportResults = (tabName) => {
    // Add null check for importResults before accessing properties
    if (!importResults || typeof importResults !== 'object') return null;
    
    const tabResults = importResults[tabName];
    if (!tabResults) return null;

    return (
      <Alert className={(tabResults?.success ?? false) ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        {(tabResults?.success ?? false) ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600" />
        )}
        <AlertDescription className={(tabResults?.success ?? false) ? 'text-green-800' : 'text-red-800'}>
          {tabResults?.message || tabResults?.error}
          {tabResults?.stats && (
            <div className="mt-2 text-sm space-y-2">
              <p>Total: {tabResults.stats?.total ?? 0}, Imported: {tabResults.stats?.imported ?? 0}, Failed: {tabResults.stats?.failed ?? 0}</p>
              {tabResults.stats?.duration && (
                <p>Duration: {tabResults.stats.duration}</p>
              )}
              {tabResults.stats?.timestamp && (
                <p>Last Import: {new Date(tabResults.stats.timestamp).toLocaleString()}</p>
              )}
              {tabResults.stats?.failed > 0 && tabResults.stats?.failedItems && (
                <div className="mt-2">
                  <p className="font-medium">Failed Items (first 10):</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {tabResults.stats.failedItems.slice(0, 10).map((item, index) => (
                      <li key={index} className="text-xs">
                        <span className="font-medium">{item.code || item.id || `Item ${index + 1}`}:</span> {item.error || item.message}
                      </li>
                    ))}
                  </ul>
                  {tabResults.stats.failedItems.length > 10 && (
                    <p className="text-xs mt-1 italic">...and {tabResults.stats.failedItems.length - 10} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  const renderImportResults = () => {
    // This is kept for backward compatibility or general display
    // Add null check for importResults before using Object.values
    if (!importResults || typeof importResults !== 'object') return null;
    
    const hasAnyResults = Object.values(importResults).some(result => result !== null);
    if (!hasAnyResults) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(importResults?.success ?? false) ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            Import Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(importResults?.success ?? false) ? (
            <div className="space-y-4">
              {importResults?.stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{importResults.stats?.total ?? 0}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{importResults.stats?.imported ?? 0}</div>
                    <div className="text-sm text-gray-600">Imported</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{importResults.stats?.skipped ?? 0}</div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{importResults.stats?.failed ?? 0}</div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                </div>
              )}
              
              {importResults?.results && (
                <div className="space-y-3">
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Categories</h4>
                      <div className="text-sm space-y-1">
                        <div>Total: {importResults.results?.categories?.stats?.total ?? 0}</div>
                        <div>Imported: {importResults.results?.categories?.stats?.imported ?? 0}</div>
                        <div>Failed: {importResults.results?.categories?.stats?.failed ?? 0}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Products</h4>
                      <div className="text-sm space-y-1">
                        <div>Total: {importResults.results?.products?.stats?.total ?? 0}</div>
                        <div>Imported: {importResults.results?.products?.stats?.imported ?? 0}</div>
                        <div>Failed: {importResults.results?.products?.stats?.failed ?? 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {importResults?.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

    // Defensive check - if critical state is invalid, return loading state
    if (!config && !families && !stats) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading Akeneo Integration...</p>
          </div>
        </div>
      );
    }
    
    return (

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FlashMessage
          message={flashMessage}
          onClose={() => setFlashMessage(null)}
        />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Akeneo PIM Integration
          </h1>
          <p className="text-gray-600 mt-1">
            Import categories and products from your Akeneo PIM system into DainoStore.
          </p>
        </div>

      {/* Statistics Display */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Current Import Statistics
          </CardTitle>
          <CardDescription>
            Current count of imported data in your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{(stats && stats.attributes != null) ? stats.attributes : 0}</div>
              <div className="text-sm text-blue-600">Attributes</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats?.families ?? 0}</div>
              <div className="text-sm text-green-600">Families</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats?.categories ?? 0}</div>
              <div className="text-sm text-purple-600">Categories</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats?.products ?? 0}</div>
              <div className="text-sm text-orange-600">Products</div>
            </div>
          </div>
          {loadingStats && (
            <div className="mt-4 text-center">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
              <span className="text-sm text-gray-500 ml-2">Updating statistics...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="attributes" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Attributes
          </TabsTrigger>
          <TabsTrigger value="families" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Families
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Akeneo Configuration</CardTitle>
                  <CardDescription>
                    Configure your Akeneo PIM connection settings. Save your configuration first, then test the connection before importing data.
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {configSaved ? (
                    <>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                      <button
                        onClick={handleDisconnectClick}
                        disabled={disconnecting}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Disconnect Akeneo"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl" className={validationErrors.baseUrl ? 'text-red-500' : ''}>Base URL</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://your-akeneo.com"
                    value={config.baseUrl}
                    onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                    className={validationErrors.baseUrl ? 'border-red-500 focus:ring-red-500' : ''}
                  />
                  {validationErrors.baseUrl && (
                    <p className="text-sm text-red-500">{validationErrors.baseUrl}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId" className={validationErrors.clientId ? 'text-red-500' : ''}>Client ID</Label>
                  <Input
                    id="clientId"
                    placeholder="Your client ID"
                    value={config.clientId}
                    onChange={(e) => handleConfigChange('clientId', e.target.value)}
                    className={validationErrors.clientId ? 'border-red-500 focus:ring-red-500' : ''}
                  />
                  {validationErrors.clientId && (
                    <p className="text-sm text-red-500">{validationErrors.clientId}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientSecret" className={validationErrors.clientSecret ? 'text-red-500' : ''}>Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    placeholder="Your client secret"
                    value={config.clientSecret}
                    onChange={(e) => handleConfigChange('clientSecret', e.target.value)}
                    className={validationErrors.clientSecret ? 'border-red-500 focus:ring-red-500' : ''}
                  />
                  {validationErrors.clientSecret && (
                    <p className="text-sm text-red-500">{validationErrors.clientSecret}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username" className={validationErrors.username ? 'text-red-500' : ''}>Username</Label>
                  <Input
                    id="username"
                    placeholder="API username"
                    value={config.username}
                    onChange={(e) => handleConfigChange('username', e.target.value)}
                    className={validationErrors.username ? 'border-red-500 focus:ring-red-500' : ''}
                  />
                  {validationErrors.username && (
                    <p className="text-sm text-red-500">{validationErrors.username}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className={validationErrors.password ? 'text-red-500' : ''}>Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="API password"
                    value={config.password}
                    onChange={(e) => handleConfigChange('password', e.target.value)}
                    className={validationErrors.password ? 'border-red-500 focus:ring-red-500' : ''}
                  />
                  {validationErrors.password && (
                    <p className="text-sm text-red-500">{validationErrors.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale">Locale</Label>
                  <Select value={config.locale} onValueChange={(value) => handleConfigChange('locale', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select locale" />
                    </SelectTrigger>
                    <SelectContent>
                      {locales.map((locale) => (
                        <SelectItem key={locale.code} value={locale.code}>
                          {locale.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Akeneo Version</Label>
                  <Select value={config.version || '7'} onValueChange={(value) => handleConfigChange('version', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Akeneo 7.x (Latest)</SelectItem>
                      <SelectItem value="6">Akeneo 6.x</SelectItem>
                      <SelectItem value="5">Akeneo 5.x</SelectItem>
                      <SelectItem value="4">Akeneo 4.x</SelectItem>
                      <SelectItem value="3">Akeneo 3.x</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select your Akeneo PIM version. Versions 6+ use UUID-based product endpoints.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-end">
                <SaveButton
                  onClick={saveConfiguration}
                  loading={saving}
                  success={saveSuccess}
                  disabled={false}
                  defaultText="Save Configuration"
                  className="flex items-center gap-2"
                />
              </div>

            </CardContent>
          </Card>

          {/* Scheduler Configuration */}
          {connectionStatus?.success && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Import Scheduler
                </CardTitle>
                <CardDescription>
                  Configure automated imports for different data types with filtering options.
                </CardDescription>
              </CardHeader>

              {/* Credit Information */}
              <div className="mx-6 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Credit Usage Information</h4>
                    <p className="text-sm text-blue-800">
                      Currently free. Future billing (<strong>0.1 credits per run</strong>) will only begin after advance notification.
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Scheduled Imports</h3>
                  <Button 
                    onClick={() => setShowScheduleForm(!showScheduleForm)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Schedule
                  </Button>
                </div>

                {/* Schedule Form */}
                {showScheduleForm && (
                  <Card className="border-2 border-dashed border-gray-200">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Import Type</Label>
                          <Select 
                            value={scheduleForm.import_type} 
                            onValueChange={(value) => setScheduleForm(prev => ({ ...prev, import_type: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select import type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="attributes">Attributes</SelectItem>
                              <SelectItem value="families">Families</SelectItem>
                              <SelectItem value="categories">Categories</SelectItem>
                              <SelectItem value="products">Products</SelectItem>
                              <SelectItem value="all">All</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Schedule Type</Label>
                          <Select 
                            value={scheduleForm.schedule_type} 
                            onValueChange={(value) => {
                              setScheduleForm(prev => ({ ...prev, schedule_type: value }));
                              // Clear validation errors when schedule type changes
                              setScheduleValidationErrors({});
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select schedule type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="once">Once</SelectItem>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {scheduleForm.schedule_type === 'once' && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Schedule Date & Time <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="datetime-local"
                            required
                            value={scheduleForm.schedule_date}
                            onChange={(e) => {
                              setScheduleForm(prev => ({ ...prev, schedule_date: e.target.value }));
                              // Clear validation error when user starts typing
                              if (scheduleValidationErrors.schedule_date) {
                                setScheduleValidationErrors(prev => ({ ...prev, schedule_date: undefined }));
                              }
                            }}
                            className={scheduleValidationErrors.schedule_date ? 'border-red-500 focus:border-red-500' : ''}
                          />
                          {scheduleValidationErrors.schedule_date && (
                            <p className="text-sm text-red-600 mt-1">
                              {scheduleValidationErrors.schedule_date}
                            </p>
                          )}
                        </div>
                      )}

                      {scheduleForm.schedule_type !== 'once' && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Time <span className="text-red-500">*</span>
                            <span className="font-normal text-gray-600 ml-1">
                              {scheduleForm.schedule_type === 'hourly' && '(e.g., :00, :30)'}
                              {scheduleForm.schedule_type === 'daily' && '(e.g., 09:00)'}
                              {scheduleForm.schedule_type === 'weekly' && '(e.g., MON-09:00)'}
                              {scheduleForm.schedule_type === 'monthly' && '(e.g., 1-09:00 for 1st of month)'}
                            </span>
                          </Label>
                          <Input
                            required
                            placeholder={
                              scheduleForm.schedule_type === 'hourly' ? ':MM (e.g., :00, :30)' :
                              scheduleForm.schedule_type === 'daily' ? 'HH:MM (e.g., 09:00)' :
                              scheduleForm.schedule_type === 'weekly' ? 'DAY-HH:MM (e.g., MON-09:00)' :
                              'DD-HH:MM (e.g., 1-09:00)'
                            }
                            value={scheduleForm.schedule_time}
                            onChange={(e) => {
                              setScheduleForm(prev => ({ ...prev, schedule_time: e.target.value }));
                              // Clear validation error when user starts typing
                              if (scheduleValidationErrors.schedule_time) {
                                setScheduleValidationErrors(prev => ({ ...prev, schedule_time: undefined }));
                              }
                            }}
                            className={scheduleValidationErrors.schedule_time ? 'border-red-500 focus:border-red-500' : ''}
                          />
                          {scheduleValidationErrors.schedule_time && (
                            <p className="text-sm text-red-600 mt-1">
                              {scheduleValidationErrors.schedule_time}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Filtering Options */}
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">Filtering Options</Label>
                        
                        {/* Channels Filter */}
                        {channels.length > 0 && (
                          <div className="space-y-2">
                            <Label>Channels (leave empty for all)</Label>
                            <div className="flex flex-wrap gap-2">
                              {channels.map((channel) => (
                                <div key={channel.code} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`channel-${channel.code}`}
                                    checked={scheduleForm.filters.channels.includes(channel.code)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setScheduleForm(prev => ({
                                        ...prev,
                                        filters: {
                                          ...prev.filters,
                                          channels: checked 
                                            ? [...prev.filters.channels, channel.code]
                                            : prev.filters.channels.filter(c => c !== channel.code)
                                        }
                                      }));
                                    }}
                                  />
                                  <Label htmlFor={`channel-${channel.code}`} className="text-sm">
                                    {channel.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Families Filter */}
                        {families.length > 0 && (
                          <div className="space-y-2">
                            <Label>Families (leave empty for all)</Label>
                            <MultiSelect
                              options={families
                                .filter(family => family != null)
                                .map(family => ({
                                  value: family?.code || family?.name || family?.id || '',
                                  label: (family?.labels && Object.values(family?.labels)[0]) || family?.code || family?.name || family?.id || ''
                                }))}
                              value={scheduleForm.filters.families}
                              onChange={(selectedFamilies) => {
                                setScheduleForm(prev => ({
                                  ...prev,
                                  filters: {
                                    ...prev.filters,
                                    families: selectedFamilies
                                  }
                                }));
                              }}
                              placeholder="Select families for scheduled import..."
                            />
                          </div>
                        )}

                        {/* Import Options */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">Import Options</Label>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Locale</Label>
                              <Select 
                                value={scheduleForm.options.locale} 
                                onValueChange={(value) => setScheduleForm(prev => ({ 
                                  ...prev, 
                                  options: { ...prev.options, locale: value }
                                }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select locale" />
                                </SelectTrigger>
                                <SelectContent>
                                  {locales.map((locale) => (
                                    <SelectItem key={locale.code} value={locale.code}>
                                      {locale.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Batch Size</Label>
                              <Input
                                type="number"
                                min="1"
                                max="200"
                                placeholder="50"
                                value={scheduleForm.options.batchSize}
                                onChange={(e) => setScheduleForm(prev => ({ 
                                  ...prev, 
                                  options: { ...prev.options, batchSize: parseInt(e.target.value) || 50 }
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center space-x-2">
                                <Switch
                                  checked={scheduleForm.options.dryRun}
                                  onCheckedChange={(checked) => setScheduleForm(prev => ({ 
                                    ...prev, 
                                    options: { ...prev.options, dryRun: checked }
                                  }))}
                                />
                                <span>Dry Run</span>
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowScheduleForm(false);
                            setEditingSchedule(null);
                            setScheduleForm({
                              import_type: 'attributes',
                              schedule_type: 'once',
                              schedule_time: '',
                              schedule_date: '',
                              is_active: true,
                              filters: { channels: [], families: [], categoryIds: [], attributes: {} },
                              options: { locale: 'en_US', dryRun: false, batchSize: 50 }
                            });
                            setScheduleValidationErrors({});
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={saveSchedule}>
                          {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Schedules List */}
                <div className="space-y-2">
                  {loadingSchedules ? (
                    <div className="text-center py-4">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                      <span className="text-sm text-gray-500 ml-2">Loading schedules...</span>
                    </div>
                  ) : schedules.length > 0 ? (
                    schedules.map((schedule) => (
                      <Card key={schedule.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={schedule.is_active ? "default" : "secondary"}>
                                {schedule.import_type}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {schedule.schedule_type === 'once' 
                                  ? new Date(schedule.schedule_date).toLocaleString()
                                  : `${schedule.schedule_type} at ${schedule.schedule_time}`
                                }
                              </span>
                              {!schedule.is_active && (
                                <Badge variant="outline">Paused</Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {schedule.filters?.channels?.length > 0 && (
                                <span>Channels: {schedule.filters.channels.join(', ')} • </span>
                              )}
                              {schedule.filters?.families?.length > 0 && (
                                <span>Families: {schedule.filters.families.length} selected • </span>
                              )}
                              <span>Locale: {schedule.options?.locale || 'en_US'}</span>
                              {schedule.options?.dryRun && <span> • Dry Run</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingSchedule(schedule);
                                setScheduleForm({
                                  id: schedule.id,
                                  import_type: schedule.import_type,
                                  schedule_type: schedule.schedule_type,
                                  schedule_time: schedule.schedule_time || '',
                                  schedule_date: schedule.schedule_date || '',
                                  is_active: schedule.is_active,
                                  filters: schedule.filters || { channels: [], families: [], categoryIds: [], attributes: {} },
                                  options: schedule.options || { locale: 'en_US', dryRun: false, batchSize: 50 }
                                });
                                setShowScheduleForm(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteSchedule(schedule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No scheduled imports configured</p>
                      <p className="text-sm">Click "Add Schedule" to create your first automated import</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="attributes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Import Attributes</span>
                {lastImportDates.attributes && (
                  <div className="flex items-center gap-2 text-sm font-normal text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Last import: {formatLastImportDate(lastImportDates.attributes)}</span>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Import attribute definitions from Akeneo PIM. These define the properties and characteristics that can be assigned to products.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!connectionStatus?.success && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please test your connection first before importing attributes.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-2">
                <Switch 
                  id="attributes-dry-run" 
                  checked={dryRun} 
                  onCheckedChange={handleDryRunChange}
                />
                <Label htmlFor="attributes-dry-run">Dry Run (Preview only)</Label>
              </div>

              {/* Advanced Attribute Settings */}
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-sm">Advanced Attribute Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Updated Interval (hours)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={attributeSettings.updatedInterval}
                      onChange={(e) => 
                        setAttributeSettings(prev => ({ ...prev, updatedInterval: parseInt(e.target.value) || 0 }))
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500">Only import attributes updated within this timeframe</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeAttributeOptions"
                      checked={attributeSettings.includeAttributeOptions}
                      onCheckedChange={(checked) =>
                        setAttributeSettings(prev => ({ ...prev, includeAttributeOptions: checked }))
                      }
                    />
                    <Label htmlFor="includeAttributeOptions" className="text-sm">
                      Include Attribute options
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">
                    Import option values for select and multiselect attributes
                  </p>

                  {familyOptions.length > 0 && (
                    <div className="space-y-2">
                      <Label>Families</Label>
                      <MultiSelect
                        options={familyOptions}
                        value={attributeSettings.selectedFamilies}
                        onChange={(selectedFamilies) => 
                          setAttributeSettings(prev => ({ ...prev, selectedFamilies }))
                        }
                        placeholder="Select families to retrieve attributes from..."
                      />
                      <p className="text-xs text-gray-500">
                        {attributeSettings.selectedFamilies.length === 0 
                          ? 'Leave empty to import all attributes' 
                          : `${attributeSettings.selectedFamilies.length} families selected`
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-4">
                <Button 
                  onClick={importAttributes} 
                  disabled={importing || !connectionStatus?.success}
                  className="flex items-center gap-2"
                >
                  {importing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {importing ? (
                    importProgress.attributes.isActive && importProgress.attributes.total > 0 
                      ? `Importing... ${importProgress.attributes.current}/${importProgress.attributes.total}`
                      : 'Importing...'
                  ) : 'Import Attributes'}
                </Button>
              </div>

              {renderTabImportResults('attributes')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="families" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Import Families</span>
                {lastImportDates.families && (
                  <div className="flex items-center gap-2 text-sm font-normal text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Last import: {formatLastImportDate(lastImportDates.families)}</span>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Import product families (attribute sets) from Akeneo PIM. Families define which attributes are available for different product types.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!connectionStatus?.success && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please test your connection first before importing families.
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Make sure to import <strong>Attributes</strong> first, as families depend on attributes being available in the system.
                </AlertDescription>
              </Alert>

              {/* Families Selection */}
              {loadingFamilies ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading families from Akeneo...
                </div>
              ) : families.length > 0 ? (
                <div className="space-y-2">
                  <Label>Select Families to Import</Label>
                  <MultiSelect
                    options={familyOptions}
                    value={selectedFamiliesToImport}
                    onChange={setSelectedFamiliesToImport}
                    placeholder="Select specific families..."
                    searchPlaceholder="Search families..."
                    emptyText="No families found"
                  />
                  <p className="text-xs text-gray-500">
                    {selectedFamiliesToImport.length === 0 
                      ? 'All families will be imported' 
                      : `${selectedFamiliesToImport.length} families selected`
                    }
                  </p>
                </div>
              ) : connectionStatus?.success ? (
                <div className="text-sm text-gray-500">
                  No families found in Akeneo or connection failed
                </div>
              ) : null}

              <div className="flex items-center space-x-2">
                <Switch 
                  id="families-dry-run" 
                  checked={dryRun} 
                  onCheckedChange={handleDryRunChange}
                />
                <Label htmlFor="families-dry-run">Dry Run (Preview only)</Label>
              </div>

              <div className="flex items-center gap-4">
                <Button 
                  onClick={importFamilies} 
                  disabled={importing || !connectionStatus?.success}
                  className="flex items-center gap-2"
                >
                  {importing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {importing ? (
                    importProgress.families.isActive && importProgress.families.total > 0 
                      ? `Importing... ${importProgress.families.current}/${importProgress.families.total}`
                      : 'Importing...'
                  ) : 'Import Families'}
                </Button>
              </div>

              {renderTabImportResults('families')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Import Categories</span>
                {lastImportDates.categories && (
                  <div className="flex items-center gap-2 text-sm font-normal text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Last import: {formatLastImportDate(lastImportDates.categories)}</span>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Import category data from Akeneo PIM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Categories will be imported with their hierarchical structure. Parent categories are created first.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="root-categories">Root Categories to Import (Optional)</Label>
                  <div className="mt-2">
                    {loadingCategories ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading categories...
                      </div>
                    ) : availableCategories.length > 0 ? (
                      <div className="space-y-2">
                        <MultiSelect
                          options={availableCategories.map(category => ({
                            value: category.code,
                            label: `${category.labels?.en_US || category.labels?.en || category.code} (${category.code})`
                          }))}
                          value={selectedRootCategories}
                          onChange={setSelectedRootCategories}
                          placeholder="Select categories to import (at least 1 required)..."
                          className={selectedRootCategories.length === 0 ? "border-red-300" : ""}
                        />
                        <div className="flex items-center justify-between">
                          <p className={`text-xs ${selectedRootCategories.length === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {selectedRootCategories.length === 0 
                              ? '⚠️ Please select at least 1 category to import' 
                              : `${selectedRootCategories.length} categories selected`
                            }
                          </p>
                          {selectedRootCategories.length > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setSelectedRootCategories([])}
                            >
                              Clear Selection
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 p-3 border rounded-md space-y-2">
                        <p>No root categories available. Make sure:</p>
                        <ul className="text-xs ml-4 list-disc space-y-1">
                          <li>Connection has been tested successfully</li>
                          <li>Akeneo configuration is saved</li>
                          <li>Your Akeneo user has category read permissions</li>
                        </ul>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={loadAvailableCategories}
                          disabled={loadingCategories || !connectionStatus?.success}
                          className="mt-2"
                        >
                          {loadingCategories ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Try Loading Categories
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="categories-dry-run" 
                    checked={dryRun} 
                    onCheckedChange={handleDryRunChange}
                  />
                  <Label htmlFor="categories-dry-run">Dry Run (Preview only)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                      id="prevent-category-url-override"
                      checked={categorySettings.preventUrlKeyOverride}
                      onCheckedChange={(checked) =>
                          setCategorySettings(prev => ({ ...prev, preventUrlKeyOverride: checked }))
                      }
                  />
                  <div>
                    <Label htmlFor="prevent-category-url-override">Prevent URL key override</Label>
                    <p className="text-sm text-muted-foreground">
                      Keep existing category URL slugs unchanged during import
                    </p>
                  </div>
                </div>

                {!categorySettings.preventUrlKeyOverride && (
                  <div className="space-y-2">
                    <Label htmlFor="category-akeneo-url-field">Akeneo URL field name</Label>
                    <Input
                      id="category-akeneo-url-field"
                      placeholder="e.g., url_key, slug, seo_url"
                      value={categorySettings.akeneoUrlField}
                      onChange={(e) => 
                        setCategorySettings(prev => ({ ...prev, akeneoUrlField: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Akeneo field to use for generating category URLs (leave empty to use category name)
                    </p>
                  </div>
                )}

                {/* Advanced Category Settings */}
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="text-sm">Advanced Category Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="hide-from-menu"
                        checked={categorySettings.hideFromMenu}
                        onCheckedChange={(checked) => 
                          setCategorySettings(prev => ({ ...prev, hideFromMenu: checked }))
                        }
                      />
                      <Label htmlFor="hide-from-menu">Hide from menu</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="set-new-active"
                        checked={categorySettings.setNewActive}
                        onCheckedChange={(checked) => 
                          setCategorySettings(prev => ({ ...prev, setNewActive: checked }))
                        }
                      />
                      <Label htmlFor="set-new-active">Set new categories as active</Label>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-4">
                  <Button
                    onClick={importCategories}
                    disabled={importing || !connectionStatus?.success || selectedRootCategories.length === 0}
                    className="flex items-center gap-2"
                  >
                    {importing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {importing ? (
                      importProgress.categories.isActive && importProgress.categories.total > 0 
                        ? `Importing... ${importProgress.categories.current}/${importProgress.categories.total}`
                        : 'Importing...'
                    ) : 'Import Categories'}
                  </Button>

                  {availableCategories.length > 0 && !loadingCategories && (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={loadAvailableCategories}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh Categories
                    </Button>
                  )}
                </div>
              </div>

              {renderTabImportResults('categories')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Import Products</span>
                {lastImportDates.products && (
                  <div className="flex items-center gap-2 text-sm font-normal text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Last import: {formatLastImportDate(lastImportDates.products)}</span>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Import product data from Akeneo PIM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Products will be imported with their attributes, images, and category assignments. Make sure to import categories first.
                </AlertDescription>
              </Alert>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="products-dry-run" 
                  checked={dryRun} 
                  onCheckedChange={handleDryRunChange}
                />
                <Label htmlFor="products-dry-run">Dry Run (Preview only)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="prevent-product-url-override"
                  checked={productSettings.preventUrlKeyOverride}
                  onCheckedChange={(checked) => 
                    setProductSettings(prev => ({ ...prev, preventUrlKeyOverride: checked }))
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="prevent-product-url-override">Prevent URL key override</Label>
                  <p className="text-sm text-muted-foreground">
                    Keep existing product URL slugs unchanged during import
                  </p>
                </div>
              </div>

              {!productSettings.preventUrlKeyOverride && (
                <div className="space-y-2">
                  <Label htmlFor="product-akeneo-url-field">Akeneo URL field name</Label>
                  <Input
                    id="product-akeneo-url-field"
                    placeholder="e.g., url_key, slug, seo_url"
                    value={productSettings.akeneoUrlField}
                    onChange={(e) =>
                      setProductSettings(prev => ({ ...prev, akeneoUrlField: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Akeneo field to use for generating product URLs (leave empty to use product name)
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="import-product-models"
                  checked={productSettings.importProductModels}
                  onCheckedChange={(checked) =>
                    setProductSettings(prev => ({ ...prev, importProductModels: checked }))
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="import-product-models">Create configurable products from product models</Label>
                  <p className="text-sm text-muted-foreground">
                    Variants are always imported as simple products. {productSettings.importProductModels ? 'Linked to configurable parents.' : 'No configurables created.'}
                  </p>
                </div>
              </div>

              {/* Advanced Product Settings */}
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-sm">Advanced Product Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Group 1: Mode, Status, Stock Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Mode Selection */}
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select
                        value={productSettings.mode}
                        onValueChange={(value) => 
                          setProductSettings(prev => ({ ...prev, mode: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="advanced">Advanced (JSON)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={productSettings.status}
                        onValueChange={(value) => 
                          setProductSettings(prev => ({ ...prev, status: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enabled">Enabled</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Stock Filter Setting */}
                    <div className="space-y-2">
                      <Label>Stock Filter</Label>
                      <Select
                        value={productSettings.stockFilter}
                        onValueChange={(value) => 
                          setProductSettings(prev => ({ ...prev, stockFilter: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">Disabled (no stock filtering)</SelectItem>
                          <SelectItem value="in_stock">In Stock</SelectItem>
                          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">Filter products from Akeneo based on their stock status</p>
                    </div>
                  </div>

                  {/* Group 2: Updated Interval, Product Completeness, Product Model */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Updated Interval */}
                    <div className="space-y-2">
                      <Label>Updated Interval (hours)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={productSettings.updatedInterval}
                        onChange={(e) => 
                          setProductSettings(prev => ({ ...prev, updatedInterval: parseInt(e.target.value) || 0 }))
                        }
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500">Only import products updated within this timeframe</p>
                    </div>

                    {/* Product Completeness */}
                    <div className="space-y-2">
                      <Label>Product Completeness (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={productSettings.completeness}
                        onChange={(e) => 
                          setProductSettings(prev => ({ ...prev, completeness: parseInt(e.target.value) || 0 }))
                        }
                        placeholder="0-100"
                      />
                      <p className="text-xs text-gray-500">Minimum completeness percentage required</p>
                    </div>

                    {/* Product Model */}
                    <div className="space-y-2">
                      <Label>Product Model</Label>
                      <Select
                        value={productSettings.productModel}
                        onValueChange={(value) => 
                          setProductSettings(prev => ({ ...prev, productModel: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="at_least_one">At least 1 variant</SelectItem>
                          <SelectItem value="all_variants_complete">All variants complete</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">Requirement for product model variants</p>
                    </div>
                  </div>

                  {/* Group 3: Families Selection */}
                  {families.length > 0 && (
                    <div className="space-y-2">
                      <Label>Families</Label>
                      <MultiSelect
                        options={familyOptions}
                        value={selectedFamilies}
                        onChange={setSelectedFamilies}
                        placeholder="Select families to retrieve products from..."
                      />
                      <p className="text-xs text-gray-500">
                        {selectedFamilies.length === 0 
                          ? 'If empty, you may not have families in Akeneo or credentials are wrong' 
                          : `${selectedFamilies.length} families selected`
                        }
                      </p>
                    </div>
                  )}

                  {/* Media Settings */}
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-medium">Media Settings</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Images</Label>
                        <p className="text-xs text-gray-500">Include product images in import</p>
                      </div>
                      <Switch
                        checked={productSettings.includeImages}
                        disabled={!storageConnected || storageError}
                        onCheckedChange={(checked) => {
                          if (!storageConnected || storageError) {
                            toast.error("Media storage must be connected to import images", {
                              action: {
                                label: "Configure Storage",
                                onClick: () => window.open('/admin/media-storage', '_blank')
                              }
                            });
                            return;
                          }
                          setProductSettings(prev => ({ ...prev, includeImages: checked }));
                        }}
                      />
                    </div>
                    
                    {/* Storage Connection Warning for Images */}
                    {productSettings.includeImages && (!storageConnected || storageError) && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-amber-800 font-medium">
                              Media Storage Required
                            </p>
                            <p className="text-xs text-amber-700 mb-2">
                              {storageError || "Media storage must be configured to import product images"}
                            </p>
                            <a 
                              href="/admin/media-storage" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900"
                            >
                              Configure Storage →
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Files</Label>
                        <p className="text-xs text-gray-500">Include product files in import</p>
                      </div>
                      <Switch
                        checked={productSettings.includeFiles}
                        disabled={!storageConnected || storageError}
                        onCheckedChange={(checked) => {
                          if (!storageConnected || storageError) {
                            toast.error("Media storage must be connected to import files", {
                              action: {
                                label: "Configure Storage",
                                onClick: () => window.open('/admin/media-storage', '_blank')
                              }
                            });
                            return;
                          }
                          setProductSettings(prev => ({ ...prev, includeFiles: checked }));
                        }}
                      />
                    </div>
                    
                    {/* Storage Connection Warning for Files */}
                    {productSettings.includeFiles && (!storageConnected || storageError) && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-amber-800 font-medium">
                              Media Storage Required
                            </p>
                            <p className="text-xs text-amber-700 mb-2">
                              {storageError || "Media storage must be configured to import product files"}
                            </p>
                            <a 
                              href="/admin/media-storage" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900"
                            >
                              Configure Storage →
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Mapping Settings */}
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-medium">Custom Field Mapping</h4>
                    <p className="text-sm text-gray-600">Configure custom mappings between Akeneo and DainoStore fields</p>
                    
                    {/* Attribute Mapping */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label>Attribute Mapping</Label>
                          <Badge variant="secondary" className="text-xs">
                            {customMappings?.attributes?.filter(m => m.enabled).length || 0} active
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const confirmed = window.confirm('Reset to default attribute mappings?');
                              if (confirmed) {
                                setCustomMappings(prev => ({
                                  ...prev,
                                  attributes: [
                                    { akeneoAttribute: 'name', dainoField: 'name', enabled: true },
                                    { akeneoAttribute: 'description', dainoField: 'description', enabled: true },
                                    { akeneoAttribute: 'price', dainoField: 'price', enabled: true },
                                    { akeneoAttribute: 'sku', dainoField: 'sku', enabled: true }
                                  ]
                                }));
                              }
                            }}
                            className="text-xs"
                          >
                            Reset
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addMapping('attributes')}
                            className="flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Mapping
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-gray-50">
                        {customMappings?.attributes?.length === 0 ? (
                          <div className="text-center py-4 text-sm text-gray-500">
                            No attribute mappings defined. Click "Add Mapping" to create one.
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 mb-2 sticky top-0 bg-gray-50 pb-2">
                              <div className="col-span-1">#</div>
                              <div className="col-span-4">Akeneo Field</div>
                              <div className="col-span-4">DainoStore Field</div>
                              <div className="col-span-2 text-center">Active</div>
                              <div className="col-span-1"></div>
                            </div>
                            {customMappings?.attributes?.map((mapping, index) => (
                              <div key={`attr-${index}`} className={`grid grid-cols-12 gap-2 items-center py-1 ${!mapping.enabled ? 'opacity-50' : ''}`}>
                                <div className="col-span-1 text-xs text-gray-400">{index + 1}</div>
                                <div className="col-span-4">
                                  <Input
                                    size="sm"
                                    value={mapping.akeneoAttribute || ''}
                                    onChange={(e) => updateMapping('attributes', index, 'akeneoAttribute', e.target.value)}
                                    placeholder="e.g. brand, color, size"
                                    className="h-8 text-xs"
                                    disabled={!mapping.enabled}
                                  />
                                </div>
                                <div className="col-span-4">
                                  <Input
                                    size="sm"
                                    value={mapping.dainoField || ''}
                                    onChange={(e) => updateMapping('attributes', index, 'dainoField', e.target.value)}
                                    placeholder="e.g. brand, color, size"
                                    className="h-8 text-xs"
                                    disabled={!mapping.enabled}
                                  />
                                </div>
                                <div className="col-span-2 flex justify-center">
                                  <Switch
                                    checked={mapping.enabled}
                                    onCheckedChange={(checked) => updateMapping('attributes', index, 'enabled', checked)}
                                  />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMapping('attributes', index)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    title="Remove mapping"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Image Mapping */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label>Image Mapping</Label>
                          <Badge variant="secondary" className="text-xs">
                            {customMappings?.images?.filter(m => m.enabled).length || 0} active
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Sort images by priority
                              setCustomMappings(prev => ({
                                ...prev,
                                images: [...prev.images].sort((a, b) => (a.priority || 999) - (b.priority || 999))
                              }));
                              toast.success('Images sorted by priority');
                            }}
                            className="text-xs"
                            title="Sort by priority"
                          >
                            Sort
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const confirmed = window.confirm('Reset to default image mappings?');
                              if (confirmed) {
                                setCustomMappings(prev => ({
                                  ...prev,
                                  images: [
                                    { akeneoAttribute: 'image', dainoField: 'main_image', enabled: true, priority: 1 },
                                    { akeneoAttribute: 'gallery', dainoField: 'image_gallery', enabled: true, priority: 2 }
                                  ]
                                }));
                              }
                            }}
                            className="text-xs"
                          >
                            Reset
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addMapping('images')}
                            className="flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Mapping
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                        {customMappings?.images?.length === 0 ? (
                          <div className="text-center py-4 text-sm text-gray-500">
                            No image mappings defined. Click "Add Mapping" to create one.
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 mb-2 sticky top-0 bg-gray-50 pb-2">
                              <div className="col-span-1">#</div>
                              <div className="col-span-3">Akeneo Field</div>
                              <div className="col-span-3">DainoStore Field</div>
                              <div className="col-span-2">Priority</div>
                              <div className="col-span-2 text-center">Active</div>
                              <div className="col-span-1"></div>
                            </div>
                            {customMappings?.images?.map((mapping, index) => (
                              <div key={`img-${index}`} className={`grid grid-cols-12 gap-2 items-center py-1 ${!mapping.enabled ? 'opacity-50' : ''}`}>
                                <div className="col-span-1 text-xs text-gray-400">{index + 1}</div>
                                <div className="col-span-3">
                                  <Input
                                    size="sm"
                                    value={mapping.akeneoAttribute || ''}
                                    onChange={(e) => updateMapping('images', index, 'akeneoAttribute', e.target.value)}
                                    placeholder="e.g. image, gallery"
                                    className="h-8 text-xs"
                                    disabled={!mapping.enabled}
                                  />
                                </div>
                                <div className="col-span-3">
                                  <Input
                                    size="sm"
                                    value={mapping.dainoField || ''}
                                    onChange={(e) => updateMapping('images', index, 'dainoField', e.target.value)}
                                    placeholder="e.g. main_image"
                                    className="h-8 text-xs"
                                    disabled={!mapping.enabled}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    type="number"
                                    size="sm"
                                    value={mapping.priority || ''}
                                    onChange={(e) => updateMapping('images', index, 'priority', parseInt(e.target.value) || 0)}
                                    placeholder="1"
                                    className="h-8 text-xs"
                                    disabled={!mapping.enabled}
                                    min="1"
                                    max="999"
                                  />
                                </div>
                                <div className="col-span-2 flex justify-center">
                                  <Switch
                                    checked={mapping.enabled}
                                    onCheckedChange={(checked) => updateMapping('images', index, 'enabled', checked)}
                                  />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMapping('images', index)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    title="Remove mapping"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Images are imported in priority order. Lower numbers have higher priority.
                      </p>
                    </div>

                    {/* Files Mapping */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label>Files Mapping</Label>
                          <Badge variant="secondary" className="text-xs">
                            {customMappings?.files?.filter(m => m.enabled).length || 0} active
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const confirmed = window.confirm('Reset to default file mappings?');
                              if (confirmed) {
                                setCustomMappings(prev => ({
                                  ...prev,
                                  files: [
                                    { akeneoAttribute: 'attachments', dainoField: 'files', enabled: true },
                                    { akeneoAttribute: 'documents', dainoField: 'downloads', enabled: true }
                                  ]
                                }));
                              }
                            }}
                            className="text-xs"
                          >
                            Reset
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addMapping('files')}
                            className="flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Mapping
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                        {customMappings?.files?.length === 0 ? (
                          <div className="text-center py-4 text-sm text-gray-500">
                            No file mappings defined. Click "Add Mapping" to create one.
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 mb-2 sticky top-0 bg-gray-50 pb-2">
                              <div className="col-span-1">#</div>
                              <div className="col-span-4">Akeneo Field</div>
                              <div className="col-span-4">DainoStore Field</div>
                              <div className="col-span-2 text-center">Active</div>
                              <div className="col-span-1"></div>
                            </div>
                            {customMappings?.files?.map((mapping, index) => (
                              <div key={`file-${index}`} className={`grid grid-cols-12 gap-2 items-center py-1 ${!mapping.enabled ? 'opacity-50' : ''}`}>
                                <div className="col-span-1 text-xs text-gray-400">{index + 1}</div>
                                <div className="col-span-4">
                                  <Input
                                    size="sm"
                                    value={mapping.akeneoAttribute || ''}
                                    onChange={(e) => updateMapping('files', index, 'akeneoAttribute', e.target.value)}
                                    placeholder="e.g. manual, datasheet"
                                    className="h-8 text-xs"
                                    disabled={!mapping.enabled}
                                  />
                                </div>
                                <div className="col-span-4">
                                  <Input
                                    size="sm"
                                    value={mapping.dainoField || ''}
                                    onChange={(e) => updateMapping('files', index, 'dainoField', e.target.value)}
                                    placeholder="e.g. product_files"
                                    className="h-8 text-xs"
                                    disabled={!mapping.enabled}
                                  />
                                </div>
                                <div className="col-span-2 flex justify-center">
                                  <Switch
                                    checked={mapping.enabled}
                                    onCheckedChange={(checked) => updateMapping('files', index, 'enabled', checked)}
                                  />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMapping('files', index)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    title="Remove mapping"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-4">
                <Button 
                  onClick={importProducts} 
                  disabled={importing || !connectionStatus?.success}
                  className="flex items-center gap-2"
                >
                  {importing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {importing ? (
                    importProgress.products.isActive && importProgress.products.total > 0 
                      ? `Importing... ${importProgress.products.current}/${importProgress.products.total}`
                      : 'Importing...'
                  ) : 'Import Products'}
                </Button>
              </div>

              {renderTabImportResults('products')}
            </CardContent>
          </Card>
        </TabsContent>

        </Tabs>

        {/* Disconnect Confirmation Modal */}
        {showDisconnectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Disconnect Akeneo</h3>
                </div>
                <button
                  onClick={handleDisconnectCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={disconnecting}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to disconnect your Akeneo integration? This will:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    Remove all saved Akeneo credentials
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    Delete custom attribute mappings
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    Require reconfiguration to import data again
                  </li>
                </ul>
                <p className="text-sm text-gray-500">
                  Note: Previously imported categories and products will not be deleted.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleDisconnectCancel}
                  disabled={disconnecting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnectConfirm}
                  disabled={disconnecting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {disconnecting ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  } catch (error) {
    console.error('🚨 AkeneoIntegration component crashed:', error);
    console.error('🚨 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Return error fallback UI
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Component Error</h2>
            <p className="text-red-700 text-sm mb-4">
              The Akeneo Integration component encountered an error: {error.message}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
};

// Wrap the component with Error Boundary to catch crashes
const AkeneoIntegrationWithErrorBoundary = () => {
  // Temporarily disable error boundary since imports are working correctly
  return <AkeneoIntegration />;
  
  /* Uncomment to re-enable error boundary if needed:
  return (
    <AkeneoErrorBoundary>
      <AkeneoIntegration />
    </AkeneoErrorBoundary>
  );
  */
};

export default AkeneoIntegrationWithErrorBoundary;