'use strict';

/**
 * Migration: Seed Default UI Translations
 *
 * This migration populates the translations table with common UI labels
 * in English that can be translated to other languages via the admin panel.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // Common UI labels organized by category
    const defaultTranslations = [
      // Common actions
      { key: 'common.add', value: 'Add', category: 'common' },
      { key: 'common.edit', value: 'Edit', category: 'common' },
      { key: 'common.delete', value: 'Delete', category: 'common' },
      { key: 'common.save', value: 'Save', category: 'common' },
      { key: 'common.cancel', value: 'Cancel', category: 'common' },
      { key: 'common.submit', value: 'Submit', category: 'common' },
      { key: 'common.close', value: 'Close', category: 'common' },
      { key: 'common.back', value: 'Back', category: 'common' },
      { key: 'common.next', value: 'Next', category: 'common' },
      { key: 'common.previous', value: 'Previous', category: 'common' },
      { key: 'common.search', value: 'Search', category: 'common' },
      { key: 'common.filter', value: 'Filter', category: 'common' },
      { key: 'common.sort', value: 'Sort', category: 'common' },
      { key: 'common.loading', value: 'Loading...', category: 'common' },
      { key: 'common.yes', value: 'Yes', category: 'common' },
      { key: 'common.no', value: 'No', category: 'common' },
      { key: 'common.confirm', value: 'Confirm', category: 'common' },
      { key: 'common.view', value: 'View', category: 'common' },
      { key: 'common.download', value: 'Download', category: 'common' },
      { key: 'common.upload', value: 'Upload', category: 'common' },
      { key: 'common.select', value: 'Select', category: 'common' },
      { key: 'common.all', value: 'All', category: 'common' },
      { key: 'common.none', value: 'None', category: 'common' },

      // Navigation
      { key: 'navigation.home', value: 'Home', category: 'navigation' },
      { key: 'navigation.dashboard', value: 'Dashboard', category: 'navigation' },
      { key: 'navigation.products', value: 'Products', category: 'navigation' },
      { key: 'navigation.categories', value: 'Categories', category: 'navigation' },
      { key: 'navigation.orders', value: 'Orders', category: 'navigation' },
      { key: 'navigation.customers', value: 'Customers', category: 'navigation' },
      { key: 'navigation.settings', value: 'Settings', category: 'navigation' },
      { key: 'navigation.logout', value: 'Logout', category: 'navigation' },
      { key: 'navigation.login', value: 'Login', category: 'navigation' },
      { key: 'navigation.profile', value: 'Profile', category: 'navigation' },
      { key: 'navigation.account', value: 'My Account', category: 'navigation' },
      { key: 'navigation.admin', value: 'Admin', category: 'navigation' },
      { key: 'navigation.storefront', value: 'Storefront', category: 'navigation' },

      // Product
      { key: 'product.name', value: 'Product Name', category: 'product' },
      { key: 'product.price', value: 'Price', category: 'product' },
      { key: 'product.stock', value: 'Stock', category: 'product' },
      { key: 'product.sku', value: 'SKU', category: 'product' },
      { key: 'product.description', value: 'Description', category: 'product' },
      { key: 'product.images', value: 'Images', category: 'product' },
      { key: 'product.category', value: 'Category', category: 'product' },
      { key: 'product.in_stock', value: 'In Stock', category: 'product' },
      { key: 'product.out_of_stock', value: 'Out of Stock', category: 'product' },
      { key: 'product.add_to_cart', value: 'Add to Cart', category: 'product' },
      { key: 'product.buy_now', value: 'Buy Now', category: 'product' },
      { key: 'product.quick_view', value: 'Quick View', category: 'product' },
      { key: 'product.details', value: 'Product Details', category: 'product' },
      { key: 'product.reviews', value: 'Reviews', category: 'product' },
      { key: 'product.related', value: 'Related Products', category: 'product' },

      // Checkout
      { key: 'checkout.cart', value: 'Shopping Cart', category: 'checkout' },
      { key: 'checkout.checkout', value: 'Checkout', category: 'checkout' },
      { key: 'checkout.payment', value: 'Payment', category: 'checkout' },
      { key: 'checkout.shipping', value: 'Shipping', category: 'checkout' },
      { key: 'checkout.billing', value: 'Billing', category: 'checkout' },
      { key: 'checkout.order_summary', value: 'Order Summary', category: 'checkout' },
      { key: 'checkout.subtotal', value: 'Subtotal', category: 'checkout' },
      { key: 'checkout.total', value: 'Total', category: 'checkout' },
      { key: 'checkout.tax', value: 'Tax', category: 'checkout' },
      { key: 'checkout.discount', value: 'Discount', category: 'checkout' },
      { key: 'checkout.shipping_fee', value: 'Shipping Fee', category: 'checkout' },
      { key: 'checkout.place_order', value: 'Place Order', category: 'checkout' },
      { key: 'checkout.continue_shopping', value: 'Continue Shopping', category: 'checkout' },
      { key: 'checkout.empty_cart', value: 'Your cart is empty', category: 'checkout' },
      { key: 'checkout.proceed_to_checkout', value: 'Proceed to Checkout', category: 'checkout' },
      { key: 'checkout.apply_coupon', value: 'Apply Coupon', category: 'checkout' },

      // Account
      { key: 'account.email', value: 'Email', category: 'account' },
      { key: 'account.password', value: 'Password', category: 'account' },
      { key: 'account.confirm_password', value: 'Confirm Password', category: 'account' },
      { key: 'account.first_name', value: 'First Name', category: 'account' },
      { key: 'account.last_name', value: 'Last Name', category: 'account' },
      { key: 'account.phone', value: 'Phone', category: 'account' },
      { key: 'account.address', value: 'Address', category: 'account' },
      { key: 'account.city', value: 'City', category: 'account' },
      { key: 'account.country', value: 'Country', category: 'account' },
      { key: 'account.postal_code', value: 'Postal Code', category: 'account' },
      { key: 'account.register', value: 'Register', category: 'account' },
      { key: 'account.sign_in', value: 'Sign In', category: 'account' },
      { key: 'account.sign_up', value: 'Sign Up', category: 'account' },
      { key: 'account.forgot_password', value: 'Forgot Password?', category: 'account' },
      { key: 'account.reset_password', value: 'Reset Password', category: 'account' },
      { key: 'account.my_orders', value: 'My Orders', category: 'account' },
      { key: 'account.order_history', value: 'Order History', category: 'account' },
      { key: 'account.wishlist', value: 'Wishlist', category: 'account' },

      // Messages
      { key: 'message.success', value: 'Success!', category: 'common' },
      { key: 'message.error', value: 'Error!', category: 'common' },
      { key: 'message.warning', value: 'Warning!', category: 'common' },
      { key: 'message.info', value: 'Info', category: 'common' },
      { key: 'message.saved', value: 'Saved successfully', category: 'common' },
      { key: 'message.deleted', value: 'Deleted successfully', category: 'common' },
      { key: 'message.updated', value: 'Updated successfully', category: 'common' },
      { key: 'message.created', value: 'Created successfully', category: 'common' },
      { key: 'message.confirm_delete', value: 'Are you sure you want to delete this?', category: 'common' },
      { key: 'message.no_results', value: 'No results found', category: 'common' },
      { key: 'message.required_field', value: 'This field is required', category: 'common' },
      { key: 'message.invalid_email', value: 'Invalid email address', category: 'common' },
      { key: 'message.password_mismatch', value: 'Passwords do not match', category: 'common' },

      // Admin
      { key: 'admin.manage', value: 'Manage', category: 'admin' },
      { key: 'admin.create', value: 'Create', category: 'admin' },
      { key: 'admin.update', value: 'Update', category: 'admin' },
      { key: 'admin.list', value: 'List', category: 'admin' },
      { key: 'admin.details', value: 'Details', category: 'admin' },
      { key: 'admin.bulk_actions', value: 'Bulk Actions', category: 'admin' },
      { key: 'admin.export', value: 'Export', category: 'admin' },
      { key: 'admin.import', value: 'Import', category: 'admin' },
      { key: 'admin.reports', value: 'Reports', category: 'admin' },
      { key: 'admin.analytics', value: 'Analytics', category: 'admin' },
      { key: 'admin.translations', value: 'Translations', category: 'admin' },
      { key: 'admin.languages', value: 'Languages', category: 'admin' },
    ];

    // Insert translations for English
    const translations = defaultTranslations.map(t => ({
      key: t.key,
      language_code: 'en',
      value: t.value,
      category: t.category,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('translations', translations, {
      updateOnDuplicate: ['value', 'category', 'updated_at']
    });

    console.log(`✅ Seeded ${translations.length} default UI translations`);
  },

  down: async (queryInterface, Sequelize) => {
    // Delete all translations with language_code 'en'
    await queryInterface.bulkDelete('translations', {
      language_code: 'en'
    }, {});

    console.log('✅ Removed default UI translations');
  }
};
