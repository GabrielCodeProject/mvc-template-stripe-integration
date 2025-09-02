import { NextRequest, NextResponse } from 'next/server';
import { FileUploadUtils, UPLOAD_CONFIGS } from '@/lib/file-upload-utils';
import { SecurityAuditLogService } from '@/services/SecurityAuditLogService';
import { SecurityAction } from '@/models/SecurityAuditLog';
import path from 'path';
import fs from 'fs/promises';

interface RouteParams {
  params: Promise<{
    filename: string;
  }>;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 
         request.headers.get('x-real-ip') || 
         request.headers.get('remote-addr') || 
         'unknown';
}

// GET /api/uploads/avatar/[filename] - Serve avatar files
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { filename } = await params;
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      await SecurityAuditLogService.getInstance().logSecurityEvent(
        SecurityAction.SUSPICIOUS_ACTIVITY,
        {
          ipAddress,
          userAgent,
          eventData: {
            reason: 'Invalid filename in avatar request',
            filename,
          },
        }
      );

      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Construct file path
    const filePath = path.join(process.cwd(), UPLOAD_CONFIGS.avatar.uploadDir, filename);

    // Check if file exists and get info
    const fileInfo = await FileUploadUtils.getFileInfo(filePath);
    if (!fileInfo.exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Determine content type
    const extension = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };

    const contentType = contentTypeMap[extension] || 'application/octet-stream';

    // Set cache headers for better performance
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
      'ETag': `"${filename}-${fileInfo.lastModified?.getTime()}"`,
    });

    // Handle conditional requests
    const ifNoneMatch = request.headers.get('if-none-match');
    const etag = headers.get('ETag');
    
    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    // Log file access (optionally, for monitoring)
    // Uncomment if you want to log every file access
    /*
    await SecurityAuditLogService.getInstance().logDataAccessEvent(
      SecurityAction.FILE_ACCESS,
      {
        ipAddress,
        userAgent,
        resource: `avatar:${filename}`,
        eventData: {
          fileSize: fileBuffer.length,
          contentType,
        },
      }
    );
    */

    return new NextResponse(new Uint8Array(fileBuffer), { headers });

  } catch (error) {
    console.error('File serving error:', error);

    await SecurityAuditLogService.getInstance().logSecurityEvent(
      SecurityAction.SUSPICIOUS_ACTIVITY,
      {
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
        eventData: {
          reason: 'Error serving avatar file',
          filename: (await params).filename,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// HEAD /api/uploads/avatar/[filename] - Check if file exists (useful for clients)
export async function HEAD(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { filename } = await params;

    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return new NextResponse(null, { status: 400 });
    }

    // Construct file path
    const filePath = path.join(process.cwd(), UPLOAD_CONFIGS.avatar.uploadDir, filename);

    // Check if file exists
    const fileInfo = await FileUploadUtils.getFileInfo(filePath);
    if (!fileInfo.exists) {
      return new NextResponse(null, { status: 404 });
    }

    // Return headers without content
    const extension = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };

    const contentType = contentTypeMap[extension] || 'application/octet-stream';

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileInfo.size?.toString() || '0',
        'Last-Modified': fileInfo.lastModified?.toUTCString() || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${filename}-${fileInfo.lastModified?.getTime()}"`,
      }
    });

  } catch (error) {
    console.error('File HEAD error:', error);
    return new NextResponse(null, { status: 500 });
  }
}