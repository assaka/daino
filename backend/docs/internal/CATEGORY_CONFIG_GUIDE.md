# Category Configuration-Based System

## Overview

The category page system uses a configuration-based approach that allows AI and developers to customize category layouts, styling, and behavior by editing `category-config.js` instead of modifying React components.

## Key Benefits

1. **Single Source of Truth**: Both editor and storefront use the same configuration
2. **AI-Friendly**: AI can modify styling, layouts, and HTML structure by editing config files
3. **No Code Duplication**: Templates are defined once in config, rendered everywhere
4. **Fully Customizable**: Change HTML structure, CSS classes, and layout without touching React components

## Architecture

### 1. Configuration File: `category-config.js`

Located at: `src/components/editor/slot/configs/category-config.js`

This file contains:
- **HTML Templates**: Using Handlebars-like syntax (`{{variables}}`, `{{#each}}`, `{{#if}}`)
- **Slot Definitions**: Each UI element is a "slot" with its own template
- **Data Bindings**: How data flows from the backend to the template
- **Styling**: CSS classes and inline styles for each slot

### 2. Variable Processing: `processVariables`

The `processVariables` utility (from `@/utils/variableProcessor`) renders templates with data:

```javascript
const template = `
  <div class="product-card">
    <h3>{{product.name}}</h3>
    <span>{{product.formatted_price}}</span>
  </div>
`;

const data = {
  product: {
    name: "T-Shirt",
    formatted_price: "$29.99"
  }
};

const html = processVariables(template, data);
// Result: <div class="product-card"><h3>T-Shirt</h3><span>$29.99</span></div>
```

### 3. Slot Components with Event Handlers

Components in `CategorySlotComponents.jsx` use `processVariables` to render templates and attach JavaScript event listeners via data attributes:

```javascript
const SortSelector = createSlotComponent({
  name: 'SortSelector',
  render: ({ slot, categoryContext, variableContext, context }) => {
    const containerRef = useRef(null);

    // Render template
    const html = processVariables(slot.content, variableContext);

    // Attach event listeners (storefront only)
    useEffect(() => {
      if (context === 'editor') return;

      const select = containerRef.current.querySelector('[data-action="change-sort"]');
      select.addEventListener('change', (e) => {
        categoryContext.handleSortChange(e.target.value);
      });
    }, [categoryContext, context]);

    return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
  }
});
```

## How to Customize Categories

### Example 1: Change Product Card Styling

Edit `category-config.js`, find the `product_items` slot:

