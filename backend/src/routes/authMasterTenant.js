/**
 * Authentication Routes (Master-Tenant Architecture)
 *
 * POST /api/auth/register - Register new agency user
 * POST /api/auth/login - Login with email/password
 * POST /api/auth/logout - Logout
 * POST /api/auth/refresh - Refresh access token
 * GET /api/auth/me - Get current user info
 *
 * This is the NEW auth system for master-tenant architecture
 * The old auth.js remains for backward compatibility
 */

const express = require('express');
const router = express.Router();
const { generateTokenPair, refreshAccessToken } = require('../utils/jwt');
const { authMiddleware } = require('../middleware/authMiddleware');
const ConnectionManager = require('../services/database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const masterEmailService = require('../services/master-email-service');

/**
 * POST /api/auth/register
 * Register new agency user and create initial store
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, storeName } = req.body;
    // Accept both camelCase and snake_case for name fields
    const firstName = req.body.firstName || req.body.first_name;
    const lastName = req.body.lastName || req.body.last_name;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required'
      });
    }

    // Check if user already exists (using Supabase client)
    const { data: existingUsers, error: checkError } = await masterDbClient
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (checkError) {
      throw new Error(`Failed to check existing user: ${checkError.message}`);
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create user in master DB (using Supabase client)
    const userId = uuidv4();
    const { data: user, error: userError } = await masterDbClient
      .from('users')
      .insert({
        id: userId,
        email,
        password: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        account_type: 'agency',
        role: 'store_owner',
        is_active: true,
        email_verified: false,
        email_verification_token: verificationCode,
        password_reset_expires: verificationExpiry.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to create user: ${userError.message}`);
    }

    // Create initial store in master DB
    const storeId = uuidv4();
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .insert({
        id: storeId,
        user_id: userId,
        status: 'pending_database',
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (storeError) {
      throw new Error(`Failed to create store: ${storeError.message}`);
    }

    // Send verification email
    try {
      await masterEmailService.sendStoreOwnerVerificationEmail({
        recipientEmail: email,
        customerName: `${firstName} ${lastName}`,
        customerFirstName: firstName,
        verificationCode,
        expiresIn: '15 minutes'
      });
      console.log('📧 Verification email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError.message);
      // Continue - user was created, they can request a new code
    }

    // Generate JWT tokens
    const tokens = generateTokenPair(user, storeId);

    // Remove sensitive fields
    delete user.password;
    delete user.email_verification_token;
    delete user.password_reset_token;

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email to continue.',
      data: {
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: '7 days',
        sessionRole: user.role,
        sessionContext: 'dashboard',
        requiresVerification: true
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email/password
 *
 * Supports two login modes:
 * 1. With hostname (tenant context) - queries tenant DB
 * 2. Without hostname (platform) - queries master DB
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, hostname } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    let user, storeId;

    if (hostname) {
      // === TENANT LOGIN ===
      // Resolve store from hostname
      const hostnameRecord = await StoreHostname.findByHostname(hostname);

      if (!hostnameRecord) {
        return res.status(404).json({
          success: false,
          error: 'Store not found for this hostname',
          code: 'STORE_NOT_FOUND'
        });
      }

      storeId = hostnameRecord.store_id;

      // Get tenant DB connection
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Query tenant DB for user
      const { data: users, error } = await tenantDb
        .from('users')
        .select('*')
        .eq('email', email)
        .limit(1);

      if (error || !users || users.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      user = users[0];

      // Verify password (tenant user)
      const bcrypt = require('bcryptjs');
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'User account is inactive',
          code: 'USER_INACTIVE'
        });
      }
    } else {
      // === MASTER LOGIN ===
      // Query master DB for agency user (using Supabase client)
      const { data: users, error: userError } = await masterDbClient
        .from('users')
        .select('*')
        .eq('email', email)
        .limit(1);

      if (userError || !users || users.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      user = users[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'User account is inactive',
          code: 'USER_INACTIVE'
        });
      }

      // Check if email is verified for store owners
      if (!user.email_verified && user.role === 'store_owner') {
        console.log('📧 Store owner email not verified, sending verification code...');

        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Update user with verification code
        await masterDbClient
          .from('users')
          .update({
            email_verification_token: verificationCode,
            password_reset_expires: verificationExpiry.toISOString()
          })
          .eq('id', user.id);

        // Send verification email
        try {
          await masterEmailService.sendStoreOwnerVerificationEmail({
            recipientEmail: email,
            customerName: `${user.first_name} ${user.last_name}`,
            customerFirstName: user.first_name,
            verificationCode,
            expiresIn: '15 minutes'
          });
          console.log('📧 Verification email sent to:', email);
        } catch (emailError) {
          console.error('⚠️ Failed to send verification email:', emailError.message);
        }

        // Get user's store for token
        const { data: userStores } = await masterDbClient
          .from('stores')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        const userStoreId = userStores?.[0]?.id || null;

        // Generate token for partial access
        const tokens = generateTokenPair(user, userStoreId);

        return res.json({
          success: true,
          message: 'Please verify your email to continue',
          data: {
            user: {
              id: user.id,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role
            },
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            sessionRole: user.role,
            sessionContext: 'dashboard',
            requiresVerification: true
          }
        });
      }

      // Get user's first active store (using Supabase client)
      const { data: stores, error: storesError } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!storesError && stores && stores.length > 0) {
        // User owns a store
        storeId = stores[0].id;
      } else {
        // Check if user is a team member of any store
        const { data: teamMemberships, error: teamError } = await masterDbClient
          .from('store_teams')
          .select('store_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!teamError && teamMemberships && teamMemberships.length > 0) {
          // User is a team member
          storeId = teamMemberships[0].store_id;
        } else {
          // No owned stores and no team memberships - still return token for onboarding
          storeId = null;
        }
      }
    }

    // Update last login (if method exists)
    if (user.updateLastLogin) {
      await user.updateLastLogin();
    }

    // Generate JWT tokens
    const tokens = generateTokenPair(user, storeId);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name || user.firstName,
          last_name: user.last_name || user.lastName,
          role: user.role,
          account_type: user.account_type || user.accountType,
          phone: user.phone,
          avatar_url: user.avatar_url,
          is_active: user.is_active,
          email_verified: user.email_verified,
          credits: user.credits,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: '7 days', // Match old format
        sessionRole: user.role, // Match old format
        sessionContext: user.role === 'customer' ? 'storefront' : 'dashboard', // Match old format
        requiresOnboarding: storeId === null // Flag for frontend to redirect to onboarding
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client removes token, optional server-side blacklist)
 * Made permissive - succeeds even without valid token
 */
router.post('/logout', async (req, res) => {
  // Don't require auth - logout should always succeed
  // Client-side clears token, server just acknowledges
  // TODO: Add token to blacklist (Redis) if needed

  try {
    // Optional: Log logout attempt if user is authenticated
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
      try {
        const token = extractTokenFromHeader(authHeader);
        const decoded = verifyToken(token);
        console.log(`User ${decoded.email} logged out`);
      } catch (err) {
        // Token invalid, that's ok
      }
    }
  } catch (err) {
    // Ignore errors
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    const newAccessToken = refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message,
      code: 'REFRESH_FAILED'
    });
  }
});

