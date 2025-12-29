import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { createPublicUrl, createCategoryUrl } from '@/utils/urlUtils';
import { useStore } from '@/components/storefront/StoreProvider';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { getCategoryName, getCurrentLanguage } from '@/utils/translationUtils';
import { useTranslation } from '@/contexts/TranslationContext';

export default function CategoryNav({ categories, styles = {}, metadata = {}, store: storeProp = null, isEditor = false, isMobile: isMobileProp = null, onLinkClick = null }) {
    const storeContext = useStore();
    const store = storeProp || storeContext?.store;
    const { t } = useTranslation();

    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [isMobile, setIsMobile] = useState(isMobileProp !== null ? isMobileProp : false);
    const [hoveredSubmenuItem, setHoveredSubmenuItem] = useState(null);

    // Extract styles from slot configuration
    const linkStyles = {
        color: styles?.color || '#374151',
        fontSize: styles?.fontSize || '0.875rem',
        fontWeight: styles?.fontWeight || '500',
    };

    const hoverColor = styles?.hoverColor || '#2563EB';
    const hoverBgColor = styles?.hoverBackgroundColor || '#f3f4f6';

    // Subcategory styles from metadata
    const subcategoryLinkColor = metadata?.subcategoryLinkColor || '#6B7280';
    const subcategoryLinkHoverColor = metadata?.subcategoryLinkHoverColor || '#2563EB';
    const subcategoryBgColor = metadata?.subcategoryBgColor || '#ffffff';
    const subcategoryBgHoverColor = metadata?.subcategoryBgHoverColor || '#F3F4F6';

    if (!store) {
        return null;
    }

    if (!categories || categories.length === 0) {
        // Don't return null - still show the Home link at least
    }

    // Detect mobile/desktop
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // Check if all menu items should be expanded by default
    // On mobile, always use expandAllMenuItems = false
    const expandAllMenuItems = isMobile ? false : (store?.settings?.expandAllMenuItems || false);
    
    // Reset expanded categories when expandAllMenuItems setting changes
    useEffect(() => {
        if (!expandAllMenuItems) {
            // Clear all expanded categories when the setting is disabled
            setExpandedCategories(new Set());
        }
    }, [expandAllMenuItems]);
    
    const toggleCategory = (categoryId) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };
