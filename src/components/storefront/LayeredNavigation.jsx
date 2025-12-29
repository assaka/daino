import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { X, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { getCurrentLanguage } from '@/utils/translationUtils';

// Helper component to render editable slot elements in edit mode
const EditableSlotElement = ({ slotKey, slot, onElementClick, children, className = "", style = {} }) => {
  // Always render the wrapper in edit mode so clicking works
  // Use slot styles if available, otherwise use empty styles
  const slotStyles = slot?.styles || {};

  return (
    <div
      className={`slot-element ${className}`}
      data-slot-id={slotKey}
      data-editable="true"
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        outline: '1px dashed #ccc',
        padding: '2px 4px',
        borderRadius: '2px',
        ...style,
        ...slotStyles
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Pass slotKey and element as expected by createElementClickHandler(slotId, element)
        if (onElementClick) {
          onElementClick(slotKey, e.currentTarget);
        }
      }}
      onDragStart={(e) => {
        e.preventDefault();
        return false;
      }}
      draggable="false"
    >
      {children}
    </div>
  );
};

export default function LayeredNavigation({
    products,
    attributes,
    onFilterChange,
    onClearFilters,
    selectedFilters: externalSelectedFilters,
    activeFilters: externalActiveFilters,
    showActiveFilters = true,
    slotConfig = {},
    settings = {},
    isEditMode = false,
    childSlots = {},
    onElementClick = () => {}
}) {
    const { t } = useTranslation();
    // Use external selectedFilters if provided (controlled mode), otherwise use internal state
    const [internalSelectedFilters, setInternalSelectedFilters] = useState({});
    const selectedFilters = externalSelectedFilters !== undefined ? externalSelectedFilters : internalSelectedFilters;
    const setSelectedFilters = externalSelectedFilters !== undefined
        ? (newFilters) => {
            // In controlled mode, call onFilterChange directly
            const filters = typeof newFilters === 'function' ? newFilters(selectedFilters) : newFilters;
            onFilterChange(filters);
          }
        : setInternalSelectedFilters;

    const [priceRange, setPriceRange] = useState([0, 1000]);
    const [expandedAttributes, setExpandedAttributes] = useState({});
    const [isFilterVisible, setIsFilterVisible] = useState(false);

    // Extract label configurations and styles from simplified slot structure
    const {
        filter_card_header = { content: 'Filter By' },
        filter_by_label = { content: 'Filter By' },
        filter_price_title = { content: 'Price' },
        filter_attribute_titles = {},
        filter_option_styles = { styles: {} }
    } = slotConfig;

    // Extract custom styling for filter options
    const optionStyles = filter_option_styles.styles || {};
    const {
        optionTextColor = '#374151',
        optionHoverColor = '#1F2937',
        optionCountColor = '#9CA3AF',
        checkboxColor = '#3B82F6',
        sliderColor = '#3B82F6',
        activeFilterBgColor = '#DBEAFE',
        activeFilterTextColor = '#1E40AF'
    } = optionStyles;

    // Extract store settings with defaults
    const enableProductFilters = settings.enable_product_filters !== false; // Default to true
    const collapseFilters = settings.collapse_filters !== false
    const maxVisibleAttributes = settings.max_visible_attributes || 5;
    const mobileFilterMode = settings.mobile_filter_mode || 'collapse'; // 'collapse' or 'slide'

    // FIXED: Calculate price range from products considering compare_price
    const { minPrice, maxPrice } = useMemo(() => {
        if (!products || products.length === 0) return { minPrice: 0, maxPrice: 1000 };
        
        const prices = [];
        products.forEach(p => {
            const price = parseFloat(p.price || 0);
            if (price > 0) prices.push(price);
            
            // Also consider compare_price if it exists and is different
            const comparePrice = parseFloat(p.compare_price || 0);
            if (comparePrice > 0 && comparePrice !== price) {
                prices.push(comparePrice);
            }
        });
        
        if (prices.length === 0) return { minPrice: 0, maxPrice: 1000 };
        
        const calculatedRange = {
            minPrice: Math.floor(Math.min(...prices)),
            maxPrice: Math.ceil(Math.max(...prices))
        };
        
        return calculatedRange;
    }, [products]);

    // Initialize price range when products change
    useEffect(() => {
        setPriceRange([minPrice, maxPrice]);
    }, [minPrice, maxPrice]);

    // Send filters when they change - ONLY in uncontrolled mode
    // In controlled mode, onFilterChange is called directly from setSelectedFilters
    const isControlledMode = externalSelectedFilters !== undefined;
    useEffect(() => {
        // Skip this effect in controlled mode to avoid infinite loops
        if (isControlledMode) return;

        const filtersToSend = { ...selectedFilters };

        // Only add price range if it's different from the full range
        if (priceRange[0] !== minPrice || priceRange[1] !== maxPrice) {
            filtersToSend.priceRange = priceRange;
        }

        onFilterChange(filtersToSend);
    }, [isControlledMode, selectedFilters, priceRange, minPrice, maxPrice, onFilterChange]);
    
    const handleAttributeChange = (attributeCode, value, checked, filterType = 'multiselect') => {
        setSelectedFilters(prev => {
            const newFilters = { ...prev };

            // For 'select' filter type (radio buttons), only one value can be selected
            if (filterType === 'select') {
                if (checked) {
                    // Replace any existing selection with the new value
                    newFilters[attributeCode] = [value];
                } else {
                    // Allow deselecting the radio button
                    delete newFilters[attributeCode];
                }
            } else {
                // For 'multiselect' filter type (checkboxes), multiple values allowed
                const currentValues = newFilters[attributeCode] || [];
                if (checked) {
                    newFilters[attributeCode] = [...currentValues, value];
                } else {
                    newFilters[attributeCode] = currentValues.filter(v => v !== value);
                    if (newFilters[attributeCode].length === 0) {
                        delete newFilters[attributeCode];
                    }
                }
            }
            return newFilters;
        });
    };

    // Clear all filters function
    const clearAllFilters = () => {
        setPriceRange([minPrice, maxPrice]);
        if (isControlledMode) {
            // In controlled mode, call onFilterChange once with empty filters
            onFilterChange({});
        } else {
            setSelectedFilters({});
        }
    };

    // Clear only the price filter
    const clearPriceFilter = () => {
        setPriceRange([minPrice, maxPrice]);
        // In controlled mode, we need to call onFilterChange directly
        if (isControlledMode) {
            // Remove priceRange from current filters
            const { priceRange: _, ...restFilters } = selectedFilters;
            onFilterChange(restFilters);
        }
    };

    // Handle price range change
    const handlePriceRangeChange = (newRange) => {
        // Guard against unnecessary updates
        if (newRange[0] === priceRange[0] && newRange[1] === priceRange[1]) {
            return;
        }

        setPriceRange(newRange);

        // In controlled mode, we need to call onFilterChange directly
        // because the useEffect is skipped for controlled mode
        if (isControlledMode) {
            // Remove existing priceRange and add new one if needed
            const { priceRange: _, ...restFilters } = selectedFilters;
            // Only add price range if it's different from the full range
            if (newRange[0] !== minPrice || newRange[1] !== maxPrice) {
                onFilterChange({ ...restFilters, priceRange: newRange });
            } else {
                onFilterChange(restFilters);
            }
        }
    };

    // Check if any filters are active
    const hasActiveFilters = Object.keys(selectedFilters).length > 0 ||
                           (priceRange[0] !== minPrice || priceRange[1] !== maxPrice);


    // Extract attribute values from products with normalized format support
    const filterOptions = useMemo(() => {
        if (!products || !attributes) {
            return {};
        }

        const options = {};
        attributes.forEach(attr => {
            if (attr.is_filterable) {
                const valueCodes = new Set();

                // Add value codes from products
                products.forEach(p => {
                    const productAttributes = p.attributes;

                    // Handle normalized format (array of objects with code/label/value)
                    if (Array.isArray(productAttributes)) {
                        const matchingAttr = productAttributes.find(pAttr =>
                            pAttr.code === attr.code
                        );

                        if (matchingAttr) {
                            // Use rawValue (code) if available, otherwise fall back to value
                            const productValue = matchingAttr.rawValue || matchingAttr.value;
                            if (productValue) {
                                valueCodes.add(String(productValue));
                            }
                        }
                    }
                });

                // Only include attributes that have values with products
                if (valueCodes.size > 0) {
                    // Get translated values from attr.values (from publicAttributes API)
                    // attr.values contains: { code, value (translated label), sort_order }
                    const attrValues = attr.values || [];

                    // Build value objects with code, label, and count
                    const valuesWithProducts = Array.from(valueCodes)
                        .map(code => {
                            // Find translated label from attribute values
                            const attrValue = attrValues.find(av => av.code === code);
                            const label = attrValue?.value || code; // Use translated value, fallback to code
                            const sortOrder = attrValue?.sort_order || 999;

                            // Count products with this value
                            const count = products.filter(p => {
                                const productAttributes = p.attributes;
                                if (!Array.isArray(productAttributes)) return false;

                                const matchingAttr = productAttributes.find(pAttr => pAttr.code === attr.code);
                                const productValue = String(matchingAttr?.rawValue || matchingAttr?.value || '');
                                return matchingAttr && productValue === code;
                            }).length;

                            return { code, label, count, sortOrder };
                        })
                        .filter(v => v.count > 0)
                        .sort((a, b) => a.sortOrder - b.sortOrder);

                    // Only include this attribute if it has values with products
                    if (valuesWithProducts.length > 0) {
                        // Use attr.label - already translated by backend (publicAttributes.js)
                        options[attr.code] = {
                            name: attr.label || attr.code,
                            values: valuesWithProducts, // Now array of { code, label, count, sortOrder }
                            filterType: attr.filter_type || 'multiselect'
                        };
                    }
                }
            }
        });

        return options;
    }, [products, attributes]);

    // Don't render if filters are disabled
    if (!enableProductFilters) {
        return null;
    }

    if (!products || products.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Filter By</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500">No products to filter</p>
                </CardContent>
            </Card>
        );
    }

    // Helper to render active filter badges (used in both modes)
    const renderActiveFilterBadges = (isMobile = false) => {
        if (!showActiveFilters || !hasActiveFilters) return null;

        const activeFilterElements = [];

        // Helper to get translated attribute label
        const getAttrLabel = (attrCode) => {
            const attr = attributes?.find(a => a.code === attrCode);
            return attr?.label || filterOptions[attrCode]?.name || attrCode;
        };

        // Helper to get translated value label
        const getValueLabel = (attrCode, valueCode) => {
            const attrOption = filterOptions[attrCode];
            const valueObj = attrOption?.values?.find(v => v.code === valueCode);
            return valueObj?.label || valueCode;
        };

        // Add active attribute filters
        Object.entries(selectedFilters).forEach(([filterKey, filterValues]) => {
            if (filterKey !== 'priceRange' && Array.isArray(filterValues)) {
                filterValues.forEach(value => {
                    activeFilterElements.push(
                        <span
                            key={`${isMobile ? 'mobile-' : ''}${filterKey}-${value}`}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs"
                            style={{
                                backgroundColor: activeFilterBgColor,
                                color: activeFilterTextColor
                            }}
                        >
                            {getAttrLabel(filterKey)}: {getValueLabel(filterKey, value)}
                            <button
                                onClick={isEditMode ? () => {} : () => {
                                    const newValues = filterValues.filter(v => v !== value);
                                    const newFilters = { ...selectedFilters };
                                    if (newValues.length > 0) {
                                        newFilters[filterKey] = newValues;
                                    } else {
                                        delete newFilters[filterKey];
                                    }
                                    setSelectedFilters(newFilters);
                                }}
                                disabled={isEditMode}
                                className={`text-lg ml-2 hover:opacity-80 transition-opacity ${isEditMode ? "pointer-events-none" : ""}`}
                                style={{ color: activeFilterTextColor }}
                            >
                                ×
                            </button>
                        </span>
                    );
                });
            }
        });

        // Add price range filter if active
        if (priceRange[0] !== minPrice || priceRange[1] !== maxPrice) {
            const [min, max] = priceRange;
            activeFilterElements.push(
                <span
                    key={`${isMobile ? 'mobile-' : ''}price-range`}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800"
                >
                    {t('common.price', 'Price')}: ${min} - ${max}
                    <button
                        onClick={isEditMode ? () => {} : clearPriceFilter}
                        disabled={isEditMode}
                        className={`text-lg ml-2 text-green-600 hover:text-green-800 ${isEditMode ? "pointer-events-none" : ""}`}
                    >
                        ×
                    </button>
                </span>
            );
        }

        return activeFilterElements.length > 0 ? (
            <div className="flex flex-wrap gap-2">
                {activeFilterElements}
            </div>
        ) : null;
    };

    // Slide panel for mobile (when mobileFilterMode === 'slide')
    const renderSlidePanel = () => (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 sm:hidden ${
                    isFilterVisible ? 'opacity-50' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setIsFilterVisible(false)}
            />

            {/* Slide Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out sm:hidden ${
                    isFilterVisible ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Panel Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">
                        {filter_by_label.content || filter_card_header.content || t('common.filters', 'Filters')}
                    </h2>
                    <button
                        onClick={() => setIsFilterVisible(false)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Panel Content - Scrollable */}
                <div className="overflow-y-auto h-[calc(100%-130px)] p-4">
                    {/* Active Filters in Panel */}
                    {renderActiveFilterBadges(true) && (
                        <div className="mb-4">
                            {renderActiveFilterBadges(true)}
                        </div>
                    )}

                    {/* Filter Accordion */}
                    <Accordion
                        type="multiple"
                        defaultValue={collapseFilters ? [] : ['price', ...Object.keys(filterOptions)]}
                        className="w-full"
                    >
                        {renderPriceFilter()}
                        {renderAttributeFilters()}
                    </Accordion>
                </div>

                {/* Panel Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                    <div className="flex gap-2">
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    clearAllFilters();
                                    setIsFilterVisible(false);
                                }}
                            >
                                {t('common.clear_all', 'Clear All')}
                            </Button>
                        )}
                        <Button
                            className="flex-1"
                            onClick={() => setIsFilterVisible(false)}
                        >
                            {t('common.apply', 'Apply')}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );

    // Helper to render price filter accordion item
    const renderPriceFilter = () => (
        <AccordionItem value="price">
            <AccordionTrigger
                className="font-semibold"
                style={{
                    color: isEditMode ? 'inherit' : (filter_price_title.styles?.color || '#374151'),
                    ...(!isEditMode ? filter_price_title.styles : {})
                }}
            >
                {isEditMode ? (
                    <EditableSlotElement
                        slotKey="price_filter_label"
                        slot={childSlots?.price_filter_label || { content: 'Price' }}
                        onElementClick={onElementClick}
                        className="font-semibold"
                    >
                        Price
                    </EditableSlotElement>
                ) : (
                    filter_price_title.content || t('common.price', 'Price')
                )}
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4">
                    <div className="px-2">
                        <Slider
                            min={minPrice}
                            max={maxPrice}
                            step={1}
                            value={priceRange}
                            onValueChange={isEditMode ? () => {} : handlePriceRangeChange}
                            disabled={isEditMode}
                            className={`w-full ${isEditMode ? "pointer-events-none" : ""}`}
                            style={{ accentColor: sliderColor }}
                        />
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1]}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Min: ${minPrice}</span>
                        <span>Max: ${maxPrice}</span>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );

    // Helper to render attribute filter accordion items
    const renderAttributeFilters = () => (
        Object.entries(filterOptions).map(([code, { name, values, filterType }]) => {
            const isRadioFilter = filterType === 'select';
            if (!values || values.length === 0) return null;

            return (
                <AccordionItem key={code} value={code}>
                    <AccordionTrigger
                        className="font-semibold"
                        style={{
                            color: isEditMode ? 'inherit' : (
                                filter_attribute_titles.attribute_filter_label?.styles?.color ||
                                filter_attribute_titles[code]?.styles?.color ||
                                '#374151'
                            ),
                            ...(!isEditMode ? (
                                filter_attribute_titles.attribute_filter_label?.styles ||
                                filter_attribute_titles[code]?.styles ||
                                {}
                            ) : {})
                        }}
                    >
                        {isEditMode ? (
                            <EditableSlotElement
                                slotKey={`${code}_filter_label`}
                                slot={childSlots?.[`${code}_filter_label`] || childSlots?.attribute_filter_label || { content: name }}
                                onElementClick={onElementClick}
                                className="font-semibold"
                                style={{
                                    ...(childSlots?.attribute_filter_label?.styles || {}),
                                    ...(childSlots?.[`${code}_filter_label`]?.styles || {})
                                }}
                            >
                                {name}
                            </EditableSlotElement>
                        ) : (
                            filter_attribute_titles[code]?.content || name
                        )}
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-2">
                            {(() => {
                                const isExpanded = expandedAttributes[code];
                                const visibleValues = isExpanded ? values : values.slice(0, maxVisibleAttributes);
                                const hasMoreValues = values.length > maxVisibleAttributes;

                                return (
                                    <>
                                        <div className={hasMoreValues && !isExpanded ? "max-h-48 overflow-hidden" : "max-h-48 overflow-y-auto"}>
                                            {visibleValues.map(valueObj => {
                                                const valueCode = valueObj.code;
                                                const valueLabel = valueObj.label;
                                                const productCount = valueObj.count;

                                                if (productCount === 0) return null;

                                                return (
                                                    <div key={valueCode} className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2">
                                                            {isEditMode ? (
                                                                <EditableSlotElement
                                                                    slotKey="filter_option_styles"
                                                                    slot={childSlots?.filter_option_styles}
                                                                    onElementClick={onElementClick}
                                                                >
                                                                    {isRadioFilter ? (
                                                                        <input
                                                                            type="radio"
                                                                            id={`attr-${code}-${valueCode}`}
                                                                            name={`attr-${code}`}
                                                                            checked={selectedFilters[code]?.includes(valueCode) || false}
                                                                            onChange={() => {}}
                                                                            disabled={true}
                                                                            className="pointer-events-none h-4 w-4"
                                                                            style={{ accentColor: checkboxColor }}
                                                                        />
                                                                    ) : (
                                                                        <Checkbox
                                                                            id={`attr-${code}-${valueCode}`}
                                                                            checked={selectedFilters[code]?.includes(valueCode) || false}
                                                                            onCheckedChange={() => {}}
                                                                            disabled={true}
                                                                            className="pointer-events-none"
                                                                            style={{ accentColor: checkboxColor }}
                                                                        />
                                                                    )}
                                                                </EditableSlotElement>
                                                            ) : (
                                                                isRadioFilter ? (
                                                                    <input
                                                                        type="radio"
                                                                        id={`attr-${code}-${valueCode}`}
                                                                        name={`attr-${code}`}
                                                                        checked={selectedFilters[code]?.includes(valueCode) || false}
                                                                        onChange={(e) => handleAttributeChange(code, valueCode, e.target.checked, filterType)}
                                                                        className="h-4 w-4 cursor-pointer"
                                                                        style={{ accentColor: checkboxColor }}
                                                                    />
                                                                ) : (
                                                                    <Checkbox
                                                                        id={`attr-${code}-${valueCode}`}
                                                                        checked={selectedFilters[code]?.includes(valueCode) || false}
                                                                        onCheckedChange={(checked) => handleAttributeChange(code, valueCode, checked, filterType)}
                                                                        className=""
                                                                        style={{ accentColor: checkboxColor }}
                                                                    />
                                                                )
                                                            )}
                                                            <Label
                                                                htmlFor={`attr-${code}-${valueCode}`}
                                                                className="text-sm cursor-pointer hover:opacity-80 transition-opacity"
                                                                style={{ color: optionTextColor }}
                                                                onMouseEnter={(e) => { e.target.style.color = optionHoverColor; }}
                                                                onMouseLeave={(e) => { e.target.style.color = optionTextColor; }}
                                                            >
                                                                {valueLabel}
                                                            </Label>
                                                        </div>
                                                        <span className="text-xs" style={{ color: optionCountColor }}>
                                                            ({productCount})
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {hasMoreValues && (
                                            <button
                                                onClick={isEditMode ? () => {} : () => setExpandedAttributes(prev => ({
                                                    ...prev,
                                                    [code]: !prev[code]
                                                }))}
                                                disabled={isEditMode}
                                                className={`text-sm font-medium mt-2 hover:opacity-80 transition-opacity ${isEditMode ? "pointer-events-none" : ""}`}
                                                style={{ color: checkboxColor }}
                                            >
                                                {isExpanded
                                                    ? t('common.show_less', 'Show Less')
                                                    : `${t('common.show_more', 'Show More')} (${values.length - maxVisibleAttributes} ${t('common.more', 'more')})`
                                                }
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            );
        })
    );

    return (
        <>
            {/* Mobile Filter Toggle - visible only on screens smaller than sm */}
            <div className="sm:hidden mb-4">
                <Button
                    variant="outline"
                    onClick={isEditMode ? () => {} : () => setIsFilterVisible(!isFilterVisible)}
                    disabled={isEditMode}
                    className={`w-full flex items-center justify-center gap-2 ${isEditMode ? "pointer-events-none" : ""}`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    {isFilterVisible && mobileFilterMode === 'collapse' ? t('common.hide_filters', 'Hide Filters') : t('common.filters', 'Filters')}
                    {hasActiveFilters && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {Object.keys(selectedFilters).length + (priceRange[0] !== minPrice || priceRange[1] !== maxPrice ? 1 : 0)}
                        </span>
                    )}
                </Button>
            </div>

            {/* Active Filters on Mobile (collapse mode only) - visible only on mobile screens below Filter button */}
            {mobileFilterMode === 'collapse' && (
                <div className="sm:hidden mb-4">
                    {renderActiveFilterBadges(true)}
                </div>
            )}

            {/* Slide Panel (when mobileFilterMode === 'slide') */}
            {mobileFilterMode === 'slide' && renderSlidePanel()}

            {/* Layered Navigation Card */}
            {/* For collapse mode: hidden on mobile unless toggled, always visible on sm+ */}
            {/* For slide mode: always hidden on mobile (uses slide panel), always visible on sm+ */}
            <Card className={`w-full ${
                mobileFilterMode === 'slide'
                    ? 'hidden sm:block'
                    : (isFilterVisible ? 'block' : 'hidden') + ' sm:block'
            }`}>
                <CardHeader>
                    <div className="flex justify-between items-center h-5">
                        {isEditMode ? (
                            <EditableSlotElement
                                slotKey="filter_by_label"
                                slot={childSlots?.filter_by_label || { content: 'Filter By' }}
                                onElementClick={onElementClick}
                                className="text-lg font-semibold"
                            >
                                Filter By
                            </EditableSlotElement>
                        ) : (
                            <CardTitle
                                className="text-lg font-semibold"
                                style={{
                                    color: filter_by_label.styles?.color || filter_card_header.styles?.color || '#1F2937',
                                    ...filter_by_label.styles,
                                    ...filter_card_header.styles
                                }}
                            >
                                {filter_by_label.content || filter_card_header.content || "Filter By"}
                            </CardTitle>
                        )}
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={isEditMode ? () => {} : clearAllFilters}
                                disabled={isEditMode}
                                className={`text-xs ${isEditMode ? "pointer-events-none" : ""}`}
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                {/* Active Filters - below Filter By title */}
                {showActiveFilters && hasActiveFilters && (
                    <div className="mb-4 p-2">
                        {renderActiveFilterBadges(false)}
                    </div>
                )}
                <Accordion
                    type="multiple"
                    defaultValue={collapseFilters ? [] : ['price', ...Object.keys(filterOptions)]}
                    className="w-full"
                >
                    {/* Price Slider */}
                    {renderPriceFilter()}

                    {/* Attribute Filters */}
                    {renderAttributeFilters()}
                </Accordion>
            </CardContent>
        </Card>
        </>
    );
}