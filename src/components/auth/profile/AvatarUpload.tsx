"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { AuthUser } from '@/models/AuthUser';

// Types and Interfaces
interface AvatarUploadProps {
  user: AuthUser;
  currentAvatar?: string;
  onAvatarUpdate?: (avatarUrl: string) => void;
  onAvatarDelete?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageData {
  file: File;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
}

interface UploadState {
  isDragging: boolean;
  isUploading: boolean;
  isProcessing: boolean;
  uploadProgress: number;
  error: string | null;
  success: string | null;
}

interface CropState {
  isActive: boolean;
  scale: number;
  cropArea: CropArea;
  imagePosition: { x: number; y: number };
}

// Constants
const AVATAR_SIZES = {
  sm: { container: 80, preview: 40 },
  md: { container: 120, preview: 60 },
  lg: { container: 160, preview: 80 },
  xl: { container: 200, preview: 100 },
} as const;

const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_DIMENSIONS = 100;
const MAX_DIMENSIONS = 2048;

// Image processing utilities
class ImageProcessor {
  static validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file type
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return {
        isValid: false,
        error: 'Please upload a JPEG, PNG, or WebP image file.',
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: 'File size must be less than 5MB.',
      };
    }

    return { isValid: true };
  }

  static async loadImage(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        // Validate dimensions
        if (img.naturalWidth < MIN_DIMENSIONS || img.naturalHeight < MIN_DIMENSIONS) {
          URL.revokeObjectURL(url);
          reject(new Error(`Image must be at least ${MIN_DIMENSIONS}x${MIN_DIMENSIONS} pixels.`));
          return;
        }

        if (img.naturalWidth > MAX_DIMENSIONS || img.naturalHeight > MAX_DIMENSIONS) {
          URL.revokeObjectURL(url);
          reject(new Error(`Image must not exceed ${MAX_DIMENSIONS}x${MAX_DIMENSIONS} pixels.`));
          return;
        }

        resolve({
          file,
          url,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image. Please try a different file.'));
      };

      img.src = url;
    });
  }

  static async cropAndCompressImage(
    imageData: ImageData,
    cropArea: CropArea,
    scale: number,
    outputSize: number = 400,
    quality: number = 0.9
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        // Set canvas size to desired output
        canvas.width = outputSize;
        canvas.height = outputSize;

        // Calculate source dimensions based on crop area and scale
        const sourceX = cropArea.x / scale;
        const sourceY = cropArea.y / scale;
        const sourceWidth = cropArea.width / scale;
        const sourceHeight = cropArea.height / scale;

        // Draw the cropped and scaled image
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          outputSize,
          outputSize
        );

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to process image'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to process image'));
      img.src = imageData.url;
    });
  }
}