//
    // Helper function to find a category by ID in a tree structure (recursive)
    const findCategoryInTree = (cats, targetId) => {
        if (!cats || !targetId) return null;
        const targetIdStr = String(targetId);

        for (const cat of cats) {
            if (String(cat.id) === targetIdStr) {
                return cat;
            }
            if (cat.children && cat.children.length > 0) {
                const found = findCategoryInTree(cat.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };

    // Build hierarchical tree from flat category list OR use existing tree
    const buildCategoryTree = (categories) => {
        if (!categories || categories.length === 0) return [];

        // Check if categories are already in tree format (have children property)
        const isAlreadyTree = categories.some(c => c.children && Array.isArray(c.children));

        // Get settings for easier access (handle both boolean and string values)
        const rootCategoryId = store?.settings?.rootCategoryId;
        const excludeRootFromMenu = store?.settings?.excludeRootFromMenu === true || store?.settings?.excludeRootFromMenu === 'true';

        // If already a tree AND we have a root category selected
        if (isAlreadyTree && rootCategoryId && rootCategoryId !== 'none') {
            // Find the root category (search recursively in case it's nested)
            const rootCategory = findCategoryInTree(categories, rootCategoryId);

            if (rootCategory) {
                if (excludeRootFromMenu) {
                    // Return children of root category (excludes the root itself)
                    return (rootCategory.children || []).filter(c => !c.hide_in_menu);
                } else {
                    // Include root category in the tree
                    return [rootCategory].filter(c => !c.hide_in_menu);
                }
            }
            // Root category not found - log warning and fall through to default behavior
            console.warn('Root category not found in tree:', rootCategoryId);
        }

        // If already a tree (no root category filtering needed), filter hidden and return
        if (isAlreadyTree) {
            return categories.filter(c => !c.hide_in_menu);
        }

        // Otherwise, build tree from flat structure (legacy behavior)
        const categoryMap = new Map();
        const rootCategories = [];

        // Filter out hidden categories first
        let visibleCategories = categories.filter(c => !c.hide_in_menu);

        // If store has a root category, filter to only show that category tree
        if (rootCategoryId && rootCategoryId !== 'none') {
            const rootCategoryIdStr = String(rootCategoryId);

            const filterCategoryTree = (categoryId, allCategories) => {
                const categoryIdStr = String(categoryId);
                const children = allCategories.filter(c => String(c.parent_id) === categoryIdStr);
                let result = children.slice(); // Copy array

                children.forEach(child => {
                    result = result.concat(filterCategoryTree(child.id, allCategories));
                });

                return result;
            };

            // Include the root category itself and all its descendants
            const rootCategory = visibleCategories.find(c => String(c.id) === rootCategoryIdStr);
            if (rootCategory) {
                const descendants = filterCategoryTree(rootCategoryId, visibleCategories);

                // Check if we should exclude root category from menu
                if (excludeRootFromMenu) {
                    visibleCategories = descendants; // Only show descendants, not the root
                } else {
                    visibleCategories = [rootCategory, ...descendants]; // Include root and descendants
                }
            } else {
                // If root category not found, show empty navigation
                console.warn('Root category not found:', rootCategoryId);
                visibleCategories = [];
            }
        }


        // Create a map of all visible categories
        visibleCategories.forEach(category => {
            categoryMap.set(category.id, { ...category, children: [] });
        });

        // Build the tree structure
        visibleCategories.forEach(category => {
            const categoryNode = categoryMap.get(category.id);
            if (category.parent_id && categoryMap.has(category.parent_id)) {
                // This category has a parent, add it to parent's children
                const parent = categoryMap.get(category.parent_id);
                parent.children.push(categoryNode);
            } else {
                // This is a root category
                rootCategories.push(categoryNode);
            }
        });

        return rootCategories;
    };

    const rootCategories = buildCategoryTree(categories);

    // Helper function to build the full category path from root to a specific category
    const buildCategoryPath = (targetCategory, allCategories) => {
        if (!targetCategory || !targetCategory.slug) {
            console.warn('buildCategoryPath: Invalid target category', targetCategory);
            return [targetCategory?.slug || ''].filter(Boolean);
        }

        const path = [];
        let current = targetCategory;
        const visited = new Set(); // Prevent infinite loops

        // Build path from target up to root
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            path.unshift(current.slug);

            if (current.parent_id) {
                current = allCategories.find(c => c.id === current.parent_id);
            } else {
                break;
            }
        }

        // Filter out root categories (categories with no parent_id)
        // Keep all categories that have a parent (are not root level)
        const filteredPath = [];
        for (const slug of path) {
            const cat = allCategories.find(c => c.slug === slug);
            if (cat && cat.parent_id !== null) {
                filteredPath.push(slug);
            }
        }

        // If no valid path found, fallback to just the target category
        if (filteredPath.length === 0) {
            return [targetCategory.slug];
        }

        return filteredPath;
    };

    // Render all descendants of a category with proper indentation
    const renderCategoryDescendants = (category, depth = 0, isDropdown = true) => {
        const items = [];

        // Add the category itself
        if (isDropdown) {
            items.push(
                <DropdownMenuItem key={category.id} asChild>
                    <Link
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="w-full transition-colors"
                        style={{
                            paddingLeft: `${depth * 16 + 12}px`,
                            color: subcategoryLinkColor,
                            backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = subcategoryLinkHoverColor;
                            e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = subcategoryLinkColor;
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                    </Link>
                </DropdownMenuItem>
            );
        } else {
            items.push(
                <Link
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block w-full px-3 py-2 text-sm transition-colors"
                    style={{
                        paddingLeft: `${depth * 16 + 12}px`,
                        color: subcategoryLinkColor,
                        backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = subcategoryLinkHoverColor;
                        e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = subcategoryLinkColor;
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
        
        // Add all children recursively
        if (category.children && category.children.length > 0) {
            category.children.forEach(child => {
                items.push(...renderCategoryDescendants(child, depth + 1, isDropdown));
            });
        }
        
        return items;
    };

    // Render always-expanded category tree
    const renderExpandedCategory = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);

        // Handle click on category name - if has children, toggle subcategories; otherwise navigate
        const handleCategoryClick = (e) => {
            if (hasChildren) {
                e.preventDefault();
                toggleCategory(category.id);
            } else {
                onLinkClick?.();
            }
        };

        return (
            <div key={category.id} className="block">
                <div className="flex items-center justify-between">
                    <Link
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="text-sm font-medium transition-colors px-2 py-2 rounded-md flex-1 touch-manipulation"
                        style={{
                            marginLeft: `${depth * 16}px`,
                            color: linkStyles.color
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = hoverColor;
                            e.currentTarget.style.backgroundColor = hoverBgColor;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = linkStyles.color;
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={handleCategoryClick}
                    >
                        {getCategoryName(category, getCurrentLanguage())}
                    </Link>
                    {hasChildren && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCategory(category.id)}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                toggleCategory(category.id);
                            }}
                            className="p-1 h-auto touch-manipulation float-right transition-colors"
                            style={{ color: linkStyles.color }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = hoverBgColor;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            aria-label={isExpanded ? `Collapse ${getCategoryName(category, getCurrentLanguage())}` : `Expand ${getCategoryName(category, getCurrentLanguage())}`}
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                            ) : (
                                <ChevronRight className="w-3 h-3" />
                            )}
                        </Button>
                    )}
                </div>
                {hasChildren && isExpanded && (
                    <div className="ml-4">
                        {/* View All link - shows all products from this category and subcategories */}
                        <Link
                            to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                            className="text-sm font-medium transition-colors px-2 py-2 rounded-md block touch-manipulation"
                            style={{
                                marginLeft: `${(depth + 1) * 16}px`,
                                color: hoverColor
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = hoverBgColor;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => onLinkClick?.()}
                        >
                            {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                        </Link>
                        {category.children.map(child => renderExpandedCategory(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Render category with children as dropdown (collapsible mode)
    const renderCategoryWithChildren = (category) => {
        if (category.children && category.children.length > 0) {
            return (
                <DropdownMenu key={category.id}>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            variant="ghost" 
                            className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 rounded-md h-auto flex items-center whitespace-nowrap"
                        >
                            <span>{getCategoryName(category, getCurrentLanguage())}</span>
                            <ChevronDown className="w-3 h-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 max-h-96 overflow-y-auto z-[9999] border border-gray-200 shadow-lg" style={{ backgroundColor: subcategoryBgColor }}>
                        <DropdownMenuItem asChild>
                            <Link
                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                className="w-full font-medium border-b border-gray-200 pb-2 mb-2 transition-colors"
                                style={{ color: subcategoryLinkColor }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = subcategoryLinkHoverColor;
                                    e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = subcategoryLinkColor;
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                            </Link>
                        </DropdownMenuItem>
                        {category.children.map(child => renderCategoryDescendants(child, 0))}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        } else {
            // Regular category without children
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))} 
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 rounded-md whitespace-nowrap"
                >
                    {getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render desktop hover-based category with absolute positioned submenu
    const renderDesktopHoverCategory = (category) => {
        if (category.children && category.children.length > 0) {
            return (
                <div key={category.id} className="relative group">
                    <Link
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="px-3 py-2 rounded-md inline-flex items-center whitespace-nowrap transition-colors"
                        style={linkStyles}
                        onMouseEnter={(e) => e.currentTarget.style.color = hoverColor}
                        onMouseLeave={(e) => e.currentTarget.style.color = linkStyles.color}
                    >
                        {getCategoryName(category, getCurrentLanguage())}
                        <ChevronDown className="w-3 h-3" />
                    </Link>

                    {/* Submenu - absolutely positioned to avoid layout shifts */}
                    <div
                        className="absolute left-0 top-full w-64 border border-gray-200 rounded-md shadow-lg z-[9999] invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200"
                        style={{ backgroundColor: subcategoryBgColor }}
                    >
                        <div>
                            <Link
                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                className="block px-4 py-2 text-sm font-medium border-b border-gray-200 transition-colors"
                                style={{ color: subcategoryLinkColor, backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = subcategoryLinkHoverColor;
                                    e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = subcategoryLinkColor;
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                            </Link>
                            {category.children.map(child => renderDesktopSubmenuItem(child, 0))}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Regular category without children
            return (
                <Link
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="px-3 py-2 rounded-md whitespace-nowrap transition-colors"
                    style={linkStyles}
                    onMouseEnter={(e) => e.currentTarget.style.color = hoverColor}
                    onMouseLeave={(e) => e.currentTarget.style.color = linkStyles.color}
                >
                    {getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render submenu items with full flat indentation (for expandAllMenuItems = true)
    const renderDesktopSubmenuItem = (category, depth = 0) => {
        const items = [];

        // Add the category itself
        items.push(
            <Link
                key={category.id}
                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                className="block px-4 py-2 text-sm transition-colors"
                style={{
                    paddingLeft: `${16 + depth * 12}px`,
                    color: subcategoryLinkColor,
                    backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.color = subcategoryLinkHoverColor;
                    e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.color = subcategoryLinkColor;
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
            </Link>
        );
        
        // Add all children recursively with increased indentation
        if (category.children && category.children.length > 0) {
            category.children.forEach(child => {
                items.push(...renderDesktopSubmenuItem(child, depth + 1));
            });
        }
        
        return items;
    };

    // Render submenu items with hover expansion for all levels
    const renderDesktopSubmenuItemWithControl = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isSecondLevel = depth === 0; // First level under main categories
        
        if (hasChildren) {
            // Category with children - create hover submenu
            return (
                <div key={category.id} className="relative group">
                    <Link 
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        style={{ paddingLeft: `${16 + depth * 12}px` }}
                    >
                        <span>{depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}</span>
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                    
                    {/* Nested submenu - appears on hover to the right */}
                    <div className="absolute left-full top-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
                        <div>
                            <Link 
                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                className="block px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 border-b border-gray-200"
                            >
                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                            </Link>
                            {/* Show children - expandAllMenuItems controls second-level visibility */}
                            {(isSecondLevel && expandAllMenuItems) || !isSecondLevel ? (
                                // Show children if not second level, or if second level and expandAllMenuItems is true
                                category.children.map(child => renderDesktopSubmenuItemWithControl(child, depth + 1))
                            ) : (
                                // Second level with expandAllMenuItems = false: show children but they won't show their grandchildren
                                category.children.map(child => renderDesktopSubmenuItemSimple(child, depth + 1))
                            )}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Regular category without children
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render ONLY the direct child in main menu (no grandchildren shown)
    const renderDirectChildOnlyInMainMenu = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        
        if (hasChildren) {
            // Category with children - show with chevron, children appear only on hover in side submenu
            return (
                <div key={category.id} className="relative group">
                    <Link 
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        style={{ paddingLeft: `${16 + depth * 12}px` }}
                    >
                        <span>{depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}</span>
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                    
                    {/* Side submenu - shows this category's children on hover */}
                    <div className="absolute left-full top-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
                        <div>
                            <Link 
                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                className="block px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 border-b border-gray-200"
                            >
                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                            </Link>
                            {/* Show children using the recursive version that can expand further */}
                            {category.children.map(child => renderDirectChildSimple(child, 0))}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Regular category without children - simple link
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render only the direct child as simple hoverable item (for main dropdown with expandAllMenuItems = false)
    const renderDirectChildSimple = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        
        if (hasChildren) {
            // Category with children - show with chevron, children appear only on hover in side submenu
            return (
                <div key={category.id} className="relative group">
                    <Link 
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        style={{ paddingLeft: `${16 + depth * 12}px` }}
                    >
                        <span>{depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}</span>
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                    
                    {/* Side submenu - shows this category's direct children on hover */}
                    <div className="absolute left-full top-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
                        <div>
                            <Link 
                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                className="block px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 border-b border-gray-200"
                            >
                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                            </Link>
                            {/* Recursively render children - they can also have their own hover submenus */}
                            {category.children.map(child => renderDirectChildSimple(child, 0))}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Regular category without children - simple link
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render only the direct child (for main dropdown with expandAllMenuItems = false)
    const renderDirectChildOnly = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        
        if (hasChildren) {
            // Category with children - show with chevron, but children only appear on its own hover
            return (
                <div key={category.id} className="relative group">
                    <Link 
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        style={{ paddingLeft: `${16 + depth * 12}px` }}
                    >
                        <span>{depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}</span>
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                    
                    {/* Nested submenu - appears on hover to the right, shows only this category's direct children */}
                    <div className="absolute left-full top-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
                        <div>
                            <Link 
                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                className="block px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 border-b border-gray-200"
                            >
                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                            </Link>
                            {/* Show only direct children of this category */}
                            {category.children.map(child => renderDirectChildOnly(child, 0))}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Regular category without children
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render simple child link with chevrons for items with children, but NO hover functionality (for main dropdown when expandAllMenuItems = false)
    const renderSimpleChildLink = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        
        if (hasChildren) {
            // Category with children - show with chevron but NO hover submenu
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    <span>{depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}</span>
                    <ChevronRight className="w-3 h-3" />
                </Link>
            );
        } else {
            // Regular category without children - simple link
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render direct children with chevrons for items with children, and JavaScript-controlled hover side menus
    const renderDirectChildrenOnly = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        
        if (hasChildren) {
            // Category with children - show WITH chevron AND JavaScript-controlled hover submenu for direct children only
            return (
                <div 
                    key={category.id} 
                    className="relative"
                    onMouseEnter={(e) => {
                        e.stopPropagation();
                        setHoveredSubmenuItem(category.id);
                    }}
                    onMouseLeave={(e) => {
                        e.stopPropagation();
                        setHoveredSubmenuItem(null);
                    }}
                >
                    <Link
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="flex items-center justify-between px-4 py-2 text-sm transition-colors"
                        style={{
                            paddingLeft: `${16 + depth * 12}px`,
                            color: subcategoryLinkColor,
                            backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = subcategoryLinkHoverColor;
                            e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = subcategoryLinkColor;
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <span>{depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}</span>
                        <ChevronRight className="w-3 h-3" />
                    </Link>

                    {/* Side submenu - shows ONLY this category's direct children when hoveredSubmenuItem matches */}
                    {hoveredSubmenuItem === category.id && (
                        <div className="absolute left-full top-0 w-64 border border-gray-200 rounded-md shadow-lg z-[60]"
                            style={{ backgroundColor: subcategoryBgColor }}
                        >
                            <div>
                                <Link
                                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                    className="block px-4 py-2 text-sm font-medium border-b border-gray-200 transition-colors"
                                    style={{ color: subcategoryLinkColor, backgroundColor: 'transparent' }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = subcategoryLinkHoverColor;
                                        e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = subcategoryLinkColor;
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                                </Link>
                                {/* Show direct children as simple links WITHOUT further hover capabilities */}
                                {category.children.map(child => (
                                    <Link
                                        key={child.id}
                                        to={createCategoryUrl(store.slug, buildCategoryPath(child, categories).join('/'))}
                                        className="block px-4 py-2 text-sm transition-colors"
                                        style={{ color: subcategoryLinkColor, backgroundColor: 'transparent' }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.color = subcategoryLinkHoverColor;
                                            e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.color = subcategoryLinkColor;
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        {getCategoryName(child, getCurrentLanguage())}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        } else {
            // Regular category without children - simple link without chevron
            return (
                <Link
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block px-4 py-2 text-sm transition-colors"
                    style={{
                        paddingLeft: `${16 + depth * 12}px`,
                        color: subcategoryLinkColor,
                        backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = subcategoryLinkHoverColor;
                        e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = subcategoryLinkColor;
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    // Render menu items with hover expansion when they have children
    const renderDesktopSubmenuItemSimple = (category, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        
        if (hasChildren) {
            // Category with children - make it hoverable
            return (
                <div key={category.id} className="relative group">
                    <Link 
                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                        className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        style={{ paddingLeft: `${16 + depth * 12}px` }}
                    >
                        <span>{depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}</span>
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                    
                    {/* Nested submenu - appears on hover to the right */}
                    <div className="absolute left-full top-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
                        <div>
                            <Link 
                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                className="block px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 border-b border-gray-200"
                            >
                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                            </Link>
                            {/* Always show children for items that have them */}
                            {category.children.map(child => renderDesktopSubmenuItemSimple(child, depth + 1))}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Regular category without children
            return (
                <Link 
                    key={category.id}
                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    {depth > 0 && '→ '}{getCategoryName(category, getCurrentLanguage())}
                </Link>
            );
        }
    };

    return (
        <>
            {/* Mobile view - always collapsible with vertical layout */}
            <nav className="block md:hidden space-y-1 p-4">
                <Link

                    to={createPublicUrl(store.slug, 'STOREFRONT')}
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-2 py-2 rounded-md block mb-2 touch-manipulation whitespace-nowrap"
                >
                    {t('common.home', 'Home')}
                </Link>
                <div className="space-y-1">
                    {rootCategories.map(category => renderExpandedCategory(category))}
                </div>
            </nav>
            
            {/* Desktop view - Always hover-based, expandAllMenuItems controls second-level expansion */}
            <nav className="hidden md:block">
                <div className="flex items-center justify-center space-x-2">
                    <Link to={createPublicUrl(store.slug, 'STOREFRONT')} className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 rounded-md whitespace-nowrap">
                        {t('common.home', 'Home')}
                    </Link>
                    {rootCategories.map(category => {
                        if (category.children && category.children.length > 0) {
                            return (
                                <div key={category.id} className="relative group">
                                    <Link
                                        to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                        className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 rounded-md inline-flex items-center whitespace-nowrap"
                                    >
                                        {getCategoryName(category, getCurrentLanguage())}
                                        <ChevronDown className="w-3 h-3" />
                                    </Link>
                                    {/* Submenu visible on hover */}
                                    <div className="absolute left-0 top-full w-64 border border-gray-200 rounded-md shadow-lg z-[9999] invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200"
                                        style={{ backgroundColor: subcategoryBgColor }}
                                    >
                                        <div>
                                            <Link
                                                to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))}
                                                className="block px-4 py-2 text-sm font-medium border-b border-gray-200 transition-colors"
                                                style={{ color: subcategoryLinkColor, backgroundColor: 'transparent' }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.color = subcategoryLinkHoverColor;
                                                    e.currentTarget.style.backgroundColor = subcategoryBgHoverColor;
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.color = subcategoryLinkColor;
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                {t('common.view_all', 'View All')} {getCategoryName(category, getCurrentLanguage())}
                                            </Link>
                                            {(() => {
                                return expandAllMenuItems ?
                                    // Show all children recursively with indentation when expandAllMenuItems = true
                                    category.children.map(child => renderDesktopSubmenuItem(child, 0))
                                    :
                                    // Show direct children with chevrons and hover side menus when expandAllMenuItems = false
                                    category.children.map(child => renderDirectChildrenOnly(child, 0))
                            })()}
                                        </div>
                                    </div>
                                </div>
                            );
                        } else {
                            // Regular category without children
                            return (
                                <Link 
                                    key={category.id}
                                    to={createCategoryUrl(store.slug, buildCategoryPath(category, categories).join('/'))} 
                                    className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 rounded-md whitespace-nowrap"
                                >
                                    {getCategoryName(category, getCurrentLanguage())}
                                </Link>
                            );
                        }
                    })}
                </div>
            </nav>
        </>
    );
}