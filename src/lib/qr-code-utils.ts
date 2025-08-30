import QRCode from 'qrcode';

/**
 * QR Code generation utilities for 2FA setup
 */
export class QRCodeUtils {
  /**
   * Generate QR code as data URL for TOTP secret
   * @param secret - TOTP secret in base32 format
   * @param email - User's email address
   * @param issuer - App name/issuer
   * @returns Promise<string> - Data URL of QR code image
   */
  public static async generateTOTPQRCode(
    secret: string,
    email: string,
    issuer: string = process.env.APP_NAME || 'MyApp'
  ): Promise<string> {
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      
      return qrCodeDataUrl;
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code as SVG string for TOTP secret
   * @param secret - TOTP secret in base32 format
   * @param email - User's email address
   * @param issuer - App name/issuer
   * @returns Promise<string> - SVG string of QR code
   */
  public static async generateTOTPQRCodeSVG(
    secret: string,
    email: string,
    issuer: string = process.env.APP_NAME || 'MyApp'
  ): Promise<string> {
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    
    try {
      const qrCodeSVG = await QRCode.toString(otpauthUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      
      return qrCodeSVG;
    } catch (error) {
      console.error('QR code SVG generation failed:', error);
      throw new Error('Failed to generate QR code SVG');
    }
  }

  /**
   * Validate TOTP secret format
   * @param secret - Secret to validate
   * @returns boolean - True if valid base32 secret
   */
  public static isValidTOTPSecret(secret: string): boolean {
    // Base32 characters: A-Z, 2-7, padding with =
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(secret) && secret.length >= 16;
  }

  /**
   * Generate manual entry key from secret (formatted for user display)
   * @param secret - TOTP secret in base32 format
   * @returns string - Formatted secret for manual entry
   */
  public static formatSecretForManualEntry(secret: string): string {
    // Insert spaces every 4 characters for readability
    return secret.replace(/(.{4})/g, '$1 ').trim();
  }
}