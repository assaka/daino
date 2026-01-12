const { masterDbClient } = require('../database/masterConnection');
const { v4: uuidv4 } = require('uuid');

// Commission hold period in days (to handle refunds)
const COMMISSION_HOLD_DAYS = 14;

// Cookie expiration in days
const REFERRAL_COOKIE_DAYS = 30;

class AffiliateService {
  constructor() {
    // Service initialization
  }

  /**
   * Generate a unique referral code
   */
  _generateReferralCode(firstName, lastName) {
    const base = `${firstName}${lastName}`.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${base}${random}`;
  }

  /**
   * Get affiliate stats for dashboard
   */
  async getStats() {
    const { data: affiliates, error } = await masterDbClient
      .from('affiliates')
      .select('status');

    if (error) throw error;

    const stats = {
      total: affiliates?.length || 0,
      pending: affiliates?.filter(a => a.status === 'pending').length || 0,
      approved: affiliates?.filter(a => a.status === 'approved').length || 0,
      suspended: affiliates?.filter(a => a.status === 'suspended').length || 0
    };

    // Get pending payouts
    const { data: payouts } = await masterDbClient
      .from('affiliate_payouts')
      .select('amount')
      .eq('status', 'pending');

    stats.pendingPayoutAmount = payouts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
    stats.pendingPayoutCount = payouts?.length || 0;

    return stats;
  }

  /**
   * Get all affiliates with tier info
   */
  async getAllAffiliates(filters = {}) {
    let query = masterDbClient
      .from('affiliates')
      .select('*, affiliate_tiers(name, code, commission_rate, commission_type)')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.type) {
      query = query.eq('affiliate_type', filters.type);
    }
    if (filters.search) {
      query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get single affiliate by ID with full details
   */
  async getAffiliateById(affiliateId) {
    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .select('*, affiliate_tiers(name, code, commission_rate, commission_type, min_payout_amount)')
      .eq('id', affiliateId)
      .single();

    if (error) throw error;
    return affiliate;
  }

  /**
   * Get affiliate by referral code
   */
  async getAffiliateByCode(referralCode) {
    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .select('id, referral_code, status, tier_id, custom_commission_type, custom_commission_value')
      .eq('referral_code', referralCode)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) throw error;
    return affiliate;
  }

  /**
   * Submit affiliate application (public)
   */
  async applyAsAffiliate(applicationData) {
    const {
      email,
      first_name,
      last_name,
      company_name,
      phone,
      website_url,
      affiliate_type = 'individual',
      application_notes
    } = applicationData;

    // Check if email already exists
    const { data: existing } = await masterDbClient
      .from('affiliates')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      throw new Error('An affiliate application with this email already exists');
    }

    // Get default tier
    const { data: defaultTier } = await masterDbClient
      .from('affiliate_tiers')
      .select('id')
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();

    // Generate unique referral code
    let referralCode = this._generateReferralCode(first_name, last_name);
    let codeExists = true;
    let attempts = 0;

    while (codeExists && attempts < 10) {
      const { data: existingCode } = await masterDbClient
        .from('affiliates')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (!existingCode) {
        codeExists = false;
      } else {
        referralCode = this._generateReferralCode(first_name, last_name);
        attempts++;
      }
    }

    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .insert({
        id: uuidv4(),
        email,
        first_name,
        last_name,
        company_name,
        phone,
        website_url,
        affiliate_type,
        application_notes,
        referral_code: referralCode,
        tier_id: defaultTier?.id || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return affiliate;
  }

  /**
   * Approve affiliate application
   */
  async approveAffiliate(affiliateId, approvedBy) {
    const crypto = require('crypto');

    // Generate password setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        password_reset_token: setupToken,
        password_reset_expires: tokenExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliateId)
      .select()
      .single();

    if (error) throw error;

    // Send welcome email with password setup link
    try {
      const masterEmailService = require('./master-email-service');
      const baseUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://www.dainostore.com';
      const setupUrl = `${baseUrl}/affiliate/login?setup=${setupToken}`;

      await masterEmailService.sendAffiliateWelcomeEmail({
        recipientEmail: affiliate.email,
        affiliateName: `${affiliate.first_name} ${affiliate.last_name}`,
        affiliateFirstName: affiliate.first_name,
        referralCode: affiliate.referral_code,
        setupUrl
      });
      console.log('📧 Affiliate welcome email sent to:', affiliate.email);
    } catch (emailError) {
      console.error('⚠️ Failed to send affiliate welcome email:', emailError.message);
      // Don't fail the approval if email fails
    }

    return affiliate;
  }

  /**
   * Reject affiliate application
   */
  async rejectAffiliate(affiliateId, reason = null) {
    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .update({
        status: 'rejected',
        admin_notes: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliateId)
      .select()
      .single();

    if (error) throw error;
    return affiliate;
  }

  /**
   * Suspend affiliate
   */
  async suspendAffiliate(affiliateId, reason = null) {
    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .update({
        status: 'suspended',
        admin_notes: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliateId)
      .select()
      .single();

    if (error) throw error;
    return affiliate;
  }

  /**
   * Update affiliate details
   */
  async updateAffiliate(affiliateId, updates) {
    const allowedFields = [
      'tier_id', 'custom_commission_type', 'custom_commission_value',
      'admin_notes', 'status', 'affiliate_type'
    ];

    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    filteredUpdates.updated_at = new Date().toISOString();

    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .update(filteredUpdates)
      .eq('id', affiliateId)
      .select()
      .single();

    if (error) throw error;
    return affiliate;
  }

  // ============================================
  // TIER MANAGEMENT
  // ============================================

  /**
   * Get all affiliate tiers
   */
  async getAllTiers() {
    const { data, error } = await masterDbClient
      .from('affiliate_tiers')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create affiliate tier
   */
  async createTier(tierData) {
    const { data: tier, error } = await masterDbClient
      .from('affiliate_tiers')
      .insert({
        id: uuidv4(),
        ...tierData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return tier;
  }

  /**
   * Update affiliate tier
   */
  async updateTier(tierId, updates) {
    const { data: tier, error } = await masterDbClient
      .from('affiliate_tiers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', tierId)
      .select()
      .single();

    if (error) throw error;
    return tier;
  }

  /**
   * Delete affiliate tier
   */
  async deleteTier(tierId) {
    // Check if any affiliates use this tier
    const { data: affiliates } = await masterDbClient
      .from('affiliates')
      .select('id')
      .eq('tier_id', tierId)
      .limit(1);

    if (affiliates && affiliates.length > 0) {
      throw new Error('Cannot delete tier that has affiliates assigned to it');
    }

    const { error } = await masterDbClient
      .from('affiliate_tiers')
      .delete()
      .eq('id', tierId);

    if (error) throw error;
    return { success: true };
  }

  // ============================================
  // REFERRAL TRACKING
  // ============================================

  /**
   * Track referral link click
   */
  async trackClick(referralCode, trackingData = {}) {
    const affiliate = await this.getAffiliateByCode(referralCode);
    if (!affiliate) {
      throw new Error('Invalid referral code');
    }

    const cookieExpires = new Date();
    cookieExpires.setDate(cookieExpires.getDate() + REFERRAL_COOKIE_DAYS);

    const { data: referral, error } = await masterDbClient
      .from('affiliate_referrals')
      .insert({
        id: uuidv4(),
        affiliate_id: affiliate.id,
        referred_email: trackingData.email || 'unknown',
        referral_code_used: referralCode,
        tracking_source: trackingData.source,
        utm_source: trackingData.utm_source,
        utm_medium: trackingData.utm_medium,
        utm_campaign: trackingData.utm_campaign,
        landing_page: trackingData.landing_page,
        ip_address: trackingData.ip_address,
        user_agent: trackingData.user_agent,
        status: 'clicked',
        cookie_set_at: new Date().toISOString(),
        cookie_expires_at: cookieExpires.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update affiliate total referrals
    await masterDbClient
      .from('affiliates')
      .update({
        total_referrals: affiliate.total_referrals + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliate.id);

    return {
      referral_id: referral.id,
      cookie_expires: cookieExpires.toISOString()
    };
  }

  /**
   * Process signup referral - called when user registers
   */
  async processSignupReferral(userId, referralCode, metadata = {}) {
    const affiliate = await this.getAffiliateByCode(referralCode);
    if (!affiliate) {
      console.log(`[AFFILIATE] Invalid referral code: ${referralCode}`);
      return null;
    }

    // Get user info
    const { data: user } = await masterDbClient
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!user) {
      console.log(`[AFFILIATE] User not found: ${userId}`);
      return null;
    }

    // Check if referral already exists for this user
    const { data: existingReferral } = await masterDbClient
      .from('affiliate_referrals')
      .select('id')
      .eq('referred_user_id', userId)
      .maybeSingle();

    if (existingReferral) {
      console.log(`[AFFILIATE] Referral already exists for user: ${userId}`);
      return existingReferral;
    }

    // Check for existing click-based referral by email and update it
    const { data: clickReferral } = await masterDbClient
      .from('affiliate_referrals')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('referred_email', user.email)
      .eq('status', 'clicked')
      .maybeSingle();

    if (clickReferral) {
      // Update existing click referral
      const { data: referral, error } = await masterDbClient
        .from('affiliate_referrals')
        .update({
          referred_user_id: userId,
          status: 'signed_up',
          updated_at: new Date().toISOString()
        })
        .eq('id', clickReferral.id)
        .select()
        .single();

      if (error) throw error;
      return referral;
    }

    // Create new referral record
    const { data: referral, error } = await masterDbClient
      .from('affiliate_referrals')
      .insert({
        id: uuidv4(),
        affiliate_id: affiliate.id,
        referred_user_id: userId,
        referred_email: user.email,
        referral_code_used: referralCode,
        ip_address: metadata.ip,
        user_agent: metadata.userAgent,
        status: 'signed_up',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[AFFILIATE] Referral recorded: user ${userId} referred by affiliate ${affiliate.id}`);
    return referral;
  }

  /**
   * Process commission on purchase
   */
  async processCommission({ userId, purchaseAmount, transactionId, sourceType }) {
    // Check if user has an affiliate referral
    const { data: referral, error: refError } = await masterDbClient
      .from('affiliate_referrals')
      .select('*, affiliates(*, affiliate_tiers(*))')
      .eq('referred_user_id', userId)
      .in('status', ['signed_up', 'converted', 'qualified'])
      .maybeSingle();

    if (refError) {
      console.error('[AFFILIATE] Error fetching referral:', refError);
      return null;
    }

    if (!referral) {
      console.log(`[AFFILIATE] No referral found for user: ${userId}`);
      return null;
    }

    const affiliate = referral.affiliates;
    if (!affiliate || affiliate.status !== 'approved') {
      console.log(`[AFFILIATE] Affiliate not approved or not found`);
      return null;
    }

    // Determine commission rate
    let commissionType = affiliate.custom_commission_type || affiliate.affiliate_tiers?.commission_type || 'percentage';
    let commissionRate = affiliate.custom_commission_value || affiliate.affiliate_tiers?.commission_rate || 0.10;

    // Calculate commission amount
    let commissionAmount;
    if (commissionType === 'percentage') {
      commissionAmount = purchaseAmount * commissionRate;
    } else {
      commissionAmount = commissionRate;
    }

    // Round to 2 decimal places
    commissionAmount = Math.round(commissionAmount * 100) / 100;

    // Calculate hold until date
    const holdUntil = new Date();
    holdUntil.setDate(holdUntil.getDate() + COMMISSION_HOLD_DAYS);

    // Create commission record
    const { data: commission, error: commError } = await masterDbClient
      .from('affiliate_commissions')
      .insert({
        id: uuidv4(),
        affiliate_id: affiliate.id,
        referral_id: referral.id,
        source_type: sourceType,
        source_transaction_id: transactionId,
        purchase_amount: purchaseAmount,
        commission_type: commissionType,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'pending',
        hold_until: holdUntil.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (commError) {
      console.error('[AFFILIATE] Error creating commission:', commError);
      throw commError;
    }

    // Update referral status to converted if first purchase
    if (referral.status === 'signed_up') {
      await masterDbClient
        .from('affiliate_referrals')
        .update({
          status: 'converted',
          first_purchase_at: new Date().toISOString(),
          first_purchase_amount: purchaseAmount,
          total_purchases: purchaseAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      // Update affiliate conversion count
      await masterDbClient
        .from('affiliates')
        .update({
          total_conversions: affiliate.total_conversions + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', affiliate.id);
    } else {
      // Update total purchases
      await masterDbClient
        .from('affiliate_referrals')
        .update({
          total_purchases: parseFloat(referral.total_purchases || 0) + purchaseAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', referral.id);
    }

    // Update affiliate earnings
    await masterDbClient
      .from('affiliates')
      .update({
        total_earnings: parseFloat(affiliate.total_earnings || 0) + commissionAmount,
        pending_balance: parseFloat(affiliate.pending_balance || 0) + commissionAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliate.id);

    console.log(`[AFFILIATE] Commission created: $${commissionAmount} for affiliate ${affiliate.id}`);
    return commission;
  }

  // ============================================
  // REFERRALS & COMMISSIONS QUERIES
  // ============================================

  /**
   * Get referrals for an affiliate
   */
  async getAffiliateReferrals(affiliateId, limit = 50) {
    const { data, error } = await masterDbClient
      .from('affiliate_referrals')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get commissions for an affiliate
   */
  async getAffiliateCommissions(affiliateId, limit = 50) {
    const { data, error } = await masterDbClient
      .from('affiliate_commissions')
      .select('*, affiliate_referrals(referred_email)')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Approve commission (admin)
   */
  async approveCommission(commissionId, approvedBy) {
    const { data: commission, error } = await masterDbClient
      .from('affiliate_commissions')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commissionId)
      .select()
      .single();

    if (error) throw error;
    return commission;
  }

  /**
   * Cancel commission (admin)
   */
  async cancelCommission(commissionId, reason = null) {
    // Get commission to update affiliate balance
    const { data: existing } = await masterDbClient
      .from('affiliate_commissions')
      .select('affiliate_id, commission_amount, status')
      .eq('id', commissionId)
      .single();

    if (!existing) throw new Error('Commission not found');

    const { data: commission, error } = await masterDbClient
      .from('affiliate_commissions')
      .update({
        status: 'cancelled',
        notes: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', commissionId)
      .select()
      .single();

    if (error) throw error;

    // Update affiliate pending balance if was pending/approved
    if (['pending', 'approved'].includes(existing.status)) {
      const { data: affiliate } = await masterDbClient
        .from('affiliates')
        .select('pending_balance')
        .eq('id', existing.affiliate_id)
        .single();

      await masterDbClient
        .from('affiliates')
        .update({
          pending_balance: Math.max(0, parseFloat(affiliate.pending_balance || 0) - parseFloat(existing.commission_amount)),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.affiliate_id);
    }

    return commission;
  }

  // ============================================
  // PAYOUT MANAGEMENT
  // ============================================

  /**
   * Get all payouts
   */
  async getAllPayouts(filters = {}) {
    let query = masterDbClient
      .from('affiliate_payouts')
      .select('*, affiliates(email, first_name, last_name)')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.affiliate_id) {
      query = query.eq('affiliate_id', filters.affiliate_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get payouts for an affiliate
   */
  async getAffiliatePayouts(affiliateId) {
    const { data, error } = await masterDbClient
      .from('affiliate_payouts')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Request payout (affiliate)
   */
  async requestPayout(affiliateId, amount) {
    const affiliate = await this.getAffiliateById(affiliateId);

    if (!affiliate) throw new Error('Affiliate not found');
    if (affiliate.status !== 'approved') throw new Error('Affiliate is not approved');
    if (!affiliate.stripe_connect_account_id) throw new Error('Stripe account not connected');
    if (!affiliate.stripe_payouts_enabled) throw new Error('Stripe payouts not enabled');

    const minPayout = affiliate.affiliate_tiers?.min_payout_amount || 50;
    if (amount < minPayout) {
      throw new Error(`Minimum payout amount is $${minPayout}`);
    }

    if (amount > parseFloat(affiliate.pending_balance || 0)) {
      throw new Error('Insufficient balance');
    }

    const { data: payout, error } = await masterDbClient
      .from('affiliate_payouts')
      .insert({
        id: uuidv4(),
        affiliate_id: affiliateId,
        amount,
        status: 'pending',
        requested_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return payout;
  }

  /**
   * Process payout via Stripe Connect
   */
  async processPayout(payoutId, processedBy) {
    const { data: payout } = await masterDbClient
      .from('affiliate_payouts')
      .select('*, affiliates(stripe_connect_account_id, pending_balance)')
      .eq('id', payoutId)
      .single();

    if (!payout) throw new Error('Payout not found');
    if (payout.status !== 'pending') throw new Error('Payout is not pending');

    const affiliate = payout.affiliates;
    if (!affiliate.stripe_connect_account_id) {
      throw new Error('Affiliate has no Stripe account connected');
    }

    // Update status to processing
    await masterDbClient
      .from('affiliate_payouts')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString(),
        processed_by: processedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId);

    try {
      // Create Stripe transfer
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const transfer = await stripe.transfers.create({
        amount: Math.round(payout.amount * 100), // Convert to cents
        currency: 'usd',
        destination: affiliate.stripe_connect_account_id,
        metadata: {
          payout_id: payoutId,
          affiliate_id: payout.affiliate_id,
          type: 'affiliate_commission'
        }
      });

      // Update payout as completed
      const { data: updatedPayout, error } = await masterDbClient
        .from('affiliate_payouts')
        .update({
          status: 'completed',
          stripe_transfer_id: transfer.id,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', payoutId)
        .select()
        .single();

      if (error) throw error;

      // Update affiliate balances
      await masterDbClient
        .from('affiliates')
        .update({
          pending_balance: Math.max(0, parseFloat(affiliate.pending_balance || 0) - payout.amount),
          total_paid_out: parseFloat(affiliate.total_paid_out || 0) + payout.amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', payout.affiliate_id);

      // Mark commissions as paid
      const { data: approvedCommissions } = await masterDbClient
        .from('affiliate_commissions')
        .select('id')
        .eq('affiliate_id', payout.affiliate_id)
        .eq('status', 'approved');

      if (approvedCommissions && approvedCommissions.length > 0) {
        const commissionIds = approvedCommissions.map(c => c.id);
        await masterDbClient
          .from('affiliate_commissions')
          .update({
            status: 'paid',
            payout_id: payoutId,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .in('id', commissionIds);
      }

      return updatedPayout;
    } catch (stripeError) {
      // Mark payout as failed
      await masterDbClient
        .from('affiliate_payouts')
        .update({
          status: 'failed',
          failure_reason: stripeError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', payoutId);

      throw new Error(`Stripe transfer failed: ${stripeError.message}`);
    }
  }

  /**
   * Cancel payout
   */
  async cancelPayout(payoutId, reason = null) {
    const { data: payout, error } = await masterDbClient
      .from('affiliate_payouts')
      .update({
        status: 'cancelled',
        notes: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    return payout;
  }

  // ============================================
  // STRIPE CONNECT
  // ============================================

  /**
   * Create Stripe Connect account for affiliate
   */
  async createStripeConnectAccount(affiliateId) {
    const affiliate = await this.getAffiliateById(affiliateId);
    if (!affiliate) throw new Error('Affiliate not found');

    if (affiliate.stripe_connect_account_id) {
      return { account_id: affiliate.stripe_connect_account_id };
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const account = await stripe.accounts.create({
      type: 'express',
      email: affiliate.email,
      metadata: {
        affiliate_id: affiliateId
      },
      capabilities: {
        transfers: { requested: true }
      }
    });

    await masterDbClient
      .from('affiliates')
      .update({
        stripe_connect_account_id: account.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliateId);

    return { account_id: account.id };
  }

  /**
   * Get Stripe Connect onboarding link
   */
  async getStripeOnboardingLink(affiliateId, returnUrl, refreshUrl) {
    const affiliate = await this.getAffiliateById(affiliateId);
    if (!affiliate) throw new Error('Affiliate not found');

    if (!affiliate.stripe_connect_account_id) {
      await this.createStripeConnectAccount(affiliateId);
      const updated = await this.getAffiliateById(affiliateId);
      affiliate.stripe_connect_account_id = updated.stripe_connect_account_id;
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const accountLink = await stripe.accountLinks.create({
      account: affiliate.stripe_connect_account_id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });

    return { url: accountLink.url };
  }

  /**
   * Check Stripe Connect account status
   */
  async checkStripeAccountStatus(affiliateId) {
    const affiliate = await this.getAffiliateById(affiliateId);
    if (!affiliate) throw new Error('Affiliate not found');

    if (!affiliate.stripe_connect_account_id) {
      return {
        connected: false,
        onboarding_complete: false,
        payouts_enabled: false
      };
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const account = await stripe.accounts.retrieve(affiliate.stripe_connect_account_id);

    const onboardingComplete = account.details_submitted;
    const payoutsEnabled = account.payouts_enabled;

    // Update affiliate record if status changed
    if (affiliate.stripe_onboarding_complete !== onboardingComplete ||
        affiliate.stripe_payouts_enabled !== payoutsEnabled) {
      await masterDbClient
        .from('affiliates')
        .update({
          stripe_onboarding_complete: onboardingComplete,
          stripe_payouts_enabled: payoutsEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', affiliateId);
    }

    return {
      connected: true,
      onboarding_complete: onboardingComplete,
      payouts_enabled: payoutsEnabled,
      account_id: affiliate.stripe_connect_account_id
    };
  }

  /**
   * Validate referral code (public)
   */
  async validateReferralCode(code) {
    const affiliate = await this.getAffiliateByCode(code);
    return {
      valid: !!affiliate,
      affiliate_id: affiliate?.id
    };
  }
}

module.exports = new AffiliateService();
