const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const creditService = require('../services/credit-service');

/**
 * Get credit pricing options for a specific currency
 * GET /api/credits/pricing?currency=usd
 */
router.get('/pricing', async (req, res) => {
  try {
    const currency = (req.query.currency || 'usd').toLowerCase();

    console.log(`💰 [Credits API] Getting pricing for currency: ${currency}`);

    const pricingService = require('../services/pricing-service');
    const pricing = await pricingService.getPricingForCurrency(currency);
    const vatRate = pricingService.getVatRate();

    console.log(`✅ [Credits API] Returning ${pricing.length} pricing options for ${currency} (with ${vatRate * 100}% BTW)`);

    res.json({
      success: true,
      data: pricing,
      currency: currency.toUpperCase(),
      tax: {
        rate: vatRate,
        percentage: Math.round(vatRate * 100),
        label: 'BTW',
        country: 'NL'
      }
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
 * Get available currencies for credit purchases
 * GET /api/credits/currencies
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
 * Get transaction history
 * GET /api/credits/transactions
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    // Credit purchases are global to the user, not per store - ignore store_id
    const limit = parseInt(req.query.limit) || 50;

    console.log('📋 [Transactions] Request received:', {
      userId,
      userEmail: req.user.email,
      limit
    });

    // DEBUG: Query ALL transactions to see what's in the table
    const { masterDbClient } = require('../database/masterConnection');
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

    const CreditTransaction = require('../models/CreditTransaction');
    const transactions = await CreditTransaction.getUserTransactions(userId, null, limit);

    console.log('📋 [Transactions] Found transactions:', {
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
 * Manually trigger daily credit deduction (admin only)
 * POST /api/credits/trigger-daily-deduction
 */
router.post('/trigger-daily-deduction', authMiddleware, authorize(['admin']), async (req, res) => {
  try {

    console.log('📊 Manual daily credit deduction triggered by:', req.user.email);

    // Import and execute the deduction script
    const runDailyDeduction = require('../../scripts/run-daily-credit-deduction');

    // Run in background to avoid timeout
    runDailyDeduction()
      .then(() => {
        console.log('✅ Manual daily deduction completed');
      })
      .catch((error) => {
        console.error('❌ Manual daily deduction failed:', error);
      });

    // Return immediately
    res.json({
      success: true,
      message: 'Daily credit deduction started. Check server logs for results.',
      triggered_at: new Date().toISOString(),
      triggered_by: req.user.email
    });

  } catch (error) {
    console.error('Error triggering daily deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger daily deduction',
      error: error.message
    });
  }
});

/**
 * Get store uptime report
 * GET /api/credits/uptime-report
 */
router.get('/uptime-report', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30, store_id } = req.query;

    const report = await creditService.getUptimeReport(userId, days, store_id);

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

module.exports = router;
