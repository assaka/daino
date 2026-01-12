/**
 * Affiliate Authentication Routes
 * Login, password reset for affiliate portal
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { masterDbClient } = require('../database/masterConnection');
const { generateTokenPair } = require('../utils/jwt');
const masterEmailService = require('../services/master-email-service');

/**
 * POST /api/affiliates/auth/login
 * Affiliate login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find affiliate by email
    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .select('*, affiliate_tiers(name, code, commission_rate)')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('Affiliate login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }

    if (!affiliate) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if affiliate has a password set
    if (!affiliate.password) {
      return res.status(401).json({
        success: false,
        error: 'Please set up your password first. Check your email for the setup link.',
        code: 'PASSWORD_NOT_SET'
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, affiliate.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check affiliate status
    if (affiliate.status === 'pending') {
      return res.status(403).json({
        success: false,
        error: 'Your application is still pending review.',
        code: 'PENDING_APPROVAL'
      });
    }

    if (affiliate.status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: 'Your application was not approved.',
        code: 'REJECTED'
      });
    }

    if (affiliate.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your affiliate account has been suspended.',
        code: 'SUSPENDED'
      });
    }

    // Generate token
    const tokens = generateTokenPair({
      id: affiliate.id,
      email: affiliate.email,
      role: 'affiliate',
      account_type: 'affiliate',
      first_name: affiliate.first_name,
      last_name: affiliate.last_name
    }, null);

    // Update last login
    await masterDbClient
      .from('affiliates')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', affiliate.id);

    // Remove password from response
    delete affiliate.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        affiliate,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionRole: 'affiliate'
      }
    });
  } catch (error) {
    console.error('Affiliate login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/affiliates/auth/setup-password
 * Set password for new affiliate (from email link)
 */
router.post('/setup-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Find affiliate by setup token
    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .select('*')
      .eq('password_reset_token', token)
      .maybeSingle();

    if (error || !affiliate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired setup link'
      });
    }

    // Check token expiry
    if (affiliate.password_reset_expires && new Date(affiliate.password_reset_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Setup link has expired. Please contact support.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update affiliate
    await masterDbClient
      .from('affiliates')
      .update({
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliate.id);

    res.json({
      success: true,
      message: 'Password set successfully. You can now log in.'
    });
  } catch (error) {
    console.error('Setup password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set password'
    });
  }
});

/**
 * POST /api/affiliates/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find affiliate
    const { data: affiliate } = await masterDbClient
      .from('affiliates')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!affiliate) {
      return res.json({
        success: true,
        message: 'If an account exists, a reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token
    await masterDbClient
      .from('affiliates')
      .update({
        password_reset_token: resetToken,
        password_reset_expires: resetExpiry.toISOString()
      })
      .eq('id', affiliate.id);

    // Send reset email
    const baseUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://www.dainostore.com';
    const resetUrl = `${baseUrl}/affiliate/reset-password?token=${resetToken}`;

    try {
      await masterEmailService.sendAffiliatePasswordResetEmail({
        recipientEmail: email,
        affiliateName: `${affiliate.first_name} ${affiliate.last_name}`,
        affiliateFirstName: affiliate.first_name,
        resetLink: resetUrl,
        expiresIn: '1 hour'
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    res.json({
      success: true,
      message: 'If an account exists, a reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request'
    });
  }
});

/**
 * POST /api/affiliates/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Find affiliate by token
    const { data: affiliate } = await masterDbClient
      .from('affiliates')
      .select('*')
      .eq('password_reset_token', token)
      .maybeSingle();

    if (!affiliate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link'
      });
    }

    // Check expiry
    if (affiliate.password_reset_expires && new Date(affiliate.password_reset_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Reset link has expired'
      });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(password, 10);

    await masterDbClient
      .from('affiliates')
      .update({
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', affiliate.id);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

/**
 * GET /api/affiliates/auth/me
 * Get current affiliate info (requires auth)
 */
router.get('/me', async (req, res) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../utils/jwt');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    if (decoded.role !== 'affiliate') {
      return res.status(403).json({
        success: false,
        error: 'Not an affiliate account'
      });
    }

    // Get fresh affiliate data
    const { data: affiliate, error } = await masterDbClient
      .from('affiliates')
      .select('*, affiliate_tiers(name, code, commission_rate, commission_type)')
      .eq('id', decoded.id)
      .single();

    if (error || !affiliate) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    delete affiliate.password;

    res.json({
      success: true,
      data: affiliate
    });
  } catch (error) {
    console.error('Get affiliate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get affiliate info'
    });
  }
});

/**
 * GET /api/affiliates/auth/stats
 * Get affiliate stats (requires auth)
 */
