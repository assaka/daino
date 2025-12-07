import React, { useState, useEffect } from 'react';
import { StorefrontProduct, StorefrontCustomOptionRule } from '@/api/storefront-entities';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, safeNumber, formatPriceWithTax, getPriceDisplay } from '@/utils/priceUtils';
import { getCurrentLanguage, getProductName, getProductShortDescription, getTranslatedField } from '@/utils/translationUtils';

export default function CustomOptions({
    product,
    onSelectionChange,
    selectedOptions = [],
    store,
    settings,
    colorTheme = {} // Allow customizable color theme
}) {

    // Default color theme with ability to override
    const theme = {
        selectedBorder: colorTheme.selectedBorder || 'border-blue-500',
        selectedBg: colorTheme.selectedBg || 'bg-blue-50',
        selectedCheckbox: colorTheme.selectedCheckbox || 'border-blue-500 bg-blue-500',
        unselectedCheckbox: colorTheme.unselectedCheckbox || 'border-gray-300',
        hoverBorder: colorTheme.hoverBorder || 'hover:border-gray-300',
        defaultBorder: colorTheme.defaultBorder || 'border-gray-200',
        saleBadgeBg: colorTheme.saleBadgeBg || 'bg-red-100',
        saleBadgeText: colorTheme.saleBadgeText || 'text-red-800',
        saleBadgeBorder: colorTheme.saleBadgeBorder || 'border-red-300'
    };

    const [customOptions, setCustomOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [displayLabel, setDisplayLabel] = useState('Custom Options');
    const [isLoading, setIsLoading] = useState(false); // Prevent duplicate loading
    const currentLang = getCurrentLanguage();

    useEffect(() => {

        if (product && store?.id && !isLoading) {
            loadCustomOptions();
        }
    }, [product?.id, store?.id]);

    const loadCustomOptions = async () => {

        if (!product || !store?.id || isLoading) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setIsLoading(true);

            // Fetch all active custom option rules for the store (using public API)
            let rules = [];
            try {
                rules = await StorefrontCustomOptionRule.filter({
                    store_id: store.id,
                    is_active: true
                });
            } catch (apiError) {
                console.error('Error fetching custom option rules:', apiError);
                setCustomOptions([]);
                setLoading(false);
                return;
            }

            // Find applicable rules for this product
            // Only evaluate rules if we have a valid product with an ID
            if (!product || !product.id) {
                setCustomOptions([]);
                setLoading(false);
                return;
            }

            const applicableRules = rules.filter(rule => isRuleApplicable(rule, product));

            if (applicableRules.length === 0) {
                setCustomOptions([]);
                setLoading(false);
                return;
            }

            // Use the first applicable rule (you could enhance this to merge multiple rules)
            const rule = applicableRules[0];

            // Get translated display label using standardized translation utility
            const translatedLabel = getTranslatedField(rule, 'display_label', currentLang) || 'Custom Options';
            setDisplayLabel(translatedLabel);

            // Load the custom option products
            if (rule.optional_product_ids && rule.optional_product_ids.length > 0) {
                try {
                    // Load products individually if $in syntax doesn't work
                    const optionProducts = [];
                    for (const productId of rule.optional_product_ids) {
                        // Skip if this is the current product being viewed
                        if (productId === product.id) {
                            continue;
                        }

                        try {
                            const products = await StorefrontProduct.filter({
                                id: productId,
                                status: 'active'
                            });

                            if (products && products.length > 0) {
                                const customOptionProduct = products[0];

                                // Product is in the rule's optional_product_ids, so it should show
                                // No need to check is_custom_option flag - being in the rule is sufficient

                                // Check stock availability - only check products.stock_quantity and products.infinite_stock
                                const trackStock = settings?.track_stock !== false; // Default to true

                                const isInStock = trackStock
                                    ? (customOptionProduct.infinite_stock === true || customOptionProduct.stock_quantity > 0)
                                    : true; // If not tracking stock, always show

                                // Only add to optionProducts if in stock
                                if (isInStock) {
                                    optionProducts.push(customOptionProduct);
                                }
                            }
                        } catch (productError) {
                            console.error(`Failed to load custom option product ${productId}:`, productError);
                        }
                    }

                    setCustomOptions(optionProducts);
                } catch (error) {
                    console.error('Error loading custom option products:', error);
                    setCustomOptions([]);
                }
            } else {
                setCustomOptions([]);
            }
        } catch (error) {
            console.error('Error loading custom options:', error);
            setCustomOptions([]);
        } finally {
            setLoading(false);
            setIsLoading(false);
        }
    };

    const isRuleApplicable = (rule, product) => {

        // Parse conditions if they're a string
        let conditions;
        try {
            conditions = typeof rule.conditions === 'string'
                ? JSON.parse(rule.conditions)
                : rule.conditions;
        } catch (e) {
            console.error('Failed to parse conditions:', e);
            return false;
        }

        // Check if rule has any conditions at all
        const { categories, attribute_sets, skus, attribute_conditions } = conditions || {};
        const hasCategories = categories && Array.isArray(categories) && categories.length > 0;
        const hasAttributeSets = attribute_sets && Array.isArray(attribute_sets) && attribute_sets.length > 0;
        const hasSkus = skus && Array.isArray(skus) && skus.length > 0;
        const hasAttributeConditions = attribute_conditions && Array.isArray(attribute_conditions) && attribute_conditions.length > 0;
        const hasAnyConditions = hasCategories || hasAttributeSets || hasSkus || hasAttributeConditions;

        // If no conditions are set, rule applies to ALL products
        if (!hasAnyConditions) {
            return true;
        }

        // Check category conditions
        if (hasCategories) {
            const productCategories = product.category_ids || [];
            const hasMatchingCategory = categories.some(catId => productCategories.includes(catId));
            if (hasMatchingCategory) {
                return true;
            }
        }

        // Check attribute set conditions
        if (hasAttributeSets) {
            if (attribute_sets.includes(product.attribute_set_id)) {
                return true;
            }
        }

        // Check SKU conditions
        if (hasSkus) {
            if (skus.includes(product.sku)) {
                return true;
            }
        }

        // Check attribute conditions
        if (hasAttributeConditions) {
            for (const condition of attribute_conditions) {
                const productValue = product[condition.attribute_code];
                const match = productValue && productValue.toString() === condition.attribute_value.toString();
                if (match) {
                    return true;
                }
            }
        }

        return false;
    };

    const handleOptionToggle = (option) => {
        const isSelected = selectedOptions.some(selected => selected.product_id === option.id);

        let newSelectedOptions;
        if (isSelected) {
            // Remove option
            newSelectedOptions = selectedOptions.filter(selected => selected.product_id !== option.id);
        } else {
            // Use centralized getPriceDisplay utility for consistent pricing
            const priceInfo = getPriceDisplay(option);
            newSelectedOptions = [...selectedOptions, {
                product_id: option.id,
                name: getProductName(option, currentLang) || option.name,
                price: priceInfo.displayPrice
            }];
        }

        onSelectionChange(newSelectedOptions);
    };

    const getTotalOptionsPrice = () => {
        return selectedOptions.reduce((total, option) => total + safeNumber(option.price), 0);
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </div>
        );
    }

    if (!customOptions || customOptions.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">{displayLabel}</h3>
            <div className="space-y-3">
                {customOptions.map(option => {
                    const isSelected = selectedOptions.some(selected => selected.product_id === option.id);

                    // Use centralized getPriceDisplay utility for consistent pricing
                    const priceInfo = getPriceDisplay(option);
                    const displayPrice = priceInfo.displayPrice;
                    const originalPrice = priceInfo.hasComparePrice ? priceInfo.originalPrice : null;
                    
                    return (
                        <div
                            key={option.id}
                            className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                                isSelected
                                    ? `${theme.selectedBorder} ${theme.selectedBg} shadow-sm`
                                    : `${theme.defaultBorder} ${theme.hoverBorder} hover:shadow-sm`
                            }`}
                            onClick={() => handleOptionToggle(option)}
                        >
                            <div className="flex items-start space-x-3">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    isSelected ? theme.selectedCheckbox : theme.unselectedCheckbox
                                }`}>
                                    {isSelected && (
                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                    )}
                                </div>

                                {/* Image and Content Container */}
                                <div className="flex-1 flex items-start space-x-3">
                                    {/* Product Image */}
                                    {option.images && option.images.length > 0 && (
                                        <div className="flex-shrink-0">
                                            <img
                                                src={
                                                    typeof option.images[0] === 'string'
                                                        ? option.images[0]
                                                        : option.images[0]?.url || option.images[0]?.src || 'https://placehold.co/64x64?text=No+Image'
                                                }
                                                alt={getProductName(option, currentLang) || option.name}
                                                className="w-16 h-16 object-cover rounded-md"
                                                onError={(e) => {
                                                    e.target.src = 'https://placehold.co/64x64?text=No+Image';
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Product Info */}
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900">
                                                    {getProductName(option, currentLang) || option.name}
                                                </h4>
                                                {(getProductShortDescription(option, currentLang) || option.short_description) && (
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {getProductShortDescription(option, currentLang) || option.short_description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="ml-4 flex-shrink-0">
                                                {priceInfo.hasComparePrice ? (
                                                    <div className="text-right">
                                                        <div className="flex items-center space-x-2">
                                                            <Badge variant={isSelected ? "default" : "outline"} className={`font-semibold ${theme.saleBadgeBg} ${theme.saleBadgeText} ${theme.saleBadgeBorder}`}>
                                                                +{formatPriceWithTax(displayPrice)}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-xs text-gray-500 line-through mt-1">
                                                            +{formatPriceWithTax(originalPrice)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Badge variant={isSelected ? "default" : "outline"} className="font-semibold">
                                                        +{formatPriceWithTax(displayPrice)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}