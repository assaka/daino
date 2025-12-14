const { masterDbClient } = require('../database/masterConnection');
const CreditTransaction = require('../models/CreditTransaction');
const AkeneoSchedule = require('../models/AkeneoSchedule');
const ServiceCreditCost = require('../models/ServiceCreditCost');

// Grace period for insufficient credits (in days)
const CREDIT_GRACE_PERIOD_DAYS = 3;

class CreditService {
  constructor() {
    // No hardcoded costs - any feature can specify its own cost
  }

  /**
   * Calculate days since a date
   * @param {string} dateString - ISO date string
   * @returns {number} - Number of days since the date
   */
  _daysSince(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get credit balance for a user (single source of truth: users.credits)
   * Note: storeId parameter kept for backward compatibility but not used
   */
  async getBalance(userId, storeId = null) {
    const { data: user, error } = await masterDbClient
      .from('users')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user credits:', error);
      return 0;
    }

    return user ? parseFloat(user.credits || 0) : 0;
  }

  /**
   * Check if user has enough credits for a specific operation
   * Note: storeId parameter kept for backward compatibility but not used
   */
  async hasEnoughCredits(userId, storeId = null, requiredCredits) {
    const balance = await this.getBalance(userId);
    return balance >= requiredCredits;
  }

  /**
   * Universal credit deduction method - any feature can use this
   * @param {string} userId - User ID
   * @param {string} storeId - Store ID (kept for usage tracking only)
   * @param {number} amount - Amount of credits to deduct
   * @param {string} description - Description of what the credits were used for
   * @param {object} metadata - Optional metadata object with additional info
   * @param {string} referenceId - Optional reference ID (e.g., schedule ID, product ID)
   * @param {string} referenceType - Optional reference type (e.g., 'akeneo_schedule', 'product_export')
   * @returns {object} - Deduction result with remaining balance
   */
  async deduct(userId, storeId, amount, description, metadata = {}, referenceId = null, referenceType = null) {
    const creditAmount = parseFloat(amount);
    const balance = await this.getBalance(userId);
    const hasCredits = await this.hasEnoughCredits(userId, storeId, creditAmount);

    if (!hasCredits) {
      throw new Error(`Insufficient credits. Required: ${creditAmount}, Available: ${balance}`);
    }

    const newBalance = balance - creditAmount;
    const { error: updateError } = await masterDbClient
      .from('users')
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, credits')
      .single();

    if (updateError) {
      throw new Error('Failed to deduct credits');
    }

    // Log credit usage to tenant DB for reporting
    if (storeId) {
      try {
        console.log(`[CREDIT_USAGE] Attempting to log credit usage for store ${storeId}`);
        const ConnectionManager = require('./database/ConnectionManager');
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const { v4: uuidv4 } = require('uuid');

        const insertData = {
          id: uuidv4(),
          user_id: userId,
          store_id: storeId,
          credits_used: creditAmount,
          usage_type: referenceType || 'general',
          reference_id: referenceId,
          reference_type: referenceType,
          description: description,
          metadata: {
            ...metadata,
            balance_before: balance,
            balance_after: newBalance,
            charged_at: new Date().toISOString()
          }
        };

        const { error: insertError } = await tenantDb
          .from('credit_usage')
          .insert(insertData);

        if (insertError) {
          console.error(`[CREDIT_USAGE] Insert error for store ${storeId}:`, insertError.message);
        } else {
          console.log(`[CREDIT_USAGE] Successfully logged ${creditAmount} credits for store ${storeId}`);
        }
      } catch (logError) {
        // Log but don't fail the deduction if credit_usage insert fails
        console.error('[CREDIT_USAGE] Failed to log to tenant DB:', logError.message);
      }
    }

    return {
      success: true,
      credits_deducted: creditAmount,
      remaining_balance: newBalance,
      description: description
    };
  }

