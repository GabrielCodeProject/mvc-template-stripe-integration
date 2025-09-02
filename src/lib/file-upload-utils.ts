import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// File upload configuration
export interface FileUploadConfig {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  uploadDir: string;
  publicPath: string;
}

// Default configuration for different file types
export const UPLOAD_CONFIGS = {
  avatar: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    uploadDir: 'uploads/avatars',
    publicPath: '/api/uploads/avatars'
  },
  documents: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
    uploadDir: 'uploads/documents',
    publicPath: '/api/uploads/documents'
  }
} as const;

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedFileName?: string;
}

export interface FileProcessingResult {
  success: boolean;
  fileName?: string;
  filePath?: string;
  publicUrl?: string;
  errors?: string[];
}

export class FileUploadUtils {
  /**
   * Validate file based on configuration
   */
  static validateFile(
    file: { name: string; size: number; type: string },
    config: FileUploadConfig
  ): FileValidationResult {
    const errors: string[] = [];

    // Size validation
    if (file.size > config.maxSizeBytes) {
      errors.push(`File size must be less than ${config.maxSizeBytes / (1024 * 1024)}MB`);
    }

    // MIME type validation
    if (!config.allowedMimeTypes.includes(file.type)) {
      errors.push(`File type not supported. Allowed types: ${config.allowedMimeTypes.join(', ')}`);
    }

    // Extension validation
    const extension = path.extname(file.name).toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
      errors.push(`File extension not supported. Allowed extensions: ${config.allowedExtensions.join(', ')}`);
    }

    // Sanitize filename
    const sanitizedFileName = this.sanitizeFileName(file.name);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedFileName,
    };
  }

  /**
   * Sanitize filename to prevent path traversal and other security issues
   */
  static sanitizeFileName(fileName: string): string {
    // Remove path separators and normalize
    const baseName = path.basename(fileName);
    
    // Replace unsafe characters
    const sanitized = baseName
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe chars with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .toLowerCase();

    // Ensure we have a filename
    if (!sanitized || sanitized === '.') {
      return `file_${Date.now()}`;
    }

    return sanitized;
  }

  /**
   * Generate unique filename to prevent collisions
   */
  static generateUniqueFileName(originalName: string, userId?: string): string {
    const sanitized = this.sanitizeFileName(originalName);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(sanitized);
    const nameWithoutExt = path.basename(sanitized, extension);
    
    const prefix = userId ? `${userId}_` : '';
    return `${prefix}${nameWithoutExt}_${timestamp}_${randomId}${extension}`;
  }

  /**
   * Ensure upload directory exists
   */
  static async ensureUploadDir(uploadDir: string): Promise<void> {
    try {
      await fs.access(uploadDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(uploadDir, { recursive: true });
    }
  }

  /**
   * Get file content type from buffer (for additional security)
   */
  static async getFileTypeFromBuffer(buffer: Buffer): Promise<string | null> {
    // Check magic bytes for common file types
    const magicBytes = buffer.subarray(0, 12);

    // JPEG
    if (magicBytes[0] === 0xFF && magicBytes[1] === 0xD8) {
      return 'image/jpeg';
    }

    // PNG
    if (magicBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return 'image/png';
    }

    // WebP
    if (magicBytes.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) && 
        magicBytes.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'))) {
      return 'image/webp';
    }

    // GIF
    if (magicBytes.subarray(0, 6).equals(Buffer.from('GIF87a', 'ascii')) ||
        magicBytes.subarray(0, 6).equals(Buffer.from('GIF89a', 'ascii'))) {
      return 'image/gif';
    }

    // PDF
    if (magicBytes.subarray(0, 4).equals(Buffer.from('%PDF', 'ascii'))) {
      return 'application/pdf';
    }

    return null;
  }

  /**
   * Validate file content matches claimed type
   */
  static async validateFileContent(
    buffer: Buffer,
    claimedType: string
  ): Promise<{ isValid: boolean; detectedType?: string; error?: string }> {
    const detectedType = await this.getFileTypeFromBuffer(buffer);

    if (!detectedType) {
      return {
        isValid: false,
        error: 'Unable to detect file type from content'
      };
    }

    if (detectedType !== claimedType) {
      return {
        isValid: false,
        detectedType,
        error: `File content does not match claimed type. Expected: ${claimedType}, Detected: ${detectedType}`
      };
    }

    return { isValid: true, detectedType };
  }

  /**
   * Process uploaded file with security checks
   */
  static async processUploadedFile(
    buffer: Buffer,
    fileName: string,
    claimedType: string,
    config: FileUploadConfig,
    userId?: string
  ): Promise<FileProcessingResult> {
    try {
      // Validate file metadata
      const validation = this.validateFile(
        { name: fileName, size: buffer.length, type: claimedType },
        config
      );

      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Validate file content
      const contentValidation = await this.validateFileContent(buffer, claimedType);
      if (!contentValidation.isValid) {
        return {
          success: false,
          errors: [contentValidation.error!],
        };
      }

      // Generate unique filename
      const uniqueFileName = this.generateUniqueFileName(fileName, userId);

      // Ensure upload directory exists
      await this.ensureUploadDir(config.uploadDir);

      // Write file to disk
      const filePath = path.join(config.uploadDir, uniqueFileName);
      await fs.writeFile(filePath, buffer);

      // Generate public URL
      const publicUrl = `${config.publicPath}/${uniqueFileName}`;

      return {
        success: true,
        fileName: uniqueFileName,
        filePath,
        publicUrl,
      };
    } catch (error) {
      console.error('File processing error:', error);
      return {
        success: false,
        errors: ['Failed to process uploaded file'],
      };
    }
  }

  /**
   * Delete file from filesystem
   */
  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  /**
   * Clean up old files (for maintenance)
   */
  static async cleanupOldFiles(
    directory: string,
    olderThanDays: number = 30
  ): Promise<number> {
    try {
      const files = await fs.readdir(directory);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          const success = await this.deleteFile(filePath);
          if (success) {
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get file info without reading content
   */
  static async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    mimeType?: string;
    lastModified?: Date;
  }> {
    try {
      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath).toLowerCase();
      
      // Simple MIME type mapping
      const mimeTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
      };

      return {
        exists: true,
        size: stats.size,
        mimeType: mimeTypeMap[extension],
        lastModified: stats.mtime,
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Generate secure upload token for client-side uploads
   */
  static generateUploadToken(
    userId: string,
    fileType: string,
    expiryMinutes: number = 30
  ): string {
    const payload = {
      userId,
      fileType,
      exp: Math.floor(Date.now() / 1000) + (expiryMinutes * 60),
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    const secret = process.env.UPLOAD_TOKEN_SECRET || 'default-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return Buffer.from(JSON.stringify({ ...payload, sig: signature })).toString('base64');
  }

  /**
   * Validate upload token
   */
  static validateUploadToken(token: string): {
    isValid: boolean;
    userId?: string;
    fileType?: string;
    error?: string;
  } {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check expiry
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return { isValid: false, error: 'Token expired' };
      }

      // Verify signature
      const { sig, ...data } = payload;
      const secret = process.env.UPLOAD_TOKEN_SECRET || 'default-secret';
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(data))
        .digest('hex');

      if (sig !== expectedSig) {
        return { isValid: false, error: 'Invalid token signature' };
      }

      return {
        isValid: true,
        userId: payload.userId,
        fileType: payload.fileType,
      };
    } catch {
      return { isValid: false, error: 'Invalid token format' };
    }
  }
}

