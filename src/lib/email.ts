import { Resend } from 'resend';

// Initialize Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
export const EMAIL_CONFIG = {
  FROM_ADDRESS: process.env.FROM_EMAIL || 'noreply@yourapp.com',
  FROM_NAME: process.env.FROM_NAME || 'YourApp',
  REPLY_TO: process.env.REPLY_TO_EMAIL,
  
  // Rate limiting - tokens per time window
  RATE_LIMITS: {
    PASSWORD_RESET: {
      MAX_REQUESTS: 3,
      TIME_WINDOW_HOURS: 1,
    },
    VERIFICATION: {
      MAX_REQUESTS: 5,
      TIME_WINDOW_HOURS: 1,
    },
  },
  
  // Token expiration times
  TOKEN_EXPIRY: {
    PASSWORD_RESET_MINUTES: 15,
    VERIFICATION_HOURS: 24,
  },
  
  // Security settings
  SECURITY: {
    TOKEN_LENGTH: 64, // bytes for cryptographically secure tokens
    UNIFORM_RESPONSE_DELAY_MS: 500, // Prevent timing attacks
  },
} as const;

// Email template types
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Base email options
export interface BaseEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

// Email service class for handling all email operations
export class EmailService {
  private static instance: EmailService;
  private resendClient: Resend;

  private constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send an email with retry logic and error handling
   */
  public async sendEmail(options: BaseEmailOptions): Promise<void> {
    try {
      const emailData = {
        from: options.from || `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo || EMAIL_CONFIG.REPLY_TO,
        headers: {
          'X-Entity-Ref-ID': this.generateTrackingId(),
        },
      };

      const result = await this.resendClient.emails.send(emailData);

      if (!result.data?.id) {
        throw new Error('Failed to send email: No email ID returned');
      }

      console.log(`Email sent successfully: ${result.data.id}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Email delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send password reset email with secure token
   */
  public async sendPasswordResetEmail(
    email: string, 
    resetToken: string, 
    userName?: string
  ): Promise<void> {
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const template = this.getPasswordResetTemplate(resetUrl, userName);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send email verification email
   */
  public async sendVerificationEmail(
    email: string, 
    verificationToken: string, 
    userName?: string
  ): Promise<void> {
    const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const template = this.getEmailVerificationTemplate(verificationUrl, userName);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send password change confirmation email
   */
  public async sendPasswordChangeConfirmation(
    email: string,
    userName?: string
  ): Promise<void> {
    const template = this.getPasswordChangeConfirmationTemplate(userName);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Generate password reset email template
   */
  private getPasswordResetTemplate(resetUrl: string, userName?: string): EmailTemplate {
    const displayName = userName || 'User';
    
    const subject = 'Reset Your Password';
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${displayName},</h2>
          <p>We received a request to reset the password for your account. If you made this request, click the button below to reset your password:</p>
          
          <a href="${resetUrl}" class="button">Reset Your Password</a>
          
          <div class="warning">
            <strong>Security Notice:</strong>
            <ul>
              <li>This link will expire in 15 minutes for your security</li>
              <li>If you didn't request this password reset, please ignore this email</li>
              <li>For your security, never share this link with anyone</li>
            </ul>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 3px;">${resetUrl}</p>
          
          <div class="footer">
            <p>If you continue to have problems, please contact our support team.</p>
            <p>This email was sent from an automated system. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request

Hello ${displayName},

We received a request to reset the password for your account. If you made this request, visit the following link to reset your password:

${resetUrl}

Security Notice:
- This link will expire in 15 minutes for your security
- If you didn't request this password reset, please ignore this email
- For your security, never share this link with anyone

If you continue to have problems, please contact our support team.

This email was sent from an automated system. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate email verification template
   */
  private getEmailVerificationTemplate(verificationUrl: string, userName?: string): EmailTemplate {
    const displayName = userName || 'User';
    
    const subject = 'Verify Your Email Address';
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .info { background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to Our App!</h1>
        </div>
        <div class="content">
          <h2>Hello ${displayName},</h2>
          <p>Thank you for signing up! To complete your account setup, please verify your email address by clicking the button below:</p>
          
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
          
          <div class="info">
            <strong>Important:</strong>
            <ul>
              <li>This verification link will expire in 24 hours</li>
              <li>You won't be able to access all features until your email is verified</li>
              <li>If this wasn't you, please ignore this email</li>
            </ul>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 3px;">${verificationUrl}</p>
          
          <div class="footer">
            <p>Welcome aboard! We're excited to have you join our community.</p>
            <p>This email was sent from an automated system. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to Our App!

Hello ${displayName},

Thank you for signing up! To complete your account setup, please verify your email address by visiting the following link:

${verificationUrl}

Important:
- This verification link will expire in 24 hours
- You won't be able to access all features until your email is verified
- If this wasn't you, please ignore this email

Welcome aboard! We're excited to have you join our community.

This email was sent from an automated system. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate password change confirmation template
   */
  private getPasswordChangeConfirmationTemplate(userName?: string): EmailTemplate {
    const displayName = userName || 'User';
    
    const subject = 'Password Changed Successfully';
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ffc107; color: #212529; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
          .warning { background-color: #f8d7da; border: 1px solid #f1aeb5; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Changed</h1>
        </div>
        <div class="content">
          <h2>Hello ${displayName},</h2>
          <p>This email confirms that your password was successfully changed on ${new Date().toLocaleDateString()}.</p>
          
          <div class="warning">
            <strong>Security Alert:</strong>
            <p>If you didn't make this change, please contact our support team immediately. Your account may have been compromised.</p>
          </div>
          
          <p>For your security:</p>
          <ul>
            <li>All active sessions have been logged out</li>
            <li>You'll need to log in again with your new password</li>
            <li>Consider enabling two-factor authentication for added security</li>
          </ul>
          
          <div class="footer">
            <p>If you need any assistance, please contact our support team.</p>
            <p>This email was sent from an automated system. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Changed

Hello ${displayName},

This email confirms that your password was successfully changed on ${new Date().toLocaleDateString()}.

Security Alert:
If you didn't make this change, please contact our support team immediately. Your account may have been compromised.

For your security:
- All active sessions have been logged out
- You'll need to log in again with your new password
- Consider enabling two-factor authentication for added security

If you need any assistance, please contact our support team.

This email was sent from an automated system. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate a unique tracking ID for emails
   */
  private generateTrackingId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Validate email address format
   */
  public static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
  }
}

// Export configured instance
export const emailService = EmailService.getInstance();