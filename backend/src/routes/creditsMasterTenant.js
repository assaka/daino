/**
 * Credits Routes (Master-Tenant Architecture)
 *
 * GET /api/credits/balance - Get current credit balance
 * GET /api/credits/transactions - Get transaction history
 * GET /api/credits/uptime-report - Get store uptime report with daily charges
 * POST /api/credits/purchase - Purchase credits
 * POST /api/credits/spend - Spend credits (internal use)
 */

const express = require('express');
const router = express.Router();
const CreditTransaction = require('../models/CreditTransaction');
const CreditUsage = require('../models/CreditUsage');
const { authMiddleware } = require('../middleware/authMiddleware');
const { masterDbClient } = require('../database/masterConnection');
const creditService = require('../services/credit-service');

/**
 * GET /api/credits/pricing
 * Get credit pricing options for a specific currency (public endpoint)
 */
router.get('/pricing', async (req, res) => {
  try {
    const currency = (req.query.currency || 'usd').toLowerCase();
    console.log(`💰 [Credits API] Getting pricing for currency: ${currency}`);

    const pricingService = require('../services/pricing-service');
    const pricing = await pricingService.getPricingForCurrency(currency);

    console.log(`✅ [Credits API] Returning ${pricing.length} pricing options for ${currency}`);

    res.json({
      success: true,
      data: pricing,
      currency: currency.toUpperCase(),
      freeCredits: parseInt(process.env.FREE_CREDITS) || 30
    });
  } catch (error) {
    console.error('Error getting credit pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit pricing',
      error: error.message
    });
  }
});

/**
 * GET /api/credits/currencies
 * Get available currencies for credit purchases (public endpoint)
 */
router.get('/currencies', async (req, res) => {
  try {
    const pricingService = require('../services/pricing-service');
    const currencies = await pricingService.getAvailableCurrencies();

    res.json({
      success: true,
      data: currencies
    });
  } catch (error) {
    console.error('Error getting currencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get currencies',
      error: error.message
    });
  }
});

/**
 * GET /api/credits/transactions
 * Get credit transaction history for current user
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    console.log('📋 [Transactions] Request received:', {
      userId,
      userEmail: req.user.email,
      limit
    });

    // DEBUG: Query ALL transactions to see what's in the table
    const { data: allTransactions, error: allError } = await masterDbClient
      .from('credit_transactions')
      .select('id, user_id, credits_amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('📋 [Transactions] DEBUG - All transactions in DB:', {
      count: allTransactions?.length || 0,
      transactions: allTransactions?.map(t => ({ id: t.id, user_id: t.user_id, credits: t.credits_amount })) || [],
      error: allError?.message
    });

    if (limit < 1 || limit > 200) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 200'
      });
    }

    const transactions = await CreditTransaction.getUserTransactions(userId, null, limit);

    console.log('📋 [Transactions] Found for user:', {
      count: transactions.length,
      transactionIds: transactions.map(t => t.id)
    });

    res.json({
      success: true,
      data: transactions.map(tx => ({
        id: tx.id,
        transaction_type: tx.transaction_type,
        amount_usd: parseFloat(tx.amount_usd || 0),
        credits_amount: parseFloat(tx.credits_amount || 0),
        status: tx.status,
        description: tx.description,
        created_at: tx.created_at,
        metadata: tx.metadata
      })),
      total: transactions.length
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transactions',
      error: error.message
    });
  }
});

/**
 * GET /api/credits/balance
 * Get current credit balance from master DB (source of truth: users.credits)
 */
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.user.store_id;

    // Get balance from users.credits (single source of truth)
    const balance = await creditService.getBalance(userId, storeId);

    res.json({
      success: true,
      data: {
        balance: balance
      }
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit balance'
    });
  }
});

/**
 * GET /api/credits/usage
 * Get credit usage history with filters
 */