// Avatar Upload Component
export default function AvatarUpload({
  currentAvatar,
  onAvatarUpdate,
  onAvatarDelete,
  className = '',
  size = 'lg',
}: AvatarUploadProps) {
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // State
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    isDragging: false,
    isUploading: false,
    isProcessing: false,
    uploadProgress: 0,
    error: null,
    success: null,
  });
  const [cropState, setCropState] = useState<CropState>({
    isActive: false,
    scale: 1,
    cropArea: { x: 0, y: 0, width: 300, height: 300 },
    imagePosition: { x: 0, y: 0 },
  });

  // Size configuration
  const sizeConfig = AVATAR_SIZES[size];

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setUploadState(prev => ({ ...prev, isDragging: false }));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // File selection handler
  const handleFileSelection = useCallback(async (file: File) => {
    setUploadState(prev => ({ 
      ...prev, 
      error: null, 
      success: null,
      isProcessing: true 
    }));

    try {
      // Validate file
      const validation = ImageProcessor.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Load and process image
      const loadedImageData = await ImageProcessor.loadImage(file);
      
      // Set up initial crop area (centered square)
      const minDimension = Math.min(loadedImageData.naturalWidth, loadedImageData.naturalHeight);
      const cropSize = Math.min(minDimension, 400);
      const centerX = (loadedImageData.naturalWidth - cropSize) / 2;
      const centerY = (loadedImageData.naturalHeight - cropSize) / 2;

      setImageData(loadedImageData);
      setCropState({
        isActive: true,
        scale: 1,
        cropArea: {
          x: centerX,
          y: centerY,
          width: cropSize,
          height: cropSize,
        },
        imagePosition: { x: 0, y: 0 },
      });

      setUploadState(prev => ({ ...prev, isProcessing: false }));
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to process image',
      }));
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadState(prev => ({ ...prev, isDragging: false }));

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  // Crop handlers
  const handleScaleChange = useCallback((newScale: number) => {
    setCropState(prev => ({ ...prev, scale: newScale }));
  }, []);

  const resetCrop = useCallback(() => {
    if (!imageData) return;

    const minDimension = Math.min(imageData.naturalWidth, imageData.naturalHeight);
    const cropSize = Math.min(minDimension, 400);
    const centerX = (imageData.naturalWidth - cropSize) / 2;
    const centerY = (imageData.naturalHeight - cropSize) / 2;

    setCropState({
      isActive: true,
      scale: 1,
      cropArea: {
        x: centerX,
        y: centerY,
        width: cropSize,
        height: cropSize,
      },
      imagePosition: { x: 0, y: 0 },
    });
  }, [imageData]);

  // Upload handler
  const handleUpload = useCallback(async () => {
    if (!imageData) return;

    setUploadState(prev => ({ 
      ...prev, 
      isUploading: true, 
      uploadProgress: 0, 
      error: null,
      success: null 
    }));

    try {
      // Crop and compress image
      const croppedBlob = await ImageProcessor.cropAndCompressImage(
        imageData,
        cropState.cropArea,
        cropState.scale
      );

      // Simulate progress
      setUploadState(prev => ({ ...prev, uploadProgress: 25 }));

      // Create form data
      const formData = new FormData();
      const fileName = `avatar_${Date.now()}.jpg`;
      formData.append('file', croppedBlob, fileName);

      setUploadState(prev => ({ ...prev, uploadProgress: 50 }));

      // Upload to server
      const response = await fetch('/api/uploads/avatar', {
        method: 'POST',
        body: formData,
      });

      setUploadState(prev => ({ ...prev, uploadProgress: 75 }));

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadState(prev => ({ ...prev, uploadProgress: 100 }));

      // Success
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        success: 'Avatar updated successfully!',
      }));

      // Clean up
      URL.revokeObjectURL(imageData.url);
      setImageData(null);
      setCropState(prev => ({ ...prev, isActive: false }));

      // Callback
      onAvatarUpdate?.(result.avatarUrl);

      // Auto-hide success message
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, success: null }));
      }, 3000);

    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        error: error instanceof Error ? error.message : 'Upload failed',
      }));
    }
  }, [imageData, cropState, onAvatarUpdate]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    setUploadState(prev => ({ 
      ...prev, 
      error: null,
      success: null 
    }));

    try {
      const response = await fetch('/api/uploads/avatar', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Delete failed');
      }

      setUploadState(prev => ({
        ...prev,
        success: 'Avatar removed successfully!',
      }));

      onAvatarDelete?.();

      // Auto-hide success message
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, success: null }));
      }, 3000);

    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Delete failed',
      }));
    }
  }, [onAvatarDelete]);

  // Cancel crop
  const cancelCrop = useCallback(() => {
    if (imageData) {
      URL.revokeObjectURL(imageData.url);
      setImageData(null);
    }
    setCropState(prev => ({ ...prev, isActive: false }));
    setUploadState(prev => ({ ...prev, error: null }));
  }, [imageData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (imageData) {
        URL.revokeObjectURL(imageData.url);
      }
    };
  }, [imageData]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Current Avatar Display */}
      <div className="text-center">
        <div className="relative inline-block mb-4">
          <div 
            className={`rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center mx-auto`}
            style={{ width: sizeConfig.container, height: sizeConfig.container }}
          >
            {currentAvatar ? (
              <Image
                src={currentAvatar}
                alt="Current avatar"
                width={sizeConfig.container}
                height={sizeConfig.container}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-gray-400" style={{ fontSize: sizeConfig.container / 3 }}>
                👤
              </span>
            )}
          </div>
          
          {/* Upload progress overlay */}
          {uploadState.isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-sm font-medium mb-1">
                  {uploadState.uploadProgress}%
                </div>
                <div className="w-16 bg-gray-300 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadState.uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {uploadState.error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {uploadState.error}
          </div>
        )}

        {uploadState.success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
            {uploadState.success}
          </div>
        )}

        {/* Processing State */}
        {uploadState.isProcessing && (
          <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 text-sm">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Processing image...</span>
            </div>
          </div>
        )}
      </div>

      {/* Crop Tool */}
      {cropState.isActive && imageData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Crop Your Image
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Adjust the crop area and zoom level to get the perfect avatar
            </p>
          </div>

          {/* Crop Preview */}
          <div className="relative mb-4 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden mx-auto"
               style={{ width: 300, height: 300 }}>
            <Image
              src={imageData.url}
              alt="Crop preview"
              width={imageData.naturalWidth}
              height={imageData.naturalHeight}
              className="absolute"
              style={{
                width: imageData.naturalWidth * cropState.scale,
                height: imageData.naturalHeight * cropState.scale,
                left: cropState.imagePosition.x,
                top: cropState.imagePosition.y,
                objectFit: 'contain',
              }}
              unoptimized
            />
            
            {/* Crop overlay */}
            <div 
              className="absolute border-2 border-white shadow-lg"
              style={{
                left: cropState.cropArea.x * cropState.scale + cropState.imagePosition.x,
                top: cropState.cropArea.y * cropState.scale + cropState.imagePosition.y,
                width: cropState.cropArea.width * cropState.scale,
                height: cropState.cropArea.height * cropState.scale,
              }}
            />
            
            {/* Grid overlay */}
            <div 
              className="absolute border border-white border-opacity-50 pointer-events-none"
              style={{
                left: cropState.cropArea.x * cropState.scale + cropState.imagePosition.x,
                top: cropState.cropArea.y * cropState.scale + cropState.imagePosition.y,
                width: cropState.cropArea.width * cropState.scale,
                height: cropState.cropArea.height * cropState.scale,
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)
                `,
                backgroundSize: `${(cropState.cropArea.width * cropState.scale) / 3}px ${(cropState.cropArea.height * cropState.scale) / 3}px`,
              }}
            />
          </div>

          {/* Zoom Control */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Zoom: {Math.round(cropState.scale * 100)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={cropState.scale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${(cropState.scale - 0.5) / (3 - 0.5) * 100}%, #e5e7eb ${(cropState.scale - 0.5) / (3 - 0.5) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>

          {/* Preview Sizes */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">32px</div>
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <Image
                  src={imageData.url}
                  alt="32px preview"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">64px</div>
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <Image
                  src={imageData.url}
                  alt="64px preview"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">128px</div>
              <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <Image
                  src={imageData.url}
                  alt="128px preview"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            </div>
          </div>

          {/* Crop Actions */}
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={resetCrop}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Reset Crop
            </button>
            <button
              onClick={cancelCrop}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploadState.isUploading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadState.isUploading ? 'Uploading...' : 'Save Avatar'}
            </button>
          </div>
        </div>
      )}

      {/* Upload Interface */}
      {!cropState.isActive && (
        <div className="space-y-4">
          {/* Drag and Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              uploadState.isDragging
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <div className="space-y-2">
              <div className="text-3xl">📸</div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Drag and drop</span> your image here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  JPEG, PNG, WebP • Max 5MB • Min 100x100px
                </p>
              </div>
            </div>
          </div>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={uploadState.isUploading || uploadState.isProcessing}
          />

          {/* Upload Button */}
          <div className="text-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState.isUploading || uploadState.isProcessing}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadState.isProcessing ? 'Processing...' : 'Choose Image'}
            </button>
          </div>

          {/* Delete Button */}
          {currentAvatar && (
            <div className="text-center pt-2">
              <button
                onClick={handleDelete}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium transition-colors"
              >
                Remove Current Avatar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Guidelines */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Avatar Guidelines
        </h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
          <li>• Use a clear, professional photo of yourself</li>
          <li>• Square images work best (will be cropped to square)</li>
          <li>• Minimum size: 100x100 pixels</li>
          <li>• Maximum size: 2048x2048 pixels</li>
          <li>• Supported formats: JPEG, PNG, WebP</li>
          <li>• File size limit: 5MB</li>
        </ul>
      </div>
    </div>
  );
}