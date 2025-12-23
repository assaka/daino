import { createCategoryUrl, createProductUrl, createCmsPageUrl } from './urlUtils';
import { getCategoryName, getProductName, getPageTitle, getCurrentLanguage } from './translationUtils';

/**
 * Flattens a nested category tree into a flat array
 * @param {Array} categories - Nested category tree
 * @returns {Array} Flat array of all categories
 */
function flattenCategoryTree(categories) {
  if (!categories || !Array.isArray(categories)) return [];

  const result = [];

  function traverse(cats) {
    for (const cat of cats) {
      // Add the category itself (without children to avoid circular refs)
      const { children, ...categoryWithoutChildren } = cat;
      result.push(categoryWithoutChildren);

      // Recursively process children
      if (children && Array.isArray(children) && children.length > 0) {
        traverse(children);
      }
    }
  }

  traverse(categories);
  return result;
}

/**
 * Builds breadcrumb items based on page type and data
 * @param {string} pageType - 'category', 'product', or 'cms'
 * @param {object} pageData - The page data (category, product, or cms page object)
 * @param {string} storeCode - Store code for URL generation
 * @param {array} categories - Array of all categories (needed for hierarchy)
 * @param {object} settings - Store settings (for show_category_in_breadcrumb, etc.)
 * @returns {array} Array of breadcrumb items { name, url, isCurrent }
 */
export function buildBreadcrumbs(pageType, pageData, storeCode, categories = [], settings = {}) {
  switch (pageType) {
    case 'category':
      return buildCategoryBreadcrumbs(pageData, storeCode, categories, settings);
    case 'product':
      return buildProductBreadcrumbs(pageData, storeCode, categories, settings);
    case 'cms':
      return buildCmsBreadcrumbs(pageData, storeCode, settings);
    default:
      return [];
  }
}

/**
 * Builds breadcrumbs for a category page
 */
export function buildCategoryBreadcrumbs(currentCategory, storeCode, categories = [], settings = {}) {
  if (!currentCategory || !categories) return [];

  // Flatten the category tree for searching (handles nested tree structure from bootstrap)
  const flatCategories = flattenCategoryTree(categories);

  let category = currentCategory;
  const categoryChain = [currentCategory];

  while (category?.parent_id) {
    const parent = flatCategories.find(c => c.id === category.parent_id);
    if (parent) {
      categoryChain.unshift(parent);
      category = parent;
    } else {
      break;
    }
  }

  // Filter out root categories from parent chain, but always keep the current category
  // This ensures the current category always appears in breadcrumbs, even if it's a root
  const filteredChain = categoryChain.filter(cat => {
    // Always include the current category
    if (cat.id === currentCategory.id) return true;
    // Exclude root categories from parent chain
    return cat.parent_id !== null;
  });

  const currentLang = getCurrentLanguage();
  return filteredChain.map((cat, index) => {
    const categoryPath = [];
    const categoryChainUpToCurrent = filteredChain.slice(0, index + 1);
    categoryChainUpToCurrent.forEach(c => categoryPath.push(c.slug));

    const translatedName = getCategoryName(cat, currentLang);
    const attributeName = cat?.attributes?.name;
    const directName = cat?.name;
    const finalName = translatedName || attributeName || directName;

    return {
      name: finalName,
      url: cat.id === currentCategory.id ? null : createCategoryUrl(storeCode, categoryPath.join('/')),
      isCurrent: cat.id === currentCategory.id
    };
  });
}

/**
 * Builds breadcrumbs for a product page
 */
export function buildProductBreadcrumbs(product, storeCode, categories = [], settings = {}) {
  if (!product) return [];

  // Flatten the category tree for searching (handles nested tree structure from bootstrap)
  const flatCategories = flattenCategoryTree(categories);

  console.log('🍞 buildProductBreadcrumbs DEBUG:', {
    inputCategoriesCount: categories?.length,
    flatCategoriesCount: flatCategories?.length,
    flatCategoryIds: flatCategories?.map(c => c.id),
    flatCategoryNames: flatCategories?.map(c => c.name),
    productCategoryIds: product?.category_ids,
    show_category_in_breadcrumb: settings?.show_category_in_breadcrumb
  });

  const breadcrumbs = [];

  if (settings?.show_category_in_breadcrumb !== false && product.category_ids && product.category_ids.length > 0 && flatCategories && flatCategories.length > 0) {
    // Find the deepest category (the one that has no children in the product's category list)
    let deepestCategory = null;
    let maxDepth = -1;

    for (const categoryId of product.category_ids) {
      const category = flatCategories.find(c => c.id === categoryId);
      if (category) {
        // Calculate depth by walking up the parent chain
        let depth = 0;
        let current = category;
        while (current?.parent_id) {
          depth++;
          current = flatCategories.find(c => c.id === current.parent_id);
          if (!current) break;
        }

        if (depth > maxDepth) {
          maxDepth = depth;
          deepestCategory = category;
        }
      }
    }


    console.log('🍞 deepestCategory found:', deepestCategory ? {
      id: deepestCategory.id,
      name: deepestCategory.name,
      parent_id: deepestCategory.parent_id,
      maxDepth
    } : 'NONE');

    if (deepestCategory) {
      let category = deepestCategory;
      const categoryChain = [category];

      while (category?.parent_id) {
        const parent = flatCategories.find(c => c.id === category.parent_id);
        console.log('🍞 Looking for parent:', category.parent_id, 'Found:', parent ? { id: parent.id, name: parent.name } : 'NOT FOUND');
        if (parent) {
          categoryChain.unshift(parent);
          category = parent;
        } else {
          break;
        }
      }

      console.log('🍞 categoryChain:', categoryChain.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id })));

      const currentLang = getCurrentLanguage();
      // Filter out root categories, but always keep the deepest category (product's category)
      const filteredChain = categoryChain.filter(cat => {
        // Always include the deepest category (product's primary category)
        if (cat.id === deepestCategory.id) return true;
        // Exclude root categories from parent chain
        return cat.parent_id !== null;
      });
      console.log('🍞 filteredChain:', filteredChain.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id })));
      filteredChain.forEach((cat, index) => {
        const categoryPath = [];
        const categoryChainUpToCurrent = filteredChain.slice(0, index + 1);
        categoryChainUpToCurrent.forEach(c => categoryPath.push(c.slug));

        const translatedName = getCategoryName(cat, currentLang);
        const attributeName = cat?.attributes?.name;
        const directName = cat?.name;
        const finalName = translatedName || attributeName || directName;

        breadcrumbs.push({
          name: finalName,
          url: createCategoryUrl(storeCode, categoryPath.join('/')),
          isCurrent: false
        });
      });
    }
  }

  breadcrumbs.push({
    name: getProductName(product, getCurrentLanguage()),
    url: null,
    isCurrent: true
  });


  return breadcrumbs;
}

/**
 * Builds breadcrumbs for a CMS page
 */
export function buildCmsBreadcrumbs(cmsPage, storeCode, settings = {}) {
  if (!cmsPage) return [];

  const breadcrumbs = [];

  const currentLang = getCurrentLanguage();

  if (cmsPage.parent_page) {
    breadcrumbs.push({
      name: getPageTitle(cmsPage.parent_page, currentLang),
      url: createCmsPageUrl(storeCode, cmsPage.parent_page.slug),
      isCurrent: false
    });
  }

  breadcrumbs.push({
    name: getPageTitle(cmsPage, currentLang) || cmsPage.name,
    url: null,
    isCurrent: true
  });

  return breadcrumbs;
}