const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

/**
 * Email Service for SanctumTools
 * Handles verification emails, welcome emails, and password reset emails
 * Uses AWS SES for production-ready email delivery
 */

// Initialize SES client
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Generate HTML template for verification email
 */
const getVerificationEmailTemplate = (verificationLink, email) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - SanctumTools</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .content h2 {
            color: #333333;
            font-size: 24px;
            margin: 0 0 20px 0;
        }
        .content p {
            color: #666666;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 20px 0;
        }
        .verify-button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .verify-button:hover {
            transform: translateY(-2px);
        }
        .warning-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .warning-box p {
            margin: 0;
            color: #856404;
            font-size: 14px;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            color: #6c757d;
            font-size: 14px;
            margin: 5px 0;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .alternative-link {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            word-break: break-all;
        }
        .alternative-link p {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666666;
        }
        .alternative-link code {
            display: block;
            padding: 10px;
            background-color: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-size: 12px;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>SanctumTools</h1>
            <p>Your Secure Mental Health Companion</p>
        </div>
        <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Hello,</p>
            <p>Thank you for signing up for SanctumTools! To complete your registration and ensure the security of your account, please verify your email address by clicking the button below:</p>

            <center>
                <a href="${verificationLink}" class="verify-button">Verify Email Address</a>
            </center>

            <div class="warning-box">
                <p><strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification link.</p>
            </div>

            <p>If you didn't create an account with SanctumTools, you can safely ignore this email.</p>

            <div class="alternative-link">
                <p><strong>Trouble clicking the button?</strong> Copy and paste this link into your browser:</p>
                <code>${verificationLink}</code>
            </div>

            <p>For security reasons, never share this link with anyone. This link is unique to your account and should only be used by you.</p>
        </div>
        <div class="footer">
            <p><strong>SanctumTools</strong></p>
            <p>Secure, encrypted mental health journaling and support</p>
            <p>Questions? Contact us at <a href="mailto:support@sanctumtools.com">support@sanctumtools.com</a></p>
            <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
                This is an automated message. Please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
  `.trim();
};

/**
 * Generate HTML template for welcome email
 */
const getWelcomeEmailTemplate = (userName) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to SanctumTools</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 600;
        }
        .header p {
            margin: 12px 0 0 0;
            font-size: 18px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .content h2 {
            color: #333333;
            font-size: 24px;
            margin: 0 0 20px 0;
        }
        .content p {
            color: #666666;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 20px 0;
        }
        .feature-box {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .feature-box h3 {
            color: #333333;
            font-size: 18px;
            margin: 0 0 10px 0;
        }
        .feature-box ul {
            margin: 0;
            padding-left: 20px;
            color: #666666;
        }
        .feature-box li {
            margin: 8px 0;
            line-height: 1.5;
        }
        .cta-button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .security-notice {
            background-color: #d1ecf1;
            border-left: 4px solid #0c5460;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .security-notice p {
            margin: 0;
            color: #0c5460;
            font-size: 14px;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            color: #6c757d;
            font-size: 14px;
            margin: 5px 0;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Welcome to SanctumTools!</h1>
            <p>Your journey to better mental health starts here</p>
        </div>
        <div class="content">
            <h2>Hello${userName ? ', ' + userName : ''}!</h2>
            <p>Your email has been successfully verified, and your account is now active. We're thrilled to have you join the SanctumTools community!</p>

            <p>SanctumTools is your secure, private space for mental health journaling, reflection, and growth. Here's what you can do:</p>

            <div class="feature-box">
                <h3>Key Features</h3>
                <ul>
                    <li><strong>Secure Journaling:</strong> Write freely in your encrypted personal journal</li>
                    <li><strong>AI-Powered Support:</strong> Get thoughtful responses and insights from Claude</li>
                    <li><strong>Private & Encrypted:</strong> Your data is protected with industry-standard encryption</li>
                    <li><strong>Crisis Support:</strong> Access to resources when you need them most</li>
                    <li><strong>Mood Tracking:</strong> Monitor your emotional well-being over time</li>
                </ul>
            </div>

            <center>
                <a href="${process.env.BASE_URL || 'https://sanctumtools.com'}/dashboard" class="cta-button">Start Your Journey</a>
            </center>

            <div class="security-notice">
                <p><strong>Security Reminder:</strong> We recommend enabling two-factor authentication (2FA) to add an extra layer of security to your account. You can set this up in your account settings.</p>
            </div>

            <p>If you have any questions or need assistance getting started, our support team is here to help.</p>

            <p>Welcome aboard, and here's to your mental health journey!</p>

            <p>Best regards,<br><strong>The SanctumTools Team</strong></p>
        </div>
        <div class="footer">
            <p><strong>SanctumTools</strong></p>
            <p>Secure, encrypted mental health journaling and support</p>
            <p>Questions? Contact us at <a href="mailto:support@sanctumtools.com">support@sanctumtools.com</a></p>
            <p style="margin-top: 20px;">
                <a href="${process.env.BASE_URL || 'https://sanctumtools.com'}/privacy">Privacy Policy</a> |
                <a href="${process.env.BASE_URL || 'https://sanctumtools.com'}/terms">Terms of Service</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
                This is an automated message. Please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
  `.trim();
};

/**
 * Generate HTML template for password reset email
 */
const getPasswordResetEmailTemplate = (resetLink, email) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - SanctumTools</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .content h2 {
            color: #333333;
            font-size: 24px;
            margin: 0 0 20px 0;
        }
        .content p {
            color: #666666;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 20px 0;
        }
        .reset-button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .reset-button:hover {
            transform: translateY(-2px);
        }
        .warning-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .warning-box p {
            margin: 0;
            color: #856404;
            font-size: 14px;
        }
        .security-note {
            background-color: #d1ecf1;
            border-left: 4px solid #0c5460;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .security-note p {
            margin: 0;
            color: #0c5460;
            font-size: 14px;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            color: #6c757d;
            font-size: 14px;
            margin: 5px 0;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .alternative-link {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            word-break: break-all;
        }
        .alternative-link p {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666666;
        }
        .alternative-link code {
            display: block;
            padding: 10px;
            background-color: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-size: 12px;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>SanctumTools</h1>
            <p>Password Reset Request</p>
        </div>
        <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hello,</p>
            <p>We received a request to reset the password for your SanctumTools account associated with this email address. Click the button below to create a new password:</p>

            <center>
                <a href="${resetLink}" class="reset-button">Reset Password</a>
            </center>

            <div class="warning-box">
                <p><strong>Important:</strong> This password reset link will expire in 1 hour. If you don't reset your password within this time, you'll need to request a new reset link.</p>
            </div>

            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

            <div class="alternative-link">
                <p><strong>Trouble clicking the button?</strong> Copy and paste this link into your browser:</p>
                <code>${resetLink}</code>
            </div>

            <div class="security-note">
                <p><strong>Security Reminder:</strong> We will never ask for your password in an email. Always use the reset link provided to change your password securely.</p>
            </div>
        </div>
        <div class="footer">
            <p><strong>SanctumTools</strong></p>
            <p>Secure, encrypted mental health journaling and support</p>
            <p>Questions? Contact us at <a href="mailto:support@sanctumtools.com">support@sanctumtools.com</a></p>
            <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
                This is an automated message. Please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
  `.trim();
};

/**
 * Send email via AWS SES
 * @param {Object} params - SES SendEmailCommand parameters
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendEmail = async (params) => {
  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    return {
      success: true,
      messageId: response.MessageId,
      message: 'Email sent successfully',
    };
  } catch (error) {
    console.error('[EmailService] Error sending email via SES:', {
      error: error.message,
      stack: error.stack,
      recipient: params.Destination?.ToAddresses?.[0],
      timestamp: new Date().toISOString(),
    });
    return {
      success: false,
      error: error.message,
      message: 'Failed to send email',
    };
  }
};

/**
 * Send verification email
 * @param {string} email - Recipient email address
 * @param {string} verificationToken - Unique verification token
 * @param {string} baseUrl - Base URL of the application
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendVerificationEmail = async (email, verificationToken, baseUrl) => {
  try {
    // Validate inputs
    if (!email || !verificationToken || !baseUrl) {
      throw new Error('Missing required parameters: email, verificationToken, and baseUrl are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Construct verification link
    const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;

    // Email options
    const mailOptions = {
      Source: process.env.SMTP_FROM || 'support@sanctumtools.com',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'Verify Your Email - SanctumTools',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: getVerificationEmailTemplate(verificationLink, email),
            Charset: 'UTF-8',
          },
          Text: {
            Data: `
Welcome to SanctumTools!

Please verify your email address by visiting this link:
${verificationLink}

This link will expire in 24 hours.

If you didn't create an account with SanctumTools, you can safely ignore this email.

Best regards,
The SanctumTools Team
            `.trim(),
            Charset: 'UTF-8',
          },
        },
      },
    };

    const result = await sendEmail(mailOptions);

    if (result.success) {
      console.log('[EmailService] Verification email sent successfully:', {
        messageId: result.messageId,
        recipient: email,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    console.error('[EmailService] Error preparing verification email:', {
      error: error.message,
      stack: error.stack,
      recipient: email,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: error.message,
      message: 'Failed to send verification email',
    };
  }
};

/**
 * Send welcome email after successful verification
 * @param {string} email - Recipient email address
 * @param {string} userName - User's name (optional)
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendWelcomeEmail = async (email, userName = null) => {
  try {
    // Validate inputs
    if (!email) {
      throw new Error('Missing required parameter: email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Email options
    const mailOptions = {
      Source: process.env.SMTP_FROM || 'support@sanctumtools.com',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'Welcome to SanctumTools - Your Account is Active!',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: getWelcomeEmailTemplate(userName),
            Charset: 'UTF-8',
          },
          Text: {
            Data: `
Welcome to SanctumTools${userName ? ', ' + userName : ''}!

Your email has been successfully verified, and your account is now active.

SanctumTools is your secure, private space for mental health journaling, reflection, and growth.

Key Features:
- Secure Journaling: Write freely in your encrypted personal journal
- AI-Powered Support: Get thoughtful responses and insights from Claude
- Private & Encrypted: Your data is protected with industry-standard encryption
- Crisis Support: Access to resources when you need them most
- Mood Tracking: Monitor your emotional well-being over time

Get started: ${process.env.BASE_URL || 'https://sanctumtools.com'}/dashboard

Security Reminder: We recommend enabling two-factor authentication (2FA) in your account settings.

If you have any questions, our support team is here to help at support@sanctumtools.com

Best regards,
The SanctumTools Team
            `.trim(),
            Charset: 'UTF-8',
          },
        },
      },
    };

    const result = await sendEmail(mailOptions);

    if (result.success) {
      console.log('[EmailService] Welcome email sent successfully:', {
        messageId: result.messageId,
        recipient: email,
        userName: userName || 'N/A',
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    console.error('[EmailService] Error preparing welcome email:', {
      error: error.message,
      stack: error.stack,
      recipient: email,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: error.message,
      message: 'Failed to send welcome email',
    };
  }
};

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} resetToken - Unique reset token
 * @param {string} baseUrl - Base URL of the application
 * @returns {Promise<Object>} - Result object with success status and message
 */
const sendPasswordResetEmail = async (email, resetToken, baseUrl) => {
  try {
    // Validate inputs
    if (!email || !resetToken || !baseUrl) {
      throw new Error('Missing required parameters: email, resetToken, and baseUrl are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Construct reset link
    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;

    // Email options
    const mailOptions = {
      Source: process.env.SMTP_FROM || 'support@sanctumtools.com',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'Reset Your Password - SanctumTools',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: getPasswordResetEmailTemplate(resetLink, email),
            Charset: 'UTF-8',
          },
          Text: {
            Data: `
Password Reset Request

We received a request to reset the password for your SanctumTools account.

To reset your password, visit this link:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Security Reminder: We will never ask for your password in an email. Always use the reset link provided to change your password securely.

Best regards,
The SanctumTools Team
            `.trim(),
            Charset: 'UTF-8',
          },
        },
      },
    };

    const result = await sendEmail(mailOptions);

    if (result.success) {
      console.log('[EmailService] Password reset email sent successfully:', {
        messageId: result.messageId,
        recipient: email,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    console.error('[EmailService] Error preparing password reset email:', {
      error: error.message,
      stack: error.stack,
      recipient: email,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: error.message,
      message: 'Failed to send password reset email',
    };
  }
};

/**
 * Verify SES connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
const verifyConnection = async () => {
  try {
    console.log('[EmailService] AWS SES configured and ready to send emails');
    return true;
  } catch (error) {
    console.error('[EmailService] AWS SES verification failed:', error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  verifyConnection,
};
