import { NextRequest, NextResponse } from 'next/server';
import { FileUploadUtils, UPLOAD_CONFIGS, ImageProcessingUtils } from '@/lib/file-upload-utils';
import { UserProfileService } from '@/services/UserProfileService';
import { AuthService } from '@/services/AuthService';
import { SecurityAuditLogService } from '@/services/SecurityAuditLogService';
import { SecurityAction } from '@/models/SecurityAuditLog';

// Rate limiting for uploads
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_UPLOADS_PER_HOUR = 5;

function checkUploadRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userAttempts = uploadAttempts.get(identifier);

  if (!userAttempts || now > userAttempts.resetTime) {
    uploadAttempts.set(identifier, { count: 1, resetTime: now + (60 * 60 * 1000) });
    return true;
  }

  if (userAttempts.count >= MAX_UPLOADS_PER_HOUR) {
    return false;
  }

  userAttempts.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 
         request.headers.get('x-real-ip') || 
         request.headers.get('remote-addr') || 
         'unknown';
}

// POST /api/uploads/avatar - Upload avatar image
export async function POST(request: NextRequest) {
  try {
    // Get client info
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Authenticate user
    const authService = AuthService.getInstance();
    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get('session')?.value;
    
    let user;
    if (authHeader?.startsWith('Bearer ')) {
      // Token-based auth
      const token = authHeader.substring(7);
      user = await authService.getUserBySession(token);
    } else if (sessionCookie) {
      // Cookie-based auth
      user = await authService.getUserBySession(sessionCookie);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Rate limiting
    if (!checkUploadRateLimit(user.id)) {
      await SecurityAuditLogService.getInstance().logSecurityEvent(
        SecurityAction.RATE_LIMIT_EXCEEDED,
        {
          userId: user.id,
          ipAddress,
          userAgent,
          resource: 'avatar_upload',
          eventData: { action: 'avatar_upload' },
        }
      );

      return NextResponse.json(
        { error: 'Too many upload attempts. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate image
    if (!ImageProcessingUtils.isValidImage(buffer)) {
      return NextResponse.json(
        { error: 'Invalid image file' },
        { status: 400 }
      );
    }

    // Validate image dimensions
    const dimensionValidation = ImageProcessingUtils.validateImageDimensions(
      buffer,
      2048, // max width
      2048, // max height
      100,  // min width
      100   // min height
    );

    if (!dimensionValidation.isValid) {
      return NextResponse.json(
        { error: dimensionValidation.error },
        { status: 400 }
      );
    }

    // Process the file upload
    const uploadResult = await FileUploadUtils.processUploadedFile(
      buffer,
      file.name,
      file.type,
      {
        ...UPLOAD_CONFIGS.avatar,
        allowedMimeTypes: [...UPLOAD_CONFIGS.avatar.allowedMimeTypes],
        allowedExtensions: [...UPLOAD_CONFIGS.avatar.allowedExtensions]
      },
      user.id
    );

    if (!uploadResult.success) {
      await SecurityAuditLogService.getInstance().logSecurityEvent(
        SecurityAction.AVATAR_UPLOAD_FAILED,
        {
          userId: user.id,
          ipAddress,
          userAgent,
          resource: `avatar:${user.id}`,
          eventData: {
            fileName: file.name,
            fileSize: file.size,
            errors: uploadResult.errors,
          },
        }
      );

      return NextResponse.json(
        { 
          error: 'File upload failed',
          details: uploadResult.errors 
        },
        { status: 400 }
      );
    }

    // Update user profile with new avatar URL
    const profileService = UserProfileService.getInstance();
    const updateResult = await profileService.updateAvatar(
      user.id,
      uploadResult.publicUrl!,
      { ipAddress, userAgent }
    );

    if (!updateResult.success) {
      // Clean up uploaded file on profile update failure
      if (uploadResult.filePath) {
        await FileUploadUtils.deleteFile(uploadResult.filePath);
      }

      return NextResponse.json(
        { error: 'Failed to update profile with new avatar' },
        { status: 500 }
      );
    }

    // Log successful upload
    await SecurityAuditLogService.getInstance().logUserManagementEvent(
      SecurityAction.AVATAR_UPDATE,
      {
        userId: user.id,
        ipAddress,
        userAgent,
        resource: `avatar:${user.id}`,
        eventData: {
          fileName: uploadResult.fileName,
          fileSize: file.size,
          dimensions: dimensionValidation.dimensions,
          publicUrl: uploadResult.publicUrl,
        },
      }
    );

    return NextResponse.json({
      success: true,
      avatarUrl: updateResult.avatarUrl,
      fileName: uploadResult.fileName,
      message: 'Avatar uploaded successfully',
    });

  } catch (error) {
    console.error('Avatar upload error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/uploads/avatar - Delete current avatar
export async function DELETE(request: NextRequest) {
  try {
    // Get client info
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Authenticate user
    const authService = AuthService.getInstance();
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await authService.getUserBySession(sessionCookie);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Delete avatar from profile
    const profileService = UserProfileService.getInstance();
    const deleteResult = await profileService.deleteAvatar(
      user.id,
      { ipAddress, userAgent }
    );

    if (!deleteResult.success) {
      return NextResponse.json(
        { 
          error: 'Failed to delete avatar',
          details: deleteResult.errors 
        },
        { status: 500 }
      );
    }

    // Log avatar deletion
    await SecurityAuditLogService.getInstance().logUserManagementEvent(
      SecurityAction.AVATAR_DELETE,
      {
        userId: user.id,
        ipAddress,
        userAgent,
        resource: `avatar:${user.id}`,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Avatar deleted successfully',
    });

  } catch (error) {
    console.error('Avatar deletion error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/uploads/avatar/[filename] - Serve avatar files
// This would be handled by a separate dynamic route: /api/uploads/avatar/[filename]/route.ts