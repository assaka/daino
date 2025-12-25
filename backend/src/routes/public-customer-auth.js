const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ConnectionManager = require('../services/database/ConnectionManager');
const emailService = require('../services/email-service');
const { buildStoreUrl } = require('../utils/domainConfig');

const router = express.Router();

// Password strength validation
const validatePasswordStrength = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
};

// @route   POST /api/public/auth/customer/forgot-password
// @desc    Send password reset email to customer
// @access  Public (no authentication required)
router.post('/customer/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('store_id').notEmpty().withMessage('Store ID is required')
], async (req, res) => {
  console.log('[PUBLIC-FORGOT-PASSWORD] Route hit!');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, store_id } = req.body;

    // Get origin URL from request (for email links)
    let origin = req.get('origin') || req.get('referer');

    // If origin is platform domain, we need to append store path
    // For custom domains, the origin is the full storefront URL
    // For platform domains (dainostore.com), storefront is at /public/{storeSlug}
    const isPlatformDomain = origin && (
      origin.includes('dainostore.com') ||
      origin.includes('daino.ai') ||
      origin.includes('daino.store') ||
      origin.includes('localhost')
    );

    console.log('[FORGOT-PASSWORD] Origin header:', req.get('origin'));
    console.log('[FORGOT-PASSWORD] Is platform domain:', isPlatformDomain);

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find customer by email and store_id
    const { data: customer } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    // Always return success to prevent email enumeration attacks
    if (!customer) {
      return res.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to customer record
    await tenantDb
      .from('customers')
      .update({
        password_reset_token: resetToken,
        password_reset_expires: resetExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    // Get store info for email
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    // For platform domains, append the store path to origin
    // Custom domains don't need path modification
    const storeSlug = store?.slug || store?.code;
    if (isPlatformDomain && origin && storeSlug) {
      // Clean origin and append store path
      origin = origin.replace(/\/$/, '') + '/public/' + storeSlug;
    }
    console.log('[FORGOT-PASSWORD] Final origin for email:', origin);

    // Build reset URL using origin (visited domain) if available
    let resetUrl;
    let baseUrl;

    if (origin) {
      // Use the actual visited domain for links
      baseUrl = origin;
      const params = new URLSearchParams({ token: resetToken, email });
      resetUrl = `${origin}/reset-password?${params.toString()}`;
    } else {
      // Fallback to buildStoreUrl if no origin
      baseUrl = await buildStoreUrl({
        tenantDb,
        storeId: store_id,
        storeSlug: storeSlug
      });
      resetUrl = await buildStoreUrl({
        tenantDb,
        storeId: store_id,
        storeSlug: storeSlug,
        path: '/reset-password',
        queryParams: { token: resetToken, email }
      });
    }

    console.log('[FORGOT-PASSWORD] Reset URL:', resetUrl);

    // Send password reset email
    // Use origin (actual visited domain) for email links
    try {
      await emailService.sendTransactionalEmail(store_id, 'password_reset', {
        recipientEmail: email,
        customer: customer,
        reset_url: resetUrl,
        store_url: baseUrl,
        origin: origin
      }).catch(async (templateError) => {
        // Fallback: Send simple email
        await emailService.sendViaBrevo(store_id, email,
          `Reset your password - ${store?.name || 'Our Store'}`,
          `
            <h2>Reset Your Password</h2>
            <p>Hi ${customer.first_name},</p>
            <p>We received a request to reset your password. Click the link below to set a new password:</p>
            <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
          `
        );
      });
    } catch (emailError) {
      console.error('Password reset email error:', emailError);
    }

    res.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// @route   POST /api/public/auth/customer/validate-reset-token
// @desc    Validate a password reset token
// @access  Public
router.post('/customer/validate-reset-token', [
  body('token').trim().notEmpty().withMessage('Reset token is required'),
  body('store_id').notEmpty().withMessage('Store ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid request'
      });
    }

    const { token, store_id } = req.body;

    console.log('[VALIDATE-RESET-TOKEN] Request received:', { token: token?.substring(0, 10) + '...', store_id });

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find customer by reset token (token is unique within tenant DB, no need to filter by store_id)
    const { data: customer, error: customerError } = await tenantDb
      .from('customers')
      .select('id, email, password_reset_expires, store_id')
      .eq('password_reset_token', token)
      .maybeSingle();

    if (customerError) {
      console.error('[VALIDATE-RESET-TOKEN] Database error:', customerError);
    }

    if (!customer) {
      console.log('[VALIDATE-RESET-TOKEN] No customer found with token');
      return res.json({
        success: true,
        valid: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Check if token has expired
    if (customer.password_reset_expires && new Date() > new Date(customer.password_reset_expires)) {
      return res.json({
        success: true,
        valid: false,
        message: 'Reset token has expired. Please request a new password reset.'
      });
    }

    res.json({
      success: true,
      valid: true,
      email: customer.email
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// @route   POST /api/public/auth/customer/reset-password
// @desc    Reset customer password with token
// @access  Public
router.post('/customer/reset-password', [
  body('token').trim().notEmpty().withMessage('Reset token is required'),
  body('password').custom(value => {
    const error = validatePasswordStrength(value);
    if (error) throw new Error(error);
    return true;
  }),
  body('store_id').notEmpty().withMessage('Store ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { token, password, store_id } = req.body;

    console.log('[RESET-PASSWORD] Request received:', { token: token?.substring(0, 10) + '...', store_id });

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find customer by reset token (token is unique within tenant DB, no need to filter by store_id)
    const { data: customer, error: customerError } = await tenantDb
      .from('customers')
      .select('*')
      .eq('password_reset_token', token)
      .maybeSingle();

    if (customerError) {
      console.error('[RESET-PASSWORD] Database error:', customerError);
    }

    if (!customer) {
      console.log('[RESET-PASSWORD] No customer found with token');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    console.log('[RESET-PASSWORD] Customer found:', { id: customer.id, email: customer.email });

    // Check if token has expired
    if (customer.password_reset_expires && new Date() > new Date(customer.password_reset_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new password reset.'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await tenantDb
      .from('customers')
      .update({
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

console.log('[PUBLIC-CUSTOMER-AUTH] Routes loaded: customer/forgot-password, customer/validate-reset-token, customer/reset-password');

module.exports = router;
