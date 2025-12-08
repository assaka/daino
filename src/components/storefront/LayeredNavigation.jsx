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
import { useTranslation } from '@/contexts/TranslationContext';
import { getCurrentLanguage } from '@/utils/translationUtils';

// Helper component to render editable slot elements in edit mode
const EditableSlotElement = ({ slotKey, slot, onElementClick, children, className = "", style = {} }) => {
  if (!slot) {
    return children;
  }

  return (
    <div
      className={`slot-element ${className}`}
      data-slot-id={slotKey}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        outline: '1px dashed #ccc',
        padding: '2px 4px',
        borderRadius: '2px',
        ...style,
        ...slot.styles
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Pass slotKey and element as expected by createElementClickHandler(slotId, element)
        onElementClick(slotKey, e.currentTarget);
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
    showActiveFilters = true,
    slotConfig = {},
    settings = {},
    isEditMode = false,
    childSlots = {},
    onElementClick = () => {}
}) {
    const { t } = useTranslation();
    const [selectedFilters, setSelectedFilters] = useState({});
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
        activeFilterBgColor = '#DBEAFE',
        activeFilterTextColor = '#1E40AF'
    } = optionStyles;

    // Extract store settings with defaults
    const enableProductFilters = settings.enable_product_filters !== false; // Default to true
    const collapseFilters = settings.collapse_filters !== false
    const maxVisibleAttributes = settings.max_visible_attributes || 5;

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

    // FIXED: Send filters when they change
    useEffect(() => {
        const filtersToSend = { ...selectedFilters };
        
        // Only add price range if it's different from the full range
        if (priceRange[0] !== minPrice || priceRange[1] !== maxPrice) {
            filtersToSend.priceRange = priceRange;
        }
        
        
        onFilterChange(filtersToSend);
    }, [selectedFilters, priceRange, minPrice, maxPrice, onFilterChange]);
    
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
        setSelectedFilters({});
        setPriceRange([minPrice, maxPrice]);
    };

    // Handle price range change with debugging
    const handlePriceRangeChange = (newRange) => {
        setPriceRange(newRange);
    };

    // Check if any filters are active
    const hasActiveFilters = Object.keys(selectedFilters).length > 0 ||
                           (priceRange[0] !== minPrice || priceRange[1] !== maxPrice);


    // Extract attribute values from products with normalized format support
    const filterOptions = useMemo(() => {
        if (!products || !attributes) {
            return {};
        }

        const currentLang = getCurrentLanguage();
        const options = {};
        attributes.forEach(attr => {
            if (attr.is_filterable) {
                const values = new Set();

                // Add values from products
                products.forEach(p => {
                    const productAttributes = p.attributes;

                    // Handle normalized format (array of objects with code/label/value)
                    if (Array.isArray(productAttributes)) {
                        const matchingAttr = productAttributes.find(pAttr =>
                            pAttr.code === attr.code
                        );

                        if (matchingAttr) {
                            // Use rawValue (code) if available, otherwise fall back to value (translated label)
                            // This matches the logic in Category.jsx buildFilters()
                            const productValue = matchingAttr.rawValue || matchingAttr.value;
                            if (productValue) {
                                values.add(String(productValue));
                            }
                        }
                    }
                });

                // Only include attributes that have values with products
                if (values.size > 0) {
                    const sortedValues = Array.from(values).sort();

                    // Filter out values that have no products
                    const valuesWithProducts = sortedValues.filter(value => {
                        const productCount = products.filter(p => {
                            const productAttributes = p.attributes;

                            // Handle normalized format (array of objects)
                            if (Array.isArray(productAttributes)) {
                                const matchingAttr = productAttributes.find(pAttr =>
                                    pAttr.code === attr.code
                                );
                                // Use rawValue (code) if available, otherwise fall back to value (translated label)
                                // This matches the logic in Category.jsx buildFilters()
                                const productValue = String(matchingAttr?.rawValue || matchingAttr?.value || '');
                                return matchingAttr && productValue === String(value);
                            }
                            return false;
                        }).length;

                        return productCount > 0;
                    });

                    // Only include this attribute if it has values with products
                    if (valuesWithProducts.length > 0) {
                        // Use attr.label - already translated by backend (publicAttributes.js)
                        // Backend returns: label: requestedLang?.label || englishLang?.label || attr.code
                        options[attr.code] = {
                            name: attr.label || attr.code,
                            values: valuesWithProducts,
                            filterType: attr.filter_type || 'multiselect' // Default to multiselect (checkboxes)
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

    return (
        <>
            {/* Mobile Filter Toggle - visible only on screens smaller than sm */}
            <div className="sm:hidden mb-4">
                <Button
                    variant="outline"
                    onClick={isEditMode ? () => {} : () => setIsFilterVisible(!isFilterVisible)}
                    disabled={isEditMode}
                    className={`w-full ${isEditMode ? "pointer-events-none" : ""}`}
                >
                    {isFilterVisible ? 'Hide Filters' : 'Filters'}
                </Button>
            </div>

            {/* Active Filters on Mobile - visible only on mobile screens below Filter button */}
            {showActiveFilters && hasActiveFilters && (
                <div className="sm:hidden mb-4">
                    <div className="flex flex-wrap gap-2">
                        {(() => {
                            const activeFilterElements = [];

                            // Add active attribute filters
                            Object.entries(selectedFilters).forEach(([filterKey, filterValues]) => {
                                if (filterKey !== 'priceRange' && Array.isArray(filterValues)) {
                                    filterValues.forEach(value => {
                                        // Ensure value is a string to prevent React error #300
                                        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                                        activeFilterElements.push(
                                            <span
                                                key={`mobile-${filterKey}-${displayValue}`}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-xs"
                                                style={{
                                                    backgroundColor: activeFilterBgColor,
                                                    color: activeFilterTextColor
                                                }}
                                            >
                                                {filterKey}: {displayValue}
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
                                                    style={{
                                                        color: activeFilterTextColor
                                                    }}
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
                                        key="mobile-price-range"
                                        className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800"
                                    >
                                        Price: ${min} - ${max}
                                        <button
                                            onClick={isEditMode ? () => {} : () => {
                                                setPriceRange([minPrice, maxPrice]);
                                            }}
                                            disabled={isEditMode}
                                            className={`text-lg ml-2 text-green-600 hover:text-green-800 ${isEditMode ? "pointer-events-none" : ""}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            }

                            return activeFilterElements;
                        })()}
                    </div>
                </div>
            )}

            {/* Layered Navigation - hidden on mobile unless toggled, always visible on sm+ */}
            <Card className={`w-full ${isFilterVisible ? 'block' : 'hidden'} sm:block`}>
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
                        <div className="flex flex-wrap items-center">
                            {(() => {
                                const activeFilterElements = [];

                                // Add active attribute filters
                                Object.entries(selectedFilters).forEach(([filterKey, filterValues]) => {
                                    if (filterKey !== 'priceRange' && Array.isArray(filterValues)) {
                                        filterValues.forEach(value => {
                                            // Ensure value is a string to prevent React error #300
                                            const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                                            activeFilterElements.push(
                                                <span
                                                    key={`${filterKey}-${displayValue}`}
                                                    className="inline-flex items-center px-2 rounded-full text-xs mr-2 mb-2"
                                                    style={{
                                                        backgroundColor: activeFilterBgColor,
                                                        color: activeFilterTextColor
                                                    }}
                                                >
                                                    {filterKey}: {displayValue}
                                                    <button
                                                        onClick={() => {
                                                            const newValues = filterValues.filter(v => v !== value);
                                                            const newFilters = { ...selectedFilters };
                                                            if (newValues.length > 0) {
                                                                newFilters[filterKey] = newValues;
                                                            } else {
                                                                delete newFilters[filterKey];
                                                            }
                                                            setSelectedFilters(newFilters);
                                                        }}
                                                        className="text-xl ml-2 hover:opacity-80 transition-opacity"
                                                        style={{
                                                            color: activeFilterTextColor
                                                        }}
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
                                            key="price-range"
                                            className="inline-flex items-center px-2 rounded-full text-xs bg-green-100 text-green-800 mr-2 mb-2"
                                        >
                                            Price: ${min} - ${max}
                                            <button
                                                onClick={() => {
                                                    setPriceRange([minPrice, maxPrice]);
                                                }}
                                                className="text-xl ml-2 text-green-600 hover:text-green-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    );
                                }

                                return activeFilterElements;
                            })()}
                        </div>
                    </div>
                )}
                <Accordion
                    type="multiple"
                    defaultValue={collapseFilters ? [] : ['price', ...Object.keys(filterOptions)]}
                    className="w-full"
                >
                    {/* FIXED: Price Slider */}
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
                                filter_price_title.content || "Price"
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

                    {/* FIXED: Attribute Filters with all options */}
                    {Object.entries(filterOptions).map(([code, { name, values, filterType }]) => {
                        // Determine if this is a single-select (radio) or multi-select (checkbox) filter
                        const isRadioFilter = filterType === 'select';
                        // Only render attribute sections that have values
                        if (!values || values.length === 0) {
                            return null;
                        }

                        return (
                            <AccordionItem key={code} value={code}>
                                <AccordionTrigger
                                    className="font-semibold"
                                    style={{
                                        color: isEditMode ? 'inherit' : (
                                            // Try shared attribute_filter_label first, then individual label, then default
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
                                                // Apply shared styles from attribute_filter_label or individual label
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
                                <div
                                    className="space-y-2"
                                >
                                    {(() => {
                                        const isExpanded = expandedAttributes[code];
                                        const visibleValues = isExpanded ? values : values.slice(0, maxVisibleAttributes);
                                        const hasMoreValues = values.length > maxVisibleAttributes;

                                        return (
                                            <>
                                                <div className={hasMoreValues && !isExpanded ? "max-h-48 overflow-hidden" : "max-h-48 overflow-y-auto"}>
                                                    {visibleValues.map(rawValue => {
                                        // Ensure value is a string to prevent React error #300
                                        const value = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);
                                        // Count products that have this attribute value
                                        const productCount = products.filter(p => {
                                            const productAttributes = p.attributes;

                                            // Handle normalized format (array of objects)
                                            if (Array.isArray(productAttributes)) {
                                                const matchingAttr = productAttributes.find(pAttr =>
                                                    pAttr.code === code
                                                );
                                                // Use rawValue (code) if available, otherwise fall back to value (translated label)
                                                // This matches the logic in Category.jsx buildFilters()
                                                const productValue = String(matchingAttr?.rawValue || matchingAttr?.value || '');
                                                return matchingAttr && productValue === String(rawValue);
                                            }
                                            return false;
                                        }).length;

                                        // Only render if there are products with this attribute value
                                        if (productCount === 0) {
                                            return null;
                                        }

                                        return (
                                            <div
                                                key={value}
                                                className="flex items-center justify-between"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    {isEditMode ? (
                                                        <EditableSlotElement
                                                            slotKey="filter_option_styles"
                                                            slot={childSlots?.filter_option_styles}
                                                            onElementClick={onElementClick}
                                                            className=""
                                                        >
                                                            {isRadioFilter ? (
                                                                <input
                                                                    type="radio"
                                                                    id={`attr-${code}-${value}`}
                                                                    name={`attr-${code}`}
                                                                    checked={selectedFilters[code]?.includes(rawValue) || false}
                                                                    onChange={() => {}}
                                                                    disabled={true}
                                                                    className="pointer-events-none h-4 w-4"
                                                                    style={{
                                                                        accentColor: checkboxColor
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Checkbox
                                                                    id={`attr-${code}-${value}`}
                                                                    checked={selectedFilters[code]?.includes(rawValue) || false}
                                                                    onCheckedChange={() => {}}
                                                                    disabled={true}
                                                                    className="pointer-events-none"
                                                                    style={{
                                                                        accentColor: checkboxColor
                                                                    }}
                                                                />
                                                            )}
                                                        </EditableSlotElement>
                                                    ) : (
                                                        isRadioFilter ? (
                                                            <input
                                                                type="radio"
                                                                id={`attr-${code}-${value}`}
                                                                name={`attr-${code}`}
                                                                checked={selectedFilters[code]?.includes(rawValue) || false}
                                                                onChange={(e) => handleAttributeChange(code, rawValue, e.target.checked, filterType)}
                                                                className="h-4 w-4 cursor-pointer"
                                                                style={{
                                                                    accentColor: checkboxColor
                                                                }}
                                                            />
                                                        ) : (
                                                            <Checkbox
                                                                id={`attr-${code}-${value}`}
                                                                checked={selectedFilters[code]?.includes(rawValue) || false}
                                                                onCheckedChange={(checked) => handleAttributeChange(code, rawValue, checked, filterType)}
                                                                disabled={false}
                                                                className=""
                                                                style={{
                                                                    accentColor: checkboxColor
                                                                }}
                                                            />
                                                        )
                                                    )}
                                                    <Label
                                                        htmlFor={`attr-${code}-${value}`}
                                                        className="text-sm cursor-pointer hover:opacity-80 transition-opacity"
                                                        style={{
                                                            color: optionTextColor
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.target.style.color = optionHoverColor;
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.style.color = optionTextColor;
                                                        }}
                                                    >
                                                        {value}
                                                    </Label>
                                                </div>
                                                <span
                                                    className="text-xs"
                                                    style={{
                                                        color: optionCountColor
                                                    }}
                                                >
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
                                                        style={{
                                                            color: checkboxColor
                                                        }}
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
                    })}
                </Accordion>
            </CardContent>
        </Card>
        </>
    );
}