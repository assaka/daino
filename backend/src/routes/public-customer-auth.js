const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const ConnectionManager = require('../services/database/ConnectionManager');
const emailService = require('../services/email-service');
const { buildStoreUrl, getStoreUrlFromRequest, buildUrlFromRequest } = require('../utils/domainConfig');
const { masterDbClient } = require('../database/masterConnection');
const { generateToken } = require('../utils/jwt');

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

    const storeSlug = store?.slug || store?.code;

    // Get store URL from request origin (uses correct domain based on where user visited from)
    const baseUrl = getStoreUrlFromRequest(req, storeSlug) || await buildStoreUrl({
      tenantDb,
      storeId: store_id,
      storeSlug: storeSlug
    });

    // Build reset URL
    const resetUrl = buildUrlFromRequest(req, storeSlug, '/reset-password', { token: resetToken, email })
      || await buildStoreUrl({
        tenantDb,
        storeId: store_id,
        storeSlug: storeSlug,
        path: '/reset-password',
        queryParams: { token: resetToken, email }
      });

    // Send password reset email
    try {
      await emailService.sendTransactionalEmail(store_id, 'password_reset', {
        recipientEmail: email,
        customer: customer,
        reset_url: resetUrl,
        store_url: baseUrl,
        origin: baseUrl  // Use baseUrl as origin for email template
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

// @route   GET /api/public/auth/email-configured
// @desc    Check if primary email provider is configured for a store
// @access  Public (no authentication required)
// @note    Used by storefront registration to check if emails can be sent
router.get('/email-configured', async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if PRIMARY email provider (brevo or sendgrid) is configured and active
    const { data: emailConfig, error } = await tenantDb
      .from('integration_configs')
      .select('integration_type, is_active, is_primary')
      .in('integration_type', ['brevo', 'sendgrid'])
      .eq('is_active', true)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    const isConfigured = !!emailConfig;

    res.json({
      success: true,
      data: {
        isConfigured,
        provider: emailConfig?.integration_type || null
      }
    });
  } catch (error) {
    console.error('Email config check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email configuration'
    });
  }
});

// ============================================
// Google OAuth Routes for Customers
// ============================================

// @route   GET /api/public/auth/customer/google
// @desc    Initiate Google OAuth for customer login
// @access  Public
router.get('/customer/google', async (req, res) => {
  try {
    const { store_id, store_slug } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Google OAuth is not configured'
      });
    }

    // Build state parameter with store info (will be returned in callback)
    const state = Buffer.from(JSON.stringify({
      store_id,
      store_slug: store_slug || ''
    })).toString('base64');

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', process.env.GOOGLE_CUSTOMER_CALLBACK_URL || `${process.env.BACKEND_URL || 'https://backend.dainostore.com'}/api/public/auth/customer/google/callback`);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    console.log('🔐 Customer Google OAuth initiated for store:', store_id);

    res.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('❌ Customer Google OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Google login'
    });
  }
});

// @route   GET /api/public/auth/customer/google/callback
// @desc    Handle Google OAuth callback for customers
// @access  Public
router.get('/customer/google/callback', async (req, res) => {
  const corsOrigin = process.env.CORS_ORIGIN || 'https://www.dainostore.com';

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error('❌ Google OAuth error:', oauthError);
      return res.redirect(`${corsOrigin}/public/default/login?error=oauth_failed`);
    }

    if (!code || !state) {
      console.error('❌ Missing code or state in callback');
      return res.redirect(`${corsOrigin}/public/default/login?error=oauth_failed`);
    }

    // Decode state to get store info
    let storeInfo;
    try {
      storeInfo = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch (e) {
      console.error('❌ Failed to decode state:', e);
      return res.redirect(`${corsOrigin}/public/default/login?error=oauth_failed`);
    }

    const { store_id, store_slug } = storeInfo;

    if (!store_id) {
      console.error('❌ No store_id in state');
      return res.redirect(`${corsOrigin}/public/default/login?error=oauth_failed`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CUSTOMER_CALLBACK_URL || `${process.env.BACKEND_URL || 'https://backend.dainostore.com'}/api/public/auth/customer/google/callback`,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('❌ Token exchange error:', tokens.error);
      return res.redirect(`${corsOrigin}/public/${store_slug || 'default'}/login?error=oauth_failed`);
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    const googleUser = await userInfoResponse.json();

    if (!googleUser.email) {
      console.error('❌ No email in Google profile');
      return res.redirect(`${corsOrigin}/public/${store_slug || 'default'}/login?error=oauth_failed`);
    }

    console.log('🔍 Google OAuth customer profile:', {
      email: googleUser.email,
      name: googleUser.name,
      google_id: googleUser.id
    });

    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if customer exists
    const { data: existingCustomer, error: findError } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', googleUser.email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (findError) {
      console.error('❌ Error finding customer:', findError);
      return res.redirect(`${corsOrigin}/public/${store_slug || 'default'}/login?error=oauth_failed`);
    }

    let customer;

    if (existingCustomer) {
      // Update existing customer
      const { data: updatedCustomer, error: updateError } = await tenantDb
        .from('customers')
        .update({
          last_login: new Date().toISOString(),
          email_verified: true,
          google_id: googleUser.id,
          avatar_url: googleUser.picture || existingCustomer.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating customer:', updateError);
        return res.redirect(`${corsOrigin}/public/${store_slug || 'default'}/login?error=oauth_failed`);
      }

      customer = updatedCustomer;
      console.log('✅ Existing customer logged in via Google OAuth:', customer.email);
    } else {
      // Create new customer
      const { data: newCustomer, error: createError } = await tenantDb
        .from('customers')
        .insert({
          id: uuidv4(),
          store_id,
          email: googleUser.email,
          first_name: googleUser.given_name || googleUser.name?.split(' ')[0] || '',
          last_name: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
          avatar_url: googleUser.picture || null,
          google_id: googleUser.id,
          email_verified: true,
          role: 'customer',
          account_type: 'individual',
          customer_type: 'registered',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating customer:', createError);
        return res.redirect(`${corsOrigin}/public/${store_slug || 'default'}/login?error=oauth_failed`);
      }

      customer = newCustomer;
      console.log('✅ New customer created via Google OAuth:', customer.email);
    }

    // Generate JWT token for customer
    const token = generateToken({
      id: customer.id,
      email: customer.email,
      role: 'customer',
      account_type: customer.account_type || 'individual',
      first_name: customer.first_name,
      last_name: customer.last_name
    }, store_id);

    console.log('✅ Customer Google OAuth successful for:', customer.email);

    // Redirect to frontend with token
    const redirectUrl = `${corsOrigin}/public/${store_slug || 'default'}/login?token=${token}&oauth=success`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Customer Google OAuth callback error:', error);
    const corsOrigin = process.env.CORS_ORIGIN || 'https://www.dainostore.com';
    res.redirect(`${corsOrigin}/public/default/login?error=oauth_failed`);
  }
});

console.log('[PUBLIC-CUSTOMER-AUTH] Routes loaded: customer/forgot-password, customer/validate-reset-token, customer/reset-password, email-configured, customer/google, customer/google/callback');

module.exports = router;