/**
 * POST /api/auth/upgrade-guest
 * Upgrade guest checkout to registered account (for post-order account creation)
 * Handles three scenarios:
 * 1. Customer record exists with NULL password (guest) -> upgrade it
 * 2. No customer record exists -> create new customer from order data
 * 3. Customer record exists with password -> return error (already registered)
 * Public route - requires store_id in body
 */
router.post('/upgrade-guest', async (req, res) => {
  try {
    const { email, password, store_id } = req.body;

    // Validate input
    if (!email || !password || !store_id) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and store_id are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if any customer exists with this email
    const { data: existingCustomer, error: findError } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (findError) {
      console.error('Error finding customer:', findError);
      return res.status(500).json({
        success: false,
        error: 'Failed to find customer'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    let finalCustomer;

    if (existingCustomer) {
      // Customer exists - check if already registered
      if (existingCustomer.password) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email already exists. Please login instead.'
        });
      }

      // Guest customer exists (password is null) - upgrade it
      const { data: updatedCustomer, error: updateError } = await tenantDb
        .from('customers')
        .update({
          password: hashedPassword,
          customer_type: 'registered', // Mark as registered
          email_verified: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (updateError) {
        console.error('Upgrade guest error:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to upgrade account'
        });
      }

      finalCustomer = updatedCustomer;
      console.log('✅ Upgraded existing guest customer:', finalCustomer.id);

    } else {
      // No customer record exists - create new customer from order data
      // First, find the most recent order for this email to get customer details
      const { data: recentOrder, error: orderError } = await tenantDb
        .from('sales_orders')
        .select('*')
        .eq('customer_email', email)
        .eq('store_id', store_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderError) {
        console.error('Error finding order:', orderError);
      }

      // Extract customer details from order or shipping address
      let firstName = 'Customer';
      let lastName = '';
      let phone = null;

      if (recentOrder) {
        // Try to get name from shipping address
        const shippingAddr = recentOrder.shipping_address || {};
        const fullName = shippingAddr.name || shippingAddr.full_name || '';

        if (fullName) {
          const nameParts = fullName.split(' ');
          firstName = nameParts[0] || 'Customer';
          lastName = nameParts.slice(1).join(' ') || '';
        }

        phone = shippingAddr.phone || recentOrder.customer_phone || null;
      }

      // Create new customer
      const { data: newCustomer, error: createError } = await tenantDb
        .from('customers')
        .insert({
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          role: 'customer',
          customer_type: 'registered', // Mark as registered since they have a password
          store_id: store_id,
          is_active: true,
          email_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Create customer error:', createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create account'
        });
      }

      finalCustomer = newCustomer;
      console.log('✅ Created new customer from guest order:', finalCustomer.id);
    }

    // Link all orders with this email to the customer and update stats
    console.log('🔗 Starting order linking for customer:', finalCustomer.id, 'email:', email);
    try {
      // First, check ALL orders for this email (regardless of customer_id)
      const { data: allOrders, error: allOrdersError } = await tenantDb
        .from('sales_orders')
        .select('id, total_amount, customer_id, customer_email, created_at')
        .eq('customer_email', email)
        .eq('store_id', store_id);

      console.log('📦 All orders for this email:', allOrders?.length || 0);
      if (allOrders) {
        allOrders.forEach(o => console.log(`  - Order ${o.id}: customer_id=${o.customer_id}, amount=${o.total_amount}`));
      }

      // Get unlinked orders (customer_id is null)
      const { data: unlinkedOrders, error: fetchError } = await tenantDb
        .from('sales_orders')
        .select('id, total_amount, created_at')
        .eq('customer_email', email)
        .eq('store_id', store_id)
        .is('customer_id', null);

      console.log('📦 Unlinked orders (customer_id=null):', unlinkedOrders?.length || 0, 'Error:', fetchError?.message || 'none');

      if (fetchError) {
        console.error('❌ Error fetching unlinked orders:', fetchError);
      }

      if (unlinkedOrders && unlinkedOrders.length > 0) {
        // Link the orders
        console.log('🔗 Linking', unlinkedOrders.length, 'orders to customer', finalCustomer.id);
        const { error: linkError } = await tenantDb
          .from('sales_orders')
          .update({ customer_id: finalCustomer.id })
          .eq('customer_email', email)
          .eq('store_id', store_id)
          .is('customer_id', null);

        if (linkError) {
          console.error('❌ Error linking orders:', linkError);
        } else {
          // Calculate stats from linked orders
          const orderCount = unlinkedOrders.length;
          const totalSpent = unlinkedOrders.reduce((sum, order) => {
            return sum + parseFloat(order.total_amount || 0);
          }, 0);

          // Get the most recent order date
          const lastOrderDate = unlinkedOrders.reduce((latest, order) => {
            const orderDate = new Date(order.created_at);
            return orderDate > latest ? orderDate : latest;
          }, new Date(0));

          // Update customer stats
          const currentTotalOrders = parseInt(finalCustomer.total_orders || 0);
          const currentTotalSpent = parseFloat(finalCustomer.total_spent || 0);

          console.log('📊 Updating customer stats: orders=', currentTotalOrders + orderCount, ', spent=', currentTotalSpent + totalSpent);

          const { error: statsError } = await tenantDb
            .from('customers')
            .update({
              total_orders: currentTotalOrders + orderCount,
              total_spent: currentTotalSpent + totalSpent,
              last_order_date: lastOrderDate.toISOString()
            })
            .eq('id', finalCustomer.id);

          if (statsError) {
            console.error('❌ Error updating customer stats:', statsError);
          } else {
            console.log(`✅ Linked ${orderCount} orders to customer ${finalCustomer.id}, total spent: $${totalSpent.toFixed(2)}`);
          }
        }
      } else {
        console.log('⚠️ No unlinked orders found for email:', email);

        // If there are orders but they're already linked, still update stats
        if (allOrders && allOrders.length > 0) {
          const linkedToThisCustomer = allOrders.filter(o => o.customer_id === finalCustomer.id);
          if (linkedToThisCustomer.length > 0) {
            const orderCount = linkedToThisCustomer.length;
            const totalSpent = linkedToThisCustomer.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
            const lastOrderDate = linkedToThisCustomer.reduce((latest, order) => {
              const orderDate = new Date(order.created_at);
              return orderDate > latest ? orderDate : latest;
            }, new Date(0));

            console.log('📊 Orders already linked, updating stats anyway:', orderCount, 'orders, $', totalSpent);

            await tenantDb
              .from('customers')
              .update({
                total_orders: orderCount,
                total_spent: totalSpent,
                last_order_date: lastOrderDate.toISOString()
              })
              .eq('id', finalCustomer.id);
          }
        }
      }
    } catch (orderLinkError) {
      // Don't fail the account creation if order linking fails
      console.error('❌ Order linking error:', orderLinkError);
    }

    // Generate verification code and send email
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update customer with verification code
    await tenantDb
      .from('customers')
      .update({
        email_verification_token: verificationCode,
        password_reset_expires: verificationExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', finalCustomer.id);

    // Send verification email
    try {
      const emailService = require('../services/email-service');
      await emailService.sendTransactionalEmail(store_id, 'email_verification', {
        recipientEmail: email,
        customer: finalCustomer,
        verification_code: verificationCode
      });
      console.log('📧 Verification email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError.message);
      // Still continue - account was created
    }

    // Generate token for auto-login
    const tokens = generateTokenPair({
      id: finalCustomer.id,
      email: finalCustomer.email,
      role: 'customer',
      account_type: 'individual',
      first_name: finalCustomer.first_name,
      last_name: finalCustomer.last_name
    }, store_id);

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = finalCustomer;

    res.status(200).json({
      success: true,
      message: 'Account created successfully. Please verify your email.',
      data: {
        user: customerWithoutPassword,
        customer: customerWithoutPassword,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionRole: 'customer',
        sessionContext: 'storefront',
        requiresVerification: true
      }
    });
  } catch (error) {
    console.error('Upgrade guest error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/customer/register
 * Register a new customer in tenant database
 * Public route - requires store_id in body
 */
router.post('/customer/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, store_id } = req.body;

    // Validate input
    if (!email || !password || !first_name || !last_name || !store_id) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, last name, and store_id are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if customer exists
    const { data: existingCustomer, error: findError } = await tenantDb
      .from('customers')
      .select('id, password')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (findError) {
      console.error('Error finding customer:', findError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check existing customer'
      });
    }

    if (existingCustomer) {
      if (existingCustomer.password) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email already exists. Please login instead.'
        });
      }
      // Guest customer exists - upgrade them instead
      const hashedPassword = await bcrypt.hash(password, 10);

      const { data: upgradedCustomer, error: upgradeError } = await tenantDb
        .from('customers')
        .update({
          first_name,
          last_name,
          phone,
          password: hashedPassword,
          customer_type: 'registered',
          email_verified: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (upgradeError) {
        console.error('Upgrade customer error:', upgradeError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create account'
        });
      }

      // Generate verification code and send email
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await tenantDb
        .from('customers')
        .update({
          email_verification_token: verificationCode,
          password_reset_expires: verificationExpiry.toISOString()
        })
        .eq('id', upgradedCustomer.id);

      // Send verification email
      try {
        const emailService = require('../services/email-service');
        await emailService.sendTransactionalEmail(store_id, 'email_verification', {
          recipientEmail: email,
          customer: upgradedCustomer,
          verification_code: verificationCode
        });
        console.log('📧 Verification email sent to:', email);
      } catch (emailError) {
        console.error('⚠️ Failed to send verification email:', emailError.message);
      }

      // Generate token
      const tokens = generateTokenPair({
        id: upgradedCustomer.id,
        email: upgradedCustomer.email,
        role: 'customer',
        account_type: 'individual',
        first_name: upgradedCustomer.first_name,
        last_name: upgradedCustomer.last_name
      }, store_id);

      const { password: _, ...customerWithoutPassword } = upgradedCustomer;

      return res.status(201).json({
        success: true,
        message: 'Account created successfully. Please verify your email.',
        data: {
          user: customerWithoutPassword,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionRole: 'customer',
          sessionContext: 'storefront',
          requiresVerification: true
        }
      });
    }

    // Create new customer
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newCustomer, error: createError } = await tenantDb
      .from('customers')
      .insert({
        email,
        password: hashedPassword,
        first_name,
        last_name,
        phone,
        role: 'customer',
        customer_type: 'registered',
        store_id: store_id,
        is_active: true,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Create customer error:', createError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create account'
      });
    }

    // Link any existing guest orders to this customer
    try {
      const { data: unlinkedOrders } = await tenantDb
        .from('sales_orders')
        .select('id, total_amount')
        .eq('customer_email', email)
        .eq('store_id', store_id)
        .is('customer_id', null);

      if (unlinkedOrders && unlinkedOrders.length > 0) {
        await tenantDb
          .from('sales_orders')
          .update({ customer_id: newCustomer.id })
          .eq('customer_email', email)
          .eq('store_id', store_id)
          .is('customer_id', null);

        // Update customer stats
        const orderCount = unlinkedOrders.length;
        const totalSpent = unlinkedOrders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

        await tenantDb
          .from('customers')
          .update({
            total_orders: orderCount,
            total_spent: totalSpent,
            last_order_date: new Date().toISOString()
          })
          .eq('id', newCustomer.id);
      }
    } catch (linkError) {
      console.error('Order linking error:', linkError);
    }

    // Generate verification code and send email
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await tenantDb
      .from('customers')
      .update({
        email_verification_token: verificationCode,
        password_reset_expires: verificationExpiry.toISOString()
      })
      .eq('id', newCustomer.id);

    // Send verification email
    try {
      const emailService = require('../services/email-service');
      await emailService.sendTransactionalEmail(store_id, 'email_verification', {
        recipientEmail: email,
        customer: newCustomer,
        verification_code: verificationCode
      });
      console.log('📧 Verification email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError.message);
    }

    // Generate token
    const tokens = generateTokenPair({
      id: newCustomer.id,
      email: newCustomer.email,
      role: 'customer',
      account_type: 'individual',
      first_name: newCustomer.first_name,
      last_name: newCustomer.last_name
    }, store_id);

    const { password: _, ...customerWithoutPassword } = newCustomer;

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email.',
      data: {
        user: customerWithoutPassword,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionRole: 'customer',
        sessionContext: 'storefront',
        requiresVerification: true
      }
    });
  } catch (error) {
    console.error('Customer registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/customer/login
 * Login customer from tenant database
 * Public route - requires store_id in body
 */
router.post('/customer/login', async (req, res) => {
  try {
    const { email, password, store_id, rememberMe } = req.body;

    // Validate input
    if (!email || !password || !store_id) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and store_id are required'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find customer
    const { data: customer, error: findError } = await tenantDb
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('store_id', store_id)
      .maybeSingle();

    if (findError) {
      console.error('Error finding customer:', findError);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!customer.password) {
      return res.status(401).json({
        success: false,
        error: 'This account has not been activated. Please create a password first.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!customer.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is inactive'
      });
    }

    if (customer.is_blacklisted) {
      return res.status(403).json({
        success: false,
        error: 'This account has been suspended. Please contact support.'
      });
    }

    // Check if email is verified - if not, send verification email
    if (!customer.email_verified) {
      console.log('📧 Customer email not verified, sending verification code...');

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Update customer with verification code
      await tenantDb
        .from('customers')
        .update({
          email_verification_token: verificationCode,
          password_reset_expires: verificationExpiry.toISOString()
        })
        .eq('id', customer.id);

      // Send verification email
      try {
        const emailService = require('../services/email-service');
        await emailService.sendTransactionalEmail(store_id, 'email_verification', {
          recipientEmail: email,
          customer: customer,
          verification_code: verificationCode
        });
        console.log('📧 Verification email sent to:', email);
      } catch (emailError) {
        console.error('⚠️ Failed to send verification email:', emailError.message);
      }

      // Still generate token for partial access but flag as needing verification
      const tokens = generateTokenPair({
        id: customer.id,
        email: customer.email,
        role: 'customer',
        account_type: 'individual',
        first_name: customer.first_name,
        last_name: customer.last_name
      }, store_id);

      const { password: _, ...customerWithoutPassword } = customer;

      return res.json({
        success: true,
        message: 'Please verify your email to continue',
        data: {
          user: customerWithoutPassword,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionRole: 'customer',
          sessionContext: 'storefront',
          requiresVerification: true
        }
      });
    }

    // Update last login
    await tenantDb
      .from('customers')
      .update({ last_login: new Date().toISOString() })
      .eq('id', customer.id);

    // Link any guest orders placed with this email to this customer
    try {
      const { data: unlinkedOrders } = await tenantDb
        .from('sales_orders')
        .select('id, total_amount, created_at')
        .eq('customer_email', email)
        .eq('store_id', store_id)
        .is('customer_id', null);

      if (unlinkedOrders && unlinkedOrders.length > 0) {
        console.log(`🔗 Linking ${unlinkedOrders.length} guest orders to customer ${customer.id} on login`);

        // Link the orders
        await tenantDb
          .from('sales_orders')
          .update({ customer_id: customer.id })
          .eq('customer_email', email)
          .eq('store_id', store_id)
          .is('customer_id', null);

        // Calculate and update stats
        const newOrderCount = unlinkedOrders.length;
        const newTotalSpent = unlinkedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        const lastOrderDate = unlinkedOrders.reduce((latest, o) => {
          const d = new Date(o.created_at);
          return d > latest ? d : latest;
        }, new Date(0));

        const currentOrders = parseInt(customer.total_orders || 0);
        const currentSpent = parseFloat(customer.total_spent || 0);

        await tenantDb
          .from('customers')
          .update({
            total_orders: currentOrders + newOrderCount,
            total_spent: currentSpent + newTotalSpent,
            last_order_date: lastOrderDate.toISOString()
          })
          .eq('id', customer.id);

        console.log(`✅ Updated customer stats: +${newOrderCount} orders, +$${newTotalSpent.toFixed(2)}`);
      }
    } catch (linkError) {
      console.error('Error linking guest orders on login:', linkError);
    }

    // Generate token
    const tokens = generateTokenPair({
      id: customer.id,
      email: customer.email,
      role: 'customer',
      account_type: 'individual',
      first_name: customer.first_name,
      last_name: customer.last_name
    }, store_id);

    const { password: _, ...customerWithoutPassword } = customer;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: customerWithoutPassword,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: rememberMe ? '30 days' : '7 days',
        sessionRole: 'customer',
        sessionContext: 'storefront'
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification code to customer email
 * Public route - requires store_id in body
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email, store_id } = req.body;

    if (!email || !store_id) {
      return res.status(400).json({
        success: false,
        error: 'Email and store_id are required'
      });
    }

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
        error: 'Customer not found'
      });
    }

    // Check if already verified
    if (customer.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified'
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
    try {
      const emailService = require('../services/email-service');
      await emailService.sendTransactionalEmail(store_id, 'email_verification', {
        recipientEmail: email,
        customer: customer,
        verification_code: verificationCode
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Still return success - code was generated
    }

    res.json({
      success: true,
      message: 'Verification code sent! Please check your email.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify customer email with code
 * Public route - requires store_id in body
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code, store_id } = req.body;

    if (!email || !code || !store_id) {
      return res.status(400).json({
        success: false,
        error: 'Email, code, and store_id are required'
      });
    }

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
        error: 'Customer not found'
      });
    }

    // Check if already verified
    if (customer.email_verified) {
      return res.json({
        success: true,
        message: 'Email is already verified'
      });
    }

    // Verify the code
    if (customer.email_verification_token !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Check if code expired
    if (customer.password_reset_expires && new Date(customer.password_reset_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    // Update customer as verified
    const { data: updatedCustomer, error: updateError } = await tenantDb
      .from('customers')
      .update({
        email_verified: true,
        email_verification_token: null,
        password_reset_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Generate token for auto-login
    const tokens = generateTokenPair({
      id: updatedCustomer.id,
      email: updatedCustomer.email,
      role: 'customer',
      account_type: 'individual',
      first_name: updatedCustomer.first_name,
      last_name: updatedCustomer.last_name
    }, store_id);

    // Send welcome email after successful verification
    try {
      const emailService = require('../services/email-service');
      await emailService.sendTransactionalEmail(store_id, 'signup_email', {
        recipientEmail: email,
        customer: updatedCustomer
      });
      console.log('📧 Welcome email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send welcome email:', emailError.message);
      // Don't fail verification if welcome email fails
    }

    res.json({
      success: true,
      message: 'Email verified successfully!',
      data: {
        user: updatedCustomer,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionRole: 'customer',
        sessionContext: 'storefront'
      }
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * GET /api/auth/check-customer-status/:email/:store_id
 * Check if a customer has already registered (has password)
 * Also checks if there are orders for this email (for "Create Account" flow)
 * Public route
 */
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
      // No customer record - check if there are orders with this email
      // This determines if "Create Account" should be shown
      const { data: orders } = await tenantDb
        .from('sales_orders')
        .select('id')
        .eq('customer_email', email)
        .eq('store_id', store_id)
        .limit(1);

      const hasOrders = orders && orders.length > 0;

      return res.json({
        success: true,
        data: {
          exists: false,
          hasPassword: false,
          hasOrders: hasOrders,
          canCreateAccount: hasOrders // Guest with orders can create account
        }
      });
    }

    res.json({
      success: true,
      data: {
        exists: true,
        hasPassword: customer.password !== null && customer.password !== undefined,
        hasOrders: true,
        canCreateAccount: !customer.password // Can create if no password yet
      }
    });
  } catch (error) {
    console.error('Check customer status error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info (fresh from database)
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Fetch fresh user data from database (not stale JWT data)
    // This ensures credits and other fields are always up-to-date
    const { data: freshUser, error } = await masterDbClient
      .from('users')
      .select('id, email, first_name, last_name, role, credits, created_at, updated_at')
      .eq('id', req.user.id)
      .single();

    if (error || !freshUser) {
      console.error('Failed to fetch fresh user data:', error);
      // Fallback to JWT data if database query fails
      return res.json({
        success: true,
        data: req.user
      });
    }

    // Merge fresh data with JWT data (keep store_id from JWT)
    const userData = {
      ...req.user,
      ...freshUser,
      full_name: [freshUser.first_name, freshUser.last_name].filter(Boolean).join(' ') || null,
      store_id: req.user.store_id // Preserve store context from JWT
    };

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
});

/**
 * POST /api/auth/store-owner/verify-email
 * Verify store owner email with code
 */
router.post('/store-owner/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required'
      });
    }

    // Find user by email
    const { data: user, error: findError } = await masterDbClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (findError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if already verified
    if (user.email_verified) {
      return res.json({
        success: true,
        message: 'Email is already verified'
      });
    }

    // Verify the code
    if (user.email_verification_token !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Check if code expired
    if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    // Update user as verified
    const { data: updatedUser, error: updateError } = await masterDbClient
      .from('users')
      .update({
        email_verified: true,
        email_verification_token: null,
        password_reset_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Get user's store
    const { data: stores } = await masterDbClient
      .from('stores')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    const storeId = stores?.[0]?.id || null;

    // Generate fresh tokens
    const tokens = generateTokenPair(updatedUser, storeId);

    // Remove sensitive fields
    delete updatedUser.password;
    delete updatedUser.email_verification_token;
    delete updatedUser.password_reset_token;

    // Send welcome email
    try {
      await masterEmailService.sendWelcomeEmail({
        recipientEmail: email,
        customerName: `${updatedUser.first_name} ${updatedUser.last_name}`,
        customerFirstName: updatedUser.first_name
      });
      console.log('📧 Welcome email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send welcome email:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Email verified successfully!',
      data: {
        user: updatedUser,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionRole: updatedUser.role,
        sessionContext: 'dashboard'
      }
    });
  } catch (error) {
    console.error('Store owner verify email error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

/**
 * POST /api/auth/store-owner/resend-verification
 * Resend verification code to store owner
 */
router.post('/store-owner/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find user by email
    const { data: user, error: findError } = await masterDbClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (findError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified'
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update user with new code
    await masterDbClient
      .from('users')
      .update({
        email_verification_token: verificationCode,
        password_reset_expires: verificationExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Send verification email
    try {
      await masterEmailService.sendStoreOwnerVerificationEmail({
        recipientEmail: email,
        customerName: `${user.first_name} ${user.last_name}`,
        customerFirstName: user.first_name,
        verificationCode,
        expiresIn: '15 minutes'
      });
      console.log('📧 Verification email resent to:', email);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent! Please check your email.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification code'
    });
  }
});

module.exports = router;
