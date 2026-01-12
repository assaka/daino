const express = require('express');
const router = express.Router();
const affiliateService = require('../services/affiliate-service');
const { masterDbClient } = require('../database/masterConnection');

// Cookie settings
const COOKIE_NAME = 'affiliate_ref';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * POST /api/affiliates/track-click
 * Track affiliate referral link click and set cookie
 */
router.post('/track-click', async (req, res) => {
  try {
    const { referral_code, landing_page, utm_source, utm_medium, utm_campaign, source } = req.body;

    if (!referral_code) {
      return res.status(400).json({ success: false, error: 'Referral code is required' });
    }

    const result = await affiliateService.trackClick(referral_code, {
      landing_page,
      utm_source,
      utm_medium,
      utm_campaign,
      source,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent']
    });

    // Set referral cookie
    res.cookie(COOKIE_NAME, referral_code, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({
      success: true,
      data: {
        referral_id: result.referral_id,
        cookie_expires: result.cookie_expires
      }
    });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/affiliates/validate/:code
 * Validate a referral code
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await affiliateService.validateReferralCode(code);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Validate code error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/affiliates/apply
 * Submit affiliate application
 */
router.post('/apply', async (req, res) => {
  try {
    const {
      email,
      first_name,
      last_name,
      company_name,
      phone,
      website_url,
      affiliate_type,
      application_notes
    } = req.body;

    // Validate required fields
    if (!email || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'Email, first name, and last name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const affiliate = await affiliateService.applyAsAffiliate({
      email: email.toLowerCase().trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      company_name: company_name?.trim(),
      phone: phone?.trim(),
      website_url: website_url?.trim(),
      affiliate_type: affiliate_type || 'individual',
      application_notes: application_notes?.trim()
    });

    res.json({
      success: true,
      data: {
        id: affiliate.id,
        email: affiliate.email,
        status: affiliate.status,
        referral_code: affiliate.referral_code,
        message: 'Your application has been submitted and is pending review.'
      }
    });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/affiliates/check-cookie
 * Check if user has a referral cookie set
 */
router.get('/check-cookie', (req, res) => {
  const referralCode = req.cookies?.[COOKIE_NAME];
  res.json({
    success: true,
    data: {
      has_referral: !!referralCode,
      referral_code: referralCode || null
    }
  });
});

/**
 * GET /api/affiliates/public-stats
 * Get public stats for homepage (active stores count, etc.)
 */
router.get('/public-stats', async (req, res) => {
  try {
    // Get count of active stores
    const { count: activeStores, error: storesError } = await masterDbClient
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .neq('status', 'pending_database');

    if (storesError) {
      console.error('Error fetching store count:', storesError);
    }

    // Get count of approved affiliates
    const { count: activeAffiliates, error: affiliatesError } = await masterDbClient
      .from('affiliates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    if (affiliatesError) {
      console.error('Error fetching affiliate count:', affiliatesError);
    }

    res.json({
      success: true,
      data: {
        activeStores: activeStores || 0,
        activeAffiliates: activeAffiliates || 0
      }
    });
  } catch (error) {
    console.error('Public stats error:', error);
    res.json({
      success: true,
      data: {
        activeStores: 0,
        activeAffiliates: 0
      }
    });
  }
});

module.exports = router;