```javascript
product_items: {
  id: 'product_items',
  type: 'component',
  component: 'ProductItemsGrid',
  content: `
    <div class="products-grid-container">
      {{#each products}}
        <div class="product-card bg-white rounded-xl shadow-lg p-6"
             data-product-id="{{this.id}}">

          <!-- Change image styling -->
          <img src="{{this.image_url}}"
               alt="{{this.name}}"
               class="w-full h-64 object-cover rounded-lg" />

          <!-- Change price color to red -->
          <span class="text-2xl font-bold text-red-600">
            {{this.formatted_price}}
          </span>

          <!-- Change button color to green -->
          <button class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                  data-action="add-to-cart"
                  data-product-id="{{this.id}}">
            Add to Cart
          </button>
        </div>
      {{/each}}
    </div>
  `
}
```

### Example 2: Modify Filter Layout

Edit the `layered_navigation` slot:

```javascript
layered_navigation: {
  id: 'layered_navigation',
  type: 'component',
  component: 'LayeredNavigation',
  content: `
    <div class="space-y-4 bg-gray-50 p-6 rounded-lg">
      <h3 class="text-2xl font-bold text-blue-600">Filter Products</h3>

      <!-- Price Filter -->
      {{#if filters.price}}
        <div class="border-b border-gray-300 pb-4">
          <h4 class="font-bold text-lg text-gray-900 mb-3">Price Range</h4>
          <div class="space-y-2">
            {{#each filters.price.ranges}}
              <label class="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded">
                <input type="checkbox"
                       class="w-5 h-5 rounded border-gray-300 text-blue-600"
                       data-action="toggle-filter"
                       data-filter-type="price"
                       data-filter-value="{{this.value}}"
                       {{#if this.active}}checked{{/if}} />
                <span class="text-gray-800 font-medium">{{this.label}}</span>
                <span class="text-blue-600 text-sm ml-auto">({{this.count}})</span>
              </label>
            {{/each}}
          </div>
        </div>
      {{/if}}
    </div>
  `
}
```

### Example 3: Customize Pagination

Edit the `pagination_container` slot:

```javascript
pagination_container: {
  id: 'pagination_container',
  type: 'component',
  component: 'PaginationComponent',
  content: `
    {{#if pagination.totalPages}}
      <div class="flex justify-center mt-12">
        <nav class="flex items-center gap-2 bg-white p-2 rounded-full shadow-lg">
          <!-- Styled Previous Button -->
          <button class="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700
                         {{#unless pagination.hasPrev}}opacity-50 cursor-not-allowed{{/unless}}"
                  data-action="go-to-page"
                  data-page="{{pagination.prevPage}}"
                  {{#unless pagination.hasPrev}}disabled{{/unless}}>
            ← Previous
          </button>

          <!-- Page Numbers with Active State -->
          {{#each pagination.pages}}
            {{#if this.isEllipsis}}
              <span class="px-4 py-3 text-gray-500">...</span>
            {{else}}
              <button class="px-4 py-3 rounded-full font-semibold
                             {{#if this.isCurrent}}bg-blue-600 text-white{{else}}text-gray-700 hover:bg-gray-100{{/if}}"
                      data-action="go-to-page"
                      data-page="{{this.number}}">
                {{this.number}}
              </button>
            {{/if}}
          {{/each}}

          <!-- Styled Next Button -->
          <button class="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700
                         {{#unless pagination.hasNext}}opacity-50 cursor-not-allowed{{/unless}}"
                  data-action="go-to-page"
                  data-page="{{pagination.nextPage}}"
                  {{#unless pagination.hasNext}}disabled{{/unless}}>
            Next →
          </button>
        </nav>
      </div>
    {{/if}}
  `
}
```

## Template Syntax Reference

### Variables

```handlebars
{{variable}}              - Simple variable
{{object.property}}       - Nested property
{{array[0]}}              - Array index
```

### Conditionals

```handlebars
{{#if condition}}
  Content when true
{{else}}
  Content when false
{{/if}}

{{#unless condition}}
  Content when false
{{/unless}}
```

### Loops

```handlebars
{{#each items}}
  {{this.property}}       - Current item property
  {{@index}}              - Current index
  {{@first}}              - True if first item
  {{@last}}               - True if last item
{{/each}}
```

### Helpers

```handlebars
{{#if (eq value "test")}}  - Equality check
{{#if (gt value 5)}}       - Greater than
{{#if (lt value 10)}}      - Less than
```

## Data Attributes for Interactivity

All interactive elements use `data-action` attributes to trigger JavaScript:

### Common Actions

| Data Attribute | Purpose | Example |
|----------------|---------|---------|
| `data-action="add-to-cart"` | Add product to cart | `<button data-action="add-to-cart" data-product-id="123">` |
| `data-action="toggle-filter"` | Toggle category filter | `<input data-action="toggle-filter" data-filter-type="price">` |
| `data-action="change-sort"` | Change sort order | `<select data-action="change-sort">` |
| `data-action="go-to-page"` | Navigate to page | `<button data-action="go-to-page" data-page="2">` |
| `data-action="remove-filter"` | Remove active filter | `<button data-action="remove-filter" data-filter-value="...">` |

## Available Variable Context

The `variableContext` passed to templates includes:

```javascript
{
  // Category data
  category: {
    name: "Category Name",
    description: "Category description",
    image_url: "/path/to/image.jpg"
  },

  // Products array
  products: [
    {
      id: 123,
      name: "Product Name",
      price: 29.99,
      formatted_price: "$29.99",
      image_url: "/path/to/image.jpg",
      url: "/product-url",
      in_stock: true,
      labels: [
        { text: "Sale", className: "bg-red-600 text-white" }
      ]
    }
  ],

  // Filters data
  filters: {
    price: {
      ranges: [
        { label: "$0-$25", value: "0-25", count: 10, active: false }
      ]
    },
    attributes: [
      {
        code: "brand",
        label: "Brand",
        options: [
          { label: "Apple", value: "apple", count: 5, active: false }
        ]
      }
    ]
  },

  // Active filters
  activeFilters: [
    { type: "price", label: "Price", value: "$0-$25" }
  ],

  // Pagination data
  pagination: {
    start: 1,
    end: 12,
    total: 48,
    currentPage: 1,
    totalPages: 4,
    hasPrev: false,
    hasNext: true,
    prevPage: 0,
    nextPage: 2,
    pages: [
      { number: 1, isCurrent: true },
      { number: 2, isCurrent: false },
      { isEllipsis: true },
      { number: 4, isCurrent: false }
    ]
  },

  // Sorting data
  sorting: {
    current: "price_asc",
    options: [
      { value: "position", label: "Position" },
      { value: "price_asc", label: "Price (Low to High)" }
    ]
  }
}
```

## Component Registration

All category components are registered in `CategorySlotComponents.jsx`:

```javascript
registerSlotComponent('ProductItemsGrid', ProductItemsGrid);
registerSlotComponent('SortSelector', SortSelector);
registerSlotComponent('PaginationComponent', PaginationComponent);
registerSlotComponent('LayeredNavigation', LayeredNavigation);
registerSlotComponent('ActiveFilters', ActiveFilters);
registerSlotComponent('ProductCountInfo', ProductCountInfo);
```

## Testing Changes

1. **In Editor**: Changes to `category-config.js` will show in the category editor at `/admin/store/{storeId}/editor/category-slots`

2. **In Storefront**: Navigate to any category page like `/public/{storeCode}/category/{category-path}`

3. **Hot Reload**: Most changes to config templates will hot-reload automatically

## Common Patterns

### Adding a New Section

```javascript
// In category-config.js
featured_products_section: {
  id: 'featured_products_section',
  type: 'component',
  component: 'FeaturedProducts',
  content: `
    <div class="my-8 bg-blue-50 p-6 rounded-lg">
      <h2 class="text-2xl font-bold mb-4">Featured Products</h2>
      <div class="grid grid-cols-3 gap-4">
        {{#each featuredProducts}}
          <div class="bg-white p-4 rounded-lg">
            <img src="{{this.image_url}}" alt="{{this.name}}" class="w-full h-48 object-cover rounded" />
            <h3 class="mt-2 font-semibold">{{this.name}}</h3>
            <span class="text-green-600 font-bold">{{this.formatted_price}}</span>
          </div>
        {{/each}}
      </div>
    </div>
  `,
  parentId: 'products_container',
  position: { col: 1, row: 6 },
  colSpan: { grid: 12, list: 12 },
  viewMode: ['grid', 'list']
}
```

### Conditional Rendering

```handlebars
{{#if product.compare_price}}
  <span class="text-sm text-gray-500 line-through">
    {{product.formatted_compare_price}}
  </span>
{{/if}}

{{#unless product.in_stock}}
  <span class="text-red-600 font-semibold">Out of Stock</span>
{{/unless}}
```

### Dynamic CSS Classes

```handlebars
<button class="btn {{#if this.active}}btn-primary{{else}}btn-secondary{{/if}}">
  {{this.label}}
</button>
```

## Troubleshooting

### Template Not Rendering

1. Check `slot.content` is defined in config
2. Verify variable names match the `variableContext`
3. Check browser console for Handlebars syntax errors

### Event Handlers Not Working

1. Ensure `data-action` attributes are present
2. Check `useEffect` hook is properly attached in the component
3. Verify `categoryContext` contains the required handler functions

### Styling Not Applied

1. Check Tailwind classes are valid
2. Verify class names don't conflict with existing styles
3. Use browser DevTools to inspect rendered HTML

## Migration Guide

To migrate existing hardcoded components to the config system:

1. **Extract HTML**: Copy HTML from the React component
2. **Replace JSX with Handlebars**: Change `{variable}` to `{{variable}}`
3. **Add to Config**: Place template in `category-config.js` slot
4. **Create Component**: Use `createSlotComponent` pattern
5. **Attach Events**: Use `useEffect` with `data-action` attributes
6. **Register**: Add to `registerSlotComponent` calls

## Best Practices

1. **Keep Templates Simple**: Complex logic belongs in the data preparation, not templates
2. **Use Data Attributes**: All interactive elements should have `data-action` and related attributes
3. **Consistent Naming**: Use descriptive slot IDs like `product_price_container`
4. **Mobile-First**: Use responsive Tailwind classes (`sm:`, `md:`, `lg:`)
5. **Accessibility**: Include proper ARIA labels and semantic HTML

## Additional Resources

- [Handlebars Documentation](https://handlebarsjs.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- `processVariables` source: `src/utils/variableProcessor.js`
- Cart config example: `src/components/editor/slot/configs/cart-config.js`
