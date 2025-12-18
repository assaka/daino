/**
 * Master Email Templates
 *
 * Uniform email templates for platform-level emails (credits purchase, etc.)
 * These templates are independent of tenant/store configurations.
 */

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'DainoStore';
const PLATFORM_URL = process.env.FRONTEND_URL || 'https://www.dainostore.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@dainostore.com';

/**
 * Master Email Header Component
 * Clean, modern design inspired by Payoneer
 * Features: White background, centered logo, colorful top border
 */
const PLATFORM_LOGO_URL = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/dainostore_logo.png` : 'https://www.dainostore.com/dainostore_logo.png';

const masterEmailHeader = (options = {}) => {
  const {
    title = '',
    subtitle = '',
    logoUrl = PLATFORM_LOGO_URL
  } = options;

  return `
    <!-- Colorful Top Border - Rainbow gradient effect using segments -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; border-radius: 12px 12px 0 0; overflow: hidden;">
      <tr>
        <td style="height: 4px; width: 16.66%; background-color: #ef4444;"></td>
        <td style="height: 4px; width: 16.66%; background-color: #f97316;"></td>
        <td style="height: 4px; width: 16.66%; background-color: #ef4444;"></td>
        <td style="height: 4px; width: 16.66%; background-color: #f97316;"></td>
        <td style="height: 4px; width: 16.66%; background-color: #ef4444;"></td>
        <td style="height: 4px; width: 16.66%; background-color: #f97316;"></td>
      </tr>
    </table>
    <!-- Email Header - Clean white background -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
      <tr>
        <td style="padding: 5px; text-align: center;">
          <img src="${logoUrl}" alt="${PLATFORM_NAME}" style="max-width: 120px; height: auto;" /><br/>
          <h1 style="font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">
            DainoStore
          </h1>
        </td>
      </tr>
    </table>
    
    <!-- Title Section (if provided) -->
    ${title || subtitle ? `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
      <tr>
        <td style="padding: 0 20px 5px; text-align: center;">
          ${title ? `
          <h1 style="margin: 0 0 4px 0; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.3;">
            ${title}
          </h1>
          ` : ''}
          ${subtitle ? `
          <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 400;">
            ${subtitle}
          </p>
          ` : ''}
        </td>
      </tr>
    </table>
    ` : ''}
  `.trim();
};

/**
 * Master Email Footer Component
 * Clean, minimal footer matching the new design
 */
const masterEmailFooter = (options = {}) => {
  const {
    showSocial = false,
    showUnsubscribe = false,
    additionalLinks = []
  } = options;

  const currentYear = new Date().getFullYear();

  return `
    <!-- Email Footer -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 0 0 12px 12px;">
      <tr>
        <td style="padding: 24px 40px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <!-- Footer Links -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td style="text-align: center;">
                <a href="${PLATFORM_URL}" style="color: #6b7280; text-decoration: none; font-size: 13px; margin: 0 10px;">Dashboard</a>
                <span style="color: #e5e7eb;">|</span>
                <a href="${PLATFORM_URL}/settings" style="color: #6b7280; text-decoration: none; font-size: 13px; margin: 0 10px;">Settings</a>
                <span style="color: #e5e7eb;">|</span>
                <a href="mailto:${SUPPORT_EMAIL}" style="color: #6b7280; text-decoration: none; font-size: 13px; margin: 0 10px;">Support</a>
                ${additionalLinks.map(link => `
                  <span style="color: #e5e7eb;">|</span>
                  <a href="${link.url}" style="color: #6b7280; text-decoration: none; font-size: 13px; margin: 0 10px;">${link.label}</a>
                `).join('')}
              </td>
            </tr>
          </table>

          ${showSocial ? `
          <!-- Social Links -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td style="text-align: center;">
                <a href="#" style="display: inline-block; margin: 0 6px;">
                  <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" alt="Twitter" style="width: 20px; height: 20px; opacity: 0.5;" />
                </a>
                <a href="#" style="display: inline-block; margin: 0 6px;">
                  <img src="https://cdn-icons-png.flaticon.com/24/733/733553.png" alt="GitHub" style="width: 20px; height: 20px; opacity: 0.5;" />
                </a>
                <a href="#" style="display: inline-block; margin: 0 6px;">
                  <img src="https://cdn-icons-png.flaticon.com/24/174/174857.png" alt="LinkedIn" style="width: 20px; height: 20px; opacity: 0.5;" />
                </a>
              </td>
            </tr>
          </table>
          ` : ''}

          <!-- Copyright -->
          <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 12px;">
            ${currentYear} ${PLATFORM_NAME}. All rights reserved.
          </p>

          <!-- Address/Legal -->
          <p style="margin: 0; color: #d1d5db; font-size: 11px;">
            This is an automated message from ${PLATFORM_NAME}.
          </p>

          ${showUnsubscribe ? `
          <p style="margin: 12px 0 0 0; color: #9ca3af; font-size: 11px;">
            <a href="${PLATFORM_URL}/email-preferences" style="color: #9ca3af; text-decoration: underline;">Manage email preferences</a>
          </p>
          ` : ''}
        </td>
      </tr>
    </table>
  `.trim();
};

/**
 * Master Email Base Template
 * Clean, minimal wrapper with light background
 */
const masterEmailBase = (content, options = {}) => {
  const {
    preheader = '',
    backgroundColor = '#ffffff'
  } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${PLATFORM_NAME}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .email-content { padding: 24px 20px !important; }
      .stack-column { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${backgroundColor};">
  <!-- Preheader text (hidden) -->
  ${preheader ? `
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${preheader}
  </div>
  <div style="display: none; max-height: 0px; overflow: hidden;">
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  ` : ''}

  <!-- Email wrapper -->
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${backgroundColor};">
    <tr>
      <td align="center" style="padding: 5px">
        <!-- Email container -->
        <table role="presentation" class="email-container" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td>
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * Credits Purchase Email Template
 * Sent when a user purchases credits on the platform
 */
const creditsPurchaseEmail = (data) => {
  const {
    customerName,
    customerFirstName,
    customerEmail,
    creditsPurchased,
    amountPaid,
    currency = 'USD',
    transactionId,
    currentBalance,
    purchaseDate,
    paymentMethod = 'Credit Card'
  } = data;

  const header = masterEmailHeader({
    title: 'Purchase Confirmed!',
    subtitle: `+${creditsPurchased} Credits`,
    primaryColor: '#6366f1', // Indigo (Daino brand)
    secondaryColor: '#8b5cf6' // Purple
  });

  const footer = masterEmailFooter();

  const content = `
    ${header}

    <!-- Email Body -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff">
      <tr>
        <td class="email-content" style="padding: 40px;">
          <!-- Greeting -->
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi <strong>${customerFirstName || customerName}</strong>,
          </p>

          <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Thank you for your credit purchase! Your payment has been processed successfully and your credits are now available.
          </p>

          <!-- Purchase Summary Card -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
            <tr>
              <td style="padding: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #6366f1; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Purchase Summary
                </h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                      Credits Purchased
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6366f1; font-size: 18px; font-weight: 700;">
                      ${creditsPurchased}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                      Amount Paid
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 500;">
                      ${amountPaid} ${currency}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                      Current Balance
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">
                      ${currentBalance} credits
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                      Payment Method
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-size: 14px;">
                      ${paymentMethod}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">
                      Purchase Date
                    </td>
                    <td style="padding: 12px 0; text-align: right; color: #111827; font-size: 14px;">
                      ${purchaseDate}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Info Box -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="padding: 16px; background-color: #eef2ff; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #3730a3; font-size: 14px; line-height: 1.5;">
                  <strong>Your credits are ready to use!</strong> Visit your dashboard to start using your credits for AI translations, product descriptions, and more.
                </p>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td align="center">
                <a href="${PLATFORM_URL}/admin/settings/credits" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
                  View Dashboard
                </a>
              </td>
            </tr>
          </table>

          <!-- Transaction ID -->
          <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
            Transaction ID: ${transactionId}
          </p>
        </td>
      </tr>
    </table>

    ${footer}
  `;

  return masterEmailBase(content, {
    preheader: `Your credit purchase of ${creditsPurchased} credits has been confirmed.`
  });
};

/**
 * Credits Low Balance Warning Email
 * Sent when user's credit balance falls below threshold
 */
const creditsLowBalanceEmail = (data) => {
  const {
    customerName,
    customerFirstName,
    currentBalance,
    threshold,
    recommendedPurchase = 100
  } = data;

  const header = masterEmailHeader({
    title: 'Low Credit Balance',
    subtitle: `${currentBalance} credits remaining`,
    primaryColor: '#f59e0b', // Amber
    secondaryColor: '#d97706'
  });

  const footer = masterEmailFooter();

  const content = `
    ${header}

    <!-- Email Body -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #FFF;">
      <tr>
        <td class="email-content" style="padding: 40px;">
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi <strong>${customerFirstName || customerName}</strong>,
          </p>

          <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Your credit balance has fallen below <strong>${threshold} credits</strong>. To ensure uninterrupted service, we recommend topping up your credits soon.
          </p>

          <!-- Balance Card -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-bottom: 25px;">
            <tr>
              <td style="padding: 24px; text-align: center;">
                <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Current Balance
                </p>
                <p style="margin: 0; color: #d97706; font-size: 36px; font-weight: 700;">
                  ${currentBalance}
                </p>
                <p style="margin: 4px 0 0 0; color: #92400e; font-size: 14px;">
                  credits
                </p>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td align="center">
                <a href="${PLATFORM_URL}/admin/settings/credits" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
                  Purchase Credits
                </a>
              </td>
            </tr>
          </table>

          <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
            We recommend purchasing at least ${recommendedPurchase} credits to maintain smooth operations.
          </p>
        </td>
      </tr>
    </table>

    ${footer}
  `;

  return masterEmailBase(content, {
    preheader: `Your credit balance is low (${currentBalance} credits). Top up to ensure uninterrupted service.`
  });
};

/**
 * Welcome Email Template
 * Sent when a new user signs up to the platform
 */
const welcomeEmail = (data) => {
  const {
    customerName,
    customerFirstName,
    customerEmail,
    signupDate
  } = data;

  const header = masterEmailHeader({
    title: `Welcome to ${PLATFORM_NAME}!`,
    subtitle: 'Your e-commerce journey starts here',
  });

  const footer = masterEmailFooter();

  const content = `
    ${header}

    <!-- Email Body -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #FFF;">
      <tr>
        <td class="email-content" style="padding: 40px;">
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi <strong>${customerFirstName || customerName}</strong>,
          </p>

          <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Welcome to ${PLATFORM_NAME}! We're excited to have you on board. Your account has been successfully created and you're ready to start building your online store.
          </p>

          <!-- Getting Started Card -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
            <tr>
              <td style="padding: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 15px; font-weight: 600;">
                  Get Started in 3 Easy Steps
                </h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; vertical-align: top; width: 40px;">
                      <div style="width: 26px; height: 26px; background-color: #6366f1; border-radius: 50%; text-align: center; line-height: 26px; color: white; font-weight: 600; font-size: 13px;">1</div>
                    </td>
                    <td style="padding: 12px 0; vertical-align: top;">
                      <p style="margin: 0; color: #111827; font-weight: 600; font-size: 14px;">Set up your store</p>
                      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Configure your store settings and branding</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; vertical-align: top; width: 40px;">
                      <div style="width: 26px; height: 26px; background-color: #6366f1; border-radius: 50%; text-align: center; line-height: 26px; color: white; font-weight: 600; font-size: 13px;">2</div>
                    </td>
                    <td style="padding: 12px 0; vertical-align: top;">
                      <p style="margin: 0; color: #111827; font-weight: 600; font-size: 14px;">Add your products</p>
                      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Import or create your product catalog</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; vertical-align: top; width: 40px;">
                      <div style="width: 26px; height: 26px; background-color: #6366f1; border-radius: 50%; text-align: center; line-height: 26px; color: white; font-weight: 600; font-size: 13px;">3</div>
                    </td>
                    <td style="padding: 12px 0; vertical-align: top;">
                      <p style="margin: 0; color: #111827; font-weight: 600; font-size: 14px;">Go live</p>
                      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Publish your store and start selling</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td align="center">
                <a href="${PLATFORM_URL}/admin" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
                  Go to Dashboard
                </a>
              </td>
            </tr>
          </table>

          <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
            Need help? Our support team is always here for you.
          </p>
        </td>
      </tr>
    </table>

    ${footer}
  `;

  return masterEmailBase(content, {
    preheader: `Welcome to ${PLATFORM_NAME}! Your account is ready.`
  });
};

/**
 * Password Reset Email Template
 */
const passwordResetEmail = (data) => {
  const {
    customerName,
    customerFirstName,
    resetLink,
    expiresIn = '1 hour'
  } = data;

  const header = masterEmailHeader({
    title: 'Reset Your Password',
    subtitle: 'Follow the link below to reset',
  });

  const footer = masterEmailFooter();

  const content = `
    ${header}

    <!-- Email Body -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #FFF;">
      <tr>
        <td class="email-content" style="padding: 40px;">
          <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi <strong>${customerFirstName || customerName}</strong>,
          </p>

          <p style="margin: 0 0 25px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            We received a request to reset the password for your ${PLATFORM_NAME} account. Click the button below to create a new password.
          </p>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td align="center">
                <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 6px;">
                  Reset Password
                </a>
              </td>
            </tr>
          </table>

          <!-- Warning Box -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="padding: 16px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.5;">
                  This link will expire in <strong>${expiresIn}</strong>. If you didn't request a password reset, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${resetLink}" style="color: #6366f1; word-break: break-all;">${resetLink}</a>
          </p>
        </td>
      </tr>
    </table>

    ${footer}
  `;

  return masterEmailBase(content, {
    preheader: `Reset your ${PLATFORM_NAME} password. This link expires in ${expiresIn}.`
  });
};

/**
 * Team Invitation Email Template
 * Sent when a store owner invites someone to join their team
 * Layout matches the AcceptInvitation page design
 */
const teamInvitationEmail = (data) => {
  const {
    inviteeEmail,
    inviterName,
    inviterEmail,
    storeName,
    role,
    message,
    inviteUrl,
    expiresDate
  } = data;

  // Clean store name - remove "store" prefix if present, handle edge cases
  let cleanStoreName = storeName.replace(/^store\s+/i, '').trim();
  // If store name is literally just "Store" or empty, use a better fallback
  if (!cleanStoreName || cleanStoreName.toLowerCase() === 'store') {
    cleanStoreName = 'the store';
  }

  // Determine article based on role (a/an) - vowels need "an"
  const roleArticle = ['admin', 'editor'].includes(role) ? 'an' : 'a';

  // Get solid background color for role badge (email clients don't support gradients well)
  const getRoleBgColor = (r) => {
    switch(r) {
      case 'admin': return '#3b82f6';
      case 'editor': return '#10b981';
      default: return '#6b7280';
    }
  };

  const header = masterEmailHeader({
    title: 'You are Invited!',
    subtitle: 'Join the team and start collaborating',
    primaryColor: '#ef4444', // Red
    secondaryColor: '#dc2626'
  });

  const footer = masterEmailFooter();

  const content = `
    ${header}

    <!-- Email Body -->
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 20px;">

          <!-- Store Info Card -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0f9ff; border: 1px solid #e0e7ff; border-radius: 12px; margin-bottom: 24px;">
            <tr>
              <td style="padding: 20px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="vertical-align: middle; width: 56px;">
                      <!-- Store icon - first letter of store name -->
                      <table role="presentation" style="width: 48px; height: 48px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <tr>
                          <td align="center" valign="middle" style="color: #3b82f6; font-size: 22px; font-weight: 700;">
                            ${cleanStoreName.charAt(0).toUpperCase()}
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style="vertical-align: middle; padding-left: 16px;">
                      <p style="margin: 0 0 2px 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">You're joining store</p>
                      <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 700;">${cleanStoreName}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Role & Inviter Grid -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="width: 50%; padding-right: 8px; vertical-align: top;">
                <!-- Role -->
                <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 12px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Your Role</p>
                      <table role="presentation">
                        <tr>
                          <td style="padding: 6px 16px; background-color: ${getRoleBgColor(role)}; color: #ffffff; font-weight: 600; font-size: 13px; border-radius: 6px; text-transform: capitalize;">
                            ${role}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="width: 50%; padding-left: 8px; vertical-align: top;">
                <!-- Inviter -->
                <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 12px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Invited By</p>
                      <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 500;">${inviterName || inviterEmail || 'Store Owner'}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          ${message ? `
          <!-- Personal Message -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 16px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px;">
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="width: 24px; vertical-align: top; padding-right: 8px;">
                      <span style="font-size: 16px;">✨</span>
                    </td>
                    <td style="vertical-align: top;">
                      <p style="margin: 0; color: #78350f; font-size: 14px; font-style: italic; line-height: 1.5;">"${message}"</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ` : ''}

          <!-- Expiration Warning -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 12px 16px; background-color: #fef3c7; border-radius: 8px;">
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="width: 24px; vertical-align: middle;">
                      <span style="font-size: 14px;">⏰</span>
                    </td>
                    <td style="vertical-align: middle; color: #92400e; font-size: 13px;">
                      This invitation expires on <strong>${expiresDate}</strong>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- CTA Buttons -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${inviteUrl}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" strokecolor="#6366f1" fillcolor="#6366f1">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Accept Invitation</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${inviteUrl}" style="display: inline-block; padding: 14px 40px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ✓ Accept Invitation
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

          <!-- Footer text -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; border-top: 1px solid #e5e7eb; padding-top: 24px;">
            <tr>
              <td style="padding-top: 24px; text-align: center;">
                <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                  By accepting, you agree to Daino's Terms of Service and Privacy Policy
                </p>
                <p style="margin: 0; color: #d1d5db; font-size: 12px;">
                  Powered by <span style="color: #9ca3af; font-weight: 500;">Daino</span> — E-commerce made simple
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${footer}
  `;

  return masterEmailBase(content, {
    preheader: `${inviterName || 'Someone'} has invited you to join ${cleanStoreName} on Daino`
  });
};

module.exports = {
  // Components
  masterEmailHeader,
  masterEmailFooter,
  masterEmailBase,

  // Templates
  creditsPurchaseEmail,
  creditsLowBalanceEmail,
  welcomeEmail,
  passwordResetEmail,
  teamInvitationEmail,

  // Constants
  PLATFORM_NAME,
  PLATFORM_URL,
  SUPPORT_EMAIL
};