router.get('/stats', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../utils/jwt');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    if (decoded.role !== 'affiliate') {
      return res.status(403).json({ success: false, error: 'Not an affiliate account' });
    }

    const affiliateId = decoded.id;

    // Get referral stats
    const { data: referrals } = await masterDbClient
      .from('affiliate_referrals')
      .select('status')
      .eq('affiliate_id', affiliateId);

    const clicks = referrals?.filter(r => r.status === 'clicked').length || 0;
    const signups = referrals?.filter(r => ['signed_up', 'converted', 'qualified'].includes(r.status)).length || 0;
    const conversions = referrals?.filter(r => ['converted', 'qualified'].includes(r.status)).length || 0;

    // Get commission stats
    const { data: commissions } = await masterDbClient
      .from('affiliate_commissions')
      .select('commission_amount, status')
      .eq('affiliate_id', affiliateId);

    const pendingEarnings = commissions
      ?.filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0) || 0;

    const approvedEarnings = commissions
      ?.filter(c => c.status === 'approved')
      .reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0) || 0;

    const paidEarnings = commissions
      ?.filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0) || 0;

    // Get affiliate for pending balance
    const { data: affiliate } = await masterDbClient
      .from('affiliates')
      .select('pending_balance, total_earnings, total_paid_out, affiliate_tiers(min_payout_amount)')
      .eq('id', affiliateId)
      .single();

    res.json({
      success: true,
      data: {
        clicks,
        signups,
        conversions,
        conversionRate: signups > 0 ? ((conversions / signups) * 100).toFixed(1) : 0,
        pendingEarnings,
        approvedEarnings,
        availableBalance: parseFloat(affiliate?.pending_balance || 0),
        totalEarnings: parseFloat(affiliate?.total_earnings || 0),
        totalPaidOut: parseFloat(affiliate?.total_paid_out || 0),
        minPayoutAmount: parseFloat(affiliate?.affiliate_tiers?.min_payout_amount || 50)
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

/**
 * GET /api/affiliates/auth/referrals
 * Get affiliate's referrals
 */
router.get('/referrals', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../utils/jwt');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const { data: referrals, error } = await masterDbClient
      .from('affiliate_referrals')
      .select('id, referred_email, status, first_purchase_amount, total_purchases, created_at')
      .eq('affiliate_id', decoded.id)
      .neq('status', 'clicked') // Don't show just clicks
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Mask emails for privacy
    const maskedReferrals = referrals?.map(r => ({
      ...r,
      referred_email: r.referred_email ?
        r.referred_email.replace(/(.{2})(.*)(@.*)/, '$1***$3') :
        'Unknown'
    }));

    res.json({
      success: true,
      data: maskedReferrals || []
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ success: false, error: 'Failed to get referrals' });
  }
});

/**
 * GET /api/affiliates/auth/commissions
 * Get affiliate's commissions
 */
router.get('/commissions', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../utils/jwt');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const { data: commissions, error } = await masterDbClient
      .from('affiliate_commissions')
      .select('id, source_type, purchase_amount, commission_amount, status, created_at, paid_at')
      .eq('affiliate_id', decoded.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      data: commissions || []
    });
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get commissions' });
  }
});

/**
 * GET /api/affiliates/auth/payouts
 * Get affiliate's payout history
 */
router.get('/payouts', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../utils/jwt');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const { data: payouts, error } = await masterDbClient
      .from('affiliate_payouts')
      .select('*')
      .eq('affiliate_id', decoded.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: payouts || []
    });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payouts' });
  }
});

/**
 * POST /api/affiliates/auth/request-payout
 * Request a payout
 */
router.post('/request-payout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../utils/jwt');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // Get affiliate with tier info
    const { data: affiliate } = await masterDbClient
      .from('affiliates')
      .select('*, affiliate_tiers(min_payout_amount)')
      .eq('id', decoded.id)
      .single();

    if (!affiliate) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }

    const minPayout = parseFloat(affiliate.affiliate_tiers?.min_payout_amount || 50);
    const availableBalance = parseFloat(affiliate.pending_balance || 0);

    if (availableBalance < minPayout) {
      return res.status(400).json({
        success: false,
        error: `Minimum payout amount is $${minPayout}. Your current balance is $${availableBalance.toFixed(2)}.`
      });
    }

    // Check for pending payout
    const { data: existingPayout } = await masterDbClient
      .from('affiliate_payouts')
      .select('id')
      .eq('affiliate_id', decoded.id)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (existingPayout && existingPayout.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending payout request.'
      });
    }

    // Create payout request
    const { data: payout, error } = await masterDbClient
      .from('affiliate_payouts')
      .insert({
        affiliate_id: decoded.id,
        amount: availableBalance,
        status: 'pending',
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update affiliate balance
    await masterDbClient
      .from('affiliates')
      .update({ pending_balance: 0 })
      .eq('id', decoded.id);

    res.json({
      success: true,
      message: 'Payout requested successfully',
      data: payout
    });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ success: false, error: 'Failed to request payout' });
  }
});

module.exports = router;
