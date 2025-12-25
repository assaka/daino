const { masterDbClient } = require('../database/masterConnection');

/**
 * Store Access Control Middleware
 *
 * Enforces subscription limits and handles store suspension based on:
 * - Active subscription status
 * - Credit balance
 * - Usage limits (API calls, storage, products)
 * - Payment status
 */

/**
 * Access levels for stores:
 * - FULL: All operations allowed
 * - READ_ONLY: Only read operations allowed
 * - SUSPENDED: No access except billing/subscription management
 * - TERMINATED: Complete shutdown, must contact support
 */
const ACCESS_LEVELS = {
  FULL: 'full',
  READ_ONLY: 'read_only',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated'
};

/**
 * Get current access level for a store
 */
async function getStoreAccessLevel(storeId) {
  try {
    // Get store from master DB
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return { level: ACCESS_LEVELS.TERMINATED, reason: 'Store not found' };
    }

    // Check if store is manually suspended
    if (store.status === 'suspended') {
      return { level: ACCESS_LEVELS.SUSPENDED, reason: 'Store manually suspended by admin' };
    }

    if (store.status === 'terminated') {
      return { level: ACCESS_LEVELS.TERMINATED, reason: 'Store terminated' };
    }

    // Get active subscription from master DB
    const { data: subscriptions, error: subError } = await masterDbClient
      .from('subscriptions')
      .select('*')
      .eq('store_id', storeId)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0];

    // No subscription found - allow full access (no subscription requirement)
    if (!subscription) {
      // Check for past_due or cancelled subscriptions
      const { data: pastDueSubscriptions } = await masterDbClient
        .from('subscriptions')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'past_due')
        .order('created_at', { ascending: false })
        .limit(1);

      const pastDueSubscription = pastDueSubscriptions?.[0];

      if (pastDueSubscription) {
        // Give 7 days grace period for payment
        const daysPastDue = Math.floor(
          (Date.now() - new Date(pastDueSubscription.current_period_end).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysPastDue > 7) {
          return { level: ACCESS_LEVELS.SUSPENDED, reason: 'Payment overdue - please update payment method' };
        } else {
          return { level: ACCESS_LEVELS.READ_ONLY, reason: `Payment overdue (${daysPastDue} days) - update payment to restore access` };
        }
      }

      // No subscription found - allow full access without restrictions
      return {
        level: ACCESS_LEVELS.FULL,
        subscription: null
      };
    }

    // Check if trial has expired
    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      if (new Date(subscription.trial_ends_at) < new Date()) {
        return { level: ACCESS_LEVELS.SUSPENDED, reason: 'Trial period expired - please upgrade to a paid plan' };
      }
    }

    // Check product limit
    if (subscription.max_products && subscription.max_products > 0) {
      const productCount = store.product_count || 0;
      if (productCount >= subscription.max_products) {
        return {
          level: ACCESS_LEVELS.READ_ONLY,
          reason: `Product limit reached (${productCount}/${subscription.max_products})`,
          upgrade_required: true
        };
      }
    }

    // Check storage limit
    if (subscription.max_storage_gb && subscription.max_storage_gb > 0) {
      const storageGB = (store.storage_used_bytes || 0) / (1024 * 1024 * 1024);
      if (storageGB >= subscription.max_storage_gb) {
        return {
          level: ACCESS_LEVELS.READ_ONLY,
          reason: `Storage limit exceeded (${storageGB.toFixed(2)}GB/${subscription.max_storage_gb}GB)`,
          upgrade_required: true
        };
      }
    }

    // All checks passed
    return {
      level: ACCESS_LEVELS.FULL,
      subscription: {
        plan_name: subscription.plan_name,
        status: subscription.status,
        trial_ends_at: subscription.trial_ends_at
      }
    };

  } catch (error) {
    console.error('Error checking store access level:', error);
    return { level: ACCESS_LEVELS.READ_ONLY, reason: 'Error checking subscription status' };
  }
}

/**
 * Middleware: Check if store has active subscription
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID required'
      });
    }

    const accessLevel = await getStoreAccessLevel(req.storeId);

    // Allow access to billing and subscription endpoints even if suspended
    const billingEndpoints = [
      '/api/database-provisioning/subscription',
      '/api/database-provisioning/billing',
      '/api/payments',
      '/api/subscriptions'
    ];

    const isBillingEndpoint = billingEndpoints.some(endpoint =>
      req.path.startsWith(endpoint)
    );

    if (isBillingEndpoint) {
      req.accessLevel = accessLevel;
      return next();
    }

    // Check access level
    if (accessLevel.level === ACCESS_LEVELS.SUSPENDED || accessLevel.level === ACCESS_LEVELS.TERMINATED) {
      return res.status(403).json({
        success: false,
        access_denied: true,
        access_level: accessLevel.level,
        reason: accessLevel.reason,
        message: 'Store access suspended',
        actions: {
          view_subscription: '/admin/subscription',
          upgrade_plan: '/admin/subscription/upgrade',
          update_payment: '/admin/billing/payment-method'
        }
      });
    }

    req.accessLevel = accessLevel;
    next();
  } catch (error) {
    console.error('Subscription enforcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status'
    });
  }
};

/**
 * Middleware: Enforce read-only mode for limited stores
 */
