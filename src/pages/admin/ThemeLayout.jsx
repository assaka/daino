import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store } from '@/api/entities';
import { User } from '@/api/entities';
import { DeliverySettings as DeliverySettingsEntity } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Palette, Eye, Navigation, ShoppingBag, Filter, Home, CreditCard, GripVertical, Languages, Trash2, Type } from 'lucide-react';
import SaveButton from '@/components/ui/save-button';
import TranslationFields from '@/components/admin/TranslationFields';
import FlashMessage from '@/components/storefront/FlashMessage';
import api from '@/utils/api';
import { queryClient } from '@/config/queryClient';
import { PageLoader } from '@/components/ui/page-loader';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Default section layouts - now organized by step within each mode
const defaultSectionLayout = {
    '1step': {
        step1: {
            column1: ['Shipping Address', 'Shipping Method', 'Billing Address'],
            column2: ['Delivery Settings', 'Payment Method'],
            column3: ['Coupon', 'Order Summary']
        }
    },
    '2step': {
        step1: {
            column1: ['Shipping Address', 'Billing Address'],
            column2: ['Shipping Method', 'Delivery Settings']
        },
        step2: {
            column1: ['Summary', 'Payment Method'],
            column2: ['Coupon', 'Order Summary']
        }
    },
    '3step': {
        step1: {
            column1: ['Shipping Address', 'Billing Address'],
            column2: []
        },
        step2: {
            column1: ['Shipping Method', 'Delivery Settings'],
            column2: []
        },
        step3: {
            column1: ['Summary', 'Payment Method'],
            column2: ['Coupon', 'Order Summary']
        }
    }
};

// Sortable Item Component for drag and drop
function SortableSection({ id, section }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-2 p-3 bg-white border rounded-lg hover:bg-gray-50"
        >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4 text-gray-400" />
            </div>
            <span className="flex-1">{section}</span>
        </div>
    );
}

// Droppable Column Component - allows dropping items from other columns
function DroppableColumn({ id, children, className }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`${className} ${isOver ? 'ring-2 ring-blue-400' : ''}`}
        >
            {children}
        </div>
    );
}

const retryApiCall = async (apiCall, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(res => setTimeout(res, delay));
        }
    }
};

