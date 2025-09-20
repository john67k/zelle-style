const { sgMail, emailConfig } = require('../config/email');
const { generateVerificationCode } = require('../utils/codeGenerator');

class EmailService {
  constructor() {
    this.verificationCodes = new Map(); // In production, use Redis or database
    this.rateLimits = new Map(); // Track email sending rates
    this.failedEmails = new Map(); // Track failed emails for retry
    this.emailLogs = []; // Store email sending logs
  }

  // Enhanced email sending with retry logic and logging
  async sendEmailWithRetry(emailData, type = 'unknown', maxRetries = 3) {
    const emailId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const logEntry = {
      id: emailId,
      to: emailData.to,
      type,
      timestamp: new Date().toISOString(),
      attempts: 0,
      success: false,
      errors: []
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logEntry.attempts = attempt;
        
        // Calculate delay for exponential backoff (0, 2s, 8s for attempts 1, 2, 3)
        if (attempt > 1) {
          const delay = Math.pow(2, attempt - 2) * 2000; // 2s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        await sgMail.send(emailData);
        
        logEntry.success = true;
        logEntry.completedAt = new Date().toISOString();
        this.emailLogs.push(logEntry);
        
        console.log(`✅ Email sent successfully (${type}):`, emailData.to, `(attempt ${attempt})`);
        
        // Remove from failed emails if it was there
        this.failedEmails.delete(emailId);
        
        return { success: true, emailId, attempts: attempt };
        
      } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        logEntry.errors.push({
          attempt,
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        
        console.error(`❌ Email send attempt ${attempt} failed (${type}):`, emailData.to, errorMsg);
        
        if (attempt === maxRetries) {
          // Final failure - log and store for manual retry
          logEntry.success = false;
          logEntry.failedAt = new Date().toISOString();
          this.emailLogs.push(logEntry);
          this.failedEmails.set(emailId, { ...logEntry, emailData });
          
          console.error(`🚨 Email permanently failed after ${maxRetries} attempts (${type}):`, emailData.to);
          throw new Error(`Failed to send email after ${maxRetries} attempts: ${errorMsg}`);
        }
      }
    }
  }

  // Get email logs for admin dashboard
  getEmailLogs(limit = 100) {
    return this.emailLogs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // Get failed emails for admin dashboard
  getFailedEmails() {
    return Array.from(this.failedEmails.values());
  }

  // Manual retry for admin dashboard
  async retryFailedEmail(emailId) {
    const failedEmail = this.failedEmails.get(emailId);
    if (!failedEmail) {
      throw new Error('Failed email not found');
    }

    try {
      const result = await this.sendEmailWithRetry(failedEmail.emailData, failedEmail.type);
      return result;
    } catch (error) {
      throw new Error(`Retry failed: ${error.message}`);
    }
  }

  // Rate limiting: max 3 verification emails per hour per email
  checkRateLimit(email, type = 'verification') {
    const key = `${email}:${type}`;
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }
    
    const attempts = this.rateLimits.get(key);
    // Remove attempts older than 1 hour
    const recentAttempts = attempts.filter(timestamp => timestamp > hourAgo);
    this.rateLimits.set(key, recentAttempts);
    
    if (recentAttempts.length >= 3) {
      throw new Error('Rate limit exceeded. Please wait before requesting another code.');
    }
    
    // Add current attempt
    recentAttempts.push(now);
    this.rateLimits.set(key, recentAttempts);
  }

  async sendVerificationCode(email, name) {
    try {
      // Check rate limit
      this.checkRateLimit(email, 'verification');
      
      // Generate 6-digit code
      const code = generateVerificationCode();
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
      
      // Store code with expiration
      this.verificationCodes.set(email, {
        code,
        expiresAt,
        attempts: 0
      });
      
      const msg = {
        to: email,
        from: emailConfig.from,
        subject: 'Verify Your Zelle Account',
        html: this.getVerificationTemplate(name, code),
        text: `Hi ${name},\n\nYour Zelle verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nThe Zelle Team`
      };
      
      const result = await this.sendEmailWithRetry(msg, 'verification');
      console.log(`Verification code sent to ${email}`);
      
      return { success: true, expiresAt, emailId: result.emailId };
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }

  async sendTransactionReceipt(email, transactionData) {
    try {
      const {
        recipientName,
        recipientEmail,
        amount,
        transactionId,
        timestamp,
        note,
        type, // 'sent' or 'received'
        senderName
      } = transactionData;
      
      const msg = {
        to: email,
        from: emailConfig.from,
        subject: `Zelle ${type === 'sent' ? 'Payment Sent' : 'Payment Received'} - $${amount}`,
        html: this.getReceiptTemplate(transactionData),
        text: this.getReceiptTextTemplate(transactionData)
      };
      
      const result = await this.sendEmailWithRetry(msg, 'receipt');
      console.log(`Receipt sent to ${email} for transaction ${transactionId}`);
      
      return { success: true, emailId: result.emailId };
    } catch (error) {
      console.error('Error sending receipt email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email, name) {
    try {
      const msg = {
        to: email,
        from: emailConfig.from,
        subject: 'Welcome to Zelle!',
        html: this.getWelcomeTemplate(name),
        text: `Hi ${name},\n\nWelcome to Zelle! Your account has been successfully verified and you're ready to start sending and receiving money instantly.\n\nWith Zelle you can:\n- Send money instantly\n- Bank-level security\n- Easy to use\n- No fees\n\nGet started at your convenience.\n\nBest regards,\nThe Zelle Team`
      };
      
      const result = await this.sendEmailWithRetry(msg, 'welcome');
      console.log(`Welcome email sent to ${email}`);
      
      return { success: true, emailId: result.emailId };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  verifyCode(email, inputCode) {
    const stored = this.verificationCodes.get(email);
    
    if (!stored) {
      throw new Error('No verification code found. Please request a new one.');
    }
    
    if (Date.now() > stored.expiresAt) {
      this.verificationCodes.delete(email);
      throw new Error('Verification code has expired. Please request a new one.');
    }
    
    if (stored.attempts >= 3) {
      this.verificationCodes.delete(email);
      throw new Error('Too many failed attempts. Please request a new code.');
    }
    
    if (stored.code !== inputCode) {
      stored.attempts++;
      throw new Error('Invalid verification code.');
    }
    
    // Code is valid, remove it
    this.verificationCodes.delete(email);
    return true;
  }

  getVerificationTemplate(name, code) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Zelle Account</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f7fb; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #5c2d91; padding: 30px; text-align: center; }
            .logo { color: white; font-size: 24px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .code-box { background-color: #f8f9fa; border: 2px dashed #5c2d91; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
            .code { font-size: 36px; font-weight: bold; color: #5c2d91; letter-spacing: 8px; margin: 10px 0; }
            .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 14px; }
            .button { display: inline-block; background-color: #5c2d91; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🏦 Zelle</div>
            </div>
            <div class="content">
                <h1 style="color: #5c2d91; margin-bottom: 20px;">Verify Your Account</h1>
                <p>Hi ${name},</p>
                <p>Thank you for signing up with Zelle! To complete your account setup, please enter the verification code below:</p>
                
                <div class="code-box">
                    <p style="margin: 0; color: #6c757d;">Your verification code is:</p>
                    <div class="code">${code}</div>
                    <p style="margin: 0; color: #6c757d; font-size: 14px;">This code expires in 10 minutes</p>
                </div>
                
                <p>If you didn't request this verification code, please ignore this email.</p>
                
                <p>For your security:</p>
                <ul>
                    <li>Never share this code with anyone</li>
                    <li>Zelle will never ask for this code over the phone</li>
                    <li>This code expires in 10 minutes</li>
                </ul>
            </div>
            <div class="footer">
                <p>This email was sent by Zelle. If you have questions, contact our support team.</p>
                <p>&copy; 2025 Zelle. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  getReceiptTemplate(data) {
    const { recipientName, recipientEmail, amount, transactionId, timestamp, note, type, senderName } = data;
    const isReceived = type === 'received';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Zelle Transaction Receipt</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f7fb; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #5c2d91; padding: 30px; text-align: center; }
            .logo { color: white; font-size: 24px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .receipt-box { background-color: #f8f9fa; border-radius: 12px; padding: 30px; margin: 30px 0; }
            .amount { font-size: 32px; font-weight: bold; color: ${isReceived ? '#28a745' : '#dc3545'}; text-align: center; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
            .detail-label { font-weight: 600; color: #6c757d; }
            .detail-value { color: #212529; }
            .status { background-color: #d4edda; color: #155724; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; }
            .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🏦 Zelle</div>
            </div>
            <div class="content">
                <h1 style="color: #5c2d91; margin-bottom: 20px;">
                    ${isReceived ? '💰 Money Received' : '📤 Payment Sent'}
                </h1>
                
                <div class="receipt-box">
                    <div class="amount">${isReceived ? '+' : '-'}$${amount}</div>
                    
                    <div class="detail-row">
                        <span class="detail-label">${isReceived ? 'From:' : 'To:'}</span>
                        <span class="detail-value">${isReceived ? senderName : recipientName}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${isReceived ? data.senderEmail : recipientEmail}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Transaction ID:</span>
                        <span class="detail-value">${transactionId}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Date & Time:</span>
                        <span class="detail-value">${new Date(timestamp).toLocaleString()}</span>
                    </div>
                    
                    ${note ? `
                    <div class="detail-row">
                        <span class="detail-label">Note:</span>
                        <span class="detail-value">${note}</span>
                    </div>
                    ` : ''}
                    
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value"><span class="status">✅ Completed</span></span>
                    </div>
                </div>
                
                <p style="color: #6c757d; font-size: 14px;">
                    This transaction was processed instantly through Zelle's secure network. 
                    Keep this receipt for your records.
                </p>
                
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <strong>🔒 Security Reminder:</strong> Never share your Zelle login credentials or verification codes with anyone.
                </div>
            </div>
            <div class="footer">
                <p>Questions about this transaction? Contact Zelle Support.</p>
                <p>&copy; 2025 Zelle. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  getWelcomeTemplate(name) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Zelle!</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f7fb; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background-color: #5c2d91; padding: 30px; text-align: center; }
            .logo { color: white; font-size: 24px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .feature { display: flex; align-items: center; margin: 20px 0; }
            .feature-icon { font-size: 24px; margin-right: 15px; }
            .button { display: inline-block; background-color: #5c2d91; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🏦 Zelle</div>
            </div>
            <div class="content">
                <h1 style="color: #5c2d91; margin-bottom: 20px;">Welcome to Zelle, ${name}! 🎉</h1>
                
                <p>Your account has been successfully verified and you're ready to start sending and receiving money instantly!</p>
                
                <h3 style="color: #5c2d91;">What you can do with Zelle:</h3>
                
                <div class="feature">
                    <span class="feature-icon">⚡</span>
                    <div>
                        <strong>Send money instantly</strong><br>
                        <span style="color: #6c757d;">Money arrives in minutes when both parties are enrolled</span>
                    </div>
                </div>
                
                <div class="feature">
                    <span class="feature-icon">🔒</span>
                    <div>
                        <strong>Bank-level security</strong><br>
                        <span style="color: #6c757d;">Your money is protected with industry-leading security</span>
                    </div>
                </div>
                
                <div class="feature">
                    <span class="feature-icon">📱</span>
                    <div>
                        <strong>Easy to use</strong><br>
                        <span style="color: #6c757d;">Send money with just an email address or phone number</span>
                    </div>
                </div>
                
                <div class="feature">
                    <span class="feature-icon">💰</span>
                    <div>
                        <strong>No fees</strong><br>
                        <span style="color: #6c757d;">When you use Zelle with your bank, there are typically no fees</span>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="#" class="button">Start Using Zelle</a>
                </div>
                
                <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <strong>💡 Pro Tip:</strong> Add your most-used contacts to make sending money even faster!
                </div>
            </div>
            <div class="footer">
                <p>Need help? Visit our Help Center or contact support.</p>
                <p>&copy; 2025 Zelle. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Plain text template for Gmail compatibility
  getReceiptTextTemplate(data) {
    const {
      recipientName,
      recipientEmail,
      amount,
      transactionId,
      timestamp,
      note,
      type,
      senderName
    } = data;

    const formattedDate = new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    if (type === 'sent') {
      return `
PAYMENT SENT CONFIRMATION

Hi ${senderName},

Your payment has been sent successfully!

TRANSACTION DETAILS:
Transaction ID: ${transactionId}
Recipient: ${recipientName} (${recipientEmail})
Amount: $${amount.toFixed(2)}
Date: ${formattedDate}
${note ? `Note: ${note}` : ''}

Your money was sent instantly and securely through Zelle.

WHAT'S NEXT?
- ${recipientName} will receive a notification about the payment
- Funds are typically available within minutes
- You can view this transaction in your Zelle activity

Need help? Visit our Help Center or contact support.

© 2025 Zelle. All rights reserved.
      `.trim();
    } else {
      return `
PAYMENT RECEIVED NOTIFICATION

Hi ${recipientName},

You've received a payment!

TRANSACTION DETAILS:
Transaction ID: ${transactionId}
From: ${senderName} (${data.senderEmail || 'N/A'})
Amount: $${amount.toFixed(2)}
Date: ${formattedDate}
${note ? `Note: ${note}` : ''}

The money has been securely transferred to your account through Zelle.

WHAT'S NEXT?
- Check your bank account - the funds are typically available within minutes
- You can view this transaction in your Zelle activity
- Consider sending a thank you message to ${senderName}

Need help? Visit our Help Center or contact support.

© 2025 Zelle. All rights reserved.
      `.trim();
    }
  }
}

module.exports = new EmailService();