// Image processing utilities (basic resizing and optimization)
export class ImageProcessingUtils {
  /**
   * Check if buffer is a valid image
   */
  static isValidImage(buffer: Buffer): boolean {
    // Check for common image magic bytes
    const magicBytes = buffer.subarray(0, 12);
    
    // JPEG, PNG, WebP, GIF
    return (
      (magicBytes[0] === 0xFF && magicBytes[1] === 0xD8) || // JPEG
      magicBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) || // PNG
      (magicBytes.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) && 
       magicBytes.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'))) || // WebP
      magicBytes.subarray(0, 6).equals(Buffer.from('GIF87a', 'ascii')) || // GIF87a
      magicBytes.subarray(0, 6).equals(Buffer.from('GIF89a', 'ascii'))    // GIF89a
    );
  }

  /**
   * Get image dimensions from buffer (basic implementation)
   * Note: For production, consider using a proper image processing library like sharp
   */
  static getImageDimensions(buffer: Buffer): { width?: number; height?: number } {
    // This is a simplified implementation
    // For production use, integrate with sharp or similar library
    
    if (!this.isValidImage(buffer)) {
      return {};
    }

    // Basic PNG dimension reading
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // For other formats, return empty object
    // In production, implement proper dimension reading for all formats
    return {};
  }

  /**
   * Validate image dimensions
   */
  static validateImageDimensions(
    buffer: Buffer,
    maxWidth: number = 2048,
    maxHeight: number = 2048,
    minWidth: number = 100,
    minHeight: number = 100
  ): { isValid: boolean; error?: string; dimensions?: { width?: number; height?: number } } {
    const dimensions = this.getImageDimensions(buffer);

    if (!dimensions.width || !dimensions.height) {
      return {
        isValid: true, // Allow images where we can't determine dimensions
        dimensions,
      };
    }

    if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
      return {
        isValid: false,
        error: `Image dimensions too large. Maximum: ${maxWidth}x${maxHeight}`,
        dimensions,
      };
    }

    if (dimensions.width < minWidth || dimensions.height < minHeight) {
      return {
        isValid: false,
        error: `Image dimensions too small. Minimum: ${minWidth}x${minHeight}`,
        dimensions,
      };
    }

    return { isValid: true, dimensions };
  }
}

export default FileUploadUtils;