import React, { useState, useEffect } from 'react';
import { Store } from '@/api/entities';
import { User } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { clearStorefrontCache } from '@/utils/cacheUtils';
import FlashMessage from '@/components/storefront/FlashMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Bot,
  Shield,
  Upload,
  Download,
  Settings,
  Eye,
  TrendingUp,
  Code,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Activity,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  Copy,
  MousePointer,
  FileText,
  Timer,
  Zap,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SaveButton from '@/components/ui/save-button';
import CmsBlockRenderer from '@/components/storefront/CmsBlockRenderer';
import { PageLoader } from '@/components/ui/page-loader';


export default function AnalyticsSettings() {
    const { selectedStore, getSelectedStoreId } = useStoreSelection();
    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [flashMessage, setFlashMessage] = useState(null);
    
    // New state for advanced analytics features
    const [dataLayerEvents, setDataLayerEvents] = useState([]);
    const [gtmSettings, setGtmSettings] = useState({
        container_id: '',
        enabled: false,
        auto_track_page_views: true,
        auto_track_ecommerce: true,
        custom_events: []
    });
    
    // Auto-refresh state for live events
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(5); // seconds
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [previousEventCount, setPreviousEventCount] = useState(0);
    const [newEventsCount, setNewEventsCount] = useState(0);
    const [importData, setImportData] = useState('');
    const [exportFormat, setExportFormat] = useState('json');

    // Custom Events Management State
    const [customEvents, setCustomEvents] = useState([]);
    const [eventTemplates, setEventTemplates] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [showEventDialog, setShowEventDialog] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [eventForm, setEventForm] = useState({
        event_name: '',
        display_name: '',
        description: '',
        event_category: 'custom',
        trigger_type: 'click',
        trigger_selector: '',
        trigger_condition: null,
        event_parameters: {},
        enabled: true,
        priority: 10,
        fire_once_per_session: false,
        send_to_backend: true
    });

    useEffect(() => {
        const loadStore = async () => {
            try {
                if (!selectedStore) {
                    setLoading(false);
                    return;
                }
                
                // Fetch complete store data with settings from API
                const fullStoreData = await Store.findById(selectedStore.id);

                // Handle the case where findById returns an array or wrapped response
                let storeData;
                if (Array.isArray(fullStoreData)) {
                    storeData = fullStoreData[0];
                } else if (fullStoreData?.data) {
                    // Handle { success: true, data: { store: {...}, tenantData: {...} } } format
                    // The settings are in tenantData
                    if (fullStoreData.data.tenantData) {
                        storeData = fullStoreData.data.tenantData;
                    } else {
                        storeData = fullStoreData.data;
                    }
                } else {
                    storeData = fullStoreData;
                }

                setStore({
                    ...selectedStore,
                    ...storeData, // Include all data from API
                    settings: {
                        ...(storeData?.settings || {}),
                        analytics_settings: {
                            enable_google_tag_manager: false,
                            gtm_script_type: 'default', // 'default' or 'custom'
                            gtm_id: '',
                            google_ads_id: '',
                            custom_gtm_script: '',
                            ...(storeData?.settings?.analytics_settings || {})
                        }
                    }
                });

                // Load advanced GTM settings
                const analytics = storeData?.settings?.analytics || {};
                // Fix: Use explicit checks instead of || operator which treats false as falsy
                const gtmEnabled = analytics.gtm_enabled !== undefined
                    ? analytics.gtm_enabled
                    : (storeData?.settings?.analytics_settings?.enable_google_tag_manager || false);

                setGtmSettings({
                    container_id: analytics.gtm_container_id || storeData?.settings?.analytics_settings?.gtm_id || '',
                    enabled: gtmEnabled,
                    auto_track_page_views: analytics.auto_track_page_views !== false,
                    auto_track_ecommerce: analytics.auto_track_ecommerce !== false,
                    custom_events: analytics.custom_events || []
                });
                
                // Load dataLayer events
                loadDataLayerEvents();

                // Load custom events and templates
                loadCustomEvents();
                loadEventTemplates();

            } catch (error) {
                console.error("Failed to load store:", error);
                setFlashMessage({ type: 'error', message: 'Could not load store settings.' });
            } finally {
                setLoading(false);
            }
        };
        if (selectedStore) {
            loadStore();
        }
    }, [selectedStore]);

    // Auto-refresh effect for live events
    useEffect(() => {
        let intervalId;
        
        if (autoRefresh && selectedStore) {
            intervalId = setInterval(() => {
                loadDataLayerEvents();
                setLastRefresh(new Date());
            }, refreshInterval * 1000);
        }
        
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [autoRefresh, refreshInterval, selectedStore]);

    const handleAnalyticsChange = (key, value) => {
        setStore(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                analytics_settings: {
                    ...prev.settings.analytics_settings,
                    [key]: value
                }
            }
        }));

        // Also sync with gtmSettings state for save handler
        if (key === 'enable_google_tag_manager') {
            setGtmSettings(prev => ({ ...prev, enabled: value }));
        } else if (key === 'gtm_id') {
            setGtmSettings(prev => ({ ...prev, container_id: value }));
        }
    };

    const handleSave = async () => {
        const storeId = getSelectedStoreId();
        if (!storeId || !store) return;
        setSaving(true);
        setSaveSuccess(false);
        try {

            // Merge both old and new analytics settings
            const updatedSettings = {
                ...store.settings,
                analytics: {
                    gtm_container_id: gtmSettings.container_id,
                    gtm_enabled: gtmSettings.enabled,
                    auto_track_page_views: gtmSettings.auto_track_page_views,
                    auto_track_ecommerce: gtmSettings.auto_track_ecommerce,
                    custom_events: gtmSettings.custom_events
                },
                analytics_settings: {
                    ...store.settings.analytics_settings,
                    gtm_id: gtmSettings.container_id,
                    enable_google_tag_manager: gtmSettings.enabled,
                    gtm_script_type: store.settings.analytics_settings?.gtm_script_type || 'default',
                    custom_gtm_script: store.settings.analytics_settings?.custom_gtm_script || ''
                }
            };

            const response = await Store.update(storeId, { settings: updatedSettings });

            // Update local state to avoid reload
            setStore(prev => ({
                ...prev,
                settings: updatedSettings
            }));

            // Reload GTM if enabled
            if (gtmSettings.enabled && gtmSettings.container_id) {
                loadGTMScript();
            }

            // Clear all cache for instant updates
            try {
                localStorage.removeItem('storeProviderCache');
                sessionStorage.removeItem('storeProviderCache');

                // Broadcast cache clear to other tabs and trigger server cache clear
                const channel = new BroadcastChannel('store_settings_update');
                channel.postMessage({ type: 'clear_cache', storeId });
                channel.close();

                // Also call cache clear API to clear Redis cache
                const storeSlug = store?.slug || selectedStore?.slug;
                if (storeSlug) {
                    await fetch(`/api/cache-test/clear-bootstrap/${storeSlug}`)
                        .catch(err => console.warn('Failed to clear server cache:', err));
                }
            } catch (e) {
                console.warn('Failed to clear cache:', e);
            }

            setFlashMessage({ type: 'success', message: 'Analytics settings saved successfully!' });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            setFlashMessage({ type: 'error', message: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };
    
    // Advanced analytics functions
    const loadDataLayerEvents = async () => {
        // Get recent dataLayer events from window.dataLayer
        const browserEvents = [];
        if (typeof window !== 'undefined' && window.dataLayer) {
            const recentEvents = window.dataLayer.slice(-50); // Last 50 events
            browserEvents.push(...recentEvents.map(event => ({
                ...event,
                source: 'browser',
                timestamp: event.timestamp || event['gtm.start'] || new Date().toISOString()
            })));
            // Debug browser event timestamps
            if (recentEvents.length > 0) {
                const sampledEvents = recentEvents.slice(-3).map(e => ({
                    event: e.event || 'unknown',
                    timestamp: e.timestamp,
                    gtmStart: e['gtm.start'],
                    formatted: (() => {
                        const ts = e.timestamp || e['gtm.start'];
                        if (!ts) return 'No timestamp';
                        try {
                            const date = new Date(ts);
                            return isNaN(date.getTime()) ? 'Invalid timestamp' : date.toLocaleString();
                        } catch (error) {
                            return 'Invalid timestamp';
                        }
                    })()
                }));
            }
        } else {
            console.warn('📊 No window.dataLayer found');
        }
        
        // Get customer activities from database
        try {
            if (selectedStore?.id) {
                const apiUrl = `/api/customer-activity?store_id=${selectedStore.id}&limit=50`;
                
                const response = await fetch(apiUrl);
                
                if (response.ok) {
                    const responseData = await response.json();
                    
                    // Handle the API response structure
                    const databaseEvents = responseData.success && responseData.data?.activities 
                        ? responseData.data.activities 
                        : (Array.isArray(responseData) ? responseData : []);

                    const formattedDbEvents = databaseEvents.map(activity => ({
                        event: activity.activity_type,
                        source: 'database',
                        timestamp: activity.created_at || activity.createdAt || activity.updatedAt || new Date().toISOString(),
                        store_id: activity.store_id,
                        session_id: activity.session_id,
                        user_id: activity.user_id,
                        page_url: activity.page_url,
                        product_id: activity.product_id,
                        search_query: activity.search_query,
                        user_agent: activity.user_agent,
                        ip_address: activity.ip_address,
                        metadata: activity.metadata,
                        // Include the full activity record for debugging
                        _raw: activity
                    }));
                    browserEvents.push(...formattedDbEvents);

                } else {
                    const errorText = await response.text();
                    console.warn('Failed to fetch customer activities:', response.status, response.statusText, errorText);
                }
            } else {
                console.warn('🚫 No selected store ID available');
            }
        } catch (error) {
            console.warn('Could not load customer activities:', error);
        }
        
        // Sort all events by timestamp (safely handle invalid dates)
        browserEvents.sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            
            // Handle invalid dates by treating them as very old
            const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
            
            return timeB - timeA; // Sort newest first
        });
        
        // Track new events if auto-refresh is enabled
        if (autoRefresh && previousEventCount > 0) {
            const newCount = browserEvents.length - previousEventCount;
            if (newCount > 0) {
                setNewEventsCount(prev => prev + newCount);
                
                // Clear the new events counter after 3 seconds
                setTimeout(() => {
                    setNewEventsCount(0);
                }, 3000);
            }
        }
        
        setPreviousEventCount(browserEvents.length);
        setDataLayerEvents(browserEvents);
    };

    const loadGTMScript = () => {
        if (!gtmSettings.container_id) return;
        
        // Remove existing GTM script if any
        const existingScript = document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
        if (existingScript) {
            existingScript.remove();
        }

        // Add new GTM script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmSettings.container_id}`;
        document.head.appendChild(script);

        // Initialize dataLayer if not exists
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'gtm.start': new Date().getTime(),
            event: 'gtm.js'
        });
    };

    const importDataLayer = () => {
        try {
            const data = JSON.parse(importData);
            
            if (Array.isArray(data)) {
                // Import as dataLayer events
                data.forEach(event => {
                    if (typeof window !== 'undefined' && window.dataLayer) {
                        window.dataLayer.push(event);
                    }
                });
                setDataLayerEvents(prev => [...prev, ...data]);
                setFlashMessage({ type: 'success', message: `Successfully imported ${data.length} dataLayer events` });
            } else if (data.tags || data.triggers || data.variables) {
                // GTM container export format
                setFlashMessage({ type: 'success', message: 'GTM container format detected. Use this data to import into Google Tag Manager directly.' });
            }
            
            setImportData('');
        } catch (error) {
            setFlashMessage({ type: 'error', message: 'Invalid JSON format. Please check your import data.' });
        }
    };

    const exportDataLayer = () => {
        const exportData = {
            store_id: selectedStore?.id,
            store_name: selectedStore?.name,
            export_date: new Date().toISOString(),
            gtm_settings: gtmSettings,
            legacy_settings: store?.settings?.analytics_settings,
            dataLayer_events: dataLayerEvents,
            suggested_gtm_tags: [
                {
                    name: 'Page View - Enhanced',
                    type: 'gtag',
                    trigger: 'Page View',
                    config: {
                        page_title: '{{Page Title}}',
                        page_location: '{{Page URL}}',
                        store_name: selectedStore?.name
                    }
                },
                {
                    name: 'Add to Cart',
                    type: 'gtag',
                    trigger: 'Custom Event - cart_add',
                    config: {
                        event_category: 'ecommerce',
                        event_label: '{{Product Name}}'
                    }
                },
                {
                    name: 'Purchase',
                    type: 'gtag',
                    trigger: 'Custom Event - purchase',
                    config: {
                        event_category: 'ecommerce',
                        transaction_id: '{{Order ID}}',
                        value: '{{Order Total}}'
                    }
                }
            ]
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daino-analytics-export-${selectedStore?.name || 'store'}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const addCustomEvent = () => {
        const eventName = prompt('Enter custom event name:');
        if (eventName) {
            setGtmSettings(prev => ({
                ...prev,
                custom_events: [...prev.custom_events, {
                    name: eventName,
                    description: '',
                    parameters: {}
                }]
            }));
        }
    };

    const removeCustomEvent = (index) => {
        setGtmSettings(prev => ({
            ...prev,
            custom_events: prev.custom_events.filter((_, i) => i !== index)
        }));
    };

    const testDataLayerPush = () => {
        const testEvent = {
            event: 'test_event',
            timestamp: new Date().toISOString(),
            test_data: 'This is a test event from DainoStore Analytics',
            store_id: selectedStore?.id
        };

        if (typeof window !== 'undefined' && window.dataLayer) {
            window.dataLayer.push(testEvent);
            setDataLayerEvents(prev => [...prev, testEvent]);
            setFlashMessage({ type: 'success', message: 'Test event pushed to dataLayer successfully!' });
        }
    };

    // Custom Events Management Functions
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
    });

    const loadCustomEvents = async () => {
        if (!selectedStore?.id) return;
        setLoadingEvents(true);
        try {
            const response = await fetch(`/api/custom-analytics-events/${selectedStore.id}`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setCustomEvents(data.data || []);
            }
        } catch (error) {
            console.error('Failed to load custom events:', error);
        } finally {
            setLoadingEvents(false);
        }
    };

    const loadEventTemplates = async () => {
        try {
            const response = await fetch('/api/custom-analytics-events/templates/list', {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setEventTemplates(data.data || []);
            }
        } catch (error) {
            console.error('Failed to load event templates:', error);
        }
    };

    const resetEventForm = () => {
        setEventForm({
            event_name: '',
            display_name: '',
            description: '',
            event_category: 'custom',
            trigger_type: 'click',
            trigger_selector: '',
            trigger_condition: null,
            event_parameters: {},
            enabled: true,
            priority: 10,
            fire_once_per_session: false,
            send_to_backend: true
        });
        setEditingEvent(null);
    };

    const openCreateDialog = () => {
        resetEventForm();
        setShowEventDialog(true);
    };

    const openEditDialog = (event) => {
        setEditingEvent(event);
        setEventForm({
            event_name: event.event_name || '',
            display_name: event.display_name || '',
            description: event.description || '',
            event_category: event.event_category || 'custom',
            trigger_type: event.trigger_type || 'click',
            trigger_selector: event.trigger_selector || '',
            trigger_condition: event.trigger_condition || null,
            event_parameters: event.event_parameters || {},
            enabled: event.enabled !== false,
            priority: event.priority || 10,
            fire_once_per_session: event.fire_once_per_session || false,
            send_to_backend: event.send_to_backend !== false
        });
        setShowEventDialog(true);
    };

    const applyTemplate = (template) => {
        setEventForm({
            event_name: template.id || '',
            display_name: template.display_name || '',
            description: template.description || '',
            event_category: template.event_category || 'custom',
            trigger_type: template.trigger_type || 'click',
            trigger_selector: template.trigger_selector || '',
            trigger_condition: template.trigger_condition || null,
            event_parameters: template.event_parameters || {},
            enabled: true,
            priority: 10,
            fire_once_per_session: false,
            send_to_backend: template.send_to_backend !== false
        });
    };

    const saveEvent = async () => {
        if (!selectedStore?.id) return;
        if (!eventForm.event_name || !eventForm.display_name || !eventForm.trigger_type) {
            setFlashMessage({ type: 'error', message: 'Event name, display name, and trigger type are required.' });
            return;
        }

        try {
            const url = editingEvent
                ? `/api/custom-analytics-events/${selectedStore.id}/${editingEvent.id}`
                : `/api/custom-analytics-events/${selectedStore.id}`;

            const response = await fetch(url, {
                method: editingEvent ? 'PUT' : 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(eventForm)
            });

            if (response.ok) {
                setFlashMessage({ type: 'success', message: editingEvent ? 'Event updated successfully!' : 'Event created successfully!' });
                setShowEventDialog(false);
                resetEventForm();
                loadCustomEvents();
            } else {
                const error = await response.json();
                setFlashMessage({ type: 'error', message: error.error || 'Failed to save event.' });
            }
        } catch (error) {
            setFlashMessage({ type: 'error', message: 'Failed to save event.' });
        }
    };

    const deleteEvent = async (eventId) => {
        if (!selectedStore?.id) return;
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            const response = await fetch(`/api/custom-analytics-events/${selectedStore.id}/${eventId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                setFlashMessage({ type: 'success', message: 'Event deleted successfully!' });
                loadCustomEvents();
            } else {
                const error = await response.json();
                setFlashMessage({ type: 'error', message: error.error || 'Failed to delete event.' });
            }
        } catch (error) {
            setFlashMessage({ type: 'error', message: 'Failed to delete event.' });
        }
    };

    const toggleEventEnabled = async (event) => {
        if (!selectedStore?.id) return;

        try {
            const response = await fetch(`/api/custom-analytics-events/${selectedStore.id}/${event.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ enabled: !event.enabled })
            });

            if (response.ok) {
                loadCustomEvents();
            }
        } catch (error) {
            setFlashMessage({ type: 'error', message: 'Failed to toggle event.' });
        }
    };

    const getTriggerIcon = (triggerType) => {
        switch (triggerType) {
            case 'click': return <MousePointer className="w-4 h-4" />;
            case 'page_load': return <FileText className="w-4 h-4" />;
            case 'form_submit': return <FileText className="w-4 h-4" />;
            case 'scroll': return <Activity className="w-4 h-4" />;
            case 'timer': return <Timer className="w-4 h-4" />;
            default: return <Zap className="w-4 h-4" />;
        }
    };

    const getCategoryColor = (category) => {
        switch (category) {
            case 'ecommerce': return 'bg-green-100 text-green-800';
            case 'engagement': return 'bg-blue-100 text-blue-800';
            case 'conversion': return 'bg-purple-100 text-purple-800';
            case 'navigation': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <PageLoader size="lg" fullScreen={false} className="p-8" />;
    }
    
    if (!store) {
        return <div className="p-8">Could not load store configuration.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Tracking & Data Layer</h1>
                <p className="text-gray-600 mt-1">Manage Google Tag Manager integration, configure tracking scripts, and export analytics data.</p>
            </div>

            <Tabs defaultValue="basic" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic" className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        GTM
                    </TabsTrigger>
                    <TabsTrigger value="events" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        DataLayer Events
                    </TabsTrigger>
                    <TabsTrigger value="import" className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Import
                    </TabsTrigger>
                    <TabsTrigger value="export" className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export
                    </TabsTrigger>
                </TabsList>

                {/* GTM Tab with Two Cards */}
                <TabsContent value="basic" className="space-y-6">
                    {/* Google Tag Manager Card */}
                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Code className="w-5 h-5" /> 
                                Google Tag Manager
                            </CardTitle>
                            <CardDescription>
                                Configure your Google Tag Manager container and tracking options.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* GTM Enable Toggle */}
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                                <div>
                                    <Label htmlFor="enable_gtm" className="text-base font-medium">Enable Google Tag Manager</Label>
                                    <p className="text-sm text-gray-500 mt-1">Track analytics and marketing tags through GTM</p>
                                </div>
                                <Switch 
                                    id="enable_gtm" 
                                    checked={!!store.settings.analytics_settings.enable_google_tag_manager} 
                                    onCheckedChange={(c) => handleAnalyticsChange('enable_google_tag_manager', c)} 
                                />
                            </div>

                            {store.settings.analytics_settings.enable_google_tag_manager && (
                                <div className="space-y-6">
                                    {/* Implementation Type */}
                                    <div>
                                        <Label className="text-base font-medium">Implementation Type</Label>
                                        <RadioGroup
                                            value={store.settings.analytics_settings.gtm_script_type || 'default'}
                                            onValueChange={(value) => handleAnalyticsChange('gtm_script_type', value)}
                                            className="mt-3"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="default" id="gtm_default" />
                                                <Label htmlFor="gtm_default" className="cursor-pointer font-medium">
                                                    Default Google Tag Manager
                                                </Label>
                                            </div>
                                            <p className="text-sm text-gray-500 ml-6">Standard GTM implementation using Google's servers</p>

                                            <div className="flex items-center space-x-2 mt-3">
                                                <RadioGroupItem value="custom" id="gtm_custom" />
                                                <Label htmlFor="gtm_custom" className="cursor-pointer font-medium">
                                                    Custom GTM Script (Server-Side Tagging)
                                                </Label>
                                            </div>
                                            <p className="text-sm text-gray-500 ml-6">Custom implementation for first-party data collection</p>
                                        </RadioGroup>
                                    </div>

                                    {/* GTM Configuration */}
                                    {store.settings.analytics_settings.gtm_script_type === 'default' ? (
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="gtm_id" className="text-base font-medium">Container ID</Label>
                                                <Input
                                                    id="gtm_id"
                                                    value={store.settings.analytics_settings.gtm_id || ''}
                                                    onChange={(e) => handleAnalyticsChange('gtm_id', e.target.value)}
                                                    placeholder="GTM-XXXXXX"
                                                    className="mt-2"
                                                />
                                                <p className="text-sm text-gray-500 mt-2">Enter your Google Tag Manager container ID</p>
                                            </div>

                                            <div className="p-4 bg-blue-50 rounded-lg">
                                                <p className="font-medium text-blue-900 mb-2">📍 How GTM is implemented:</p>
                                                <ul className="space-y-1 text-blue-800 text-sm">
                                                    <li>• <strong>Head section:</strong> JavaScript code automatically added to <code className="px-1 py-0.5 bg-blue-100 rounded">&lt;head&gt;</code></li>
                                                    <li>• <strong>Body section:</strong> <code className="px-1 py-0.5 bg-blue-100 rounded">&lt;noscript&gt;</code> fallback added after <code className="px-1 py-0.5 bg-blue-100 rounded">&lt;body&gt;</code></li>
                                                    <li>• <strong>Automatic:</strong> No manual code placement required</li>
                                                </ul>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="gtm_id_custom" className="text-base font-medium">Container ID</Label>
                                                <Input
                                                    id="gtm_id_custom"
                                                    value={store.settings.analytics_settings.gtm_id || ''}
                                                    onChange={(e) => handleAnalyticsChange('gtm_id', e.target.value)}
                                                    placeholder="GTM-XXXXXX"
                                                    className="mt-2"
                                                />
                                                <p className="text-sm text-gray-500 mt-2">Required for noscript tag generation</p>
                                            </div>
                                            
                                            <div>
                                                <Label htmlFor="custom_gtm_script" className="text-base font-medium">Custom GTM Script</Label>
                                                <Textarea
                                                    id="custom_gtm_script"
                                                    value={store.settings.analytics_settings.custom_gtm_script || ''}
                                                    onChange={(e) => handleAnalyticsChange('custom_gtm_script', e.target.value)}
                                                    placeholder="<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\nnew Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\nj=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n'https://your-server.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n})(window,document,'script','dataLayer','GTM-XXXXXX');</script>\n<!-- End Google Tag Manager -->"
                                                    rows={8}
                                                    className="font-mono text-sm mt-2"
                                                />
                                                <p className="text-sm text-gray-500 mt-2">
                                                    Complete GTM script for server-side tagging. Replace the endpoint with your server-side tagging URL.
                                                </p>
                                            </div>

                                            <div className="p-4 bg-green-50 rounded-lg">
                                                <p className="font-medium text-green-900 mb-2">✅ Custom GTM Implementation:</p>
                                                <ul className="space-y-1 text-green-800 text-sm">
                                                    <li>• <strong>Head script:</strong> Your custom script placed in <code className="px-1 py-0.5 bg-green-100 rounded">&lt;head&gt;</code></li>
                                                    <li>• <strong>Noscript tags:</strong> Auto-generated when Container ID is provided</li>
                                                    <li>• <strong>Automatic:</strong> Both head and body implementations handled automatically</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tracking Options */}
                                    <div className="border-t pt-6">
                                        <h3 className="text-lg font-medium text-gray-900 mb-4">Tracking Options</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                                <div>
                                                    <Label htmlFor="auto-page-views" className="font-medium">Auto-track Page Views</Label>
                                                    <p className="text-sm text-gray-500">Automatically track all page visits</p>
                                                </div>
                                                <Switch
                                                    id="auto-page-views"
                                                    checked={gtmSettings.auto_track_page_views}
                                                    onCheckedChange={(auto_track_page_views) => setGtmSettings(prev => ({ ...prev, auto_track_page_views }))}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                                <div>
                                                    <Label htmlFor="auto-ecommerce" className="font-medium">Auto-track E-commerce Events</Label>
                                                    <p className="text-sm text-gray-500">Track cart and purchase events</p>
                                                </div>
                                                <Switch
                                                    id="auto-ecommerce"
                                                    checked={gtmSettings.auto_track_ecommerce}
                                                    onCheckedChange={(auto_track_ecommerce) => setGtmSettings(prev => ({ ...prev, auto_track_ecommerce }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Test Button */}
                                    <div className="flex justify-end pt-4 border-t">
                                        <Button variant="outline" onClick={testDataLayerPush} className="flex items-center gap-2">
                                            <Activity className="w-4 h-4" />
                                            Test Datalayer
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Google Ads Card */}
                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" /> 
                                Google Ads
                            </CardTitle>
                            <CardDescription>
                                Set up Google Ads conversion tracking and remarketing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="google_ads_id" className="text-base font-medium">Google Ads ID</Label>
                                <Input 
                                    id="google_ads_id" 
                                    value={store.settings.analytics_settings.google_ads_id || ''} 
                                    onChange={(e) => handleAnalyticsChange('google_ads_id', e.target.value)} 
                                    placeholder="AW-XXXXXXXXX"
                                    className="mt-2"
                                />
                                <p className="text-sm text-gray-500 mt-2">Enter your Google Ads conversion ID for tracking and remarketing</p>
                            </div>
                            
                            {store.settings.analytics_settings.google_ads_id && (
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <p className="font-medium text-green-900 mb-2">✅ Google Ads Implementation:</p>
                                    <ul className="space-y-1 text-green-800 text-sm">
                                        <li>• <strong>gtag.js library:</strong> Automatically loaded in <code className="px-1 py-0.5 bg-green-100 rounded">&lt;head&gt;</code></li>
                                        <li>• <strong>Configuration script:</strong> Auto-configured with your Ads ID</li>
                                        <li>• <strong>GTM compatible:</strong> Works alongside Google Tag Manager</li>
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* DataLayer Events */}
                <TabsContent value="events" className="space-y-6">
                    {/* Custom Events Management Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Zap className="w-5 h-5" />
                                        Custom DataLayer Events
                                    </CardTitle>
                                    <CardDescription>
                                        Create custom events to track specific user interactions. Events are pushed to window.dataLayer for Google Tag Manager.
                                    </CardDescription>
                                </div>
                                <Button onClick={openCreateDialog} className="flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    New Event
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingEvents ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                </div>
                            ) : customEvents.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                    <Zap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No custom events yet</h3>
                                    <p className="text-gray-500 mb-4">Create custom events to track user interactions like button clicks, form submissions, and more.</p>
                                    <Button onClick={openCreateDialog} variant="outline">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Your First Event
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {customEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className={`border rounded-lg p-4 ${event.enabled ? 'bg-white' : 'bg-gray-50 opacity-75'}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg ${event.enabled ? 'bg-blue-100' : 'bg-gray-200'}`}>
                                                        {getTriggerIcon(event.trigger_type)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium text-gray-900">{event.display_name}</h4>
                                                            <Badge variant="outline" className={getCategoryColor(event.event_category)}>
                                                                {event.event_category}
                                                            </Badge>
                                                            {event.is_system && (
                                                                <Badge variant="secondary">System</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{event.event_name}</code>
                                                            {event.trigger_selector && (
                                                                <span className="ml-2">• Selector: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{event.trigger_selector}</code></span>
                                                            )}
                                                        </p>
                                                        {event.description && (
                                                            <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                {getTriggerIcon(event.trigger_type)}
                                                                {event.trigger_type.replace('_', ' ')}
                                                            </span>
                                                            {event.fire_once_per_session && (
                                                                <span>Once per session</span>
                                                            )}
                                                            {event.send_to_backend && (
                                                                <span className="text-green-600">Logs to backend</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleEventEnabled(event)}
                                                        title={event.enabled ? 'Disable' : 'Enable'}
                                                    >
                                                        {event.enabled ? (
                                                            <ToggleRight className="w-5 h-5 text-green-600" />
                                                        ) : (
                                                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEditDialog(event)}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    {!event.is_system && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => deleteEvent(event.id)}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Built-in Events Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                Built-in Events (Always Active)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { name: 'page_view', label: 'Page View', desc: 'Every page load' },
                                    { name: 'view_item', label: 'Product View', desc: 'Product detail pages' },
                                    { name: 'add_to_cart', label: 'Add to Cart', desc: 'Products added to cart' },
                                    { name: 'remove_from_cart', label: 'Remove from Cart', desc: 'Products removed' },
                                    { name: 'begin_checkout', label: 'Checkout Started', desc: 'Checkout initiated' },
                                    { name: 'purchase', label: 'Purchase', desc: 'Order completed' },
                                    { name: 'search', label: 'Search', desc: 'Product searches' },
                                    { name: 'view_item_list', label: 'Product List View', desc: 'Category pages' },
                                    { name: 'select_item', label: 'Product Click', desc: 'Product clicks in lists' },
                                ].map((event) => (
                                    <div key={event.name} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-sm">{event.label}</p>
                                            <p className="text-xs text-gray-500">{event.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Event Create/Edit Dialog */}
                <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Custom Event'}</DialogTitle>
                            <DialogDescription>
                                {editingEvent ? 'Update the event configuration.' : 'Configure a custom event to track user interactions.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            {/* Templates Section (only for new events) */}
                            {!editingEvent && eventTemplates.length > 0 && (
                                <div>
                                    <Label className="text-sm font-medium mb-2 block">Start from Template</Label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                                        {eventTemplates.map((template) => (
                                            <button
                                                key={template.id}
                                                onClick={() => applyTemplate(template)}
                                                className="text-left p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                            >
                                                <p className="font-medium text-sm">{template.display_name}</p>
                                                <p className="text-xs text-gray-500 truncate">{template.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="event_name">Event Name *</Label>
                                    <Input
                                        id="event_name"
                                        value={eventForm.event_name}
                                        onChange={(e) => setEventForm(prev => ({ ...prev, event_name: e.target.value }))}
                                        placeholder="add_to_wishlist"
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Technical name for dataLayer</p>
                                </div>
                                <div>
                                    <Label htmlFor="display_name">Display Name *</Label>
                                    <Input
                                        id="display_name"
                                        value={eventForm.display_name}
                                        onChange={(e) => setEventForm(prev => ({ ...prev, display_name: e.target.value }))}
                                        placeholder="Add to Wishlist"
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Human-readable name</p>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={eventForm.description}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Track when users add products to their wishlist"
                                    className="mt-1"
                                    rows={2}
                                />
                            </div>

                            {/* Trigger Configuration */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="trigger_type">Trigger Type *</Label>
                                    <Select
                                        value={eventForm.trigger_type}
                                        onValueChange={(value) => setEventForm(prev => ({ ...prev, trigger_type: value }))}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="click">Click</SelectItem>
                                            <SelectItem value="page_load">Page Load</SelectItem>
                                            <SelectItem value="form_submit">Form Submit</SelectItem>
                                            <SelectItem value="scroll">Scroll</SelectItem>
                                            <SelectItem value="timer">Timer</SelectItem>
                                            <SelectItem value="custom">Custom (Code)</SelectItem>
                                            <SelectItem value="automatic">Automatic</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="event_category">Category</Label>
                                    <Select
                                        value={eventForm.event_category}
                                        onValueChange={(value) => setEventForm(prev => ({ ...prev, event_category: value }))}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ecommerce">E-commerce</SelectItem>
                                            <SelectItem value="engagement">Engagement</SelectItem>
                                            <SelectItem value="conversion">Conversion</SelectItem>
                                            <SelectItem value="navigation">Navigation</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* CSS Selector for click/form triggers */}
                            {['click', 'form_submit'].includes(eventForm.trigger_type) && (
                                <div>
                                    <Label htmlFor="trigger_selector">CSS Selector</Label>
                                    <Input
                                        id="trigger_selector"
                                        value={eventForm.trigger_selector}
                                        onChange={(e) => setEventForm(prev => ({ ...prev, trigger_selector: e.target.value }))}
                                        placeholder=".wishlist-button, [data-wishlist-btn]"
                                        className="mt-1 font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">CSS selector for the element(s) that trigger this event</p>
                                </div>
                            )}

                            {/* Event Parameters */}
                            <div>
                                <Label htmlFor="event_parameters">Event Parameters (JSON)</Label>
                                <Textarea
                                    id="event_parameters"
                                    value={JSON.stringify(eventForm.event_parameters, null, 2)}
                                    onChange={(e) => {
                                        try {
                                            const params = JSON.parse(e.target.value);
                                            setEventForm(prev => ({ ...prev, event_parameters: params }));
                                        } catch {
                                            // Allow invalid JSON while typing
                                        }
                                    }}
                                    placeholder='{"item_id": "{{product_id}}", "item_name": "{{product_name}}"}'
                                    className="mt-1 font-mono text-sm"
                                    rows={4}
                                />
                                <p className="text-xs text-gray-500 mt-1">Use {'{{variable}}'} for dynamic values</p>
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Options</Label>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">Enabled</p>
                                            <p className="text-xs text-gray-500">Event is active and will fire</p>
                                        </div>
                                        <Switch
                                            checked={eventForm.enabled}
                                            onCheckedChange={(checked) => setEventForm(prev => ({ ...prev, enabled: checked }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">Fire Once Per Session</p>
                                            <p className="text-xs text-gray-500">Prevent duplicate events in same session</p>
                                        </div>
                                        <Switch
                                            checked={eventForm.fire_once_per_session}
                                            onCheckedChange={(checked) => setEventForm(prev => ({ ...prev, fire_once_per_session: checked }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">Log to Backend</p>
                                            <p className="text-xs text-gray-500">Save event to customer_activities table</p>
                                        </div>
                                        <Switch
                                            checked={eventForm.send_to_backend}
                                            onCheckedChange={(checked) => setEventForm(prev => ({ ...prev, send_to_backend: checked }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Priority */}
                            <div>
                                <Label htmlFor="priority">Priority</Label>
                                <Input
                                    id="priority"
                                    type="number"
                                    value={eventForm.priority}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 10 }))}
                                    className="mt-1 w-24"
                                    min={1}
                                    max={100}
                                />
                                <p className="text-xs text-gray-500 mt-1">Higher priority events execute first (1-100)</p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={saveEvent}>
                                {editingEvent ? 'Update Event' : 'Create Event'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Import */}
                <TabsContent value="import" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Import DataLayer Events</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="import-data">JSON Data</Label>
                                <Textarea
                                    id="import-data"
                                    placeholder="Paste your JSON data here..."
                                    value={importData}
                                    onChange={(e) => setImportData(e.target.value)}
                                    rows={10}
                                />
                            </div>
                            
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    You can import dataLayer events as JSON array or GTM container export data.
                                </AlertDescription>
                            </Alert>

                            <Button onClick={importDataLayer} disabled={!importData.trim()}>
                                Import Data
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Export */}
                <TabsContent value="export" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Export Analytics Data</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-600">
                                Export your current dataLayer events, GTM settings, and suggested tag configurations for use in Google Tag Manager.
                            </p>

                            <Alert>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>
                                    The export includes ready-to-use GTM tag configurations for common e-commerce events.
                                </AlertDescription>
                            </Alert>

                            <Button onClick={exportDataLayer} className="flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Export Analytics Data
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-8">
                <SaveButton
                    onClick={handleSave}
                    loading={saving}
                    success={saveSuccess}
                    defaultText="Save All Settings"
                />
            </div>
        </div>
    );
}