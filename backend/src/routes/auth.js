console.log('[AUTH ROUTES] Loading auth.js module - v1.0.3');
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const ConnectionManager = require('../services/database/ConnectionManager');
const passport = require('../config/passport');
const emailService = require('../services/email-service');
const { getStoreUrlFromRequest } = require('../utils/domainConfig');
const router = express.Router();

// Helper function to determine tenant table name based on role
const getTableForRole = (role) => {
  if (role === 'customer') {
    return 'customers';
  } else if (role === 'store_owner' || role === 'admin') {
    return 'users';
  }
  throw new Error('Invalid role specified');
};

// Generate JWT token with role-specific session data
const generateToken = (user, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '24h');
  const sessionId = generateSessionId();

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    account_type: user.account_type,
    session_id: sessionId,
    session_role: user.role,
    issued_at: Date.now()
  };

  // Include store_id for customers to enforce store binding
  // Also include for store owners/admins for context
  if (user.store_id) {
    payload.store_id = user.store_id;
    console.log('🔍 generateToken: Including store_id in JWT payload:', user.store_id);
  } else {
    console.log('⚠️ generateToken: No store_id in user object');
  }

  console.log('🔍 generateToken: Final payload:', {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    has_store_id: !!payload.store_id,
    store_id: payload.store_id
  });

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// Generate unique session ID
const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
};

// Password strength validator
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long`;
  }
  if (!hasUpperCase) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!hasLowerCase) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!hasNumber) {
    return 'Password must contain at least one number';
  }
  if (!hasSpecialChar) {
    return 'Password must contain at least one special character';
  }
  return null;
};

// Helper: Create addresses for customer or user
const createCustomerAddresses = async (tenantDb, userId, firstName, lastName, phone, email, addressData, role = 'customer') => {
  try {
    const fullName = `${firstName} ${lastName}`;
    const foreignKey = role === 'customer' ? 'customer_id' : 'user_id';

    // Create shipping address
    if (addressData.shipping_address?.street) {
      const addr = addressData.shipping_address;
      await tenantDb
        .from('addresses')
        .insert({
          [foreignKey]: userId,
          type: 'shipping',
          full_name: fullName,
          street: addr.street,
          street_2: addr.street2 || null,
          city: addr.city,
          state: addr.state,
          postal_code: addr.postal_code,
          country: addr.country || 'US',
          phone: phone || null,
          email: email,
          is_default: true
        });
    }

    // Create billing address if different
    if (addressData.billing_address?.street) {
      const billing = addressData.billing_address;
      const shipping = addressData.shipping_address || {};

      const isDifferent = (
        billing.street !== shipping.street ||
        billing.city !== shipping.city ||
        billing.postal_code !== shipping.postal_code
      );

      if (isDifferent) {
        await tenantDb
          .from('addresses')
          .insert({
            [foreignKey]: userId,
            type: 'billing',
            full_name: fullName,
            street: billing.street,
            street_2: billing.street2 || null,
            city: billing.city,
            state: billing.state,
            postal_code: billing.postal_code,
            country: billing.country || 'US',
            phone: phone || null,
            email: email,
            is_default: true
          });
      } else {
        await tenantDb
          .from('addresses')
          .update({ type: 'both' })
          .eq(foreignKey, userId)
          .eq('type', 'shipping');
      }
    }
  } catch (error) {
    // Failed to create addresses
  }
};

// Helper: Send welcome email
const sendWelcomeEmail = async (tenantDb, storeId, email, customer, origin = null) => {
  try {
    // Get store from tenant database by storeId
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    // email-service will fetch store from tenant DB if store is missing or has no name
    emailService.sendTransactionalEmail(storeId, 'signup_email', {
      recipientEmail: email,
      customer: customer,
      store: store,
      origin: origin,  // Pass origin for email links
      languageCode: 'en'
    }).catch(err => {
      // Welcome email failed
    });
  } catch (error) {
    // Error sending welcome email
  }
};

// Helper: Send verification email with code
const sendVerificationEmail = async (tenantDb, storeId, email, customer, verificationCode, origin = null) => {
  try {
    // Get store from tenant database by storeId
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    const storeName = store?.name || 'Our Store';
    const storeUrl = origin || store?.domain || process.env.CORS_ORIGIN;

    // Try to send via email template if exists, otherwise send simple email
    emailService.sendEmail(storeId, 'email_verification', email, {
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_first_name: customer.first_name,
      verification_code: verificationCode,
      store_name: storeName,
      store_url: storeUrl,
      current_year: new Date().getFullYear()
    }, 'en').catch(templateError => {
      // Fallback: Send simple email with verification code
      emailService.sendViaBrevo(storeId, email,
        `Verify your email - ${storeName}`,
        `
          <h2>Verify Your Email</h2>
          <p>Hi ${customer.first_name},</p>
          <p>Thank you for registering! Please use the following verification code to complete your registration:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; color: #4F46E5;">${verificationCode}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        `
      ).catch(err => {
        // Verification email failed
      });
    });
  } catch (error) {
    // Error sending verification email
  }
};