  /**
   * Get comprehensive credit information for a user/store
   * Note: Now uses users.credits as single source of truth
   */
  async getCreditInfo(userId, storeId) {
    // Get user's current balance from users.credits
    const balance = await this.getBalance(userId);

    // Get recent transactions (purchases)
    const recentTransactions = await CreditTransaction.getUserTransactions(userId, storeId, 10);

    // Calculate total purchased from transactions (master DB)
    const { data: transactions } = await masterDbClient
      .from('credit_transactions')
      .select('credits_amount')
      .eq('user_id', userId)
      .eq('status', 'completed');

    const totalPurchased = (transactions || []).reduce((sum, t) => sum + parseFloat(t.credits_amount || 0), 0);

    // Check schedules that need credits
    const scheduleInfo = await AkeneoSchedule.getSchedulesNeedingCredits(userId, storeId);

    return {
      balance: parseFloat(balance),
      total_purchased: totalPurchased,
      recent_transactions: recentTransactions,
      schedule_info: scheduleInfo
    };
  }

  /**
   * Check if an Akeneo schedule can run (has enough credits)
   */
  async canRunAkeneoSchedule(userId, storeId, scheduleId) {
    const schedule = await AkeneoSchedule.findOne({
      where: { id: scheduleId, store_id: storeId }
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const requiredCredits = parseFloat(schedule.credit_cost) || 0.1; // Default 0.1 credits
    const hasCredits = await this.hasEnoughCredits(userId, storeId, requiredCredits);

    return {
      can_run: hasCredits,
      required_credits: requiredCredits,
      current_balance: await this.getBalance(userId, storeId),
      schedule: {
        id: schedule.id,
        import_type: schedule.import_type,
        schedule_type: schedule.schedule_type
      }
    };
  }

  /**
   * Deduct credits for an Akeneo schedule execution
   */
  async deductCreditsForSchedule(userId, scheduleId) {
    const schedule = await AkeneoSchedule.findByPk(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    return await schedule.deductCreditsForExecution(userId);
  }

  /**
   * Record credit usage for manual Akeneo operations
   */
  async recordManualAkeneoUsage(userId, storeId, importType, metadata = {}) {
    const creditsUsed = 0.1; // Default cost for Akeneo operations
    
    return await this.deduct(
      userId, 
      storeId, 
      creditsUsed, 
      `Manual Akeneo ${importType} import`,
      { import_type: importType, ...metadata },
      null,
      'manual_import'
    );
  }

  /**
   * Check if user can publish store (has enough credits for daily cost)
   */
  async canPublishStore(userId, storeId) {
    const dailyCost = 1.0; // 1 credit per day
    const hasCredits = await this.hasEnoughCredits(userId, storeId, dailyCost);
    
    return {
      can_publish: hasCredits,
      required_credits: dailyCost,
      current_balance: await this.getBalance(userId, storeId),
      message: hasCredits ? 'Ready to publish' : 'Insufficient credits for publishing'
    };
  }

  /**
   * Start charging daily credits for published store
   */
  async startDailyCharging(userId, storeId) {
    const dailyCost = 1.0; // 1 credit per day
    
    return await this.deduct(
      userId,
      storeId,
      dailyCost,
      'Store publishing - daily charge',
      { 
        charge_type: 'daily',
        store_published: true,
        started_at: new Date().toISOString()
      },
      storeId,
      'store_publishing'
    );
  }

  /**
   * Charge daily fee for custom domain
   * Uses master DB lookup table and tenant DB via ConnectionManager
   * Implements 3-day grace period before deactivating domain for insufficient credits
   */
  async chargeDailyCustomDomainFee(userId, domainId, domainName) {
    let dailyCost = 0.5;
    try {
      dailyCost = await ServiceCreditCost.getCostByKey('custom_domain');
    } catch (error) {
      // Use fallback
    }

    // Check if domain is still active via master DB lookup table (include metadata for grace period)
    const { data: domain, error: lookupError } = await masterDbClient
      .from('custom_domains_lookup')
      .select('id, store_id, domain, is_active, is_verified, ssl_status, metadata')
      .eq('id', domainId)
      .maybeSingle();

    if (lookupError || !domain) {
      return {
        success: false,
        message: 'Domain not found in lookup table'
      };
    }

    if (!domain.is_active || !domain.is_verified || domain.ssl_status !== 'active') {
      return {
        success: false,
        message: 'Domain is not active, skipping daily charge'
      };
    }

    const ConnectionManager = require('./database/ConnectionManager');

    // Check if already charged today BEFORE deducting credits
    const chargeDate = new Date().toISOString().split('T')[0];
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(domain.store_id);

      const { data: existingCharge, error: checkError } = await tenantDb
        .from('credit_usage')
        .select('id, created_at')
        .eq('reference_id', domainId)
        .eq('reference_type', 'custom_domain')
        .gte('created_at', `${chargeDate}T00:00:00`)
        .lt('created_at', `${chargeDate}T23:59:59`)
        .maybeSingle();

      if (!checkError && existingCharge) {
        console.log(`[DAILY_DEDUCTION] Domain ${domainName} already charged today (${chargeDate}), skipping`);
        return {
          success: true,
          already_charged: true,
          message: `Already charged today (${chargeDate})`,
          credits_deducted: 0,
          charge_date: chargeDate
        };
      }
    } catch (checkError) {
      // If check fails, log but continue (fail-open to avoid missed charges)
      console.warn(`[DAILY_DEDUCTION] Could not check existing charge for domain ${domainId}:`, checkError.message);
    }

    // Get balance before deduction
    const balanceBefore = await this.getBalance(userId);
    const domainMetadata = domain.metadata || {};

    // Check if user has enough credits
    if (balanceBefore < dailyCost) {
      const gracePeriodStart = domainMetadata.credit_grace_period_start;
      const daysSinceGraceStart = this._daysSince(gracePeriodStart);

      if (!gracePeriodStart) {
        // Start grace period
        console.log(`[DAILY_DEDUCTION] Domain ${domainName}: Insufficient credits, starting ${CREDIT_GRACE_PERIOD_DAYS}-day grace period`);

        await masterDbClient
          .from('custom_domains_lookup')
          .update({
            metadata: {
              ...domainMetadata,
              credit_grace_period_start: new Date().toISOString(),
              credit_warning_sent: false
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', domainId);

        return {
          success: false,
          message: `Insufficient credits - grace period started (${CREDIT_GRACE_PERIOD_DAYS} days remaining)`,
          credits_deducted: 0,
          remaining_balance: balanceBefore,
          grace_period: {
            started: true,
            days_remaining: CREDIT_GRACE_PERIOD_DAYS
          }
        };
      } else if (daysSinceGraceStart >= CREDIT_GRACE_PERIOD_DAYS) {
        // Grace period expired - deactivate domain
        console.log(`[DAILY_DEDUCTION] Domain ${domainName}: Grace period expired after ${daysSinceGraceStart} days, deactivating`);

        // Deactivate domain in master DB lookup table
        await masterDbClient
          .from('custom_domains_lookup')
          .update({
            is_active: false,
            metadata: {
              ...domainMetadata,
              deactivated_reason: 'insufficient_credits',
              deactivated_at: new Date().toISOString(),
              credit_grace_period_start: null
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', domainId);

        // Also try to update tenant DB custom_domains table
        try {
          const tenantDb = await ConnectionManager.getStoreConnection(domain.store_id);
          await tenantDb
            .from('custom_domains')
            .update({
              is_active: false,
              metadata: {
                deactivated_reason: 'insufficient_credits',
                deactivated_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', domainId);
        } catch (tenantUpdateError) {
          console.warn(`[DAILY_DEDUCTION] Could not update tenant DB domain:`, tenantUpdateError.message);
        }

        return {
          success: false,
          message: 'Grace period expired - domain deactivated due to insufficient credits',
          credits_deducted: 0,
          remaining_balance: balanceBefore,
          domain_deactivated: true,
          grace_period: {
            expired: true,
            days_elapsed: daysSinceGraceStart
          }
        };
      } else {
        // Still in grace period
        const daysRemaining = CREDIT_GRACE_PERIOD_DAYS - daysSinceGraceStart;
        console.log(`[DAILY_DEDUCTION] Domain ${domainName}: Still in grace period (${daysRemaining} days remaining)`);

        return {
          success: false,
          message: `Insufficient credits - ${daysRemaining} day(s) remaining in grace period`,
          credits_deducted: 0,
          remaining_balance: balanceBefore,
          grace_period: {
            active: true,
            days_remaining: daysRemaining,
            started_at: gracePeriodStart
          }
        };
      }
    }

    // User has enough credits - clear any existing grace period
    if (domainMetadata.credit_grace_period_start) {
      console.log(`[DAILY_DEDUCTION] Domain ${domainName}: Credits restored, clearing grace period`);
      await masterDbClient
        .from('custom_domains_lookup')
        .update({
          metadata: {
            ...domainMetadata,
            credit_grace_period_start: null,
            credit_warning_sent: false
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', domainId);
    }

    // Ensure dailyCost is a number (not string)
    const costAmount = parseFloat(dailyCost);

    // Deduct credits
    const deductResult = await this.deduct(
      userId,
      domain.store_id,
      costAmount,
      `Custom domain - daily charge (${domainName})`,
      {
        charge_type: 'daily',
        domain_id: domainId,
        domain_name: domainName,
        charge_date: new Date().toISOString()
      },
      domainId,
      'custom_domain'
    );

    return {
      success: true,
      credits_deducted: costAmount,
      remaining_balance: deductResult.remaining_balance,
      message: `Daily charge applied for ${domainName}`
    };
  }

  /**
   * Record daily credit charge for published/active store
   * Uses master DB only - status='active' means store is published and billable
   * Also inserts record into store_uptime table in tenant DB for reporting
   * Implements 3-day grace period before pausing store for insufficient credits
   */
  async chargeDailyPublishingFee(userId, storeId) {
    let dailyCost = 1.0;
    try {
      dailyCost = await ServiceCreditCost.getCostByKey('store_daily_publishing');
    } catch (error) {
      // Use fallback
    }

    // Check if store is published in master DB (include metadata for grace period)
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('id, slug, status, is_active, published, metadata')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store || !store.published) {
      return {
        success: false,
        message: 'Store is not published, skipping daily charge'
      };
    }

    // Check if already charged today BEFORE deducting credits
    const chargeDate = new Date().toISOString().split('T')[0];
    try {
      const ConnectionManager = require('./database/ConnectionManager');
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const { data: existingCharge, error: checkError } = await tenantDb
        .from('store_uptime')
        .select('id, charged_date')
        .eq('store_id', storeId)
        .eq('charged_date', chargeDate)
        .maybeSingle();

      if (!checkError && existingCharge) {
        console.log(`[DAILY_DEDUCTION] Store ${store.slug} already charged today (${chargeDate}), skipping`);
        return {
          success: true,
          already_charged: true,
          message: `Already charged today (${chargeDate})`,
          credits_deducted: 0,
          charge_date: chargeDate
        };
      }
    } catch (checkError) {
      // If check fails, log but continue (fail-open to avoid missed charges)
      console.warn(`[DAILY_DEDUCTION] Could not check existing charge for store ${storeId}:`, checkError.message);
    }

    // Get balance before deduction
    const balanceBefore = await this.getBalance(userId);
    const storeMetadata = store.metadata || {};

    // Check if user has enough credits
    if (balanceBefore < dailyCost) {
      const gracePeriodStart = storeMetadata.credit_grace_period_start;
      const daysSinceGraceStart = this._daysSince(gracePeriodStart);

      if (!gracePeriodStart) {
        // Start grace period
        console.log(`[DAILY_DEDUCTION] Store ${store.slug}: Insufficient credits, starting ${CREDIT_GRACE_PERIOD_DAYS}-day grace period`);

        await masterDbClient
          .from('stores')
          .update({
            metadata: {
              ...storeMetadata,
              credit_grace_period_start: new Date().toISOString(),
              credit_warning_sent: false
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', storeId);

        return {
          success: false,
          message: `Insufficient credits - grace period started (${CREDIT_GRACE_PERIOD_DAYS} days remaining)`,
          credits_deducted: 0,
          remaining_balance: balanceBefore,
          grace_period: {
            started: true,
            days_remaining: CREDIT_GRACE_PERIOD_DAYS
          }
        };
      } else if (daysSinceGraceStart >= CREDIT_GRACE_PERIOD_DAYS) {
        // Grace period expired - pause the store
        console.log(`[DAILY_DEDUCTION] Store ${store.slug}: Grace period expired after ${daysSinceGraceStart} days, pausing store`);

        await masterDbClient
          .from('stores')
          .update({
            published: false,
            status: 'paused',
            metadata: {
              ...storeMetadata,
              paused_reason: 'insufficient_credits',
              paused_at: new Date().toISOString(),
              credit_grace_period_start: null // Clear grace period
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', storeId);

        return {
          success: false,
          message: 'Grace period expired - store paused due to insufficient credits',
          credits_deducted: 0,
          remaining_balance: balanceBefore,
          store_paused: true,
          grace_period: {
            expired: true,
            days_elapsed: daysSinceGraceStart
          }
        };
      } else {
        // Still in grace period
        const daysRemaining = CREDIT_GRACE_PERIOD_DAYS - daysSinceGraceStart;
        console.log(`[DAILY_DEDUCTION] Store ${store.slug}: Still in grace period (${daysRemaining} days remaining)`);

        return {
          success: false,
          message: `Insufficient credits - ${daysRemaining} day(s) remaining in grace period`,
          credits_deducted: 0,
          remaining_balance: balanceBefore,
          grace_period: {
            active: true,
            days_remaining: daysRemaining,
            started_at: gracePeriodStart
          }
        };
      }
    }

    // User has enough credits - clear any existing grace period
    if (storeMetadata.credit_grace_period_start) {
      console.log(`[DAILY_DEDUCTION] Store ${store.slug}: Credits restored, clearing grace period`);
      await masterDbClient
        .from('stores')
        .update({
          metadata: {
            ...storeMetadata,
            credit_grace_period_start: null,
            credit_warning_sent: false
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);
    }

    // Deduct credits
    const deductResult = await this.deduct(
      userId,
      storeId,
      dailyCost,
      'Store publishing - daily charge',
      {
        charge_type: 'daily',
        store_published: true,
        charge_date: new Date().toISOString()
      },
      storeId,
      'store_publishing'
    );

    // Insert store_uptime record into tenant DB for reporting
    // Note: credit_usage is now handled by the deduct() method
    if (deductResult.success) {
      try {
        console.log(`[STORE_UPTIME] Attempting to log uptime for store ${storeId}`);
        const ConnectionManager = require('./database/ConnectionManager');
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const { v4: uuidv4 } = require('uuid');
        const chargeDate = new Date().toISOString().split('T')[0];

        // Insert into store_uptime table
        const { error: uptimeInsertError } = await tenantDb
          .from('store_uptime')
          .upsert({
            id: uuidv4(),
            store_id: storeId,
            user_id: userId,
            charged_date: chargeDate,
            credits_charged: dailyCost,
            user_balance_before: balanceBefore,
            user_balance_after: deductResult.remaining_balance,
            store_name: store.slug,
            metadata: {
              charge_type: 'daily_publishing',
              store_published: true
            }
          }, {
            onConflict: 'store_id,charged_date',
            ignoreDuplicates: true
          });

        if (uptimeInsertError) {
          console.error(`[STORE_UPTIME] Insert error for store ${storeId}:`, uptimeInsertError.message);
        } else {
          console.log(`[STORE_UPTIME] Successfully logged uptime for store ${storeId} on ${chargeDate}`);
        }
      } catch (uptimeError) {
        // Log but don't fail the charge if store_uptime insert fails
        console.error('[STORE_UPTIME] Failed to insert record:', uptimeError.message);
      }
    }

    return deductResult;
  }

  /**
   * Create a credit purchase transaction
   */
  async createPurchaseTransaction(userId, storeId, amountUsd, creditsAmount, paymentIntentId = null) {
    return await CreditTransaction.createPurchase(
      userId,
      storeId,
      amountUsd,
      creditsAmount,
      paymentIntentId
    );
  }

  /**
   * Mark a purchase transaction as completed and add credits to user
   */
  async completePurchaseTransaction(transactionId, stripeChargeId = null) {
    console.log(`💳 [CreditService] completePurchaseTransaction called:`, { transactionId, stripeChargeId });

    const transaction = await CreditTransaction.findByPk(transactionId);

    if (!transaction) {
      console.error(`❌ [CreditService] Transaction not found: ${transactionId}`);
      throw new Error('Transaction not found');
    }

    console.log(`📋 [CreditService] Transaction found:`, {
      id: transaction.id,
      user_id: transaction.user_id,
      credits_amount: transaction.credits_amount,
      status: transaction.status
    });

    // Get user's current balance before update (master DB)
    const { data: userBefore, error: userError } = await masterDbClient
      .from('users')
      .select('id, credits')
      .eq('id', transaction.user_id)
      .single();

    if (userError) {
      console.error(`❌ [CreditService] Error fetching user ${transaction.user_id}:`, userError);
      throw new Error(`Failed to find user: ${userError.message}`);
    }

    if (!userBefore) {
      console.error(`❌ [CreditService] User not found: ${transaction.user_id}`);
      throw new Error(`User not found: ${transaction.user_id}`);
    }

    console.log(`👤 [CreditService] User found:`, {
      id: userBefore.id,
      currentCredits: userBefore.credits
    });

    const creditsToAdd = parseFloat(transaction.credits_amount);
    const newBalance = parseFloat(userBefore.credits || 0) + creditsToAdd;

    console.log(`💰 [CreditService] Updating credits:`, {
      currentBalance: userBefore.credits,
      creditsToAdd,
      newBalance
    });

    const { data: updatedUser, error: updateError } = await masterDbClient
      .from('users')
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction.user_id)
      .select('id, credits')
      .single();

    if (updateError) {
      console.error(`❌ [CreditService] Failed to update user credits:`, updateError);
      throw new Error(`Failed to update user credits: ${updateError.message}`);
    }

    console.log(`✅ [CreditService] Credits updated successfully:`, {
      userId: updatedUser?.id,
      newCredits: updatedUser?.credits
    });

    return await CreditTransaction.markCompleted(transactionId, stripeChargeId);
  }

  /**
   * Mark a purchase transaction as failed
   */
  async failPurchaseTransaction(transactionId, reason = null) {
    return await CreditTransaction.markFailed(transactionId, reason);
  }

  /**
   * Award bonus credits to a user
   */
  async awardBonusCredits(userId, storeId, creditsAmount, description = null) {
    // Get current balance
    const { data: user } = await masterDbClient
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    const newBalance = parseFloat(user?.credits || 0) + parseFloat(creditsAmount);

    // Add credits to users.credits (single source of truth, master DB)
    const { error } = await masterDbClient
      .from('users')
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to award bonus credits: ${error.message}`);
    }

    // Create bonus transaction record
    return await CreditTransaction.createBonus(userId, storeId, creditsAmount, description);
  }

  /**
   * Calculate credit pricing (can be made configurable later)
   */
  getCreditPricing() {
    return [
      {
        amount_usd: 10.00,
        credits: 100,
        price_per_credit: 0.10,
        popular: false
      },
      {
        amount_usd: 25.00,
        credits: 275,
        price_per_credit: 0.091,
        popular: true,
        savings: '9% savings'
      },
      {
        amount_usd: 50.00,
        credits: 600,
        price_per_credit: 0.083,
        popular: false,
        savings: '17% savings'
      },
      {
        amount_usd: 100.00,
        credits: 1250,
        price_per_credit: 0.080,
        popular: false,
        savings: '20% savings'
      }
    ];
  }

  /**
   * Get usage analytics for a user/store
   * Note: Simplified - detailed usage tracking not implemented
   */
  async getUsageAnalytics(userId, storeId, days = 30) {
    const balance = await this.getBalance(userId);

    return {
      period_days: days,
      current_balance: balance,
      daily_usage: [],
      total_credits_used: 0,
      total_operations: 0
    };
  }

  /**
   * Get store uptime report
   * Shows daily credit charges for published stores
   * Queries only tenant database - no master DB access needed
   */
  async getUptimeReport(userId, days = 30, storeId = null) {
    const ConnectionManager = require('./database/ConnectionManager');

    // Store ID is required (from query param or current store context)
    if (!storeId) {
      return {
        records: [],
        summary: {
          total_stores: 0,
          total_days: 0,
          total_credits_charged: 0
        },
        store_breakdown: [],
        period_days: parseInt(days),
        message: 'Store ID is required'
      };
    }

    try {
      // Query this store's tenant DB for uptime records
      let tenantDb;
      try {
        tenantDb = await ConnectionManager.getStoreConnection(storeId);
      } catch (connectionError) {
        // Store doesn't have a database configured - return empty result
        console.warn(`No database configured for store ${storeId}:`, connectionError.message);
        return {
          records: [],
          summary: {
            total_stores: 0,
            total_days: 0,
            total_credits_charged: 0
          },
          store_breakdown: [],
          period_days: parseInt(days),
          message: 'Store database not configured'
        };
      }

      // Get uptime records for this store
      const { data: records, error } = await tenantDb
        .from('store_uptime')
        .select('*')
        .eq('user_id', userId)
        .eq('store_id', storeId)
        .order('charged_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(parseInt(days) * 10);

      if (error) {
        console.error('Error querying store_uptime:', error);
        // Return empty result instead of throwing
        return {
          records: [],
          summary: {
            total_stores: 0,
            total_days: 0,
            total_credits_charged: 0
          },
          store_breakdown: [],
          period_days: parseInt(days),
          message: `Query error: ${error.message}`
        };
      }

      const uptimeRecords = records || [];

      // Calculate summary statistics
      const totalCredits = uptimeRecords.reduce((sum, r) => sum + parseFloat(r.credits_charged || 0), 0);
      const dates = uptimeRecords.map(r => new Date(r.charged_date));

      const summary = {
        total_stores: uptimeRecords.length > 0 ? 1 : 0,
        total_days: uptimeRecords.length,
        total_credits_charged: totalCredits,
        first_charge_date: dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null,
        last_charge_date: dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null
      };

      // Store breakdown (single store)
      const storeBreakdown = uptimeRecords.length > 0 ? [{
        store_id: storeId,
        store_name: uptimeRecords[0]?.store_name || 'Unknown',
        days_running: uptimeRecords.length,
        total_credits: totalCredits,
        first_charge: dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null,
        last_charge: dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null
      }] : [];

      return {
        records: uptimeRecords,
        summary,
        store_breakdown: storeBreakdown,
        period_days: parseInt(days)
      };
    } catch (error) {
      console.error(`Failed to get uptime report:`, error);
      throw error;
    }
  }
}

module.exports = new CreditService();