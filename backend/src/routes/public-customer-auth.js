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

    // Build reset URL
    // Build reset URL using store's custom domain or platform URL
    const resetUrl = await buildStoreUrl({
      tenantDb,
      storeId: store_id,
      storeSlug: store?.slug || store?.code,
      path: '/reset-password',
      queryParams: { token: resetToken, email }
    });
    const baseUrl = await buildStoreUrl({
      tenantDb,
      storeId: store_id,
      storeSlug: store?.slug || store?.code
    });

    // Send password reset email
    try {
      await emailService.sendEmail(store_id, 'password_reset', email, {
        customer_name: `${customer.first_name} ${customer.last_name}`,
        customer_first_name: customer.first_name,
        reset_url: resetUrl,
        reset_link: resetUrl,
        store_name: store?.name || 'Our Store',
        store_url: baseUrl,
        current_year: new Date().getFullYear(),
        expiry_hours: 1
      }, 'en').catch(async (templateError) => {
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

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find customer by reset token
    const { data: customer } = await tenantDb
      .from('customers')
      .select('*')
      .eq('password_reset_token', token)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

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

console.log('[PUBLIC-CUSTOMER-AUTH] Routes loaded: customer/forgot-password, customer/reset-password');

module.exports = router;