router.get('/usage', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      store_id,
      store_ids,
      usage_type,
      usage_types,
      model_used,
      models,
      start_date,
      end_date,
      limit = 50,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Parse multi-select filters (comma-separated strings to arrays)
    const storeIdArray = store_ids ? store_ids.split(',').filter(Boolean) : (store_id ? [store_id] : []);
    const usageTypeArray = usage_types ? usage_types.split(',').filter(Boolean) : (usage_type && usage_type !== 'all' ? [usage_type] : []);
    const modelArray = models ? models.split(',').filter(Boolean) : (model_used ? [model_used] : []);

    // Build query
    let query = masterDbClient
      .from('credit_usage')
      .select('*')
      .eq('user_id', userId);

    // Apply filters
    if (storeIdArray.length > 0) {
      query = query.in('store_id', storeIdArray);
    }
    if (usageTypeArray.length > 0) {
      query = query.in('usage_type', usageTypeArray);
    }
    if (modelArray.length > 0) {
      query = query.in('model_used', modelArray);
    }
    if (start_date) {
      query = query.gte('created_at', new Date(start_date).toISOString());
    }
    if (end_date) {
      // Add 1 day to include the entire end date
      const endDateObj = new Date(end_date);
      endDateObj.setDate(endDateObj.getDate() + 1);
      query = query.lt('created_at', endDateObj.toISOString());
    }

    // Get total count for pagination
    const countQuery = masterDbClient
      .from('credit_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (storeIdArray.length > 0) countQuery.in('store_id', storeIdArray);
    if (usageTypeArray.length > 0) countQuery.in('usage_type', usageTypeArray);
    if (modelArray.length > 0) countQuery.in('model_used', modelArray);
    if (start_date) countQuery.gte('created_at', new Date(start_date).toISOString());
    if (end_date) {
      const endDateObj = new Date(end_date);
      endDateObj.setDate(endDateObj.getDate() + 1);
      countQuery.lt('created_at', endDateObj.toISOString());
    }

    const { count, error: countError } = await countQuery;

    // Apply sorting and pagination
    const ascending = sort_order.toLowerCase() === 'asc';
    query = query
      .order(sort_by, { ascending })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: usage, error } = await query;

    if (error) {
      console.error('Error getting credit usage:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get credit usage',
        error: error.message
      });
    }

    // Get store slugs for the usage records - master stores table only has slug, not name
    const storeIds = [...new Set(usage.map(u => u.store_id).filter(Boolean))];
    let storeNames = {};

    if (storeIds.length > 0) {
      const { data: stores, error: storesError } = await masterDbClient
        .from('stores')
        .select('id, slug')
        .in('id', storeIds);

      if (storesError) {
        console.error('Error fetching stores:', storesError);
      }

      if (stores && stores.length > 0) {
        storeNames = stores.reduce((acc, s) => {
          acc[s.id] = s.slug;
          return acc;
        }, {});
      }
    }

    // Calculate totals for the filtered period
    const totalCredits = usage.reduce((sum, u) => sum + parseFloat(u.credits_used || 0), 0);

    // Get ALL distinct types and models for this user (not just filtered results) for filter dropdowns
    const { data: allTypesData } = await masterDbClient
      .from('credit_usage')
      .select('usage_type')
      .eq('user_id', userId);

    const { data: allModelsData } = await masterDbClient
      .from('credit_usage')
      .select('model_used')
      .eq('user_id', userId)
      .not('model_used', 'is', null);

    const distinctTypes = [...new Set((allTypesData || []).map(u => u.usage_type).filter(Boolean))];
    const distinctModels = [...new Set((allModelsData || []).map(u => u.model_used).filter(Boolean))];

    res.json({
      success: true,
      data: {
        usage: usage.map(u => ({
          ...u,
          store_name: u.store_id ? (storeNames[u.store_id] || u.store_id) : 'N/A',
          credits_used: parseFloat(u.credits_used || 0)
        })),
        pagination: {
          total: count || 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + usage.length < (count || 0)
        },
        summary: {
          total_credits_used: totalCredits,
          record_count: usage.length
        },
        filters: {
          types: distinctTypes,
          models: distinctModels
        }
      }
    });
  } catch (error) {
    console.error('Get credit usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit usage',
      details: error.message
    });
  }
});

/**
 * GET /api/credits/usage/types
 * Get available usage types for filter dropdown from master credit_usage
 */
router.get('/usage/types', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get distinct usage types from master credit_usage table for this user
    const { data: types, error } = await masterDbClient
      .from('credit_usage')
      .select('usage_type')
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting usage types:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get usage types',
        error: error.message
      });
    }

    // Get unique types
    const uniqueTypes = [...new Set((types || []).map(t => t.usage_type))].filter(Boolean);

    // Map to user-friendly labels
    const typeLabels = {
      'store_publishing': 'Store Publishing',
      'store_daily_publishing': 'Daily Publishing',
      'custom_domain': 'Custom Domain',
      'akeneo_schedule': 'Akeneo Scheduled Import',
      'akeneo_manual': 'Akeneo Manual Import',
      'ai_translation': 'AI Translation',
      'ai_image': 'AI Image Processing',
      'ai_seo': 'AI SEO',
      'ai_content': 'AI Content Generation',
      'ai_chat': 'AI Chat',
      'ai_generation': 'AI Generation',
      'manual_import': 'Manual Import',
      'general': 'General'
    };

    res.json({
      success: true,
      data: uniqueTypes.map(type => ({
        value: type,
        label: typeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }))
    });
  } catch (error) {
    console.error('Get usage types error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage types',
      details: error.message
    });
  }
});

/**
 * GET /api/credits/usage/models
 * Get available LLM models for filter dropdown from master credit_usage
 */
router.get('/usage/models', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get distinct models from master credit_usage table for this user
    const { data: models, error } = await masterDbClient
      .from('credit_usage')
      .select('model_used')
      .eq('user_id', userId)
      .not('model_used', 'is', null);

    if (error) {
      console.error('Error getting models:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get models',
        error: error.message
      });
    }

    // Get unique models
    const uniqueModels = [...new Set((models || []).map(m => m.model_used))].filter(Boolean);

    res.json({
      success: true,
      data: uniqueModels.map(model => ({
        value: model,
        label: model
      }))
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get models',
      details: error.message
    });
  }
});