export default function ThemeLayout() {
    const { selectedStore, getSelectedStoreId } = useStoreSelection();
    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [flashMessage, setFlashMessage] = useState(null);
    const [deliverySettings, setDeliverySettings] = useState(null);
    const [showStepTranslations, setShowStepTranslations] = useState(false);
    const [stepTranslations, setStepTranslations] = useState({});
    const [newFontName, setNewFontName] = useState('');
    const [newFontUrl, setNewFontUrl] = useState('');

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Helper to filter out sections that shouldn't be displayed
    const filterVisibleSections = (sections) => {
        return sections.filter(section => {
            // Hide "Delivery Settings" if both delivery date and comments are disabled
            if (section === 'Delivery Settings') {
                const deliveryDateEnabled = deliverySettings?.enable_delivery_date || false;
                const deliveryCommentsEnabled = deliverySettings?.enable_comments || false;
                return deliveryDateEnabled || deliveryCommentsEnabled;
            }
            return true;
        });
    };

    useEffect(() => {
        if (selectedStore) {
            loadStore();
            loadStepTranslations();
        }
    }, [selectedStore]);

    // Update UI when store settings change
    useEffect(() => {
        // Trigger re-render when product_grid settings change
    }, [store?.settings?.product_grid]);

    const loadStepTranslations = async () => {
        try {
            const storeId = getSelectedStoreId();
            if (!storeId) {
                console.warn('No store selected for loading step translations');
                return;
            }

            const checkoutKeys = ['checkout.step_2step_1', 'checkout.step_2step_2',
                                 'checkout.step_3step_1', 'checkout.step_3step_2', 'checkout.step_3step_3'];

            const allTranslations = {};

            // Make requests for common languages
            const languages = ['en', 'nl', 'fr', 'de', 'es'];

            for (const lang of languages) {
                try {
                    const langResponse = await api.get(`/translations/ui-labels?store_id=${storeId}&lang=${lang}`);

                    if (langResponse && langResponse.data && langResponse.data.labels) {
                        const labels = langResponse.data.labels;
                        const langTranslations = {};

                        // Extract checkout step translations - handle nested structure
                        checkoutKeys.forEach(key => {
                            const shortKey = key.replace('checkout.', '');
                            // Handle both flat and nested structures
                            let value = labels[key];

                            // If labels is nested like { checkout: { step_2step_1: 'value' } }
                            if (!value && labels.checkout) {
                                value = labels.checkout[shortKey];
                            }

                            if (value) {
                                langTranslations[shortKey] = value;
                            }
                        });

                        if (Object.keys(langTranslations).length > 0) {
                            allTranslations[lang] = langTranslations;
                        }
                    }
                } catch (err) {
                    // Language might not exist, skip silently
                }
            }

            setStepTranslations(allTranslations);
        } catch (error) {
            console.error('Error loading step translations:', error);
        }
    };

    // Sync default step names with English translations (bi-directional)
    useEffect(() => {
        if (!store?.settings) return;

        // When store settings change, update English translations to match (only if different)
        const updatedTranslations = { ...stepTranslations };

        if (!updatedTranslations.en) {
            updatedTranslations.en = {};
        }

        let hasChanges = false;

        // Sync 2-step names
        if (store.settings.checkout_2step_step1_name && store.settings.checkout_2step_step1_name !== updatedTranslations.en.step_2step_1) {
            updatedTranslations.en.step_2step_1 = store.settings.checkout_2step_step1_name;
            hasChanges = true;
        }
        if (store.settings.checkout_2step_step2_name && store.settings.checkout_2step_step2_name !== updatedTranslations.en.step_2step_2) {
            updatedTranslations.en.step_2step_2 = store.settings.checkout_2step_step2_name;
            hasChanges = true;
        }

        // Sync 3-step names
        if (store.settings.checkout_3step_step1_name && store.settings.checkout_3step_step1_name !== updatedTranslations.en.step_3step_1) {
            updatedTranslations.en.step_3step_1 = store.settings.checkout_3step_step1_name;
            hasChanges = true;
        }
        if (store.settings.checkout_3step_step2_name && store.settings.checkout_3step_step2_name !== updatedTranslations.en.step_3step_2) {
            updatedTranslations.en.step_3step_2 = store.settings.checkout_3step_step2_name;
            hasChanges = true;
        }
        if (store.settings.checkout_3step_step3_name && store.settings.checkout_3step_step3_name !== updatedTranslations.en.step_3step_3) {
            updatedTranslations.en.step_3step_3 = store.settings.checkout_3step_step3_name;
            hasChanges = true;
        }

        if (hasChanges) {
            setStepTranslations(updatedTranslations);
        }
    }, [store?.settings?.checkout_2step_step1_name, store?.settings?.checkout_2step_step2_name,
        store?.settings?.checkout_3step_step1_name, store?.settings?.checkout_3step_step2_name,
        store?.settings?.checkout_3step_step3_name]);

    // Sync English translations back to default step names (reverse direction)
    useEffect(() => {
        if (!stepTranslations?.en || !store) return;

        const updates = {};
        let hasChanges = false;

        // Sync English translations back to settings
        if (stepTranslations.en.step_2step_1 && stepTranslations.en.step_2step_1 !== store.settings?.checkout_2step_step1_name) {
            updates.checkout_2step_step1_name = stepTranslations.en.step_2step_1;
            hasChanges = true;
        }
        if (stepTranslations.en.step_2step_2 && stepTranslations.en.step_2step_2 !== store.settings?.checkout_2step_step2_name) {
            updates.checkout_2step_step2_name = stepTranslations.en.step_2step_2;
            hasChanges = true;
        }
        if (stepTranslations.en.step_3step_1 && stepTranslations.en.step_3step_1 !== store.settings?.checkout_3step_step1_name) {
            updates.checkout_3step_step1_name = stepTranslations.en.step_3step_1;
            hasChanges = true;
        }
        if (stepTranslations.en.step_3step_2 && stepTranslations.en.step_3step_2 !== store.settings?.checkout_3step_step2_name) {
            updates.checkout_3step_step2_name = stepTranslations.en.step_3step_2;
            hasChanges = true;
        }
        if (stepTranslations.en.step_3step_3 && stepTranslations.en.step_3step_3 !== store.settings?.checkout_3step_step3_name) {
            updates.checkout_3step_step3_name = stepTranslations.en.step_3step_3;
            hasChanges = true;
        }

        if (hasChanges) {
            setStore(prev => ({
                ...prev,
                settings: {
                    ...prev.settings,
                    ...updates
                }
            }));
        }
    }, [stepTranslations?.en]);

    const loadStore = async () => {
        try {
            const storeId = getSelectedStoreId();

            // Use selectedStore.id as fallback if getSelectedStoreId() fails
            const actualStoreId = (storeId && storeId !== 'undefined') ? storeId : selectedStore?.id;

            if (!actualStoreId || actualStoreId === 'undefined') {
                setLoading(false);
                return;
            }

            // The selectedStore from context doesn't have settings, so we need to fetch the full store data
            const fullStoreResponse = await Store.findById(actualStoreId);

            // Store.findById returns an array, so we need to get the first item
            const fullStoreResponse_normalized = Array.isArray(fullStoreResponse) ? fullStoreResponse[0] : fullStoreResponse;

            // Handle nested data structure - settings are in data.tenantData.settings
            // Backend GET /api/stores/:id returns: { success: true, data: { store: {...}, tenantData: {...} } }
            const responseData = fullStoreResponse_normalized?.data || fullStoreResponse_normalized;
            const fullStore = responseData?.tenantData || responseData;

            // Initialize step translations with defaults from store settings if not already loaded
            setTimeout(() => {
                setStepTranslations(prev => {
                    // If translations already loaded from API, don't override
                    if (prev && Object.keys(prev).length > 0 && prev.en && Object.keys(prev.en).length > 0) {
                        return prev;
                    }

                    // Initialize with defaults from store settings
                    return {
                        en: {
                            step_2step_1: fullStore?.settings?.checkout_2step_step1_name || 'Information',
                            step_2step_2: fullStore?.settings?.checkout_2step_step2_name || 'Payment',
                            step_3step_1: fullStore?.settings?.checkout_3step_step1_name || 'Information',
                            step_3step_2: fullStore?.settings?.checkout_3step_step2_name || 'Shipping',
                            step_3step_3: fullStore?.settings?.checkout_3step_step3_name || 'Payment'
                        }
                    };
                });
            }, 500); // Small delay to let API load first

            // Handle database response structure
            // Ensure settings object and its nested properties exist with defaults
            const settings = {
                ...(fullStore?.settings || {}),
                // Category page defaults - use nullish coalescing to preserve saved values
                enable_product_filters: fullStore?.settings?.enable_product_filters ?? true,
                collapse_filters: fullStore?.settings?.collapse_filters ?? false,
                max_visible_attributes: fullStore?.settings?.max_visible_attributes ?? 5,
                show_stock_label: fullStore?.settings?.show_stock_label ?? false,
                enable_view_mode_toggle: fullStore?.settings?.enable_view_mode_toggle ?? true,
                default_view_mode: fullStore?.settings?.default_view_mode || 'grid',
                // Header defaults
                show_language_selector: fullStore?.settings?.show_language_selector ?? false,
                // Product gallery defaults
                product_gallery_layout: fullStore?.settings?.product_gallery_layout || 'horizontal',
                vertical_gallery_position: fullStore?.settings?.vertical_gallery_position || 'left',
                mobile_gallery_layout: fullStore?.settings?.mobile_gallery_layout || 'below',
                // Checkout Page defaults
                checkout_steps_count: fullStore?.settings?.checkout_steps_count ?? 3,
                // Step names for 2-step checkout
                checkout_2step_step1_name: fullStore?.settings?.checkout_2step_step1_name || 'Information',
                checkout_2step_step2_name: fullStore?.settings?.checkout_2step_step2_name || 'Payment',
                // Step names for 3-step checkout
                checkout_3step_step1_name: fullStore?.settings?.checkout_3step_step1_name || 'Information',
                checkout_3step_step2_name: fullStore?.settings?.checkout_3step_step2_name || 'Shipping',
                checkout_3step_step3_name: fullStore?.settings?.checkout_3step_step3_name || 'Payment',
                checkout_step_indicator_active_color: fullStore?.settings?.checkout_step_indicator_active_color || '#007bff',
                checkout_step_indicator_inactive_color: fullStore?.settings?.checkout_step_indicator_inactive_color || '#D1D5DB',
                checkout_step_indicator_completed_color: fullStore?.settings?.checkout_step_indicator_completed_color || '#10B981',
                checkout_step_indicator_style: fullStore?.settings?.checkout_step_indicator_style || 'circles',
                checkout_section_title_color: fullStore?.settings?.checkout_section_title_color || '#111827',
                checkout_section_title_size: fullStore?.settings?.checkout_section_title_size || '1.25rem',
                checkout_section_bg_color: fullStore?.settings?.checkout_section_bg_color || '#FFFFFF',
                checkout_section_border_color: fullStore?.settings?.checkout_section_border_color || '#E5E7EB',
                checkout_section_text_color: fullStore?.settings?.checkout_section_text_color || '#374151',
                // Checkout Layout Configuration
                checkout_1step_columns: fullStore?.settings?.checkout_1step_columns ?? 3,
                checkout_2step_columns: fullStore?.settings?.checkout_2step_columns ?? 2,
                checkout_3step_columns: fullStore?.settings?.checkout_3step_columns ?? 2,
                checkout_1step_layout: fullStore?.settings?.checkout_1step_layout || defaultSectionLayout['1step'],
                checkout_2step_layout: fullStore?.settings?.checkout_2step_layout || defaultSectionLayout['2step'],
                checkout_3step_layout: fullStore?.settings?.checkout_3step_layout || defaultSectionLayout['3step'],
                // Product grid - merge breakpoints properly
                product_grid: {
                    breakpoints: {
                        default: fullStore?.settings?.product_grid?.breakpoints?.default ?? 1,
                        sm: fullStore?.settings?.product_grid?.breakpoints?.sm ?? 2,
                        md: fullStore?.settings?.product_grid?.breakpoints?.md ?? 0,
                        lg: fullStore?.settings?.product_grid?.breakpoints?.lg ?? 2,
                        xl: fullStore?.settings?.product_grid?.breakpoints?.xl ?? 0,
                        '2xl': fullStore?.settings?.product_grid?.breakpoints?.['2xl'] ?? 0
                    },
                    customBreakpoints: fullStore?.settings?.product_grid?.customBreakpoints || [],
                    rows: fullStore?.settings?.product_grid?.rows ?? 4
                },
                theme: {
                    // Default values
                    primary_button_color: '#007bff',
                    secondary_button_color: '#6c757d',
                    add_to_cart_button_color: '#28a745',
                    view_cart_button_color: '#17a2b8',
                    checkout_button_color: '#007bff',
                    place_order_button_color: '#28a745',
                    font_family: 'Inter',
                    custom_fonts: [], // Custom fonts array
                    // Product Tabs Styling defaults
                    product_tabs_title_color: '#DC2626', // red-600
                    product_tabs_title_size: '1.875rem', // text-3xl
                    product_tabs_content_bg: '#EFF6FF', // blue-50
                    product_tabs_attribute_label_color: '#16A34A', // green-600
                    // Breadcrumb defaults
                    breadcrumb_show_home_icon: true,
                    breadcrumb_item_text_color: '#6B7280', // gray-500
                    breadcrumb_item_hover_color: '#374151', // gray-700
                    breadcrumb_active_item_color: '#111827', // gray-900
                    breadcrumb_separator_color: '#9CA3AF', // gray-400
                    breadcrumb_font_size: '0.875rem', // text-sm
                    breadcrumb_mobile_font_size: '0.75rem', // text-xs
                    breadcrumb_font_weight: '400', // font-normal
                    // Override with existing settings if they exist
                    ...((fullStore?.settings || {}).theme || {})
                },
            };
            
            // Use the full store data instead of selectedStore, but ensure we have the ID
            const finalStore = {
                ...fullStore,
                id: fullStore?.id || actualStoreId, // Ensure we have the store ID
                settings
            };

            setStore(finalStore);

            // Load delivery settings
            try {
                const existingSettings = await DeliverySettingsEntity.filter({ store_id: actualStoreId });
                if (existingSettings && existingSettings.length > 0) {
                    setDeliverySettings(existingSettings[0]);
                }
            } catch (error) {
                console.error("Failed to load delivery settings:", error);
            }
        } catch (error) {
            console.error("Failed to load store:", error);
            setFlashMessage({ type: 'error', message: 'Could not load store settings.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSettingsChange = (key, value) => {
        setStore(prev => ({
            ...prev,
            settings: { ...prev.settings, [key]: value }
        }));
    };

    const handleStandardBreakpointChange = (breakpoint, columns) => {
        setStore(prev => {
            const newStore = {
                ...prev,
                settings: {
                    ...prev.settings,
                    product_grid: {
                        ...prev.settings.product_grid,
                        breakpoints: {
                            ...prev.settings.product_grid?.breakpoints,
                            [breakpoint]: columns
                        },
                        customBreakpoints: prev.settings.product_grid?.customBreakpoints || [],
                        rows: prev.settings.product_grid?.rows ?? 4
                    }
                }
            };

            return newStore;
        });
    };

    const handleRowsChange = (rows) => {
        setStore(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                product_grid: {
                    ...prev.settings.product_grid,
                    breakpoints: prev.settings.product_grid?.breakpoints || {},
                    customBreakpoints: prev.settings.product_grid?.customBreakpoints || [],
                    rows: rows
                }
            }
        }));
    };

    const handleAddCustomBreakpoint = () => {
        setStore(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                product_grid: {
                    ...prev.settings.product_grid,
                    breakpoints: prev.settings.product_grid?.breakpoints || {},
                    customBreakpoints: [
                        ...(prev.settings.product_grid?.customBreakpoints || []),
                        { name: '', columns: 2 }
                    ],
                    rows: prev.settings.product_grid?.rows ?? 4
                }
            }
        }));
    };

    const handleCustomBreakpointChange = (index, field, value) => {
        setStore(prev => {
            const updatedCustomBreakpoints = [...(prev.settings.product_grid?.customBreakpoints || [])];
            updatedCustomBreakpoints[index] = {
                ...updatedCustomBreakpoints[index],
                [field]: value
            };

            return {
                ...prev,
                settings: {
                    ...prev.settings,
                    product_grid: {
                        ...prev.settings.product_grid,
                        breakpoints: prev.settings.product_grid?.breakpoints || {},
                        customBreakpoints: updatedCustomBreakpoints,
                        rows: prev.settings.product_grid?.rows ?? 4
                    }
                }
            };
        });
    };

    const handleRemoveCustomBreakpoint = (index) => {
        setStore(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                product_grid: {
                    ...prev.settings.product_grid,
                    breakpoints: prev.settings.product_grid?.breakpoints || {},
                    customBreakpoints: (prev.settings.product_grid?.customBreakpoints || []).filter((_, i) => i !== index),
                    rows: prev.settings.product_grid?.rows ?? 4
                }
            }
        }));
    };

    const generateGridClassesPreview = (gridConfig) => {
        if (!gridConfig) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';

        let classes = [];
        const breakpoints = gridConfig.breakpoints || {};
        const customBreakpoints = gridConfig.customBreakpoints || [];

        // Standard breakpoints
        Object.entries(breakpoints).forEach(([breakpoint, columns]) => {
            if (columns > 0) {
                if (breakpoint === 'default') {
                    classes.push(`grid-cols-${columns}`);
                } else {
                    classes.push(`${breakpoint}:grid-cols-${columns}`);
                }
            }
        });

        // Custom breakpoints
        customBreakpoints.forEach(({ name, columns }) => {
            if (name && columns > 0) {
                classes.push(`${name}:grid-cols-${columns}`);
            }
        });

        return classes.length > 0 ? classes.join(' ') : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
    };

    const calculateProductsPerPage = (gridConfig) => {
        if (!gridConfig) return {
            max: 12,
            description: 'Default: 12 products per page',
            breakdowns: []
        };

        const breakpoints = gridConfig.breakpoints || {};
        const rows = gridConfig.rows || 4;

        if (rows === 0) {
            return {
                max: 'infinite',
                description: 'Infinite scroll enabled',
                breakdowns: []
            };
        }

        // Calculate products per page for each breakpoint
        const breakdownList = [];
        let maxColumns = 1;

        // Standard breakpoint order (from smallest to largest)
        const breakpointOrder = [
            { key: 'default', label: 'Mobile' },
            { key: 'sm', label: 'Small (640px+)' },
            { key: 'md', label: 'Medium (768px+)' },
            { key: 'lg', label: 'Large (1024px+)' },
            { key: 'xl', label: 'XL (1280px+)' },
            { key: '2xl', label: '2XL (1536px+)' }
        ];

        breakpointOrder.forEach(({ key, label }) => {
            const columns = breakpoints[key] || 0;
            if (columns > 0) {
                const productsForBreakpoint = columns * rows;
                breakdownList.push({
                    breakpoint: key,
                    label,
                    columns,
                    rows,
                    total: productsForBreakpoint
                });

                if (columns > maxColumns) {
                    maxColumns = columns;
                }
            }
        });

        const maxProductsPerPage = maxColumns * rows;

        return {
            max: maxProductsPerPage,
            description: `Maximum: ${maxColumns} columns × ${rows} rows = ${maxProductsPerPage} products per page`,
            breakdowns: breakdownList
        };
    };

    const handleThemeChange = (key, value) => {
        setStore(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                theme: { ...prev.settings.theme, [key]: value }
            }
        }));
    };

    // Extract font name from Google Fonts URL
    const extractFontNameFromGoogleUrl = (url) => {
        try {
            const urlObj = new URL(url);
            const familyParam = urlObj.searchParams.get('family');
            if (familyParam) {
                // Handle format: "Noto+Sans+JP:wght@100..900" or "Noto+Sans+JP"
                // Also handles multiple fonts: "Font1|Font2" - we take the first one
                const firstFont = familyParam.split('|')[0].split('&')[0];
                // Remove weight/style suffixes like ":wght@100..900" or ":ital,wght@0,400"
                const fontName = firstFont.split(':')[0];
                // Replace + with spaces
                return fontName.replace(/\+/g, ' ');
            }
        } catch (e) {
            console.error('Error parsing Google Fonts URL:', e);
        }
        return null;
    };

    // Auto-fill font name when URL changes (for Google Fonts)
    useEffect(() => {
        if (newFontUrl && newFontUrl.includes('fonts.googleapis.com')) {
            const extractedName = extractFontNameFromGoogleUrl(newFontUrl);
            if (extractedName && !newFontName) {
                setNewFontName(extractedName);
            }
        }
    }, [newFontUrl]);

    // Add custom font via URL
    const handleAddCustomFont = () => {
        if (!newFontUrl.trim()) {
            setFlashMessage({ type: 'error', message: 'Please enter a font URL.' });
            return;
        }

        const urlLower = newFontUrl.toLowerCase();

        // Check if it's a Google Fonts CSS URL
        const isGoogleFont = urlLower.includes('fonts.googleapis.com') || urlLower.includes('fonts.gstatic.com');

        // For Google Fonts, extract name from URL if not provided
        let fontName = newFontName.trim();
        if (isGoogleFont) {
            const extractedName = extractFontNameFromGoogleUrl(newFontUrl.trim());
            if (extractedName) {
                fontName = extractedName; // Always use extracted name for Google Fonts
            } else if (!fontName) {
                setFlashMessage({ type: 'error', message: 'Could not extract font name from URL. Please enter it manually.' });
                return;
            }
        } else if (!fontName) {
            setFlashMessage({ type: 'error', message: 'Please enter a font name.' });
            return;
        }

        // Detect format from URL for direct font files
        let format = 'woff2'; // default
        if (!isGoogleFont) {
            if (urlLower.includes('.ttf')) format = 'ttf';
            else if (urlLower.includes('.otf')) format = 'otf';
            else if (urlLower.includes('.woff2')) format = 'woff2';
            else if (urlLower.includes('.woff')) format = 'woff';
        }

        const newFont = {
            name: fontName,
            url: newFontUrl.trim(),
            format,
            isGoogleFont // Flag to indicate this is a Google Fonts stylesheet URL
        };

        // Check for duplicates
        const currentFonts = store.settings.theme?.custom_fonts || [];
        if (currentFonts.some(f => f.name.toLowerCase() === newFont.name.toLowerCase())) {
            setFlashMessage({ type: 'error', message: 'A font with this name already exists.' });
            return;
        }

        handleThemeChange('custom_fonts', [...currentFonts, newFont]);
        setNewFontName('');
        setNewFontUrl('');
        setFlashMessage({ type: 'success', message: `Font "${newFont.name}" added successfully.` });
    };

    // Handle font family change with auto-save
    const handleFontFamilyChange = async (value) => {
        // Update the font family
        setStore(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                theme: { ...prev.settings.theme, font_family: value }
            }
        }));

        // Auto-save after a short delay to ensure state is updated
        setTimeout(async () => {
            try {
                const { Store } = await import('@/api/entities');
                const updatedSettings = {
                    ...store.settings,
                    theme: { ...store.settings.theme, font_family: value }
                };
                await Store.updateSettings(store.id, { settings: updatedSettings });
                setFlashMessage({ type: 'success', message: `Font changed to "${value}"` });
            } catch (error) {
                console.error('Auto-save font error:', error);
                setFlashMessage({ type: 'error', message: 'Failed to save font change' });
            }
        }, 100);
    };

    // Remove custom font
    const handleFontDelete = (fontToDelete) => {
        const currentFonts = store.settings.theme?.custom_fonts || [];
        const updatedFonts = currentFonts.filter(f => f.url !== fontToDelete.url);
        handleThemeChange('custom_fonts', updatedFonts);

        // If this was the selected font, reset to default
        if (store.settings.theme?.font_family === fontToDelete.name) {
            handleThemeChange('font_family', 'Inter');
        }

        setFlashMessage({ type: 'success', message: `Font "${fontToDelete.name}" removed.` });
    };

    // Unified drag handler - supports cross-column and cross-step dragging
    const handleUnifiedDragEnd = (event, stepType) => {
        const { active, over } = event;

        if (!over) return;

        // Parse the droppable IDs: format is "stepKey-columnKey" (e.g., "step1-column1")
        const activeId = active.id; // Section name (e.g., "Account")
        const overId = over.id; // Either section name or droppable zone ID

        // Get the current layout
        const fullLayout = store.settings?.[`checkout_${stepType}_layout`] || defaultSectionLayout[stepType];
        const updatedLayout = JSON.parse(JSON.stringify(fullLayout)); // Deep clone

        // Find where the active item currently is
        let sourceStepKey = null;
        let sourceColumnKey = null;
        let sourceIndex = -1;

        // Search through all steps and columns to find the active item
        Object.keys(updatedLayout).forEach(stepKey => {
            Object.keys(updatedLayout[stepKey]).forEach(columnKey => {
                const index = updatedLayout[stepKey][columnKey].indexOf(activeId);
                if (index !== -1) {
                    sourceStepKey = stepKey;
                    sourceColumnKey = columnKey;
                    sourceIndex = index;
                }
            });
        });

        if (!sourceStepKey || !sourceColumnKey) return;

        // Determine target location
        let targetStepKey = sourceStepKey;
        let targetColumnKey = sourceColumnKey;
        let targetIndex = sourceIndex;

        // Check if over is a droppable zone (format: "step1-column1")
        if (overId.includes('-')) {
            const [stepPart, columnPart] = overId.split('-');
            targetStepKey = stepPart;
            targetColumnKey = columnPart;
            // Initialize column if it doesn't exist
            if (!updatedLayout[targetStepKey][targetColumnKey]) {
                updatedLayout[targetStepKey][targetColumnKey] = [];
            }
            targetIndex = updatedLayout[targetStepKey][targetColumnKey].length; // Add to end
        } else {
            // Over is another section - find where it is
            Object.keys(updatedLayout).forEach(stepKey => {
                Object.keys(updatedLayout[stepKey]).forEach(columnKey => {
                    const index = updatedLayout[stepKey][columnKey].indexOf(overId);
                    if (index !== -1) {
                        targetStepKey = stepKey;
                        targetColumnKey = columnKey;
                        targetIndex = index;
                    }
                });
            });
        }

        // Remove from source
        updatedLayout[sourceStepKey][sourceColumnKey].splice(sourceIndex, 1);

        // Insert at target
        updatedLayout[targetStepKey][targetColumnKey].splice(targetIndex, 0, activeId);

        // Update the settings
        handleSettingsChange(`checkout_${stepType}_layout`, updatedLayout);
    };

    // Handler for column count change - merges sections when reducing columns
    const handleColumnCountChange = (stepType, newColumnCount) => {
        const oldColumnCount = store.settings?.[`checkout_${stepType}_columns`] || (stepType === '1step' ? 3 : 2);

        // Update column count
        handleSettingsChange(`checkout_${stepType}_columns`, newColumnCount);

        // If reducing columns, merge sections from removed columns
        if (newColumnCount < oldColumnCount) {
            const fullLayout = store.settings?.[`checkout_${stepType}_layout`] || defaultSectionLayout[stepType];
            const updatedLayout = { ...fullLayout };

            // Get all step keys in the layout
            const stepKeys = Object.keys(updatedLayout);

            stepKeys.forEach(stepKey => {
                const stepLayout = { ...updatedLayout[stepKey] };
                const sectionsToMerge = [];

                // Collect sections from columns that will be removed
                for (let i = newColumnCount + 1; i <= 3; i++) {
                    const columnKey = `column${i}`;
                    if (stepLayout[columnKey] && stepLayout[columnKey].length > 0) {
                        sectionsToMerge.push(...stepLayout[columnKey]);
                        stepLayout[columnKey] = []; // Clear the removed column
                    }
                }

                // Add collected sections to the last visible column
                if (sectionsToMerge.length > 0) {
                    const lastColumnKey = `column${newColumnCount}`;
                    stepLayout[lastColumnKey] = [
                        ...(stepLayout[lastColumnKey] || []),
                        ...sectionsToMerge
                    ];
                }

                updatedLayout[stepKey] = stepLayout;
            });

            // Update the layout with merged sections
            handleSettingsChange(`checkout_${stepType}_layout`, updatedLayout);
        }
    };

    const handleSave = async () => {
        if (!store) return;
        setSaving(true);
        setSaveSuccess(false);

        try {
            // Save checkout step translations to translations table
            if (stepTranslations && Object.keys(stepTranslations).length > 0) {
                for (const [lang, translations] of Object.entries(stepTranslations)) {
                    for (const [key, value] of Object.entries(translations)) {
                        const fullKey = `checkout.${key}`;
                        try {
                            await api.post('/translations/ui-labels', {
                                store_id: store.id,
                                key: fullKey,
                                language_code: lang,
                                value: value,
                                category: 'checkout',
                                type: 'system'
                            });
                        } catch (err) {
                            console.error(`Error saving translation ${fullKey} for ${lang}:`, err);
                        }
                    }
                }
            }

            // Use the same approach as Tax.jsx and ShippingMethods.jsx
            const result = await retryApiCall(async () => {
                const { Store } = await import('@/api/entities');
                const apiResult = await Store.updateSettings(store.id, { settings: store.settings });
                return apiResult;
            });

            // ALWAYS clear specific cache keys when admin saves settings
            const clearSpecificCacheKeys = () => {
                const keysToAlwaysClear = [
                    'storeProviderCache',
                    'store_settings_cache',
                    'store_theme_cache',
                    'gallery_settings_cache',
                    `store_${store.id}_settings`,
                    `store_${store.id}_cache`,
                    'product_layout_config',
                    'category_layout_config',
                    // 🔧 GALLERY SYNC FIX: Clear additional template processing caches
                    'variableProcessor_cache',
                    'template_processing_cache',
                    'slot_configuration_cache'
                ];

                keysToAlwaysClear.forEach(key => {
                    localStorage.removeItem(key);
                    sessionStorage.removeItem(key);
                });

                // Force store refresh
                localStorage.setItem('forceRefreshStore', 'true');
                localStorage.setItem('settings_updated_at', Date.now().toString());
            };

            try {
                clearSpecificCacheKeys();

                // CRITICAL: Invalidate React Query bootstrap cache to force storefront to refetch settings
                queryClient.invalidateQueries({ queryKey: ['bootstrap'] });

                // Broadcast cache clear to all tabs
                try {
                    const channel = new BroadcastChannel('store_settings_update');
                    channel.postMessage({
                        type: 'clear_cache',
                        reason: 'admin_settings_save',
                        timestamp: Date.now(),
                        keysCleared: ['storeProviderCache', 'store_settings_cache', 'gallery_settings_cache']
                    });
                    channel.close();
                } catch (broadcastError) {
                    console.warn('BroadcastChannel not supported:', broadcastError);
                }

            } catch (e) {
                console.error('Cache clearing failed:', e);
            }

            // CRITICAL: Sync theme settings to slot configurations
            // This ensures Editor and Storefront use the admin-set theme colors
            try {
                // 1. Button Color Mappings
                const buttonColorMappings = [
                    {
                        color: store.settings.theme.add_to_cart_button_color,
                        slots: [
                            { pageType: 'category', slotId: 'product_card_add_to_cart' },
                            { pageType: 'product', slotId: 'add_to_cart_button' }
                        ]
                    },
                    {
                        color: store.settings.theme.view_cart_button_color,
                        slots: [
                            { pageType: 'cart', slotId: 'view_cart_button' }
                        ]
                    },
                    {
                        color: store.settings.theme.checkout_button_color,
                        slots: [
                            { pageType: 'cart', slotId: 'checkout_button' }
                        ]
                    },
                    {
                        color: store.settings.theme.place_order_button_color,
                        slots: [
                            { pageType: 'checkout', slotId: 'place_order_button' }
                        ]
                    },
                    // Primary button color - used in empty cart continue shopping
                    {
                        color: store.settings.theme.primary_button_color,
                        slots: [
                            { pageType: 'cart', slotId: 'empty_cart_button' },
                            { pageType: 'success', slotId: 'continue_shopping_button' }
                        ]
                    },
                    // Secondary button color
                    {
                        color: store.settings.theme.secondary_button_color,
                        slots: [
                            { pageType: 'success', slotId: 'view_order_button' }
                        ]
                    }
                ];

                for (const mapping of buttonColorMappings) {
                    if (mapping.color) {
                        for (const { pageType, slotId } of mapping.slots) {
                            try {
                                await api.patch(`/slot-configurations/${store.id}/${pageType}/slot/${slotId}`, {
                                    styles: { backgroundColor: mapping.color }
                                });
                            } catch (slotErr) {
                                // Slot config might not exist yet, that's okay
                                console.debug(`Could not update ${pageType}/${slotId}:`, slotErr.message);
                            }
                        }
                    }
                }

                // 2. Product Tabs Styling - sync to product page product_tabs slot
                const productTabsSettings = store.settings.theme;
                if (productTabsSettings) {
                    try {
                        await api.patch(`/slot-configurations/${store.id}/product/slot/product_tabs`, {
                            styles: {
                                // Tab title styling
                                titleSize: productTabsSettings.product_tabs_title_size || '1rem',
                                fontWeight: productTabsSettings.product_tabs_font_weight || '500',
                                borderRadius: productTabsSettings.product_tabs_border_radius || '0.5rem',
                                textDecoration: productTabsSettings.product_tabs_text_decoration || 'none',
                                // Tab colors
                                titleColor: productTabsSettings.product_tabs_title_color || '#111827',
                                activeBgColor: productTabsSettings.product_tabs_active_bg || '#ffffff',
                                inactiveColor: productTabsSettings.product_tabs_inactive_color || '#6B7280',
                                inactiveBgColor: productTabsSettings.product_tabs_inactive_bg || '#ffffff',
                                hoverColor: productTabsSettings.product_tabs_hover_color || '#111827',
                                hoverBgColor: productTabsSettings.product_tabs_hover_bg || '#F3F4F6',
                                borderColor: productTabsSettings.product_tabs_border_color || '#e0e0e0',
                                contentBgColor: productTabsSettings.product_tabs_content_bg || '#ffffff',
                                // Attribute label color
                                attributeLabelColor: productTabsSettings.product_tabs_attribute_label_color || '#374151'
                            }
                        });
                    } catch (tabsErr) {
                        console.debug('Could not update product_tabs:', tabsErr.message);
                    }
                }

                // 3. Pagination Styling - sync to category page pagination_container slot
                const paginationSettings = store.settings.pagination;
                if (paginationSettings) {
                    try {
                        await api.patch(`/slot-configurations/${store.id}/category/slot/pagination_container`, {
                            styles: {
                                // Button styling
                                buttonBgColor: paginationSettings.buttonBgColor || '#FFFFFF',
                                buttonTextColor: paginationSettings.buttonTextColor || '#374151',
                                buttonHoverBgColor: paginationSettings.buttonHoverBgColor || '#F3F4F6',
                                buttonBorderColor: paginationSettings.buttonBorderColor || '#D1D5DB',
                                // Active state styling
                                activeBgColor: paginationSettings.activeBgColor || '#3B82F6',
                                activeTextColor: paginationSettings.activeTextColor || '#FFFFFF'
                            }
                        });
                    } catch (paginationErr) {
                        console.debug('Could not update pagination_container:', paginationErr.message);
                    }
                }
            } catch (syncErr) {
                console.warn('Could not sync theme settings to slot configs:', syncErr);
            }

            setFlashMessage({ type: 'success', message: 'Settings saved successfully!' });

            // Reload store data to reflect saved changes
            await loadStore();

        } catch (error) {
            setFlashMessage({ type: 'error', message: `Failed to save settings: ${error.response?.data?.message || error.message}` });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <PageLoader size="lg" />;
    }
    
    if (!store) {
        return <div className="p-8">Could not load store configuration.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Theme & Layout</h1>
                    <p className="text-gray-600 mt-1">Customize the look, feel, and layout of your storefront.</p>
                </div>

                <div className="space-y-8" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); } }}>
                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" /> Theme Settings</CardTitle>
                            <CardDescription>Control the colors and fonts of your store.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Typography Section */}
                            <div className="space-y-4">
                                <h4 className="font-medium flex items-center gap-2"><Type className="w-4 h-4" /> Typography</h4>

                                {/* Font Selection and Preview */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="font_family">Font Family</Label>
                                        <Select value={store.settings.theme.font_family} onValueChange={handleFontFamilyChange}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {/* Google Fonts */}
                                                <SelectItem value="Inter">Inter (Sans-serif)</SelectItem>
                                                <SelectItem value="Roboto">Roboto (Sans-serif)</SelectItem>
                                                <SelectItem value="Open Sans">Open Sans (Sans-serif)</SelectItem>
                                                <SelectItem value="Lato">Lato (Sans-serif)</SelectItem>
                                                <SelectItem value="Merriweather">Merriweather (Serif)</SelectItem>
                                                <SelectItem value="Playfair Display">Playfair Display (Serif)</SelectItem>
                                                {/* Custom Fonts */}
                                                {(store.settings.theme?.custom_fonts || []).length > 0 && (
                                                    <>
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 border-t mt-1">Custom Fonts</div>
                                                        {(store.settings.theme?.custom_fonts || []).map((font, idx) => (
                                                            <SelectItem key={idx} value={font.name}>{font.name} (Custom)</SelectItem>
                                                        ))}
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Font Preview */}
                                    <div>
                                        <Label>Font Preview</Label>
                                        <div className="mt-1 p-4 border rounded-lg bg-white min-h-[80px]">
                                            {/* Load custom fonts for preview */}
                                            {(store.settings.theme?.custom_fonts || []).map((font, idx) => (
                                                font.isGoogleFont ? (
                                                    <link key={idx} href={font.url} rel="stylesheet" />
                                                ) : (
                                                    <style key={idx}>{`
                                                        @font-face {
                                                            font-family: '${font.name}';
                                                            src: url('${font.url}') format('${font.format === 'ttf' ? 'truetype' : font.format === 'otf' ? 'opentype' : font.format}');
                                                            font-display: swap;
                                                        }
                                                    `}</style>
                                                )
                                            ))}
                                            {/* Load Google Font for built-in fonts preview */}
                                            {!store.settings.theme?.custom_fonts?.some(f => f.name === store.settings.theme.font_family) && (
                                                <link
                                                    href={`https://fonts.googleapis.com/css2?family=${(store.settings.theme.font_family || 'Inter').replace(/ /g, '+')}:wght@400;700&display=swap`}
                                                    rel="stylesheet"
                                                />
                                            )}
                                            <p
                                                className="text-2xl mb-1"
                                                style={{ fontFamily: `'${store.settings.theme.font_family || 'Inter'}', sans-serif` }}
                                            >
                                                The quick brown fox
                                            </p>
                                            <p
                                                className="text-base text-gray-600"
                                                style={{ fontFamily: `'${store.settings.theme.font_family || 'Inter'}', sans-serif` }}
                                            >
                                                jumps over the lazy dog. 0123456789
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Add Custom Font */}
                                <div className="p-4 border rounded-lg bg-gray-50">
                                    <div className="flex justify-between items-start mb-3">
                                        <Label className="font-medium">Add Custom Font (via URL)</Label>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Get fonts from <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Fonts</a> (click a font → "Get embed code" → copy the CSS URL).
                                        Font name is auto-detected from Google Fonts URLs.
                                    </p>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500 mb-1 block">Font URL</Label>
                                            <Input
                                                placeholder="https://fonts.googleapis.com/css2?family=..."
                                                value={newFontUrl}
                                                onChange={(e) => setNewFontUrl(e.target.value)}
                                            />
                                        </div>
                                        <div className="w-48">
                                            <Label className="text-xs text-gray-500 mb-1 block">Font Name {newFontUrl.includes('fonts.googleapis.com') ? '(auto-detected)' : ''}</Label>
                                            <Input
                                                placeholder={newFontUrl.includes('fonts.googleapis.com') ? 'Auto-detected' : 'Enter font name'}
                                                value={newFontName}
                                                onChange={(e) => setNewFontName(e.target.value)}
                                                disabled={newFontUrl.includes('fonts.googleapis.com')}
                                                className={newFontUrl.includes('fonts.googleapis.com') ? 'bg-gray-100 cursor-not-allowed' : ''}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <Button onClick={handleAddCustomFont} variant="outline">
                                                Add Font
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Fonts List */}
                                {(store.settings.theme?.custom_fonts || []).length > 0 && (
                                    <div>
                                        <Label className="mb-2 block">Custom Fonts</Label>
                                        <div className="space-y-2">
                                            {(store.settings.theme?.custom_fonts || []).map((font, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <Type className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium text-sm">{font.name}</p>
                                                            <p className="text-xs text-gray-500 truncate">{font.url}</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleFontDelete(font)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Separator />
                            <h4 className="font-medium">Button Colors</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <Label htmlFor="primary_button_color">Primary Buttons</Label>
                                    <Input id="primary_button_color" type="color" value={store.settings.theme.primary_button_color} onChange={(e) => handleThemeChange('primary_button_color', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="secondary_button_color">Secondary Buttons</Label>
                                    <Input id="secondary_button_color" type="color" value={store.settings.theme.secondary_button_color} onChange={(e) => handleThemeChange('secondary_button_color', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="add_to_cart_button_color">'Add to Cart' Button</Label>
                                    <Input id="add_to_cart_button_color" type="color" value={store.settings.theme.add_to_cart_button_color} onChange={(e) => handleThemeChange('add_to_cart_button_color', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="view_cart_button_color">'View Cart' Button</Label>
                                    <Input id="view_cart_button_color" type="color" value={store.settings.theme.view_cart_button_color} onChange={(e) => handleThemeChange('view_cart_button_color', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="checkout_button_color">'Checkout' Button</Label>
                                    <Input id="checkout_button_color" type="color" value={store.settings.theme.checkout_button_color} onChange={(e) => handleThemeChange('checkout_button_color', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="place_order_button_color">'Place Order' Button</Label>
                                    <Input id="place_order_button_color" type="color" value={store.settings.theme.place_order_button_color} onChange={(e) => handleThemeChange('place_order_button_color', e.target.value)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5" /> Currency & Display</CardTitle>
                            <CardDescription>Control how currency and other elements are displayed.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="hide_currency_category">Hide Currency on Category Pages</Label>
                                    <p className="text-sm text-gray-500">Don't show currency symbol on category pages.</p>
                                </div>
                                <Switch id="hide_currency_category" checked={!!store.settings.hide_currency_category} onCheckedChange={(c) => handleSettingsChange('hide_currency_category', c)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="hide_currency_product">Hide Currency on Product Pages</Label>
                                    <p className="text-sm text-gray-500">Don't show currency symbol on product pages.</p>
                                </div>
                                <Switch id="hide_currency_product" checked={!!store.settings.hide_currency_product} onCheckedChange={(c) => handleSettingsChange('hide_currency_product', c)} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Navigation className="w-5 h-5" /> Header & Navigation</CardTitle>
                            <CardDescription>Customize the store's header and breadcrumbs.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="hide_header_cart">Hide header in Cart</Label>
                                </div>
                                <Switch id="hide_header_cart" checked={!!store.settings.hide_header_cart} onCheckedChange={(c) => handleSettingsChange('hide_header_cart', c)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="hide_header_checkout">Hide header in Checkout</Label>
                                </div>
                                <Switch id="hide_header_checkout" checked={!!store.settings.hide_header_checkout} onCheckedChange={(c) => handleSettingsChange('hide_header_checkout', c)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="show_language_selector">Show Language Selector</Label>
                                    <p className="text-sm text-gray-500">Display language selector in header navigation. Only visible when more than 1 language is active.</p>
                                </div>
                                <Switch id="show_language_selector" checked={!!store.settings.show_language_selector} onCheckedChange={(c) => handleSettingsChange('show_language_selector', c)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="show_permanent_search">Show Permanent Search Bar</Label>
                                    <p className="text-sm text-gray-500">Always show search bar on mobile instead of toggle icon.</p>
                                </div>
                                <Switch id="show_permanent_search" checked={!!store.settings.show_permanent_search} onCheckedChange={(c) => handleSettingsChange('show_permanent_search', c)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="show_category_in_breadcrumb">Show Category in Breadcrumbs</Label>
                                </div>
                                <Switch id="show_category_in_breadcrumb" checked={!!store.settings.show_category_in_breadcrumb} onCheckedChange={(c) => handleSettingsChange('show_category_in_breadcrumb', c)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="expand_all_menu_items">Always Show All Subcategories</Label>
                                    <p className="text-sm text-gray-500">Display all subcategories in navigation without requiring hover or click to expand</p>
                                </div>
                                <Switch id="expand_all_menu_items" checked={!!store.settings.expandAllMenuItems} onCheckedChange={(c) => handleSettingsChange('expandAllMenuItems', c)} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Home className="w-5 h-5" /> Breadcrumbs</CardTitle>
                            <CardDescription>Customize breadcrumb navigation appearance on category and product pages.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="breadcrumb_show_home_icon">Show Home Icon</Label>
                                    <p className="text-sm text-gray-500">Display home icon in breadcrumbs.</p>
                                </div>
                                <Switch
                                    id="breadcrumb_show_home_icon"
                                    checked={!!store.settings.theme?.breadcrumb_show_home_icon}
                                    onCheckedChange={(c) => handleThemeChange('breadcrumb_show_home_icon', c)}
                                />
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <Label className="text-base font-medium">Colors</Label>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="breadcrumb_item_text_color">Link Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="breadcrumb_item_text_color"
                                                type="color"
                                                value={store.settings.theme?.breadcrumb_item_text_color || '#6B7280'}
                                                onChange={(e) => handleThemeChange('breadcrumb_item_text_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.theme?.breadcrumb_item_text_color || '#6B7280'}
                                                onChange={(e) => handleThemeChange('breadcrumb_item_text_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="breadcrumb_item_hover_color">Hover Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="breadcrumb_item_hover_color"
                                                type="color"
                                                value={store.settings.theme?.breadcrumb_item_hover_color || '#374151'}
                                                onChange={(e) => handleThemeChange('breadcrumb_item_hover_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.theme?.breadcrumb_item_hover_color || '#374151'}
                                                onChange={(e) => handleThemeChange('breadcrumb_item_hover_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="breadcrumb_active_item_color">Current Page Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="breadcrumb_active_item_color"
                                                type="color"
                                                value={store.settings.theme?.breadcrumb_active_item_color || '#111827'}
                                                onChange={(e) => handleThemeChange('breadcrumb_active_item_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.theme?.breadcrumb_active_item_color || '#111827'}
                                                onChange={(e) => handleThemeChange('breadcrumb_active_item_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="breadcrumb_separator_color">Separator Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="breadcrumb_separator_color"
                                                type="color"
                                                value={store.settings.theme?.breadcrumb_separator_color || '#9CA3AF'}
                                                onChange={(e) => handleThemeChange('breadcrumb_separator_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.theme?.breadcrumb_separator_color || '#9CA3AF'}
                                                onChange={(e) => handleThemeChange('breadcrumb_separator_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <Label className="text-base font-medium">Typography</Label>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="breadcrumb_font_size">Font Size (Desktop)</Label>
                                        <Select
                                            value={store.settings.theme?.breadcrumb_font_size || '0.875rem'}
                                            onValueChange={(value) => handleThemeChange('breadcrumb_font_size', value)}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0.75rem">Extra Small (12px)</SelectItem>
                                                <SelectItem value="0.875rem">Small (14px)</SelectItem>
                                                <SelectItem value="1rem">Medium (16px)</SelectItem>
                                                <SelectItem value="1.125rem">Large (18px)</SelectItem>
                                                <SelectItem value="1.25rem">Extra Large (20px)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="breadcrumb_mobile_font_size">Font Size (Mobile)</Label>
                                        <Select
                                            value={store.settings.theme?.breadcrumb_mobile_font_size || '0.75rem'}
                                            onValueChange={(value) => handleThemeChange('breadcrumb_mobile_font_size', value)}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0.625rem">Extra Small (10px)</SelectItem>
                                                <SelectItem value="0.75rem">Small (12px)</SelectItem>
                                                <SelectItem value="0.875rem">Medium (14px)</SelectItem>
                                                <SelectItem value="1rem">Large (16px)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="breadcrumb_font_weight">Font Weight</Label>
                                        <Select
                                            value={store.settings.theme?.breadcrumb_font_weight || '400'}
                                            onValueChange={(value) => handleThemeChange('breadcrumb_font_weight', value)}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="300">Light (300)</SelectItem>
                                                <SelectItem value="400">Normal (400)</SelectItem>
                                                <SelectItem value="500">Medium (500)</SelectItem>
                                                <SelectItem value="600">Semi Bold (600)</SelectItem>
                                                <SelectItem value="700">Bold (700)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" /> Category Page</CardTitle>
                            <CardDescription>Settings for category and filtering pages.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="enable_product_filters">Enable Product Filters</Label>
                                    <p className="text-sm text-gray-500">Show filter sidebar on category pages.</p>
                                </div>
                                <Switch
                                    id="enable_product_filters"
                                    checked={!!store.settings.enable_product_filters}
                                    onCheckedChange={(c) => handleSettingsChange('enable_product_filters', c)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="collapse_filters">Collapse Filters</Label>
                                    <p className="text-sm text-gray-500">Start with filter sections collapsed by default.</p>
                                </div>
                                <Switch
                                    id="collapse_filters"
                                    checked={!!store.settings.collapse_filters}
                                    onCheckedChange={(c) => handleSettingsChange('collapse_filters', c)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="max_visible_attributes">Max Visible Attributes</Label>
                                    <p className="text-sm text-gray-500">Show this many filter options before "Show More" button.</p>
                                </div>
                                <div className="w-20">
                                    <Input
                                        id="max_visible_attributes"
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={store.settings.max_visible_attributes || 5}
                                        onChange={(e) => handleSettingsChange('max_visible_attributes', parseInt(e.target.value) || 5)}
                                        className="text-center"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="show_stock_label">Show Stock Label</Label>
                                    <p className="text-sm text-gray-500">Display stock status (In Stock/Out of Stock) above the Add to Cart button.</p>
                                </div>
                                <Switch
                                    id="show_stock_label"
                                    checked={!!store.settings.show_stock_label}
                                    onCheckedChange={(c) => handleSettingsChange('show_stock_label', c)}
                                />
                            </div>

                            <Separator />

                            <div className="p-3 border rounded-lg space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="enable_view_mode_toggle">Enable Grid/List View Toggle</Label>
                                        <p className="text-sm text-gray-500">Show toggle button to switch between grid and list view on category pages.</p>
                                    </div>
                                    <Switch
                                        id="enable_view_mode_toggle"
                                        checked={!!store.settings.enable_view_mode_toggle}
                                        onCheckedChange={(c) => handleSettingsChange('enable_view_mode_toggle', c)}
                                    />
                                </div>

                                {store.settings.enable_view_mode_toggle && (
                                    <div className="pt-3 border-t">
                                        <div>
                                            <Label htmlFor="default_view_mode">Default View Mode</Label>
                                            <p className="text-sm text-gray-500">Choose which view mode to show by default.</p>
                                        </div>
                                        <Select
                                            value={store.settings.default_view_mode || 'grid'}
                                            onValueChange={(value) => handleSettingsChange('default_view_mode', value)}
                                        >
                                            <SelectTrigger className="mt-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="grid">Grid View</SelectItem>
                                                <SelectItem value="list">List View</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="p-4 border rounded-lg space-y-6">
                                <div>
                                    <Label className="text-base font-medium">Product Grid Layout</Label>
                                    <p className="text-sm text-gray-500">Configure how many products display per row at different screen sizes</p>
                                </div>

                                {/* Standard Tailwind Breakpoints */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div>
                                            <Label htmlFor="grid_default">Default (Mobile)</Label>
                                            <Select value={String(store.settings.product_grid?.breakpoints?.default || 1)} onValueChange={(value) => handleStandardBreakpointChange('default', parseInt(value))}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">1 column</SelectItem>
                                                    <SelectItem value="2">2 columns</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="grid_sm">Small (sm)</Label>
                                            <Select value={String(store.settings.product_grid?.breakpoints?.sm || 2)} onValueChange={(value) => handleStandardBreakpointChange('sm', parseInt(value))}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">- (disabled)</SelectItem>
                                                    <SelectItem value="1">1 column</SelectItem>
                                                    <SelectItem value="2">2 columns</SelectItem>
                                                    <SelectItem value="3">3 columns</SelectItem>
                                                    <SelectItem value="4">4 columns</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="grid_md">Medium (md)</Label>
                                            <Select value={String(store.settings.product_grid?.breakpoints?.md || 0)} onValueChange={(value) => handleStandardBreakpointChange('md', parseInt(value))}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">- (disabled)</SelectItem>
                                                    <SelectItem value="1">1 column</SelectItem>
                                                    <SelectItem value="2">2 columns</SelectItem>
                                                    <SelectItem value="3">3 columns</SelectItem>
                                                    <SelectItem value="4">4 columns</SelectItem>
                                                    <SelectItem value="5">5 columns</SelectItem>
                                                    <SelectItem value="6">6 columns</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="grid_lg">Large (lg)</Label>
                                            <Select
                                                value={String(store.settings.product_grid?.breakpoints?.lg || 2)}
                                                onValueChange={(value) => handleStandardBreakpointChange('lg', parseInt(value))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">- (disabled)</SelectItem>
                                                    <SelectItem value="1">1 column</SelectItem>
                                                    <SelectItem value="2">2 columns</SelectItem>
                                                    <SelectItem value="3">3 columns</SelectItem>
                                                    <SelectItem value="4">4 columns</SelectItem>
                                                    <SelectItem value="5">5 columns</SelectItem>
                                                    <SelectItem value="6">6 columns</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="grid_xl">Extra Large (xl)</Label>
                                            <Select value={String(store.settings.product_grid?.breakpoints?.xl || 0)} onValueChange={(value) => handleStandardBreakpointChange('xl', parseInt(value))}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">- (disabled)</SelectItem>
                                                    <SelectItem value="1">1 column</SelectItem>
                                                    <SelectItem value="2">2 columns</SelectItem>
                                                    <SelectItem value="3">3 columns</SelectItem>
                                                    <SelectItem value="4">4 columns</SelectItem>
                                                    <SelectItem value="5">5 columns</SelectItem>
                                                    <SelectItem value="6">6 columns</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="grid_2xl">2X Large (2xl)</Label>
                                            <Select value={String(store.settings.product_grid?.breakpoints?.['2xl'] || 0)} onValueChange={(value) => handleStandardBreakpointChange('2xl', parseInt(value))}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">- (disabled)</SelectItem>
                                                    <SelectItem value="1">1 column</SelectItem>
                                                    <SelectItem value="2">2 columns</SelectItem>
                                                    <SelectItem value="3">3 columns</SelectItem>
                                                    <SelectItem value="4">4 columns</SelectItem>
                                                    <SelectItem value="5">5 columns</SelectItem>
                                                    <SelectItem value="6">6 columns</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Rows Configuration */}
                                <div className="border-t pt-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <Label htmlFor="grid_rows">Number of Rows</Label>
                                            <p className="text-sm text-gray-500">How many rows of products to show per page (0 = infinite scroll)</p>
                                        </div>
                                        <div className="w-32">
                                            <Select
                                                value={String(store.settings.product_grid?.rows || 4)}
                                                onValueChange={(value) => handleRowsChange(parseInt(value))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">Infinite scroll</SelectItem>
                                                    <SelectItem value="1">1 row</SelectItem>
                                                    <SelectItem value="2">2 rows</SelectItem>
                                                    <SelectItem value="3">3 rows</SelectItem>
                                                    <SelectItem value="4">4 rows</SelectItem>
                                                    <SelectItem value="5">5 rows</SelectItem>
                                                    <SelectItem value="6">6 rows</SelectItem>
                                                    <SelectItem value="8">8 rows</SelectItem>
                                                    <SelectItem value="10">10 rows</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Breakpoints */}
                                <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <Label className="text-base font-medium">Custom Breakpoints</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={handleAddCustomBreakpoint}>
                                            + Add Custom Breakpoint
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {(store.settings.product_grid?.customBreakpoints || []).map((breakpoint, index) => (
                                            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                                                <div className="flex-1">
                                                    <Label htmlFor={`custom_name_${index}`}>Name:</Label>
                                                    <Input
                                                        id={`custom_name_${index}`}
                                                        value={breakpoint.name || ''}
                                                        onChange={(e) => handleCustomBreakpointChange(index, 'name', e.target.value)}
                                                        placeholder="e.g. tablet-lg"
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <Label htmlFor={`custom_columns_${index}`}>Columns:</Label>
                                                    <Select value={String(breakpoint.columns || 1)} onValueChange={(value) => handleCustomBreakpointChange(index, 'columns', parseInt(value))}>
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1">1 column</SelectItem>
                                                            <SelectItem value="2">2 columns</SelectItem>
                                                            <SelectItem value="3">3 columns</SelectItem>
                                                            <SelectItem value="4">4 columns</SelectItem>
                                                            <SelectItem value="5">5 columns</SelectItem>
                                                            <SelectItem value="6">6 columns</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveCustomBreakpoint(index)}>
                                                    Remove ×
                                                </Button>
                                            </div>
                                        ))}

                                        {(!store.settings.product_grid?.customBreakpoints || store.settings.product_grid.customBreakpoints.length === 0) && (
                                            <p className="text-sm text-gray-500 text-center py-4">No custom breakpoints defined. Click "Add Custom Breakpoint" to create one.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Live Preview */}
                                <div className="bg-gray-50 p-3 rounded space-y-4">
                                    <div>
                                        <Label className="text-sm font-medium">Generated Classes Preview:</Label>
                                        <div className="mt-2 text-xs text-gray-700 font-mono break-all">
                                            {generateGridClassesPreview(store.settings.product_grid)}
                                        </div>
                                    </div>

                                    {(() => {
                                        const calculation = calculateProductsPerPage(store.settings.product_grid);
                                        return (
                                            <div>
                                                <Label className="text-sm font-medium">Products Per Page by Breakpoint:</Label>
                                                <div className="mt-2 text-sm text-gray-700">
                                                    {calculation.description}
                                                </div>
                                                {calculation.breakdowns.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {calculation.breakdowns.map((breakdown) => (
                                                            <div key={breakdown.breakpoint} className="text-xs text-gray-600">
                                                                <span className="font-medium">{breakdown.label}:</span> {breakdown.columns} cols × {breakdown.rows} rows = <span className="font-medium text-blue-600">{breakdown.total} products</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <Separator />

                            {/* Pagination Styling */}
                            <div className="p-4 border rounded-lg space-y-4">
                                <div>
                                    <Label className="text-base font-medium">Pagination Styling</Label>
                                    <p className="text-sm text-gray-500">Customize the appearance of pagination buttons on category pages</p>
                                </div>

                                {/* Button Colors */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Button Background</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                value={store.settings.pagination?.buttonBgColor || '#FFFFFF'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonBgColor: e.target.value })}
                                                className="w-12 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.pagination?.buttonBgColor || '#FFFFFF'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonBgColor: e.target.value })}
                                                className="flex-1"
                                                placeholder="#FFFFFF"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Button Text</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                value={store.settings.pagination?.buttonTextColor || '#374151'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonTextColor: e.target.value })}
                                                className="w-12 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.pagination?.buttonTextColor || '#374151'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonTextColor: e.target.value })}
                                                className="flex-1"
                                                placeholder="#374151"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Hover Colors */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Hover Background</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                value={store.settings.pagination?.buttonHoverBgColor || '#F3F4F6'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonHoverBgColor: e.target.value })}
                                                className="w-12 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.pagination?.buttonHoverBgColor || '#F3F4F6'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonHoverBgColor: e.target.value })}
                                                className="flex-1"
                                                placeholder="#F3F4F6"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Border Color</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                value={store.settings.pagination?.buttonBorderColor || '#D1D5DB'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonBorderColor: e.target.value })}
                                                className="w-12 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.pagination?.buttonBorderColor || '#D1D5DB'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, buttonBorderColor: e.target.value })}
                                                className="flex-1"
                                                placeholder="#D1D5DB"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Active Page Colors */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Active Page Background</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                value={store.settings.pagination?.activeBgColor || '#3B82F6'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, activeBgColor: e.target.value })}
                                                className="w-12 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.pagination?.activeBgColor || '#3B82F6'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, activeBgColor: e.target.value })}
                                                className="flex-1"
                                                placeholder="#3B82F6"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Active Page Text</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                value={store.settings.pagination?.activeTextColor || '#FFFFFF'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, activeTextColor: e.target.value })}
                                                className="w-12 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings.pagination?.activeTextColor || '#FFFFFF'}
                                                onChange={(e) => handleSettingsChange('pagination', { ...store.settings.pagination, activeTextColor: e.target.value })}
                                                className="flex-1"
                                                placeholder="#FFFFFF"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <Label className="text-sm font-medium mb-3 block">Preview</Label>
                                    <div className="flex justify-center items-center gap-1">
                                        <button
                                            className="px-3 py-1.5 border rounded text-sm"
                                            style={{
                                                backgroundColor: store.settings.pagination?.buttonBgColor || '#FFFFFF',
                                                color: store.settings.pagination?.buttonTextColor || '#374151',
                                                borderColor: store.settings.pagination?.buttonBorderColor || '#D1D5DB'
                                            }}
                                        >
                                            Previous
                                        </button>
                                        <button
                                            className="px-3 py-1.5 border rounded text-sm"
                                            style={{
                                                backgroundColor: store.settings.pagination?.buttonBgColor || '#FFFFFF',
                                                color: store.settings.pagination?.buttonTextColor || '#374151',
                                                borderColor: store.settings.pagination?.buttonBorderColor || '#D1D5DB'
                                            }}
                                        >
                                            1
                                        </button>
                                        <button
                                            className="px-3 py-1.5 border rounded text-sm"
                                            style={{
                                                backgroundColor: store.settings.pagination?.activeBgColor || '#3B82F6',
                                                color: store.settings.pagination?.activeTextColor || '#FFFFFF',
                                                borderColor: store.settings.pagination?.activeBgColor || '#3B82F6'
                                            }}
                                        >
                                            2
                                        </button>
                                        <button
                                            className="px-3 py-1.5 border rounded text-sm"
                                            style={{
                                                backgroundColor: store.settings.pagination?.buttonBgColor || '#FFFFFF',
                                                color: store.settings.pagination?.buttonTextColor || '#374151',
                                                borderColor: store.settings.pagination?.buttonBorderColor || '#D1D5DB'
                                            }}
                                        >
                                            3
                                        </button>
                                        <button
                                            className="px-3 py-1.5 border rounded text-sm"
                                            style={{
                                                backgroundColor: store.settings.pagination?.buttonBgColor || '#FFFFFF',
                                                color: store.settings.pagination?.buttonTextColor || '#374151',
                                                borderColor: store.settings.pagination?.buttonBorderColor || '#D1D5DB'
                                            }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5" /> Product Page</CardTitle>
                            <CardDescription>Settings for the product detail page.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label htmlFor="hide_quantity_selector">Hide Quantity Selector</Label>
                                    <p className="text-sm text-gray-500">Don't show the quantity input on product pages.</p>
                                </div>
                                <Switch id="hide_quantity_selector" checked={!!store.settings.hide_quantity_selector} onCheckedChange={(c) => handleSettingsChange('hide_quantity_selector', c)} />
                            </div>

                            <div className="p-3 border rounded-lg">
                                <div className="space-y-3">
                                    <div>
                                        <Label htmlFor="product_gallery_layout">Product Gallery Layout</Label>
                                        <p className="text-sm text-gray-500">Choose how the product images are arranged on the product page.</p>
                                    </div>
                                    <Select
                                        value={store.settings.product_gallery_layout || 'horizontal'}
                                        onValueChange={(value) => handleSettingsChange('product_gallery_layout', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="horizontal">Horizontal (Main image with thumbnails below)</SelectItem>
                                            <SelectItem value="vertical">Vertical (Main image with thumbnails on side)</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {store.settings.product_gallery_layout === 'vertical' && (
                                        <div className="mt-4 pt-4 border-t">
                                            <div>
                                                <Label htmlFor="vertical_gallery_position">Thumbnail Position (Vertical Layout)</Label>
                                                <p className="text-sm text-gray-500">Choose whether thumbnails appear on the left or right side.</p>
                                            </div>
                                            <Select
                                                value={store.settings.vertical_gallery_position || 'left'}
                                                onValueChange={(value) => handleSettingsChange('vertical_gallery_position', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="left">Left (Thumbnails on left side)</SelectItem>
                                                    <SelectItem value="right">Right (Thumbnails on right side)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="mt-4 pt-4 border-t">
                                        <div>
                                            <Label htmlFor="mobile_gallery_layout">Mobile Layout</Label>
                                            <p className="text-sm text-gray-500">How thumbnails are positioned on mobile devices (screens smaller than 640px).</p>
                                        </div>
                                        <Select
                                            value={store.settings.mobile_gallery_layout || 'below'}
                                            onValueChange={(value) => handleSettingsChange('mobile_gallery_layout', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="above">Above (Thumbnails above main image)</SelectItem>
                                                <SelectItem value="below">Below (Thumbnails below main image)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 border rounded-lg">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-medium mb-2">Product Tabs Styling</h4>
                                        <p className="text-sm text-gray-500">Customize the appearance of product tabs on product detail pages.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Font Styling Settings */}
                                        <div>
                                            <Label htmlFor="product_tabs_title_size">Tab Title Size</Label>
                                            <Select
                                                value={store.settings.theme.product_tabs_title_size}
                                                onValueChange={(value) => handleThemeChange('product_tabs_title_size', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0.875rem">Small (14px)</SelectItem>
                                                    <SelectItem value="1rem">Medium (16px)</SelectItem>
                                                    <SelectItem value="1.125rem">Large (18px)</SelectItem>
                                                    <SelectItem value="1.25rem">X-Large (20px)</SelectItem>
                                                    <SelectItem value="1.5rem">2X-Large (24px)</SelectItem>
                                                    <SelectItem value="1.875rem">3X-Large (30px)</SelectItem>
                                                    <SelectItem value="2.25rem">4X-Large (36px)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_font_weight">Tab Font Weight</Label>
                                            <Select
                                                value={store.settings.theme.product_tabs_font_weight || '500'}
                                                onValueChange={(value) => handleThemeChange('product_tabs_font_weight', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="300">Light (300)</SelectItem>
                                                    <SelectItem value="400">Normal (400)</SelectItem>
                                                    <SelectItem value="500">Medium (500)</SelectItem>
                                                    <SelectItem value="600">Semibold (600)</SelectItem>
                                                    <SelectItem value="700">Bold (700)</SelectItem>
                                                    <SelectItem value="800">Extra Bold (800)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_border_radius">Tab Border Radius</Label>
                                            <Select
                                                value={store.settings.theme.product_tabs_border_radius || '0.5rem'}
                                                onValueChange={(value) => handleThemeChange('product_tabs_border_radius', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">None (0)</SelectItem>
                                                    <SelectItem value="0.125rem">Small (2px)</SelectItem>
                                                    <SelectItem value="0.25rem">Medium (4px)</SelectItem>
                                                    <SelectItem value="0.375rem">Default (6px)</SelectItem>
                                                    <SelectItem value="0.5rem">Large (8px)</SelectItem>
                                                    <SelectItem value="0.75rem">Extra Large (12px)</SelectItem>
                                                    <SelectItem value="1rem">Round (16px)</SelectItem>
                                                    <SelectItem value="9999px">Full Round</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_text_decoration">Tab Text Decoration</Label>
                                            <Select
                                                value={store.settings.theme.product_tabs_text_decoration || 'none'}
                                                onValueChange={(value) => handleThemeChange('product_tabs_text_decoration', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="underline">Underline</SelectItem>
                                                    <SelectItem value="overline">Overline</SelectItem>
                                                    <SelectItem value="line-through">Line Through</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Color Settings */}
                                        <div>
                                            <Label htmlFor="product_tabs_title_color">Tab Title Color</Label>
                                            <Input
                                                id="product_tabs_title_color"
                                                type="color"
                                                value={store.settings.theme.product_tabs_title_color}
                                                onChange={(e) => handleThemeChange('product_tabs_title_color', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_active_bg">Active Tab Background</Label>
                                            <Input
                                                id="product_tabs_active_bg"
                                                type="color"
                                                value={store.settings.theme.product_tabs_active_bg || '#ffffff'}
                                                onChange={(e) => handleThemeChange('product_tabs_active_bg', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_inactive_color">Inactive Tab Text Color</Label>
                                            <Input
                                                id="product_tabs_inactive_color"
                                                type="color"
                                                value={store.settings.theme.product_tabs_inactive_color || '#6B7280'}
                                                onChange={(e) => handleThemeChange('product_tabs_inactive_color', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_inactive_bg">Inactive Tab Background</Label>
                                            <Input
                                                id="product_tabs_inactive_bg"
                                                type="color"
                                                value={store.settings.theme.product_tabs_inactive_bg || '#ffffff'}
                                                onChange={(e) => handleThemeChange('product_tabs_inactive_bg', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_hover_color">Hover Text Color</Label>
                                            <Input
                                                id="product_tabs_hover_color"
                                                type="color"
                                                value={store.settings.theme.product_tabs_hover_color || '#111827'}
                                                onChange={(e) => handleThemeChange('product_tabs_hover_color', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_hover_bg">Hover Background Color</Label>
                                            <Input
                                                id="product_tabs_hover_bg"
                                                type="color"
                                                value={store.settings.theme.product_tabs_hover_bg || '#F3F4F6'}
                                                onChange={(e) => handleThemeChange('product_tabs_hover_bg', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_border_color">Tab Border Color</Label>
                                            <Input
                                                id="product_tabs_border_color"
                                                type="color"
                                                value={store.settings.theme.product_tabs_border_color || '#e0e0e0'}
                                                onChange={(e) => handleThemeChange('product_tabs_border_color', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_content_bg">Tab Content Background</Label>
                                            <Input
                                                id="product_tabs_content_bg"
                                                type="color"
                                                value={store.settings.theme.product_tabs_content_bg}
                                                onChange={(e) => handleThemeChange('product_tabs_content_bg', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="product_tabs_attribute_label_color">Attribute Label Color</Label>
                                            <Input
                                                id="product_tabs_attribute_label_color"
                                                type="color"
                                                value={store.settings.theme.product_tabs_attribute_label_color}
                                                onChange={(e) => handleThemeChange('product_tabs_attribute_label_color', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Checkout Page</CardTitle>
                            <CardDescription>Customize the appearance and flow of your checkout page.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Checkout Settings */}
                            <div className="space-y-4">
                                <Label className="text-base font-medium">Checkout Settings</Label>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <Label htmlFor="allow_guest_checkout" className="font-medium">Allow Guest Checkout</Label>
                                            <p className="text-sm text-gray-500">Allow customers to checkout without creating an account</p>
                                        </div>
                                        <Switch
                                            id="allow_guest_checkout"
                                            checked={store?.settings?.allow_guest_checkout !== undefined ? store.settings.allow_guest_checkout : true}
                                            onCheckedChange={(checked) => handleSettingsChange('allow_guest_checkout', checked)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <Label htmlFor="require_shipping_address" className="font-medium">Require Shipping Address</Label>
                                            <p className="text-sm text-gray-500">Always require a shipping address during checkout</p>
                                        </div>
                                        <Switch
                                            id="require_shipping_address"
                                            checked={store?.settings?.require_shipping_address !== undefined ? store.settings.require_shipping_address : true}
                                            onCheckedChange={(checked) => handleSettingsChange('require_shipping_address', checked)}
                                        />
                                    </div>
                                    <div className="p-3 border rounded-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label htmlFor="collect_phone_number_at_checkout" className="font-medium">Show Phone Number at Checkout</Label>
                                                <p className="text-sm text-gray-500">Show a phone number field during checkout</p>
                                            </div>
                                            <Switch
                                                id="collect_phone_number_at_checkout"
                                                checked={store?.settings?.collect_phone_number_at_checkout !== undefined ? store.settings.collect_phone_number_at_checkout : false}
                                                onCheckedChange={(checked) => handleSettingsChange('collect_phone_number_at_checkout', checked)}
                                            />
                                        </div>

                                        {store?.settings?.collect_phone_number_at_checkout && (
                                            <div className="pt-3 border-t">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <Label htmlFor="phone_number_required_at_checkout" className="font-medium">Phone Number Required</Label>
                                                        <p className="text-sm text-gray-500">Make the phone number field required or optional</p>
                                                    </div>
                                                    <Switch
                                                        id="phone_number_required_at_checkout"
                                                        checked={store?.settings?.phone_number_required_at_checkout !== undefined ? store.settings.phone_number_required_at_checkout : true}
                                                        onCheckedChange={(checked) => handleSettingsChange('phone_number_required_at_checkout', checked)}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {store?.settings?.phone_number_required_at_checkout !== false ? 'Phone number is required' : 'Phone number is optional'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>

                    <Card className="material-elevation-1 border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Checkout Layout Configuration</CardTitle>
                            <CardDescription>Define the column layout, styling, and section order for each checkout step configuration.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>How it works:</strong> Based on your selected step count below ({store.settings?.checkout_steps_count || 3} step{(store.settings?.checkout_steps_count || 3) > 1 ? 's' : ''}), configure the layout further down.
                                    Available sections: Shipping Address, Shipping Method, Billing Address, Delivery Options, Payment Method, Coupon, Order Summary.
                                </p>
                            </div>

                            {/* Step Count Configuration */}
                            <div className="p-4 border rounded-lg space-y-4">
                                <div>
                                    <Label htmlFor="checkout_steps_count" className="text-base font-medium">Checkout Steps</Label>
                                    <p className="text-sm text-gray-500">Choose how many steps to display in the checkout process.</p>
                                </div>
                                <Select
                                    value={String(store.settings?.checkout_steps_count || 3)}
                                    onValueChange={(value) => handleSettingsChange('checkout_steps_count', parseInt(value))}
                                >
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 Step (Single Page)</SelectItem>
                                        <SelectItem value="2">2 Steps</SelectItem>
                                        <SelectItem value="3">3 Steps</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Step Names Configuration */}
                                {store.settings?.checkout_steps_count > 1 && (
                                    <div className="mt-4 space-y-3">
                                        <Label className="text-sm font-medium">Step Names</Label>
                                        <p className="text-xs text-gray-500">Customize the names displayed for each step in the checkout process.</p>

                                        {store.settings?.checkout_steps_count === 2 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <Label htmlFor="checkout_2step_step1_name" className="text-xs">Step 1 Name</Label>
                                                    <Input
                                                        id="checkout_2step_step1_name"
                                                        value={store.settings?.checkout_2step_step1_name || 'Information'}
                                                        onChange={(e) => handleSettingsChange('checkout_2step_step1_name', e.target.value)}
                                                        placeholder="Information"
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="checkout_2step_step2_name" className="text-xs">Step 2 Name</Label>
                                                    <Input
                                                        id="checkout_2step_step2_name"
                                                        value={store.settings?.checkout_2step_step2_name || 'Payment'}
                                                        onChange={(e) => handleSettingsChange('checkout_2step_step2_name', e.target.value)}
                                                        placeholder="Payment"
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {store.settings?.checkout_steps_count === 3 && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <Label htmlFor="checkout_3step_step1_name" className="text-xs">Step 1 Name</Label>
                                                    <Input
                                                        id="checkout_3step_step1_name"
                                                        value={store.settings?.checkout_3step_step1_name || 'Information'}
                                                        onChange={(e) => handleSettingsChange('checkout_3step_step1_name', e.target.value)}
                                                        placeholder="Information"
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="checkout_3step_step2_name" className="text-xs">Step 2 Name</Label>
                                                    <Input
                                                        id="checkout_3step_step2_name"
                                                        value={store.settings?.checkout_3step_step2_name || 'Shipping'}
                                                        onChange={(e) => handleSettingsChange('checkout_3step_step2_name', e.target.value)}
                                                        placeholder="Shipping"
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="checkout_3step_step3_name" className="text-xs">Step 3 Name</Label>
                                                    <Input
                                                        id="checkout_3step_step3_name"
                                                        value={store.settings?.checkout_3step_step3_name || 'Payment'}
                                                        onChange={(e) => handleSettingsChange('checkout_3step_step3_name', e.target.value)}
                                                        placeholder="Payment"
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Step Name Translations */}
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <Label className="text-sm font-medium">Step Name Translations</Label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowStepTranslations(!showStepTranslations)}
                                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                                    >
                                                        <Languages className="w-4 h-4" />
                                                        {showStepTranslations ? 'Hide' : 'Manage'} Translations
                                                    </button>
                                                    <Link to="/admin/translations?tab=ui-labels&category=checkout">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex items-center gap-1"
                                                        >
                                                            <Languages className="w-3 h-3" />
                                                            Edit in UI Labels
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-3">
                                                Translate checkout step names into multiple languages
                                            </p>

                                            {showStepTranslations && (
                                                <div className="mt-4 border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Languages className="w-5 h-5 text-blue-600" />
                                                        <h3 className="text-base font-semibold text-blue-900">Step Name Translations</h3>
                                                    </div>
                                                    <TranslationFields
                                                        translations={stepTranslations}
                                                        onChange={(newTranslations) => {
                                                            setStepTranslations(newTranslations);
                                                        }}
                                                        fields={
                                                            store.settings?.checkout_steps_count === 2 ? [
                                                                { name: 'step_2step_1', label: 'Step 1 Name', type: 'text', required: true, placeholder: 'Information' },
                                                                { name: 'step_2step_2', label: 'Step 2 Name', type: 'text', required: true, placeholder: 'Payment' }
                                                            ] : [
                                                                { name: 'step_3step_1', label: 'Step 1 Name', type: 'text', required: true, placeholder: 'Information' },
                                                                { name: 'step_3step_2', label: 'Step 2 Name', type: 'text', required: true, placeholder: 'Shipping' },
                                                                { name: 'step_3step_3', label: 'Step 3 Name', type: 'text', required: true, placeholder: 'Payment' }
                                                            ]
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Step Indicator Styling */}
                            <div className="p-4 border rounded-lg space-y-4">
                                <div>
                                    <Label className="text-base font-medium">Step Indicator Styling</Label>
                                    <p className="text-sm text-gray-500">Customize how the step progress indicator appears during checkout.</p>
                                </div>

                                <div>
                                    <Label htmlFor="checkout_step_indicator_style">Indicator Style</Label>
                                    <Select
                                        value={store.settings?.checkout_step_indicator_style || 'circles'}
                                        onValueChange={(value) => handleSettingsChange('checkout_step_indicator_style', value)}
                                    >
                                        <SelectTrigger className="mt-1 w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="circles">Circles</SelectItem>
                                            <SelectItem value="bars">Progress Bars</SelectItem>
                                            <SelectItem value="numbers">Numbered Steps</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="checkout_step_indicator_active_color">Active Step Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="checkout_step_indicator_active_color"
                                                type="color"
                                                value={store.settings?.checkout_step_indicator_active_color || '#007bff'}
                                                onChange={(e) => handleSettingsChange('checkout_step_indicator_active_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings?.checkout_step_indicator_active_color || '#007bff'}
                                                onChange={(e) => handleSettingsChange('checkout_step_indicator_active_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="checkout_step_indicator_inactive_color">Inactive Step Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="checkout_step_indicator_inactive_color"
                                                type="color"
                                                value={store.settings?.checkout_step_indicator_inactive_color || '#D1D5DB'}
                                                onChange={(e) => handleSettingsChange('checkout_step_indicator_inactive_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings?.checkout_step_indicator_inactive_color || '#D1D5DB'}
                                                onChange={(e) => handleSettingsChange('checkout_step_indicator_inactive_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="checkout_step_indicator_completed_color">Completed Step Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="checkout_step_indicator_completed_color"
                                                type="color"
                                                value={store.settings?.checkout_step_indicator_completed_color || '#10B981'}
                                                onChange={(e) => handleSettingsChange('checkout_step_indicator_completed_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings?.checkout_step_indicator_completed_color || '#10B981'}
                                                onChange={(e) => handleSettingsChange('checkout_step_indicator_completed_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section Styling */}
                            <div className="p-4 border rounded-lg space-y-4">
                                <div>
                                    <Label className="text-base font-medium">Section Styling</Label>
                                    <p className="text-sm text-gray-500">Customize the appearance of checkout sections (Shipping Address, Payment Method, etc.).</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="checkout_section_title_color">Section Title Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="checkout_section_title_color"
                                                type="color"
                                                value={store.settings?.checkout_section_title_color || '#111827'}
                                                onChange={(e) => handleSettingsChange('checkout_section_title_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings?.checkout_section_title_color || '#111827'}
                                                onChange={(e) => handleSettingsChange('checkout_section_title_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="checkout_section_title_size">Section Title Size</Label>
                                        <Select
                                            value={store.settings?.checkout_section_title_size || '1.25rem'}
                                            onValueChange={(value) => handleSettingsChange('checkout_section_title_size', value)}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0.875rem">Small (14px)</SelectItem>
                                                <SelectItem value="1rem">Medium (16px)</SelectItem>
                                                <SelectItem value="1.125rem">Large (18px)</SelectItem>
                                                <SelectItem value="1.25rem">X-Large (20px)</SelectItem>
                                                <SelectItem value="1.5rem">2X-Large (24px)</SelectItem>
                                                <SelectItem value="1.875rem">3X-Large (30px)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="checkout_section_bg_color">Section Background Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="checkout_section_bg_color"
                                                type="color"
                                                value={store.settings?.checkout_section_bg_color || '#FFFFFF'}
                                                onChange={(e) => handleSettingsChange('checkout_section_bg_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings?.checkout_section_bg_color || '#FFFFFF'}
                                                onChange={(e) => handleSettingsChange('checkout_section_bg_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="checkout_section_border_color">Section Border Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="checkout_section_border_color"
                                                type="color"
                                                value={store.settings?.checkout_section_border_color || '#E5E7EB'}
                                                onChange={(e) => handleSettingsChange('checkout_section_border_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings?.checkout_section_border_color || '#E5E7EB'}
                                                onChange={(e) => handleSettingsChange('checkout_section_border_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="checkout_section_text_color">Section Text Color</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                id="checkout_section_text_color"
                                                type="color"
                                                value={store.settings?.checkout_section_text_color || '#374151'}
                                                onChange={(e) => handleSettingsChange('checkout_section_text_color', e.target.value)}
                                                className="w-20 h-10 p-1 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={store.settings?.checkout_section_text_color || '#374151'}
                                                onChange={(e) => handleSettingsChange('checkout_section_text_color', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 1-Step Layout */}
                            {store.settings?.checkout_steps_count === 1 && (
                            <div className="p-4 border rounded-lg space-y-4">
                                <div>
                                    <Label className="text-base font-medium">1-Step Checkout Layout</Label>
                                    <p className="text-sm text-gray-500">All sections on one page</p>
                                </div>

                                <div>
                                    <Label htmlFor="checkout_1step_columns">Number of Columns</Label>
                                    <Select
                                        value={String(store.settings?.checkout_1step_columns || 3)}
                                        onValueChange={(value) => handleColumnCountChange('1step', parseInt(value))}
                                    >
                                        <SelectTrigger className="w-48 mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 Column</SelectItem>
                                            <SelectItem value="2">2 Columns</SelectItem>
                                            <SelectItem value="3">3 Columns</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Drag and Drop Section Ordering - Unified DndContext */}
                                {(() => {
                                    const fullLayout = store.settings?.checkout_1step_layout || defaultSectionLayout['1step'];
                                    const stepLayout = fullLayout.step1 || {};
                                    const allSections = [...(stepLayout.column1 || []), ...(stepLayout.column2 || []), ...(stepLayout.column3 || [])];

                                    return (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={(event) => handleUnifiedDragEnd(event, '1step')}
                                        >
                                            <SortableContext
                                                items={allSections}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className={`grid gap-4 mt-4 ${store.settings?.checkout_1step_columns === 1 ? 'grid-cols-1' : store.settings?.checkout_1step_columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                    {['column1', 'column2', 'column3'].slice(0, store.settings?.checkout_1step_columns || 3).map((columnKey, idx) => {
                                                        const columnSections = filterVisibleSections(stepLayout[columnKey] || []);

                                                        return (
                                                            <div key={columnKey} className="space-y-2">
                                                                <Label className="text-sm font-semibold">Column {idx + 1}</Label>
                                                                <DroppableColumn
                                                                    id={`step1-${columnKey}`}
                                                                    className="space-y-2 min-h-[100px] p-2 bg-gray-50 rounded border-2 border-dashed"
                                                                >
                                                                    {columnSections.map((section) => (
                                                                        <SortableSection key={section} id={section} section={section} />
                                                                    ))}
                                                                    {columnSections.length === 0 && (
                                                                        <p className="text-sm text-gray-400 text-center py-4">Drop sections here</p>
                                                                    )}
                                                                </DroppableColumn>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    );
                                })()}
                            </div>
                            )}

                            {store.settings?.checkout_steps_count === 2 && <Separator />}

                            {/* 2-Step Layout */}
                            {store.settings?.checkout_steps_count === 2 && (
                            <div className="p-4 border rounded-lg space-y-6">
                                <div>
                                    <Label className="text-base font-medium">2-Step Checkout Layout</Label>
                                    <p className="text-sm text-gray-500">{store.settings?.checkout_2step_step1_name || 'Information'} → {store.settings?.checkout_2step_step2_name || 'Payment'}</p>
                                </div>

                                <div>
                                    <Label htmlFor="checkout_2step_columns">Number of Columns</Label>
                                    <Select
                                        value={String(store.settings?.checkout_2step_columns || 2)}
                                        onValueChange={(value) => handleColumnCountChange('2step', parseInt(value))}
                                    >
                                        <SelectTrigger className="w-48 mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 Column</SelectItem>
                                            <SelectItem value="2">2 Columns</SelectItem>
                                            <SelectItem value="3">3 Columns</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Unified DndContext for both steps */}
                                {(() => {
                                    const fullLayout = store.settings?.checkout_2step_layout || defaultSectionLayout['2step'];
                                    const step1Layout = fullLayout.step1 || {};
                                    const step2Layout = fullLayout.step2 || {};
                                    const allSections = [
                                        ...(step1Layout.column1 || []),
                                        ...(step1Layout.column2 || []),
                                        ...(step1Layout.column3 || []),
                                        ...(step2Layout.column1 || []),
                                        ...(step2Layout.column2 || []),
                                        ...(step2Layout.column3 || [])
                                    ];

                                    return (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={(event) => handleUnifiedDragEnd(event, '2step')}
                                        >
                                            <SortableContext
                                                items={allSections}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {/* Step 1 Layout */}
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold text-blue-700">Step 1: {store.settings?.checkout_2step_step1_name || 'Information'}</Label>
                                                    <div className={`grid gap-4 ${store.settings?.checkout_2step_columns === 1 ? 'grid-cols-1' : store.settings?.checkout_2step_columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                        {['column1', 'column2', 'column3'].slice(0, store.settings?.checkout_2step_columns || 2).map((columnKey, idx) => {
                                                            const columnSections = filterVisibleSections(step1Layout[columnKey] || []);

                                                            return (
                                                                <div key={columnKey} className="space-y-2">
                                                                    <Label className="text-xs text-gray-600">Column {idx + 1}</Label>
                                                                    <DroppableColumn
                                                                        id={`step1-${columnKey}`}
                                                                        className="space-y-2 min-h-[100px] p-2 bg-blue-50 rounded border-2 border-dashed border-blue-200"
                                                                    >
                                                                        {columnSections.map((section) => (
                                                                            <SortableSection key={section} id={section} section={section} />
                                                                        ))}
                                                                        {columnSections.length === 0 && (
                                                                            <p className="text-sm text-gray-400 text-center py-4">Drop sections here</p>
                                                                        )}
                                                                    </DroppableColumn>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Step 2 Layout */}
                                                <div className="space-y-3 mt-6">
                                                    <Label className="text-sm font-semibold text-green-700">Step 2: {store.settings?.checkout_2step_step2_name || 'Payment'}</Label>
                                                    <div className={`grid gap-4 ${store.settings?.checkout_2step_columns === 1 ? 'grid-cols-1' : store.settings?.checkout_2step_columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                        {['column1', 'column2', 'column3'].slice(0, store.settings?.checkout_2step_columns || 2).map((columnKey, idx) => {
                                                            const columnSections = filterVisibleSections(step2Layout[columnKey] || []);

                                                            return (
                                                                <div key={columnKey} className="space-y-2">
                                                                    <Label className="text-xs text-gray-600">Column {idx + 1}</Label>
                                                                    <DroppableColumn
                                                                        id={`step2-${columnKey}`}
                                                                        className="space-y-2 min-h-[100px] p-2 bg-green-50 rounded border-2 border-dashed border-green-200"
                                                                    >
                                                                        {columnSections.map((section) => (
                                                                            <SortableSection key={section} id={section} section={section} />
                                                                        ))}
                                                                        {columnSections.length === 0 && (
                                                                            <p className="text-sm text-gray-400 text-center py-4">Drop sections here</p>
                                                                        )}
                                                                    </DroppableColumn>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    );
                                })()}
                            </div>
                            )}

                            {store.settings?.checkout_steps_count === 3 && <Separator />}

                            {/* 3-Step Layout */}
                            {store.settings?.checkout_steps_count === 3 && (
                            <div className="p-4 border rounded-lg space-y-6">
                                <div>
                                    <Label className="text-base font-medium">3-Step Checkout Layout</Label>
                                    <p className="text-sm text-gray-500">{store.settings?.checkout_3step_step1_name || 'Information'} → {store.settings?.checkout_3step_step2_name || 'Shipping'} → {store.settings?.checkout_3step_step3_name || 'Payment'}</p>
                                </div>

                                <div>
                                    <Label htmlFor="checkout_3step_columns">Number of Columns</Label>
                                    <Select
                                        value={String(store.settings?.checkout_3step_columns || 2)}
                                        onValueChange={(value) => handleColumnCountChange('3step', parseInt(value))}
                                    >
                                        <SelectTrigger className="w-48 mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 Column</SelectItem>
                                            <SelectItem value="2">2 Columns</SelectItem>
                                            <SelectItem value="3">3 Columns</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Unified DndContext for all three steps */}
                                {(() => {
                                    const fullLayout = store.settings?.checkout_3step_layout || defaultSectionLayout['3step'];
                                    const step1Layout = fullLayout.step1 || {};
                                    const step2Layout = fullLayout.step2 || {};
                                    const step3Layout = fullLayout.step3 || {};
                                    const allSections = [
                                        ...(step1Layout.column1 || []),
                                        ...(step1Layout.column2 || []),
                                        ...(step1Layout.column3 || []),
                                        ...(step2Layout.column1 || []),
                                        ...(step2Layout.column2 || []),
                                        ...(step2Layout.column3 || []),
                                        ...(step3Layout.column1 || []),
                                        ...(step3Layout.column2 || []),
                                        ...(step3Layout.column3 || [])
                                    ];

                                    return (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={(event) => handleUnifiedDragEnd(event, '3step')}
                                        >
                                            <SortableContext
                                                items={allSections}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {/* Step 1 Layout */}
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold text-blue-700">Step 1: {store.settings?.checkout_3step_step1_name || 'Information'}</Label>
                                                    <div className={`grid gap-4 ${store.settings?.checkout_3step_columns === 1 ? 'grid-cols-1' : store.settings?.checkout_3step_columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                        {['column1', 'column2', 'column3'].slice(0, store.settings?.checkout_3step_columns || 2).map((columnKey, idx) => {
                                                            const columnSections = filterVisibleSections(step1Layout[columnKey] || []);

                                                            return (
                                                                <div key={columnKey} className="space-y-2">
                                                                    <Label className="text-xs text-gray-600">Column {idx + 1}</Label>
                                                                    <DroppableColumn
                                                                        id={`step1-${columnKey}`}
                                                                        className="space-y-2 min-h-[100px] p-2 bg-blue-50 rounded border-2 border-dashed border-blue-200"
                                                                    >
                                                                        {columnSections.map((section) => (
                                                                            <SortableSection key={section} id={section} section={section} />
                                                                        ))}
                                                                        {columnSections.length === 0 && (
                                                                            <p className="text-sm text-gray-400 text-center py-4">Drop sections here</p>
                                                                        )}
                                                                    </DroppableColumn>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Step 2 Layout */}
                                                <div className="space-y-3 mt-6">
                                                    <Label className="text-sm font-semibold text-purple-700">Step 2: {store.settings?.checkout_3step_step2_name || 'Shipping'}</Label>
                                                    <div className={`grid gap-4 ${store.settings?.checkout_3step_columns === 1 ? 'grid-cols-1' : store.settings?.checkout_3step_columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                        {['column1', 'column2', 'column3'].slice(0, store.settings?.checkout_3step_columns || 2).map((columnKey, idx) => {
                                                            const columnSections = filterVisibleSections(step2Layout[columnKey] || []);

                                                            return (
                                                                <div key={columnKey} className="space-y-2">
                                                                    <Label className="text-xs text-gray-600">Column {idx + 1}</Label>
                                                                    <DroppableColumn
                                                                        id={`step2-${columnKey}`}
                                                                        className="space-y-2 min-h-[100px] p-2 bg-purple-50 rounded border-2 border-dashed border-purple-200"
                                                                    >
                                                                        {columnSections.map((section) => (
                                                                            <SortableSection key={section} id={section} section={section} />
                                                                        ))}
                                                                        {columnSections.length === 0 && (
                                                                            <p className="text-sm text-gray-400 text-center py-4">Drop sections here</p>
                                                                        )}
                                                                    </DroppableColumn>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Step 3 Layout */}
                                                <div className="space-y-3 mt-6">
                                                    <Label className="text-sm font-semibold text-green-700">Step 3: {store.settings?.checkout_3step_step3_name || 'Payment'}</Label>
                                                    <div className={`grid gap-4 ${store.settings?.checkout_3step_columns === 1 ? 'grid-cols-1' : store.settings?.checkout_3step_columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                        {['column1', 'column2', 'column3'].slice(0, store.settings?.checkout_3step_columns || 2).map((columnKey, idx) => {
                                                            const columnSections = filterVisibleSections(step3Layout[columnKey] || []);

                                                            return (
                                                                <div key={columnKey} className="space-y-2">
                                                                    <Label className="text-xs text-gray-600">Column {idx + 1}</Label>
                                                                    <DroppableColumn
                                                                        id={`step3-${columnKey}`}
                                                                        className="space-y-2 min-h-[100px] p-2 bg-green-50 rounded border-2 border-dashed border-green-200"
                                                                    >
                                                                        {columnSections.map((section) => (
                                                                            <SortableSection key={section} id={section} section={section} />
                                                                        ))}
                                                                        {columnSections.length === 0 && (
                                                                            <p className="text-sm text-gray-400 text-center py-4">Drop sections here</p>
                                                                        )}
                                                                    </DroppableColumn>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    );
                                })()}
                            </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end mt-8">
                    <SaveButton
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSave();
                            return false;
                        }}
                        loading={saving}
                        success={saveSuccess}
                        defaultText="Save All Settings"
                    />
                </div>
            </div>
        </div>
    );
}