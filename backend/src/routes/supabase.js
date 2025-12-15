const express = require('express');
const router = express.Router();
const supabaseIntegration = require('../services/supabase-integration');
const supabaseMediaStorageOAuth = require('../services/supabase-media-storage-oauth');
const supabaseStorage = require('../services/supabase-storage');
const { authMiddleware } = require('../middleware/authMiddleware');
const { storeResolver } = require('../middleware/storeResolver');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB to accommodate larger files like PDFs
  },
  fileFilter: (req, file, cb) => {
    // Allow all common file types - validation will be done at the application level
    const allowedMimes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Please check allowed file types.`));
    }
  }
});


// Check OAuth status (for onboarding - works with pending stores)
router.get('/oauth-status', authMiddleware, async (req, res) => {
  try {
    const storeId = req.query.storeId;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }

    console.log('Checking OAuth status for store:', storeId);

    // Check for OAuth errors first
    try {
      const { getRedisClient } = require('../config/redis');
      const redisClient = getRedisClient();

      let oauthError = null;

      if (redisClient) {
        oauthError = await redisClient.get(`oauth:error:${storeId}`);
        if (oauthError) {
          console.log('❌ Found OAuth error in Redis:', oauthError);
          await redisClient.del(`oauth:error:${storeId}`); // Clean up
        }
      }

      if (!oauthError && global.oauthErrors && global.oauthErrors.has(storeId)) {
        const errorData = global.oauthErrors.get(storeId);
        oauthError = errorData.message;
        console.log('❌ Found OAuth error in memory:', oauthError);
        global.oauthErrors.delete(storeId); // Clean up
      }

      if (oauthError) {
        return res.json({
          success: false,
          connected: false,
          error: oauthError
        });
      }
    } catch (errorCheckErr) {
      console.error('⚠️ Error checking for OAuth errors:', errorCheckErr.message);
    }

    // Check Redis first (primary storage)
    try {
      const { getRedisClient } = require('../config/redis');
      const redisClient = getRedisClient();

      if (redisClient) {
        const redisKey = `oauth:pending:${storeId}`;
        const tokenDataStr = await redisClient.get(redisKey);

        if (tokenDataStr) {
          const tokenData = JSON.parse(tokenDataStr);
          console.log('✅ OAuth tokens found in Redis');

          return res.json({
            success: true,
            connected: true,
            projectUrl: tokenData.project_url,
            status: 'pending_provisioning',
            message: 'OAuth completed. Waiting for database provisioning.'
          });
        } else {
          console.log('Redis key not found:', redisKey);
        }
      }
    } catch (redisError) {
      console.log('Redis check failed:', redisError.message);
    }

    // Check memory as fallback (for pending stores)
    if (global.pendingOAuthTokens && global.pendingOAuthTokens.has(storeId)) {
      const tokenData = global.pendingOAuthTokens.get(storeId);
      console.log('✅ OAuth tokens found in memory (fallback)');

      return res.json({
        success: true,
        connected: true,
        projectUrl: tokenData.project_url,
        status: 'pending_provisioning',
        message: 'OAuth completed. Waiting for database provisioning.'
      });
    }

    // Check if OAuth tokens exist in tenant DB (for active stores)
    try {
      const token = await supabaseIntegration.getSupabaseToken(storeId);

      if (token) {
        console.log('✅ OAuth tokens found in tenant database');
        return res.json({
          success: true,
          connected: true,
          projectUrl: token.project_url,
          status: 'active',
          message: 'OAuth tokens exist in database'
        });
      }
    } catch (dbError) {
      console.log('Tenant DB not accessible (expected for pending stores):', dbError.message);
    }

    // No OAuth connection found
    console.log('❌ No OAuth connection found for store');
    return res.json({
      success: true,
      connected: false,
      message: 'No OAuth connection found'
    });

  } catch (error) {
    console.error('Error checking OAuth status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get connection status and ensure buckets exist
router.get('/status', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const status = await supabaseIntegration.getConnectionStatus(req.storeId);

    // If connected with service role key, ensure buckets exist
    if (status.connected && status.hasServiceRoleKey) {
      const bucketResult = await supabaseStorage.ensureBucketsExist(req.storeId);
      if (bucketResult.success && bucketResult.bucketsCreated && bucketResult.bucketsCreated.length > 0) {
        console.log('Auto-created buckets on status check:', bucketResult.bucketsCreated);
      }
    }

    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error getting Supabase status:', error);

    // Determine if this is a timeout/connection issue
    const isTimeout = error.message?.includes('timeout') || error.message?.includes('Timeout');
    const isConnectionError = error.message?.includes('ECONNREFUSED') ||
                              error.message?.includes('ENOTFOUND') ||
                              error.message?.includes('NetworkError');

    // Return disconnected status instead of error - allows UI to show disconnect/reset buttons
    res.json({
      success: true,
      connected: false,
      connectionError: true,
      message: isTimeout
        ? 'Connection timed out. Try resetting the connection.'
        : 'Unable to verify connection status',
      error: error.message,
      canDisconnect: true,
      canForceReset: true,  // Show force reset button
      recommendForceReset: isTimeout || isConnectionError  // Recommend reset for connection issues
    });
  }
});

// Initialize OAuth flow
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    // Get storeId from query parameter (for onboarding) or from storeResolver
    const storeId = req.query.storeId || req.storeId;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    console.log('Initiating Supabase OAuth connection for store:', storeId);
    console.log('OAuth configuration status:', {
      clientIdConfigured: !!process.env.SUPABASE_OAUTH_CLIENT_ID,
      clientSecretConfigured: !!process.env.SUPABASE_OAUTH_CLIENT_SECRET,
      redirectUriConfigured: !!process.env.SUPABASE_OAUTH_REDIRECT_URI
    });

    const state = uuidv4();
    const authUrl = supabaseIntegration.getAuthorizationUrl(storeId, state);
    console.log('Generated OAuth URL length:', authUrl.length);

    // Store state in session or database for verification
    req.session = req.session || {};
    req.session.supabaseOAuthState = state;
    req.session.supabaseOAuthStore = storeId;

    res.json({
      success: true,
      authUrl,
      state
    });
  } catch (error) {
    console.error('Error initiating Supabase connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    console.log('Supabase OAuth callback received:', {
      query: req.query,
      frontendUrl: process.env.FRONTEND_URL,
      hasCode: !!req.query.code,
      hasState: !!req.query.state,
      hasError: !!req.query.error
    });

    const { code, state, error, error_description } = req.query;
    
    // Check for OAuth errors from Supabase
    if (error) {
      console.error('OAuth error from Supabase:', error, error_description);
      throw new Error(error_description || error || 'Authorization failed');
    }
    
    if (!code) {
      throw new Error('Authorization code not provided');
    }

    // Parse state to get store ID
    let storeId;
    try {
      // Decode the state parameter first (it may be URL-encoded)
      const decodedState = decodeURIComponent(state);
      console.log('Decoded state:', decodedState);

      const stateData = JSON.parse(decodedState);
      storeId = stateData.storeId;
      console.log('Parsed state data:', stateData);

      if (!storeId) {
        throw new Error('Store ID not found in state');
      }
    } catch (err) {
      console.error('Failed to parse state:', {
        raw: state,
        error: err.message,
        stack: err.stack
      });
      throw new Error('Invalid state parameter - unable to identify store');
    }

    // Exchange code for token
    console.log('Exchanging code for token...');
    const result = await supabaseIntegration.exchangeCodeForToken(code, storeId);
    
    console.log('Token exchange result:', result);
    
    // Try to create buckets after successful connection (skip for pending stores)
    if (result.success) {
      try {
        const { MasterStore } = require('../models/master');
        const store = await MasterStore.findByPk(storeId);

        if (store && store.status === 'pending_database') {
          console.log('⏭️ Skipping bucket creation - tenant DB not provisioned yet');
        } else {
          console.log('Attempting to create storage buckets...');
          const bucketResult = await supabaseStorage.ensureBucketsExist(storeId);
          if (bucketResult.success) {
            console.log('Bucket creation result:', bucketResult.message);
          }
        }
      } catch (bucketError) {
        console.log('Could not create buckets immediately:', bucketError.message);
        // Non-blocking - buckets will be created on first use
      }
    }
    
    // Send minimal success page that closes instantly
    console.log('✅ OAuth callback successful - sending success HTML page');
    const projectUrl = result.project?.url || 'Connected';
    const userEmail = result.user?.email || '';

    console.log('Project URL:', projectUrl);
    console.log('User email:', userEmail);

    // Check if this is a limited scope connection
    const isLimitedScope = result.limitedScope ||
                          projectUrl === 'Configuration pending' ||
                          projectUrl === 'https://pending-configuration.supabase.co' ||
                          projectUrl === 'pending_configuration' ||
                          projectUrl === 'Configuration pending - limited scope';

    // Set CSP header to allow inline scripts
    res.setHeader('Content-Security-Policy', "script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self';");

    console.log('📤 Sending success HTML with postMessage script...');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Success</title>
        <style>
          body {
            margin: 0;
            background: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .container {
            text-align: center;
            color: white;
          }
          .checkmark {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 24px;
            margin: 0 0 10px 0;
            font-weight: 600;
          }
          p {
            font-size: 14px;
            margin: 0 0 30px 0;
            opacity: 0.9;
          }
          button {
            background: white;
            color: #10b981;
            border: none;
            padding: 12px 32px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.1s;
            position: relative;
            z-index: 9999;
            pointer-events: auto;
          }
          button:hover {
            transform: scale(1.05);
            background: #f0f0f0;
          }
          button:active {
            transform: scale(0.95);
            background: #e0e0e0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Successfully Connected!</h1>
          <p>Your Supabase account has been connected</p>
          <button id="closeBtn">Close & Continue</button>
          <p style="font-size: 12px; margin-top: 20px; opacity: 0.7;">Window will auto-close in 5 seconds or click above</p>
        </div>
        <script>
          (function() {
            console.log('🎯 OAuth success page loaded');
            console.log('Has opener:', !!window.opener);
            console.log('Opener closed:', window.opener ? window.opener.closed : 'N/A');

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }

            function init() {
              console.log('🚀 Initializing success page...');
              const closeBtn = document.getElementById('closeBtn');

              if (closeBtn) {
                // Attach click handler
                closeBtn.addEventListener('click', function(e) {
                  e.preventDefault();
                  closeWindow();
                });
              }

              // Auto-close after 5 seconds as fallback
              setTimeout(() => {
                closeWindow();
              }, 5000);
            }

            function closeWindow() {
              console.log('🔔 Attempting to notify parent window...');

              // Use postMessage for cross-origin communication (more reliable)
              try {
                if (window.opener && !window.opener.closed) {
                  console.log('📤 Sending postMessage to parent...');

                  // Send message to parent window
                  window.opener.postMessage({
                    type: 'supabase-oauth-success',
                    message: 'Successfully connected to Supabase!'
                  }, '*'); // Use '*' to ensure message is sent regardless of origin

                  console.log('✅ postMessage sent');

                  // Also try sessionStorage as fallback
                  try {
                    window.opener.sessionStorage.setItem('supabase_connection_success', 'Successfully connected to Supabase!');
                    console.log('✅ sessionStorage set');
                  } catch (e) {
                    console.log('⚠️ sessionStorage failed:', e.message);
                  }
                } else {
                  console.error('❌ No opener or opener is closed');
                }
              } catch (error) {
                console.error('❌ Error communicating with parent:', error);
              }

              // Close window after short delay to ensure message is sent
              console.log('🚪 Closing popup in 100ms...');
              setTimeout(() => {
                window.close();
              }, 100);
            }
          })();
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });

    // Send error page that closes the popup window
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connection Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f3f4f6;
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          .error {
            color: #ef4444;
            font-size: 48px;
            margin-bottom: 1rem;
          }
          h1 {
            color: #1f2937;
            margin-bottom: 0.5rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 1rem;
          }
          .error-details {
            background: #fef2f2;
            color: #991b1b;
            padding: 1rem;
            border-radius: 6px;
            margin-top: 1rem;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">✗</div>
          <h1>Connection Failed</h1>
          <p>Unable to connect to Supabase. This window will close automatically.</p>
          <div class="error-details">${error.message}</div>
        </div>
        <script>
          console.log('🚨 OAuth Error Page Loaded');
          console.log('   Error:', '${error.message.replace(/'/g, "\\'")}');

          // Notify parent window of error immediately
          if (window.opener) {
            console.log('✅ Window opener found, sending postMessage');

            const errorMessage = '${error.message.replace(/'/g, "\\'")}';

            // ALSO store in sessionStorage as fallback
            try {
              window.opener.sessionStorage.setItem('supabase_oauth_error', errorMessage);
              console.log('✅ Error stored in parent sessionStorage');
            } catch (storageErr) {
              console.error('❌ Failed to store in sessionStorage:', storageErr);
            }

            // Send message to parent (use '*' to ensure it gets through regardless of origin)
            window.opener.postMessage({
              type: 'supabase-oauth-error',
              error: errorMessage
            }, '*');

            console.log('📤 postMessage sent to parent window');

            // Try sending multiple times to ensure delivery
            let attempts = 0;
            const sendInterval = setInterval(() => {
              attempts++;
              window.opener.postMessage({
                type: 'supabase-oauth-error',
                error: errorMessage
              }, '*');
              console.log('📤 Retry #' + attempts + ' - postMessage sent');

              if (attempts >= 3) {
                clearInterval(sendInterval);
              }
            }, 300);

            // Keep window open longer to ensure message is delivered
            setTimeout(() => {
              clearInterval(sendInterval);
              console.log('🚪 Closing error window after 3 seconds');
              window.close();
            }, 3000);
          } else {
            console.error('❌ No window opener found');
            // No opener, show manual close button immediately
            document.querySelector('.container').innerHTML =
              '<div class="error">✗</div>' +
              '<h1>Connection Failed</h1>' +
              '<p>You can close this window and try again.</p>' +
              '<button onclick="window.close();" style="' +
              'background: #ef4444; color: white; border: none; ' +
              'padding: 10px 20px; border-radius: 6px; cursor: pointer; ' +
              'font-size: 16px; margin-top: 10px;">Close Window</button>';
          }
        </script>
      </body>
      </html>
    `);
  }
});

