/**
 * Platform Email Routes
 *
 * Handles platform-level email operations:
 * - Unsubscribe from onboarding emails
 * - Email preferences management
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { masterDbClient } = require('../database/masterConnection');

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'DainoStore';
const PLATFORM_URL = process.env.FRONTEND_URL || 'https://www.dainostore.com';

/**
 * GET /api/emails/unsubscribe
 * Unsubscribe from platform emails (onboarding, etc.)
 * Public endpoint - validates token
 */
router.get('/unsubscribe', async (req, res) => {
  try {
    const { token, email, type } = req.query;

    if (!token || !email || !type) {
      return res.status(400).send(generateUnsubscribePage({
        success: false,
        message: 'Invalid unsubscribe link. Missing required parameters.'
      }));
    }

    // Find user by email
    const { data: user, error: findError } = await masterDbClient
      .from('users')
      .select('id, email, first_name')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (findError || !user) {
      return res.status(404).send(generateUnsubscribePage({
        success: false,
        message: 'User not found or invalid email address.'
      }));
    }

    // Verify token - supports both specific type tokens and general newsletter token
    const expectedTypeToken = crypto.createHash('sha256')
      .update(`${user.id}-${email}-${type}-unsubscribe`)
      .digest('hex');

    const expectedNewsletterToken = crypto.createHash('sha256')
      .update(`${user.id}-${email}-newsletter-unsubscribe`)
      .digest('hex');

    if (token !== expectedTypeToken && token !== expectedNewsletterToken) {
      return res.status(400).send(generateUnsubscribePage({
        success: false,
        message: 'Invalid unsubscribe token. The link may have expired.'
      }));
    }

    // All marketing emails use the general newsletter_unsubscribed column
    const updateData = {
      newsletter_unsubscribed: true,
      newsletter_unsubscribed_at: new Date().toISOString()
    };
    const emailTypeName = 'marketing';

    // Update user preferences
    const { error: updateError } = await masterDbClient
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('[UNSUBSCRIBE] Update error:', updateError);
      return res.status(500).send(generateUnsubscribePage({
        success: false,
        message: 'Failed to update preferences. Please try again later.'
      }));
    }

    console.log(`[UNSUBSCRIBE] User ${email} unsubscribed from ${type} emails`);

    return res.send(generateUnsubscribePage({
      success: true,
      message: `You've been unsubscribed from ${emailTypeName} emails.`,
      firstName: user.first_name
    }));

  } catch (error) {
    console.error('[UNSUBSCRIBE] Error:', error);
    return res.status(500).send(generateUnsubscribePage({
      success: false,
      message: 'An error occurred. Please try again later.'
    }));
  }
});

/**
 * POST /api/emails/resubscribe
 * Re-subscribe to platform emails
 * Requires authentication
 */
router.post('/resubscribe', async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email || !type) {
      return res.status(400).json({
        success: false,
        error: 'Email and type are required'
      });
    }

    // Find user by email
    const { data: user, error: findError } = await masterDbClient
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (findError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // All marketing emails use the general newsletter_unsubscribed column
    const updateData = {
      newsletter_unsubscribed: false,
      newsletter_unsubscribed_at: null
    };

    // Update user preferences
    const { error: updateError } = await masterDbClient
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('[RESUBSCRIBE] Update error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update preferences'
      });
    }

    console.log(`[RESUBSCRIBE] User ${email} re-subscribed to marketing emails`);

    return res.json({
      success: true,
      message: `You've been re-subscribed to marketing emails.`
    });

  } catch (error) {
    console.error('[RESUBSCRIBE] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * Generate HTML page for unsubscribe response
 */
function generateUnsubscribePage({ success, message, firstName }) {
  const bgColor = success ? '#f0fdf4' : '#fef2f2';
  const iconColor = success ? '#22c55e' : '#ef4444';
  const icon = success ? '&#10003;' : '&#10007;';
  const title = success ? 'Unsubscribed Successfully' : 'Unsubscribe Failed';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${PLATFORM_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: ${bgColor};
      color: ${iconColor};
      font-size: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 {
      color: #111827;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #6366f1;
      color: white;
      text-decoration: none;
      font-weight: 500;
      border-radius: 8px;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #4f46e5;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${firstName ? `Hi ${firstName}, ` : ''}${message}</p>
    ${success ? `
    <p style="font-size: 14px; color: #9ca3af;">
      You can always update your email preferences in your account settings.
    </p>
    ` : ''}
    <a href="${PLATFORM_URL}" class="btn">Go to ${PLATFORM_NAME}</a>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = router;