/**
 * GET /api/credits/usage/stats
 * Get usage statistics summary
 */
router.get('/usage/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { store_id, store_ids, days = 30 } = req.query;

    // Parse multi-select filters
    const storeIdArray = store_ids ? store_ids.split(',').filter(Boolean) : (store_id ? [store_id] : []);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let query = masterDbClient
      .from('credit_usage')
      .select('usage_type, credits_used, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (storeIdArray.length > 0) {
      query = query.in('store_id', storeIdArray);
    }

    const { data: usage, error } = await query;

    if (error) {
      console.error('Error getting usage stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get usage stats',
        error: error.message
      });
    }

    // Calculate stats by type
    const statsByType = {};
    let totalCredits = 0;

    usage.forEach(u => {
      const credits = parseFloat(u.credits_used || 0);
      totalCredits += credits;

      if (!statsByType[u.usage_type]) {
        statsByType[u.usage_type] = {
          count: 0,
          total_credits: 0
        };
      }
      statsByType[u.usage_type].count++;
      statsByType[u.usage_type].total_credits += credits;
    });

    // Calculate daily average
    const dailyAverage = totalCredits / parseInt(days);

    res.json({
      success: true,
      data: {
        total_credits_used: totalCredits,
        daily_average: dailyAverage,
        by_type: statsByType,
        period_days: parseInt(days),
        record_count: usage.length
      }
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage stats',
      details: error.message
    });
  }
});

/**
 * GET /api/credits/transactions
 * Get credit transaction history
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const storeId = req.user.store_id;
    const { limit = 50, offset = 0, type } = req.query;

    const where = { store_id: storeId };
    if (type) {
      where.transaction_type = type;
    }

    const transactions = await CreditTransaction.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await CreditTransaction.count({ where });

    res.json({
      success: true,
      data: {
        transactions: transactions.map(t => ({
          id: t.id,
          amount_usd: parseFloat(t.amount_usd || 0),
          credits_amount: parseFloat(t.credits_amount || 0),
          type: t.transaction_type,
          description: t.description,
          status: t.status,
          created_at: t.created_at
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + transactions.length < total
        }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions'
    });
  }
});

/**
 * GET /api/credits/uptime-report
 * Get store uptime report showing daily charges for published stores
 * Requires store_id query parameter or uses current store from auth context
 */
router.get('/uptime-report', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30, store_id } = req.query;

    // Use store_id from query param, or fall back to current store from auth context
    const targetStoreId = store_id || req.user.store_id;

    if (!targetStoreId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required. Provide store_id query parameter.'
      });
    }

    const report = await creditService.getUptimeReport(userId, days, targetStoreId);

    res.json({
      success: true,
      ...report
    });
  } catch (error) {
    console.error('Error getting uptime report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get uptime report',
      error: error.message
    });
  }
});

/**
 * POST /api/credits/purchase
 * Purchase credits (Stripe integration)
 */
router.post('/purchase', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.user.store_id;
    const { amount, paymentMethod = 'stripe', paymentProviderId } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    // TODO: Process payment with Stripe
    // const paymentIntent = await stripe.paymentIntents.create({...});
    // const paymentProviderId = paymentIntent.id;

    // Record transaction
    const transaction = await CreditTransaction.recordPurchase(
      storeId,
      amount,
      {
        paymentMethod,
        paymentProviderId: paymentProviderId || `test_${Date.now()}`,
        paymentStatus: 'completed',
        description: `Credit purchase: ${amount} credits`,
        referenceId: null
      }
    );

    // Update balance using creditService (updates users.credits)
    await creditService.completePurchaseTransaction(transaction.id);
    const newBalance = await creditService.getBalance(userId, storeId);

    res.json({
      success: true,
      message: `Successfully purchased ${amount} credits`,
      data: {
        transaction: {
          id: transaction.id,
          amount: parseFloat(transaction.amount),
          type: transaction.transaction_type
        },
        balance: {
          current: newBalance
        }
      }
    });
  } catch (error) {
    console.error('Purchase credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to purchase credits',
      details: error.message
    });
  }
});

/**
 * POST /api/credits/spend
 * Spend credits (internal use - called by services)
 */
router.post('/spend', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.user.store_id;
    const { amount, serviceKey, description } = req.body;

    // Validate
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    // Check balance using creditService
    const hasCredits = await creditService.hasEnoughCredits(userId, storeId, amount);

    if (!hasCredits) {
      const currentBalance = await creditService.getBalance(userId, storeId);
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        required: amount,
        available: currentBalance
      });
    }

    // Deduct credits using creditService
    const result = await creditService.deduct(
      userId,
      storeId,
      amount,
      description || 'Credit spent',
      { service_key: serviceKey },
      null,
      serviceKey || 'manual_spend'
    );

    res.json({
      success: true,
      message: `${amount} credits spent successfully`,
      data: {
        amount_spent: amount,
        new_balance: result.remaining_balance
      }
    });
  } catch (error) {
    console.error('Spend credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to spend credits',
      details: error.message
    });
  }
});

module.exports = router;