// Media Storage OAuth callback
router.get('/storage/callback', async (req, res) => {
  try {
    console.log('📦 Supabase Media Storage OAuth callback received:', {
      hasCode: !!req.query.code,
      hasState: !!req.query.state,
      hasError: !!req.query.error
    });

    const { code, state, error, error_description } = req.query;

    // Check for OAuth errors from Supabase
    if (error) {
      console.error('OAuth error from Supabase:', error, error_description);
      throw new Error(error_description || error || 'Authorization failed');
    }

    if (!code || !state) {
      throw new Error('Authorization code or state not provided');
    }

    // Exchange code for token using media storage OAuth service
    console.log('📦 Exchanging code for token via media storage OAuth...');
    const result = await supabaseMediaStorageOAuth.exchangeCodeForToken(code, state);

    console.log('📦 Media Storage Token exchange result:', result);

    // Try to create buckets after successful connection
    if (result.success) {
      try {
        console.log('📦 Attempting to create storage buckets...');
        const bucketResult = await supabaseStorage.ensureBucketsExist(result.storeId);
        if (bucketResult.success) {
          console.log('📦 Bucket creation result:', bucketResult.message);
        }
      } catch (bucketError) {
        console.log('📦 Could not create buckets immediately:', bucketError.message);
      }
    }

    // Send success page
    console.log('✅ Media Storage OAuth callback successful');
    res.setHeader('Content-Security-Policy', "script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self';");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Storage Connected</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            text-align: center;
            max-width: 400px;
          }
          .checkmark {
            color: #10b981;
            font-size: 64px;
            margin-bottom: 1rem;
          }
          h1 { color: #1f2937; margin-bottom: 0.5rem; }
          p { color: #6b7280; margin-bottom: 1rem; }
          button {
            background: #f3f4f6;
            color: #374151;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            transition: all 0.2s;
          }
          button:hover { background: #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Storage Connected!</h1>
          <p>Your Supabase storage has been connected successfully.</p>
          <p><strong>Project:</strong> ${result.projectName || 'Connected'}</p>
          <button id="closeBtn">Close & Continue</button>
        </div>
        <script>
          (function() {
            console.log('📦 Storage OAuth success page loaded');

            document.getElementById('closeBtn').addEventListener('click', closeWindow);
            setTimeout(closeWindow, 5000);

            function closeWindow() {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'supabase-storage-oauth-success',
                  success: true,
                  projectName: '${result.projectName || ''}'
                }, '*');
              }
              setTimeout(() => window.close(), 500);
            }
          })();
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('📦 Media Storage OAuth callback error:', error.message);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connection Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f3f4f6;
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          .error { color: #ef4444; font-size: 48px; margin-bottom: 1rem; }
          h1 { color: #1f2937; margin-bottom: 0.5rem; }
          p { color: #6b7280; }
          .error-details {
            background: #fef2f2;
            color: #991b1b;
            padding: 1rem;
            border-radius: 6px;
            margin-top: 1rem;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">✗</div>
          <h1>Connection Failed</h1>
          <p>Unable to connect storage. This window will close automatically.</p>
          <div class="error-details">${error.message}</div>
        </div>
        <script>
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'supabase-storage-oauth-error',
              error: '${error.message.replace(/'/g, "\\'")}'
            }, '*');
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>
    `);
  }
});

// Get available projects
router.get('/projects', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const result = await supabaseIntegration.getProjects(req.storeId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching Supabase projects:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Select a project
router.post('/select-project', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }
    
    const result = await supabaseIntegration.selectProject(req.storeId, projectId);
    
    // Try to create buckets after project selection
    if (result.success) {
      try {
        console.log('Attempting to create storage buckets after project selection...');
        const bucketResult = await supabaseStorage.ensureBucketsExist(req.storeId);
        if (bucketResult.success) {
          console.log('Bucket creation result:', bucketResult.message);
          result.bucketsCreated = bucketResult.bucketsCreated;
          if (bucketResult.bucketsCreated && bucketResult.bucketsCreated.length > 0) {
            result.message = `${result.message || 'Project selected successfully'}. Auto-created buckets: ${bucketResult.bucketsCreated.join(', ')}`;
          }
        }
      } catch (bucketError) {
        console.log('Could not create buckets after project selection:', bucketError.message);
        // Non-blocking - buckets will be created on first use
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error selecting Supabase project:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test connection and ensure buckets exist
router.post('/test', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const result = await supabaseIntegration.testConnection(req.storeId);
    
    // If connection is successful and has keys, ensure buckets exist
    if (result.success) {
      const bucketResult = await supabaseStorage.ensureBucketsExist(req.storeId);
      if (bucketResult.success && bucketResult.bucketsCreated && bucketResult.bucketsCreated.length > 0) {
        result.message = `${result.message}. Auto-created buckets: ${bucketResult.bucketsCreated.join(', ')}`;
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Disconnect - always attempt cleanup even if errors occur
router.post('/disconnect', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const result = await supabaseIntegration.disconnect(req.storeId);
    res.json(result);
  } catch (error) {
    console.error('Error disconnecting Supabase:', error);

    // Try force cleanup even if main disconnect fails
    try {
      const ConnectionManager = require('../services/database/ConnectionManager');
      const tenantDb = await ConnectionManager.getStoreConnection(req.storeId);

      // Force delete integration configs
      await tenantDb
        .from('integration_configs')
        .delete()
        .eq('store_id', req.storeId)
        .in('integration_type', ['supabase-oauth', 'supabase-keys']);

      console.log('Force cleanup of integration_configs completed');

      res.json({
        success: true,
        message: 'Connection forcefully cleaned up. You can now reconnect.',
        forceCleanup: true
      });
    } catch (cleanupError) {
      console.error('Force cleanup also failed:', cleanupError);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect. Please try again or contact support.',
        error: error.message
      });
    }
  }
});

// Force reset connection - always works regardless of connection state
// Use this when normal disconnect fails or connection is in a bad state
router.post('/force-reset', authMiddleware, storeResolver(), async (req, res) => {
  const storeId = req.storeId;
  console.log(`[FORCE_RESET] Starting force reset for store ${storeId}`);

  const results = {
    tenant_integration_configs: false,
    master_integration_tokens: false,
    errors: []
  };

  // 1. Clean tenant integration_configs
  try {
    const ConnectionManager = require('../services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('integration_configs')
      .delete()
      .eq('store_id', storeId)
      .in('integration_type', ['supabase-oauth', 'supabase-keys']);

    if (error) throw error;
    results.tenant_integration_configs = true;
    console.log('[FORCE_RESET] Cleaned tenant integration_configs');
  } catch (err) {
    console.error('[FORCE_RESET] Error cleaning tenant:', err.message);
    results.errors.push(`Tenant cleanup: ${err.message}`);
  }

  // 2. Clean master integration_tokens
  try {
    const { masterDbClient } = require('../database/masterConnection');

    const { error } = await masterDbClient
      .from('integration_tokens')
      .delete()
      .eq('store_id', storeId)
      .eq('integration_type', 'supabase-oauth');

    if (error) throw error;
    results.master_integration_tokens = true;
    console.log('[FORCE_RESET] Cleaned master integration_tokens');
  } catch (err) {
    console.error('[FORCE_RESET] Error cleaning master:', err.message);
    results.errors.push(`Master cleanup: ${err.message}`);
  }

  // Return success if at least tenant was cleaned
  if (results.tenant_integration_configs) {
    res.json({
      success: true,
      message: 'Connection reset successfully. You can now reconnect to Supabase.',
      results
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Failed to reset connection. Please contact support.',
      results
    });
  }
});

// =================
// Storage endpoints
// =================

// Upload image - handles both 'file' and 'image' fields for flexibility
router.post('/storage/upload', authMiddleware, 
  storeResolver(), 
  upload.single('file') || upload.single('image'), // Accept both field names
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided'
        });
      }

      // Enhanced options from request body
      const options = {
        folder: req.body.folder || 'uploads',
        public: req.body.public === 'true' || req.body.public === true,
        type: req.body.type || 'general', // product, category, asset, etc.
        useMagentoStructure: req.body.useMagentoStructure === 'true',
        filename: req.body.filename
      };

      const result = await supabaseStorage.uploadImage(req.storeId, req.file, options);

      // Enhanced response with additional metadata
      res.json({
        success: true,
        ...result,
        id: result.id || Date.now(),
        filename: result.filename || req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Test upload - upload a sample product image
router.post('/storage/test-upload', authMiddleware, 
  storeResolver(),
  async (req, res) => {
    try {
      console.log('Testing Supabase storage upload...');
      
      // Create a test image buffer (1x1 pixel PNG)
      const testImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      // Create mock file object
      const mockFile = {
        originalname: 'test-product.png',
        mimetype: 'image/png',
        buffer: testImageBuffer,
        size: testImageBuffer.length
      };

      // For test upload, always try direct API first
      let result;
      try {
        console.log('Attempting direct API upload for test...');
        console.log('Store ID:', req.storeId);
        
        // First check if we have API keys
        const tokenInfo = await supabaseIntegration.getTokenInfo(req.storeId);
        console.log('Token info check for test upload:');
        console.log('  Has project URL:', !!tokenInfo?.project_url);
        console.log('  Project URL:', tokenInfo?.project_url);
        console.log('  Has service key:', !!tokenInfo?.service_role_key);
        
        result = await supabaseStorage.uploadImageDirect(req.storeId, mockFile, {
          folder: 'test-products',
          public: true
        });
      } catch (directError) {
        console.log('Direct API failed:', directError.message);
        console.log('Attempting regular upload as fallback...');
        result = await supabaseStorage.uploadImage(req.storeId, mockFile, {
          folder: 'test-products',
          public: true
        });
      }

      res.json({
        success: true,
        message: 'Test image uploaded successfully!',
        ...result
      });
    } catch (error) {
      console.error('Error in test upload:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Upload multiple images
router.post('/storage/upload-multiple', authMiddleware,
  storeResolver(),
  upload.array('images', 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No image files provided'
        });
      }

      const result = await supabaseStorage.uploadMultipleImages(req.storeId, req.files, {
        folder: req.body.folder,
        public: req.body.public === 'true'
      });

      res.json(result);
    } catch (error) {
      console.error('Error uploading images:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// List images
router.get('/storage/list', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const result = await supabaseStorage.listImages(req.storeId, req.query.folder, {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0,
      bucket: req.query.bucket
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// List files from specific bucket
router.get('/storage/list/:bucketName', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { bucketName } = req.params;
    console.log(`📂 Listing files from bucket: ${bucketName}`);

    const result = await supabaseStorage.listImages(req.storeId, req.query.folder, {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0,
      bucket: bucketName
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing files from bucket:', error);

    // Check for specific authentication/service role key errors
    if (error.message && (error.message.includes('Invalid service role key') || error.message.includes('JWT') || error.message.includes('malformed'))) {
      return res.status(401).json({
        success: false,
        message: error.message,
        errorType: 'INVALID_SERVICE_KEY'
      });
    }

    // Check for permission errors
    if (error.message && error.message.includes('permission')) {
      return res.status(403).json({
        success: false,
        message: error.message,
        errorType: 'PERMISSION_DENIED'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete image
router.delete('/storage/delete', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { path, bucket } = req.body;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'Image path is required'
      });
    }

    const result = await supabaseStorage.deleteImage(req.storeId, path, bucket);
    res.json(result);
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Move image
router.post('/storage/move', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { fromPath, toPath, bucket } = req.body;
    
    if (!fromPath || !toPath) {
      return res.status(400).json({
        success: false,
        message: 'Both fromPath and toPath are required'
      });
    }

    const result = await supabaseStorage.moveImage(req.storeId, fromPath, toPath, bucket);
    res.json(result);
  } catch (error) {
    console.error('Error moving image:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Copy image
router.post('/storage/copy', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { fromPath, toPath, bucket } = req.body;
    
    if (!fromPath || !toPath) {
      return res.status(400).json({
        success: false,
        message: 'Both fromPath and toPath are required'
      });
    }

    const result = await supabaseStorage.copyImage(req.storeId, fromPath, toPath, bucket);
    res.json(result);
  } catch (error) {
    console.error('Error copying image:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get signed URL
router.post('/storage/signed-url', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { path, expiresIn, bucket } = req.body;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'Image path is required'
      });
    }

    const result = await supabaseStorage.getSignedUrl(req.storeId, path, expiresIn, bucket);
    res.json(result);
  } catch (error) {
    console.error('Error creating signed URL:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get storage statistics
router.get('/storage/stats', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const result = await supabaseStorage.getStorageStats(req.storeId);
    res.json(result);
  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Fetch and update API keys for current project
router.post('/fetch-api-keys', authMiddleware, storeResolver(), async (req, res) => {
  try {
    console.log('Fetching API keys for store:', req.storeId);
    const result = await supabaseIntegration.fetchAndUpdateApiKeys(req.storeId);
    
    // Get updated status
    const status = await supabaseIntegration.getConnectionStatus(req.storeId);
    
    res.json({
      ...result,
      connectionStatus: status
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Manually update project configuration (for limited scope connections or when API doesn't provide keys)
router.post('/update-config', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { projectId, projectUrl, serviceRoleKey, databaseUrl, storageUrl, authUrl } = req.body;
    
    console.log('Manual config update request:', {
      hasProjectId: !!projectId,
      hasProjectUrl: !!projectUrl,
      hasServiceRoleKey: !!serviceRoleKey
    });
    
    // Validate at least one field is provided
    if (!projectUrl && !serviceRoleKey && !databaseUrl && !storageUrl && !authUrl) {
      return res.status(400).json({
        success: false,
        message: 'At least one configuration field must be provided'
      });
    }
    
    // Validate project URL format if provided
    if (projectUrl && !projectUrl.includes('supabase.co')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project URL format. Expected format: https://[project-id].supabase.co'
      });
    }
    
    const result = await supabaseIntegration.updateProjectConfig(req.storeId, {
      projectUrl,
      serviceRoleKey,
      databaseUrl,
      storageUrl,
      authUrl
    });
    
    // After updating, test if storage works and create buckets
    if (serviceRoleKey) {
      try {
        const tokenInfo = await supabaseIntegration.getTokenInfo(req.storeId);
        console.log('Config updated. New token info:', {
          hasServiceKey: !!tokenInfo?.service_role_key
        });
        
        // Try to create buckets with the new service role key
        console.log('Attempting to create storage buckets with new config...');
        const bucketResult = await supabaseStorage.ensureBucketsExist(req.storeId);
        if (bucketResult.success) {
          console.log('Bucket creation result:', bucketResult.message);
          result.bucketsCreated = bucketResult.bucketsCreated;
        }
        
        result.storageReady = true;
      } catch (testError) {
        console.log('Could not verify storage readiness:', testError.message);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating project config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Debug endpoint to check all credential sources
router.get('/debug-credentials', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const results = {
      storeId,
      sources: {}
    };

    // Check 1: supabase-storage integration
    try {
      const supabaseMediaStorageOAuth = require('../services/supabase-media-storage-oauth');
      const storageCredentials = await supabaseMediaStorageOAuth.getStorageCredentials(storeId);
      results.sources['supabase-storage'] = {
        found: !!storageCredentials,
        hasProjectUrl: !!storageCredentials?.project_url,
        hasServiceRoleKey: !!storageCredentials?.service_role_key,
        projectUrl: storageCredentials?.project_url || null
      };
    } catch (e) {
      results.sources['supabase-storage'] = { error: e.message };
    }

    // Check 2: supabase-oauth integration
    try {
      const IntegrationConfig = require('../models/IntegrationConfig');
      const oauthConfig = await IntegrationConfig.findByStoreAndType(storeId, 'supabase-oauth');
      results.sources['supabase-oauth'] = {
        found: !!oauthConfig,
        hasProjectUrl: !!oauthConfig?.config_data?.projectUrl,
        hasServiceRoleKey: !!oauthConfig?.config_data?.serviceRoleKey,
        projectUrl: oauthConfig?.config_data?.projectUrl || null,
        connectionStatus: oauthConfig?.connection_status || null
      };
    } catch (e) {
      results.sources['supabase-oauth'] = { error: e.message };
    }

    // Check 3: store_databases
    try {
      const StoreDatabase = require('../models/master/StoreDatabase');
      const storeDb = await StoreDatabase.findByStoreId(storeId);
      if (storeDb) {
        const credentials = storeDb.getCredentials();
        results.sources['store_databases'] = {
          found: true,
          databaseType: storeDb.database_type,
          hasProjectUrl: !!credentials?.projectUrl,
          hasServiceRoleKey: !!credentials?.serviceRoleKey,
          projectUrl: credentials?.projectUrl || null,
          connectionStatus: storeDb.connection_status
        };
      } else {
        results.sources['store_databases'] = { found: false };
      }
    } catch (e) {
      results.sources['store_databases'] = { error: e.message };
    }

    // Check 4: supabaseIntegration token
    try {
      const token = await supabaseIntegration.getSupabaseToken(storeId);
      results.sources['supabase-integration-token'] = {
        found: !!token,
        hasProjectUrl: !!token?.project_url,
        hasServiceRoleKey: !!token?.service_role_key,
        projectUrl: token?.project_url || null
      };
    } catch (e) {
      results.sources['supabase-integration-token'] = { error: e.message };
    }

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Ensure buckets exist - can be called anytime to create missing buckets
router.post('/storage/ensure-buckets', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const result = await supabaseStorage.ensureBucketsExist(req.storeId);
    res.json(result);
  } catch (error) {
    console.error('Error ensuring buckets exist:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get storage buckets
router.get('/storage/buckets', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const result = await supabaseStorage.listBuckets(req.storeId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching buckets:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Create storage bucket
router.post('/storage/buckets', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { name, public: isPublic } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Bucket name is required'
      });
    }
    
    const result = await supabaseStorage.createBucket(req.storeId, name, {
      public: isPublic === true || isPublic === 'true'
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error creating bucket:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete storage bucket
router.delete('/storage/buckets/:bucketId', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { bucketId } = req.params;
    
    const result = await supabaseStorage.deleteBucket(req.storeId, bucketId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting bucket:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;