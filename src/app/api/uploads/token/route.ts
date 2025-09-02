import { NextRequest, NextResponse } from 'next/server';
import { FileUploadUtils } from '@/lib/file-upload-utils';
import { AuthService } from '@/services/AuthService';
import { SecurityAuditLogService } from '@/services/SecurityAuditLogService';
import { SecurityAction } from '@/models/SecurityAuditLog';
import { z } from 'zod';

// Schema for token request
const tokenRequestSchema = z.object({
  fileType: z.enum(['avatar', 'document']),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
});

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 
         request.headers.get('x-real-ip') || 
         request.headers.get('remote-addr') || 
         'unknown';
}

// POST /api/uploads/token - Generate upload token
export async function POST(request: NextRequest) {
  try {
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Authenticate user
    const authService = AuthService.getInstance();
    const sessionCookie = request.cookies.get('session')?.value;
    const authHeader = request.headers.get('authorization');
    
    let user;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = await authService.getUserBySession(token);
    } else if (sessionCookie) {
      user = await authService.getUserBySession(sessionCookie);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = tokenRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const { fileType, fileName, fileSize, mimeType } = validationResult.data;

    // Additional file validation based on type
    const allowedTypes = {
      avatar: {
        maxSize: 5 * 1024 * 1024, // 5MB
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      },
      document: {
        maxSize: 10 * 1024 * 1024, // 10MB
        mimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ],
      },
    };

    const typeConfig = allowedTypes[fileType];
    
    if (fileSize > typeConfig.maxSize) {
      return NextResponse.json(
        { 
          error: `File size too large. Maximum size for ${fileType}: ${typeConfig.maxSize / (1024 * 1024)}MB` 
        },
        { status: 400 }
      );
    }

    if (!typeConfig.mimeTypes.includes(mimeType)) {
      return NextResponse.json(
        { 
          error: `File type not allowed. Allowed types for ${fileType}: ${typeConfig.mimeTypes.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Generate upload token
    const uploadToken = FileUploadUtils.generateUploadToken(
      user.id,
      fileType,
      30 // expires in 30 minutes
    );

    // Log token generation
    await SecurityAuditLogService.getInstance().logDataAccessEvent(
      SecurityAction.UPLOAD_TOKEN_GENERATED,
      {
        userId: user.id,
        ipAddress,
        userAgent,
        resource: `upload_token:${fileType}`,
        eventData: {
          fileType,
          fileName,
          fileSize,
          mimeType,
        },
      }
    );

    return NextResponse.json({
      success: true,
      uploadToken,
      expiresIn: 1800, // 30 minutes in seconds
      uploadUrl: `/api/uploads/${fileType}`,
      maxFileSize: typeConfig.maxSize,
      allowedMimeTypes: typeConfig.mimeTypes,
    });

  } catch (error) {
    console.error('Upload token generation error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/uploads/token/validate - Validate upload token (for debugging)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token parameter required' },
        { status: 400 }
      );
    }

    const validation = FileUploadUtils.validateUploadToken(token);

    if (!validation.isValid) {
      return NextResponse.json(
        { 
          valid: false,
          error: validation.error 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      userId: validation.userId,
      fileType: validation.fileType,
    });

  } catch (error) {
    console.error('Token validation error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}