// @route   POST /api/auth/register
// @desc    Register a new user in tenant database
// @access  Public
// @note    TENANT ONLY - requires store_id
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').custom(value => {
    const error = validatePasswordStrength(value);
    if (error) throw new Error(error);
    return true;
  }),
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('store_id').notEmpty().withMessage('store_id is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, first_name, last_name, phone, role = 'store_owner', account_type = 'agency', send_welcome_email = false, address_data, store_id } = req.body;

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Determine table name based on role
    const tableName = getTableForRole(role);

    // Check if user exists with same email in the appropriate table
    const { data: existingUser } = await tenantDb
      .from(tableName)
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `User with this email already exists in the ${tableName} table`
      });
    }

    // Hash password before inserting
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in the appropriate tenant table
    const { data: user, error: createError } = await tenantDb
      .from(tableName)
      .insert({
        email,
        password: hashedPassword,
        first_name,
        last_name,
        phone,
        role,
        account_type,
        store_id: role === 'customer' ? store_id : null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('User creation error:', createError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }

    // If agency user (store_owner/admin), also create in master DB
    if (account_type === 'agency' && role !== 'customer') {
      const { masterDbClient } = require('../database/masterConnection');

      const { error: masterError } = await masterDbClient
        .from('users')
        .insert({
          id: user.id, // Use same UUID
          email,
          password: hashedPassword,
          first_name,
          last_name,
          phone,
          role,
          account_type,
          is_active: true,
          email_verified: false,
          credits: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (masterError) {
        console.error('Master DB user creation error:', masterError);
        // Don't fail the registration, just log the error
        // The user was created in tenant DB successfully
      }
    }

    // Create addresses if provided
    if (address_data && role === 'customer') {
      await createCustomerAddresses(tenantDb, user.id, first_name, last_name, phone, email, address_data, role);
    }

    // Send welcome email if requested (for customer registrations)
    if (send_welcome_email && role === 'customer' && store_id) {
      // Get store slug for origin URL
      const { data: store } = await tenantDb
        .from('stores')
        .select('slug')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      const origin = getStoreUrlFromRequest(req, store?.slug);
      sendWelcomeEmail(tenantDb, store_id, email, user, origin);
    }

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user,
        token,
        sessionRole: user.role,
        sessionContext: user.role === 'customer' ? 'storefront' : 'dashboard'
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/upgrade-guest
// @desc    Upgrade guest customer to registered account (for post-order account creation)
// @access  Public
// @note    TENANT ONLY - requires store_id
router.post('/upgrade-guest', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
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

    const { email, password, store_id } = req.body;

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find existing guest customer (password is null)
    const { data: guestCustomer } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('store_id', store_id)
      .is('password', null)
      .maybeSingle();

    if (!guestCustomer) {
      return res.status(404).json({
        success: false,
        message: 'No guest account found with this email, or account is already registered'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the guest customer with password
    const { data: updatedCustomer, error: updateError } = await tenantDb
      .from('customers')
      .update({
        password: hashedPassword,
        email_verified: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', guestCustomer.id)
      .select()
      .single();

    if (updateError) {
      console.error('Upgrade guest error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upgrade account'
      });
    }

    // Link all guest orders to this customer account
    try {
      await tenantDb
        .from('orders')
        .update({ customer_id: updatedCustomer.id })
        .eq('customer_email', email)
        .eq('store_id', store_id)
        .is('customer_id', null);
    } catch (orderLinkError) {
      // Don't fail the account upgrade if order linking fails
      console.error('Order linking error:', orderLinkError);
    }

    // Generate token for auto-login
    const token = generateToken(updatedCustomer);

    // Send welcome email asynchronously
    const { data: storeForEmail } = await tenantDb
      .from('stores')
      .select('slug')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const emailOrigin = getStoreUrlFromRequest(req, storeForEmail?.slug);
    sendWelcomeEmail(tenantDb, store_id, email, updatedCustomer, emailOrigin).catch(err => {
      console.error('Welcome email error:', err);
    });

    res.status(200).json({
      success: true,
      message: 'Account upgraded successfully',
      data: {
        user: updatedCustomer,
        customer: updatedCustomer,
        token,
        sessionRole: 'customer',
        sessionContext: 'storefront'
      }
    });
  } catch (error) {
    console.error('Upgrade guest error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/auth/check-customer-status/:email/:store_id
// @desc    Check if a customer has already registered (has password)
// @access  Public
// @note    TENANT ONLY
router.get('/check-customer-status/:email/:store_id', async (req, res) => {
  try {
    const { email, store_id } = req.params;

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: customer } = await tenantDb
      .from('customers')
      .select('id, email, password')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!customer) {
      return res.json({
        success: true,
        data: {
          exists: false,
          hasPassword: false
        }
      });
    }

    res.json({
      success: true,
      data: {
        exists: true,
        hasPassword: customer.password !== null && customer.password !== undefined
      }
    });
  } catch (error) {
    console.error('Check customer status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/check-email
// @desc    Check what roles are available for an email in a specific store
// @access  Public
// @note    TENANT ONLY - requires store_id
router.post('/check-email', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('store_id').notEmpty().withMessage('store_id is required')
], async (req, res) => {
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

    // Find all accounts with this email in users table
    const { data: users } = await tenantDb
      .from('users')
      .select('role, account_type, first_name, last_name, is_active')
      .eq('email', email);

    if (!users || users.length === 0) {
      return res.json({
        success: true,
        data: {
          email,
          accounts: [],
          hasAccounts: false
        }
      });
    }

    const accounts = users.filter(user => user.is_active).map(user => ({
      role: user.role,
      account_type: user.account_type,
      name: `${user.first_name} ${user.last_name}`
    }));

    res.json({
      success: true,
      data: {
        email,
        accounts,
        hasAccounts: accounts.length > 0,
        multipleAccounts: accounts.length > 1
      }
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user - store_owner/admin from master DB, customers from tenant DB
// @access  Public
// @note    store_id required ONLY for customer login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  body('store_id').optional().isUUID().withMessage('store_id must be a valid UUID'),
  body('role').optional().isIn(['admin', 'store_owner', 'customer']).withMessage('Invalid role'),
  body('rememberMe').optional().isBoolean().withMessage('Remember me must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, store_id, role, rememberMe } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const bcrypt = require('bcryptjs');
    const { masterDbClient } = require('../database/masterConnection');

    // Validate: customers MUST provide store_id
    if (role === 'customer' && !store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required for customer login'
      });
    }

    let users = [];
    let authenticatedUser = null;
    let loginDb = null; // Track which DB we're using for login attempts

    // CRITICAL: Store owners and admins ALWAYS authenticate against MASTER DB
    if (role === 'store_owner' || role === 'admin') {
      console.log(`🔍 Authenticating ${role} against MASTER DB:`, email);

      // Query master DB for store owner/admin
      const { data: masterUsers, error } = await masterDbClient
        .from('users')
        .select('*')
        .eq('email', email)
        .in('role', ['store_owner', 'admin']);

      if (error) {
        console.error('Master DB query error:', error);
        return res.status(500).json({
          success: false,
          message: 'Database error during authentication'
        });
      }

      users = masterUsers || [];
      console.log(`🔍 Found ${users.length} users in master DB`);

    } else if (role === 'customer') {
      console.log('🔍 Authenticating customer against TENANT DB:', email, 'store_id:', store_id);

      // Get tenant connection
      loginDb = await ConnectionManager.getStoreConnection(store_id);

      // Check rate limiting (from tenant DB)
      const recentAttempts = await loginDb
        .from('login_attempts')
        .select('*')
        .or(`email.eq.${email},ip_address.eq.${ipAddress}`)
        .gte('attempted_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order('attempted_at', { ascending: false });

      if (recentAttempts.data && recentAttempts.data.length >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many login attempts. Please try again later.'
        });
      }

      // Search in customers table (tenant DB)
      const { data: customers } = await loginDb
        .from('customers')
        .select('*')
        .eq('email', email)
        .eq('store_id', store_id);

      users = customers || [];
      console.log(`🔍 Found ${users.length} customers in tenant DB`);

    } else {
      // No role specified - try master DB first (store owners/admins), then tenant DB (customers)
      console.log('🔍 No role specified, trying MASTER DB first:', email);

      const { data: masterUsers } = await masterDbClient
        .from('users')
        .select('*')
        .eq('email', email)
        .in('role', ['store_owner', 'admin']);

      if (masterUsers && masterUsers.length > 0) {
        users = masterUsers;
        console.log('🔍 Found user in master DB');
      } else if (store_id) {
        // Try tenant DB if store_id provided
        console.log('🔍 Not in master DB, trying TENANT DB');
        loginDb = await ConnectionManager.getStoreConnection(store_id);

        const { data: customers } = await loginDb
          .from('customers')
          .select('*')
          .eq('email', email)
          .eq('store_id', store_id);

        users = customers || [];
        console.log(`🔍 Found ${users.length} customers in tenant DB`);
      }
    }

    if (!users || users.length === 0) {
      // Log failed attempt (only for tenant DB customers)
      if (loginDb) {
        await loginDb
          .from('login_attempts')
          .insert({
            email,
            ip_address: ipAddress,
            success: false,
            attempted_at: new Date().toISOString(),
            store_id
          });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Try to find a user account that matches the password
    if (role) {
      // First try the specified role
      const roleUser = users.find(u => u.role === role);
      if (roleUser && roleUser.password) {
        const isMatch = await bcrypt.compare(password, roleUser.password);
        if (isMatch) {
          authenticatedUser = roleUser;
        }
      }
    }

    // If no role specified or role-specific auth failed, try all accounts
    if (!authenticatedUser) {
      for (const user of users) {
        if (user.password) {
          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) {
            authenticatedUser = user;
            break;
          }
        }
      }
    }

    if (!authenticatedUser) {
      // Log failed attempt (only for tenant DB customers)
      if (loginDb) {
        await loginDb
          .from('login_attempts')
          .insert({
            email,
            ip_address: ipAddress,
            success: false,
            attempted_at: new Date().toISOString(),
            store_id
          });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!authenticatedUser.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Check if customer is blacklisted
    if (authenticatedUser.role === 'customer' && authenticatedUser.is_blacklisted) {
      const { getTranslation } = require('../utils/translationHelper');
      const language = req.headers['x-language'] || 'en';
      const message = await getTranslation('error.blacklist.login', language);
      return res.status(403).json({
        success: false,
        message
      });
    }

    // Log successful attempt and update last_login based on user type
    if (authenticatedUser.role === 'customer') {
      // Customer login - use tenant DB
      await loginDb
        .from('login_attempts')
        .insert({
          email,
          ip_address: ipAddress,
          success: true,
          attempted_at: new Date().toISOString(),
          store_id
        });

      await loginDb
        .from('customers')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authenticatedUser.id);

    } else {
      // Store owner/admin login - use master DB
      await masterDbClient
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authenticatedUser.id);
    }

    // Update local object
    authenticatedUser.last_login = new Date().toISOString();

    // For store owners/admins, fetch their first ACTIVE store from master DB to include in token
    // CRITICAL: Must have is_active=true AND status NOT pending_database
    if (authenticatedUser.role === 'store_owner' || authenticatedUser.role === 'admin') {
      console.log('🔍 Fetching active stores for user:', authenticatedUser.id, authenticatedUser.email);

      const { data: userStores, error: storesError } = await masterDbClient
        .from('stores')
        .select('id, name, slug, is_active, status')
        .eq('user_id', authenticatedUser.id)
        .eq('is_active', true)
        .neq('status', 'pending_database')
        .order('created_at', { ascending: true })
        .limit(1);

      console.log('🔍 Stores query result:', {
        found: userStores?.length || 0,
        error: storesError,
        stores: userStores
      });

      if (userStores && userStores.length > 0) {
        authenticatedUser.store_id = userStores[0].id;
        console.log('✅ Added first active store to token:', userStores[0].name, '(slug:', userStores[0].slug + ')', 'status:', userStores[0].status, userStores[0].id);
      } else {
        console.log('⚠️ Store owner has no active stores with database. Checking all stores...');

        // Debug: Check all stores for this user
        const { data: allStores } = await masterDbClient
          .from('stores')
          .select('id, name, slug, is_active, status, user_id')
          .eq('user_id', authenticatedUser.id);

        console.log('🔍 All stores for user:', allStores);
      }
    }

    // Generate token with remember me option
    const token = generateToken(authenticatedUser, rememberMe);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = authenticatedUser;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
        expiresIn: rememberMe ? '30 days' : '24 hours',
        sessionRole: authenticatedUser.role,
        sessionContext: authenticatedUser.role === 'customer' ? 'storefront' : 'dashboard'
      }
    });
  } catch (error) {
    console.error('❌ LOGIN ERROR (POST /login):', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', require('../middleware/authMiddleware').authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

// @route   PATCH /api/auth/me
// @desc    Update current user in tenant database
// @access  Private
// @note    TENANT ONLY - requires store_id from user context
router.patch('/me', require('../middleware/authMiddleware').authMiddleware, async (req, res) => {
  try {
    const { role, account_type, store_id } = req.body;
    const updateData = {};

    if (role) updateData.role = role;
    if (account_type) updateData.account_type = account_type;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Require store_id for tenant lookup
    const userStoreId = store_id || req.user.store_id;
    if (!userStoreId) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(userStoreId);

    // Determine table based on user role
    const tableName = req.user.role === 'customer' ? 'customers' : 'users';

    // Update user
    updateData.updated_at = new Date().toISOString();
    const { data: updatedUser, error } = await tenantDb
      .from(tableName)
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Update user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }

    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('PATCH /me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// TODO: Google OAuth endpoints need refactoring for TENANT ONLY architecture
// They currently depend on master DB User model and need to be updated to:
// 1. Accept store_id in the OAuth flow
// 2. Create/update users in tenant DB instead of master DB
// 3. Update passport configuration to work with tenant databases
//
// @route   GET /api/auth/google
// @desc    Initiate Google OAuth (DISABLED - needs tenant refactoring)
// @access  Public
router.get('/google', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Google OAuth is temporarily disabled during tenant migration. Please use email/password login.'
  });
});

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback (DISABLED - needs tenant refactoring)
// @access  Public
router.get('/google/callback', (req, res) => {
  const corsOrigin = process.env.CORS_ORIGIN || 'https://www.dainostore.com';
  res.redirect(`${corsOrigin}/auth?error=oauth_disabled`);
});

// @route   POST /api/auth/logout
// @desc    Logout user and log the event in tenant database
// @access  Private
// @note    TENANT ONLY - requires store_id
router.post('/logout', require('../middleware/authMiddleware').authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.body;
    const userStoreId = store_id || req.user.store_id;

    // Log the logout event for security auditing
    if (userStoreId) {
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(userStoreId);
        await tenantDb
          .from('login_attempts')
          .insert({
            email: req.user.email,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('User-Agent'),
            success: true,
            action: 'logout',
            attempted_at: new Date().toISOString(),
            store_id: userStoreId
          });
      } catch (logError) {
        // Don't fail the logout if logging fails
        console.error('Logout logging error:', logError);
      }
    }

    // CRITICAL: Transfer user cart and wishlist to guest session on logout
    // Get or create session_id from request body or header
    const guestSessionId = req.body.session_id || req.headers['x-session-id'];

    if (guestSessionId && userStoreId && req.user.role === 'customer') {
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(userStoreId);

        // CART TRANSFER: Move user's cart to session
        const { data: userCart } = await tenantDb
          .from('carts')
          .select('*')
          .eq('user_id', req.user.id)
          .eq('store_id', userStoreId)
          .maybeSingle();

        if (userCart) {
          // Check if session already has a cart
          const { data: sessionCart } = await tenantDb
            .from('carts')
            .select('*')
            .eq('session_id', guestSessionId)
            .eq('store_id', userStoreId)
            .maybeSingle();

          if (sessionCart) {
            // Merge user cart items into session cart
            const mergedItems = [...sessionCart.items];

            userCart.items.forEach(userItem => {
              const existingIndex = mergedItems.findIndex(item =>
                item.product_id === userItem.product_id &&
                JSON.stringify(item.selected_options || []) === JSON.stringify(userItem.selected_options || [])
              );

              if (existingIndex >= 0) {
                // Product exists, add quantities
                mergedItems[existingIndex].quantity += userItem.quantity;
              } else {
                // New product, add to cart
                mergedItems.push(userItem);
              }
            });

            // Update session cart with merged items
            await tenantDb
              .from('carts')
              .update({
                items: mergedItems,
                updated_at: new Date().toISOString()
              })
              .eq('id', sessionCart.id);

            // Delete user cart
            await tenantDb
              .from('carts')
              .delete()
              .eq('id', userCart.id);
          } else {
            // No session cart exists, transfer user cart to session
            await tenantDb
              .from('carts')
              .update({
                session_id: guestSessionId,
                user_id: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', userCart.id);
          }
        }

        // WISHLIST TRANSFER: Move user's wishlist to session
        const { data: userWishlist } = await tenantDb
          .from('wishlists')
          .select('*')
          .eq('user_id', req.user.id)
          .eq('store_id', userStoreId);

        if (userWishlist && userWishlist.length > 0) {
          // Get existing session wishlist items
          const { data: sessionWishlist } = await tenantDb
            .from('wishlists')
            .select('*')
            .eq('session_id', guestSessionId)
            .eq('store_id', userStoreId);

          const sessionProductIds = new Set((sessionWishlist || []).map(item => item.product_id));

          // Transfer user wishlist items to session
          for (const userItem of userWishlist) {
            if (!sessionProductIds.has(userItem.product_id)) {
              // Update user item to belong to session
              await tenantDb
                .from('wishlists')
                .update({
                  session_id: guestSessionId,
                  user_id: null
                })
                .eq('id', userItem.id);
            } else {
              // Item already in session wishlist, delete user duplicate
              await tenantDb
                .from('wishlists')
                .delete()
                .eq('id', userItem.id);
            }
          }
        }
      } catch (transferError) {
        console.error('Error transferring cart/wishlist to session on logout:', transferError);
        // Don't fail logout if transfer fails, just log it
      }
    }

    // In a JWT-based system, we can't invalidate tokens server-side without a blacklist
    // For now, we'll just log the event and return success
    // TODO: Implement token blacklisting for enhanced security

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// @route   POST /api/auth/customer/register
// @desc    Register a new customer in tenant database
// @access  Public
// @note    TENANT ONLY - requires store_id
router.post('/customer/register', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').custom(value => {
    const error = validatePasswordStrength(value);
    if (error) throw new Error(error);
    return true;
  }),
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('store_id').notEmpty().withMessage('store_id is required')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, first_name, last_name, phone, date_of_birth, gender, send_welcome_email = false, address_data, store_id } = req.body;

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if customer exists
    const { data: existingCustomer } = await tenantDb
      .from('customers')
      .select('id')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please login instead.'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create customer with verification code
    const customerData = {
      email,
      password: hashedPassword,
      first_name,
      last_name,
      phone,
      role: 'customer',
      account_type: 'individual',
      store_id: store_id,
      email_verified: false,
      email_verification_token: verificationCode,
      password_reset_expires: verificationExpiry.toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add optional fields if provided
    if (date_of_birth) {
      customerData.date_of_birth = date_of_birth;
    }
    if (gender) {
      customerData.gender = gender;
    }

    const { data: customer, error: createError } = await tenantDb
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (createError) {
      console.error('Customer creation error:', createError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create customer'
      });
    }

    // Create addresses if provided
    if (address_data) {
      await createCustomerAddresses(tenantDb, customer.id, first_name, last_name, phone, email, address_data, 'customer');
    }

    // Send verification email with code
    const { data: storeForVerify } = await tenantDb
      .from('stores')
      .select('slug')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const verifyOrigin = getStoreUrlFromRequest(req, storeForVerify?.slug);
    await sendVerificationEmail(tenantDb, store_id, email, customer, verificationCode, verifyOrigin);

    // Generate token (user can login but will be blocked until verified)
    const token = generateToken(customer);

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = customer;

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for a verification code.',
      data: {
        user: customerWithoutPassword,
        token,
        sessionRole: customer.role,
        sessionContext: 'storefront',
        requiresVerification: true
      }
    });
  } catch (error) {
    console.error('Customer registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.'
    });
  }
});

// @route   POST /api/auth/customer/login
// @desc    Login customer from tenant database
// @access  Public
// @note    TENANT ONLY - already properly scoped with store_id
router.post('/customer/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  body('store_id').notEmpty().withMessage('Store ID is required').isUUID().withMessage('Store ID must be a valid UUID'),
  body('rememberMe').optional().isBoolean().withMessage('Remember me must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, store_id, rememberMe } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const bcrypt = require('bcryptjs');

    // Check rate limiting (from tenant DB)
    const recentAttempts = await tenantDb
      .from('login_attempts')
      .select('*')
      .or(`email.eq.${email},ip_address.eq.${ipAddress}`)
      .gte('attempted_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order('attempted_at', { ascending: false });

    if (recentAttempts.data && recentAttempts.data.length >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.'
      });
    }

    // CRITICAL: Find customer with this email AND store_id to prevent cross-store login
    const { data: customer } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!customer) {
      await tenantDb
        .from('login_attempts')
        .insert({
          email,
          ip_address: ipAddress,
          success: false,
          attempted_at: new Date().toISOString(),
          store_id
        });

      const { getTranslation } = require('../utils/translationHelper');
      const language = req.headers['x-language'] || 'en';
      const message = await getTranslation('auth.error.invalid_credentials', language, store_id);
      return res.status(400).json({
        success: false,
        message: message || 'Invalid credentials'
      });
    }

    // Check password
    if (!customer.password) {
      const { getTranslation } = require('../utils/translationHelper');
      const language = req.headers['x-language'] || 'en';
      const message = await getTranslation('auth.error.account_not_activated', language, store_id);
      return res.status(400).json({
        success: false,
        message: message || 'This account has not been activated yet. Please create a password first.'
      });
    }

    const isMatch = await bcrypt.compare(password, customer.password);

    if (!isMatch) {
      await tenantDb
        .from('login_attempts')
        .insert({
          email,
          ip_address: ipAddress,
          success: false,
          attempted_at: new Date().toISOString(),
          store_id
        });

      const { getTranslation } = require('../utils/translationHelper');
      const language = req.headers['x-language'] || 'en';
      const message = await getTranslation('auth.error.invalid_credentials', language, store_id);
      return res.status(400).json({
        success: false,
        message: message || 'Invalid credentials'
      });
    }

    // Check if customer is active
    if (!customer.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Check if customer is blacklisted
    if (customer.is_blacklisted) {
      const { getTranslation } = require('../utils/translationHelper');
      const language = req.headers['x-language'] || 'en';
      const message = await getTranslation('error.blacklist.login', language);
      return res.status(403).json({
        success: false,
        message
      });
    }

    // Verify customer has a store assigned
    if (!customer.store_id) {
      return res.status(403).json({
        success: false,
        message: 'Customer account is not assigned to a store. Please contact support.'
      });
    }

    // Log successful attempt
    await tenantDb
      .from('login_attempts')
      .insert({
        email,
        ip_address: ipAddress,
        success: true,
        attempted_at: new Date().toISOString(),
        store_id
      });

    // Update last login
    await tenantDb
      .from('customers')
      .update({ last_login: new Date().toISOString() })
      .eq('id', customer.id);

    // CRITICAL: Merge guest cart and wishlist to authenticated user
    // Get session_id from request body or header
    const guestSessionId = req.body.session_id || req.headers['x-session-id'];

    if (guestSessionId) {
      try {
        // CART MERGE: Transfer guest cart items to user cart
        const { data: guestCart } = await tenantDb
          .from('carts')
          .select('*')
          .eq('session_id', guestSessionId)
          .eq('store_id', store_id)
          .maybeSingle();

        if (guestCart && guestCart.items && guestCart.items.length > 0) {
          // Check if user already has a cart
          const { data: userCart } = await tenantDb
            .from('carts')
            .select('*')
            .eq('user_id', customer.id)
            .eq('store_id', store_id)
            .maybeSingle();

          if (userCart) {
            // Merge items: Add guest items to existing user cart, avoiding duplicates
            const mergedItems = [...userCart.items];

            guestCart.items.forEach(guestItem => {
              const existingIndex = mergedItems.findIndex(item =>
                item.product_id === guestItem.product_id &&
                JSON.stringify(item.selected_options || []) === JSON.stringify(guestItem.selected_options || [])
              );

              if (existingIndex >= 0) {
                // Product exists, add quantities
                mergedItems[existingIndex].quantity += guestItem.quantity;
              } else {
                // New product, add to cart
                mergedItems.push(guestItem);
              }
            });

            // Update user cart with merged items
            await tenantDb
              .from('carts')
              .update({
                items: mergedItems,
                updated_at: new Date().toISOString()
              })
              .eq('id', userCart.id);

            // Delete guest cart
            await tenantDb
              .from('carts')
              .delete()
              .eq('id', guestCart.id);
          } else {
            // No user cart exists, transfer guest cart to user
            await tenantDb
              .from('carts')
              .update({
                user_id: customer.id,
                session_id: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', guestCart.id);
          }
        }

        // WISHLIST MERGE: Transfer guest wishlist items to user wishlist
        const { data: guestWishlist } = await tenantDb
          .from('wishlists')
          .select('*')
          .eq('session_id', guestSessionId)
          .eq('store_id', store_id);

        if (guestWishlist && guestWishlist.length > 0) {
          // Get existing user wishlist items
          const { data: userWishlist } = await tenantDb
            .from('wishlists')
            .select('*')
            .eq('user_id', customer.id)
            .eq('store_id', store_id);

          const userProductIds = new Set((userWishlist || []).map(item => item.product_id));

          // Transfer guest wishlist items that don't already exist in user wishlist
          for (const guestItem of guestWishlist) {
            if (!userProductIds.has(guestItem.product_id)) {
              // Update guest item to belong to user
              await tenantDb
                .from('wishlists')
                .update({
                  user_id: customer.id,
                  session_id: null
                })
                .eq('id', guestItem.id);
            } else {
              // Item already in user wishlist, delete guest duplicate
              await tenantDb
                .from('wishlists')
                .delete()
                .eq('id', guestItem.id);
            }
          }
        }
      } catch (mergeError) {
        console.error('Error merging guest cart/wishlist to user:', mergeError);
        // Don't fail login if merge fails, just log it
      }
    }

    // Generate token
    const token = generateToken(customer, rememberMe);

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = customer;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: customerWithoutPassword,
        token,
        expiresIn: rememberMe ? '30 days' : '24 hours',
        sessionRole: customer.role,
        sessionContext: 'storefront'
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/customer/forgot-password
// @desc    Send password reset email to customer
// @access  Public (no authentication required)
// @note    TENANT ONLY - requires store_id
router.post('/customer/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('store_id').notEmpty().withMessage('Store ID is required')
], async (req, res) => {
  console.log('[FORGOT-PASSWORD] Route hit! Path:', req.path, 'Original URL:', req.originalUrl);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, store_id } = req.body;

    console.log('[FORGOT-PASSWORD] Request received:', { email, store_id });

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find customer by email (without store_id filter to check for mismatches)
    const { data: customer } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    // Debug: Log if customer exists but has different store_id
    if (customer && customer.store_id !== store_id) {
      console.warn('[FORGOT-PASSWORD] Customer found but store_id mismatch! Customer store_id:', customer.store_id, 'Request store_id:', store_id);
    }

    // Always return success to prevent email enumeration attacks
    // Even if customer doesn't exist, we don't reveal that
    if (!customer) {
      console.log('[FORGOT-PASSWORD] No customer found with email:', email);
      return res.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    console.log('[FORGOT-PASSWORD] Customer found:', { id: customer.id, email: customer.email, store_id: customer.store_id });

    // Generate reset token (random 32 character string)
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    console.log('[FORGOT-PASSWORD] Generated token:', resetToken.substring(0, 10) + '...', 'Expiry:', resetExpiry);

    // Save reset token to customer record
    const { error: updateError } = await tenantDb
      .from('customers')
      .update({
        password_reset_token: resetToken,
        password_reset_expires: resetExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    if (updateError) {
      console.error('[FORGOT-PASSWORD] Failed to save reset token:', updateError);
    } else {
      console.log('[FORGOT-PASSWORD] Reset token saved successfully for customer:', customer.id);
    }

    // Get store info for email
    const { data: store } = await tenantDb
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .maybeSingle();

    console.log('[FORGOT-PASSWORD] Store lookup by id:', store_id, '-> Found:', store?.name || 'NOT FOUND');

    const storeName = store?.name || 'Our Store';
    const storeSlug = store?.slug || store?.code || 'default';

    // Build reset URL with store-specific path
    const baseUrl = store?.domain
      ? `https://${store.domain}`
      : (process.env.CORS_ORIGIN || 'https://www.dainostore.com');
    const resetUrl = `${baseUrl}/public/${storeSlug}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send password reset email
    try {
      // Try template-based email first
      await emailService.sendTransactionalEmail(store_id, 'password_reset', {
        recipientEmail: email,
        customer: customer,
        reset_url: resetUrl
      }).catch(async (templateError) => {
        // Fallback: Send simple email
        await emailService.sendViaBrevo(store_id, email,
          `Reset your password - ${storeName}`,
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
      // Don't fail the request if email fails - token is saved
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

// @route   POST /api/auth/customer/validate-reset-token
// @desc    Validate password reset token before showing form
// @access  Public
// @note    TENANT ONLY - requires store_id
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

    // Find customer by reset token
    const { data: customer, error: customerError } = await tenantDb
      .from('customers')
      .select('id, email, password_reset_expires, store_id')
      .eq('password_reset_token', token)
      .maybeSingle();

    if (customerError) {
      console.error('[VALIDATE-RESET-TOKEN] Database error:', customerError);
    }

    // Debug: check if token exists but store_id doesn't match
    if (customer && customer.store_id !== store_id) {
      console.warn('[VALIDATE-RESET-TOKEN] Store ID mismatch! Customer store_id:', customer.store_id, 'Request store_id:', store_id);
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

// @route   POST /api/auth/customer/reset-password
// @desc    Reset customer password with token
// @access  Public
// @note    TENANT ONLY - requires store_id
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

    console.log('[RESET-PASSWORD] Customer found:', { id: customer.id, email: customer.email, store_id: customer.store_id });

    // Check if token has expired
    if (customer.password_reset_expires && new Date() > new Date(customer.password_reset_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new password reset.'
      });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
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

// @route   POST /api/auth/verify-email
// @desc    Verify customer email with code
// @access  Public
// @note    TENANT ONLY - requires store_id
router.post('/verify-email', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('code').trim().notEmpty().withMessage('Verification code is required'),
  body('store_id').notEmpty().withMessage('store_id is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, code, store_id } = req.body;

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find customer by email
    const { data: customer } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if already verified
    if (customer.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Check verification code
    if (customer.email_verification_token !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Check if code expired (15 minutes)
    if (customer.password_reset_expires && new Date() > new Date(customer.password_reset_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Mark as verified
    await tenantDb
      .from('customers')
      .update({
        email_verified: true,
        email_verification_token: null,
        password_reset_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    res.json({
      success: true,
      message: 'Email verified successfully!'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification'
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification code
// @access  Public
// @note    TENANT ONLY - requires store_id
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('store_id').notEmpty().withMessage('store_id is required')
], async (req, res) => {
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

    // Find customer by email
    const { data: customer } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if already verified
    if (customer.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update customer with new code
    await tenantDb
      .from('customers')
      .update({
        email_verification_token: verificationCode,
        password_reset_expires: verificationExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    // Send verification email
    const { data: storeForResend } = await tenantDb
      .from('stores')
      .select('slug')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const resendOrigin = getStoreUrlFromRequest(req, storeForResend?.slug);
    await sendVerificationEmail(tenantDb, store_id, email, customer, verificationCode, resendOrigin);

    res.json({
      success: true,
      message: 'Verification code sent! Please check your email.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Debug endpoint to check customers (TENANT ONLY VERSION)
router.get('/debug/customers', async (req, res) => {
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

    const { data: customers } = await tenantDb
      .from('customers')
      .select('id, email, first_name, last_name, store_id, created_at')
      .eq('store_id', store_id)
      .limit(10);

    res.json({
      success: true,
      count: customers?.length || 0,
      customers: customers || []
    });
  } catch (error) {
    console.error('Debug customers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fix endpoint disabled - no longer needed in tenant-only architecture
router.post('/debug/fix-customer-stores', async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated in tenant-only architecture. All customers must be created with a store_id.'
  });
});

// ========================================
// STORE OWNER PASSWORD RESET ENDPOINTS
// ========================================

// @route   POST /api/auth/store-owner/forgot-password
// @desc    Send password reset email to store owner
// @access  Public (no authentication required)
// @note    MASTER DB - store owners are in master database
router.post('/store-owner/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  console.log('[STORE-OWNER-FORGOT-PASSWORD] Route hit! Path:', req.path);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Get master database connection
    const { masterDbClient } = require('../database/masterConnection');

    // Find store owner by email in master DB
    const { data: user, error } = await masterDbClient
      .from('users')
      .select('*')
      .eq('email', email)
      .in('role', ['store_owner', 'admin'])
      .maybeSingle();

    if (error) {
      console.error('[STORE-OWNER-FORGOT-PASSWORD] Database error:', error);
    }

    // Always return success to prevent email enumeration attacks
    if (!user) {
      console.log('[STORE-OWNER-FORGOT-PASSWORD] No user found for email:', email);
      return res.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token (random 32 character string)
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to user record in master DB
    const { error: updateError } = await masterDbClient
      .from('users')
      .update({
        password_reset_token: resetToken,
        password_reset_expires: resetExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[STORE-OWNER-FORGOT-PASSWORD] Failed to save reset token:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to process password reset request.'
      });
    }

    // Build reset URL for admin
    const baseUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://www.dainostore.com';
    const resetUrl = `${baseUrl}/admin/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send password reset email using master email service
    try {
      const masterEmailService = require('../services/master-email-service');
      await masterEmailService.sendPasswordResetEmail({
        recipientEmail: email,
        customerName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Store Owner',
        customerFirstName: user.first_name || 'there',
        resetLink: resetUrl,
        expiresIn: '1 hour'
      });
      console.log('[STORE-OWNER-FORGOT-PASSWORD] Reset email sent to:', email);
    } catch (emailError) {
      console.error('[STORE-OWNER-FORGOT-PASSWORD] Email send error:', emailError);
      // Don't fail the request if email fails - token is saved
    }

    res.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('[STORE-OWNER-FORGOT-PASSWORD] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// @route   POST /api/auth/store-owner/reset-password
// @desc    Reset store owner password with token
// @access  Public
// @note    MASTER DB - store owners are in master database
router.post('/store-owner/reset-password', [
  body('token').trim().notEmpty().withMessage('Reset token is required'),
  body('password').custom(value => {
    const error = validatePasswordStrength(value);
    if (error) throw new Error(error);
    return true;
  })
], async (req, res) => {
  console.log('[STORE-OWNER-RESET-PASSWORD] Route hit! Path:', req.path);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    // Get master database connection
    const { masterDbClient } = require('../database/masterConnection');

    // Find user by reset token in master DB
    const { data: user, error } = await masterDbClient
      .from('users')
      .select('*')
      .eq('password_reset_token', token)
      .maybeSingle();

    if (error) {
      console.error('[STORE-OWNER-RESET-PASSWORD] Database error:', error);
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Check if token has expired
    if (user.password_reset_expires && new Date() > new Date(user.password_reset_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new password reset.'
      });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token in master DB
    const { error: updateError } = await masterDbClient
      .from('users')
      .update({
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[STORE-OWNER-RESET-PASSWORD] Failed to update password:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset password.'
      });
    }

    console.log('[STORE-OWNER-RESET-PASSWORD] Password reset successful for:', user.email);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('[STORE-OWNER-RESET-PASSWORD] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// Log registered routes on module load
console.log(`[AUTH ROUTES] Registered ${router.stack.length} routes including: customer/login, customer/register, customer/forgot-password, customer/reset-password, store-owner/forgot-password, store-owner/reset-password`);

module.exports = router;
