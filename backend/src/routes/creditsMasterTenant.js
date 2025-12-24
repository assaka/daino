/**
 * Credits Routes (Master-Tenant Architecture)
 *
 * GET /api/credits/balance - Get current credit balance
 * GET /api/credits/balance/cached - Get cached balance (fast)
 * GET /api/credits/transactions - Get transaction history
 * GET /api/credits/uptime-report - Get store uptime report with daily charges
 * POST /api/credits/purchase - Purchase credits
 * POST /api/credits/spend - Spend credits (internal use)
 * POST /api/credits/sync - Sync balance to tenant cache
 */

const express = require('express');
const router = express.Router();
const CreditTransaction = require('../models/CreditTransaction');
const { authMiddleware } = require('../middleware/authMiddleware');
const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('../services/database/ConnectionManager');
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

    // Sync to tenant DB cache
    try {
      await syncBalanceToTenant(storeId, balance);
    } catch (syncError) {
      console.warn('Failed to sync balance to tenant:', syncError.message);
    }

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
 * GET /api/credits/balance/cached
 * Get cached balance from tenant DB (fast, may be stale)
 */
router.get('/balance/cached', authMiddleware, async (req, res) => {
  try {
    const storeId = req.user.store_id;

    // Try to get from tenant DB cache
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: cached, error } = await tenantDb
      .from('credit_balance_cache')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error || !cached) {
      // Cache miss - redirect to fresh endpoint
      return res.redirect('/api/credits/balance');
    }

    // Check if cache is stale (> 5 minutes)
    const cacheAge = Date.now() - new Date(cached.last_synced_at).getTime();
    const isStale = cacheAge > 5 * 60 * 1000;

    if (isStale) {
      // Redirect to fresh endpoint
      return res.redirect('/api/credits/balance');
    }

    res.json({
      success: true,
      data: {
        balance: parseFloat(cached.balance),
        cached: true,
        last_synced: cached.last_synced_at
      }
    });
  } catch (error) {
    console.error('Get cached balance error:', error);
    // Fallback to fresh balance
    return res.redirect('/api/credits/balance');
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

    // Sync to tenant cache
    await syncBalanceToTenant(storeId, newBalance);

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

    // Sync balance to tenant cache
    await syncBalanceToTenant(storeId, result.remaining_balance);

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

/**
 * POST /api/credits/sync
 * Force sync balance from master to tenant cache
 */
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const storeId = req.user.store_id;

    // Get balance from users.credits (single source of truth)
    const balance = await creditService.getBalance(userId, storeId);

    await syncBalanceToTenant(storeId, balance);

    res.json({
      success: true,
      message: 'Balance synced to tenant cache',
      data: {
        balance: balance
      }
    });
  } catch (error) {
    console.error('Sync balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync balance'
    });
  }
});

/**
 * Helper: Sync balance to tenant DB cache
 * @private
 */
async function syncBalanceToTenant(storeId, balance) {
  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('credit_balance_cache')
      .upsert({
        store_id: storeId,
        balance: parseFloat(balance),
        last_synced_at: new Date().toISOString()
      });

    if (error) {
      console.error('Sync to tenant failed:', error);
    }
  } catch (error) {
    console.error('Sync to tenant error:', error);
    // Don't throw - sync is optional
  }
}

module.exports = router;