const enforceReadOnly = async (req, res, next) => {
  try {
    const accessLevel = req.accessLevel || await getStoreAccessLevel(req.storeId);

    // Allow read operations
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Block write operations if read-only
    if (accessLevel.level === ACCESS_LEVELS.READ_ONLY) {
      return res.status(403).json({
        success: false,
        read_only: true,
        access_level: accessLevel.level,
        reason: accessLevel.reason,
        message: 'Store in read-only mode due to subscription limits',
        upgrade_required: accessLevel.upgrade_required,
        actions: {
          upgrade_plan: '/admin/subscription/upgrade'
        }
      });
    }

    next();
  } catch (error) {
    console.error('Read-only enforcement error:', error);
    next();
  }
};

/**
 * Middleware: Check specific resource limits before creation
 */
const checkResourceLimit = (resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.storeId) {
        return next();
      }

      // Get subscription from master DB
      const { data: subscriptions } = await masterDbClient
        .from('subscriptions')
        .select('*')
        .eq('store_id', req.storeId)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1);

      const subscription = subscriptions?.[0];

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'Active subscription required',
          upgrade_required: true
        });
      }

      // Check specific resource limits
      switch (resourceType) {
        case 'product':
          if (subscription.max_products && subscription.max_products > 0) {
            const { data: store } = await masterDbClient
              .from('stores')
              .select('product_count')
              .eq('id', req.storeId)
              .single();

            if (store && store.product_count >= subscription.max_products) {
              return res.status(403).json({
                success: false,
                limit_exceeded: true,
                resource: 'products',
                current: store.product_count,
                limit: subscription.max_products,
                message: `Product limit reached. Upgrade to create more products.`,
                upgrade_url: '/admin/subscription/upgrade'
              });
            }
          }
          break;

        case 'order':
          // Monthly order limit check removed - usage_metrics table deprecated
          break;

        case 'storage':
          if (subscription.max_storage_gb && subscription.max_storage_gb > 0) {
            const { data: store } = await masterDbClient
              .from('stores')
              .select('storage_used_bytes')
              .eq('id', req.storeId)
              .single();

            const storageGB = (store?.storage_used_bytes || 0) / (1024 * 1024 * 1024);

            if (storageGB >= subscription.max_storage_gb) {
              return res.status(403).json({
                success: false,
                limit_exceeded: true,
                resource: 'storage',
                current: storageGB.toFixed(2),
                limit: subscription.max_storage_gb,
                message: `Storage limit exceeded. Upgrade for more storage.`,
                upgrade_url: '/admin/subscription/upgrade'
              });
            }
          }
          break;
      }

      next();
    } catch (error) {
      console.error('Resource limit check error:', error);
      next();
    }
  };
};

/**
 * Middleware: Warning when approaching limits
 */
const warnApproachingLimits = async (req, res, next) => {
  try {
    if (!req.storeId || req.method !== 'GET') {
      return next();
    }

    const { data: subscriptions } = await masterDbClient
      .from('subscriptions')
      .select('*')
      .eq('store_id', req.storeId)
      .in('status', ['active', 'trial'])
      .limit(1);

    const subscription = subscriptions?.[0];

    if (!subscription) {
      return next();
    }

    const { data: store } = await masterDbClient
      .from('stores')
      .select('product_count, storage_used_bytes')
      .eq('id', req.storeId)
      .single();

    const warnings = [];

    // Check if approaching product limit (>80%)
    if (subscription.max_products && subscription.max_products > 0) {
      const productUsage = (store.product_count / subscription.max_products) * 100;
      if (productUsage >= 80) {
        warnings.push({
          type: 'products',
          usage_percent: productUsage.toFixed(0),
          current: store.product_count,
          limit: subscription.max_products
        });
      }
    }

    // Check if approaching storage limit (>80%)
    if (subscription.max_storage_gb && subscription.max_storage_gb > 0) {
      const storageGB = (store.storage_used_bytes || 0) / (1024 * 1024 * 1024);
      const storageUsage = (storageGB / subscription.max_storage_gb) * 100;
      if (storageUsage >= 80) {
        warnings.push({
          type: 'storage',
          usage_percent: storageUsage.toFixed(0),
          current_gb: storageGB.toFixed(2),
          limit_gb: subscription.max_storage_gb
        });
      }
    }

    // Add warnings to response headers (won't break existing responses)
    if (warnings.length > 0) {
      res.setHeader('X-Subscription-Warnings', JSON.stringify(warnings));
    }

    next();
  } catch (error) {
    console.error('Warning check error:', error);
    next();
  }
};

module.exports = {
  ACCESS_LEVELS,
  getStoreAccessLevel,
  requireActiveSubscription,
  enforceReadOnly,
  checkResourceLimit,
  warnApproachingLimits
};
