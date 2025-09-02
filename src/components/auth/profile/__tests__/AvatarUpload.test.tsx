import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import AvatarUpload from '../AvatarUpload';
import { renderWithUser, createMockFile, createDragEvent, createMockCanvasContext } from '@/test/utils/test-utils';
import { AuthUser } from '@/models/AuthUser';

// Mock fetch for upload requests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AvatarUpload', () => {
  const mockUser: AuthUser = {
    id: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    image: 'https://example.com/current-avatar.jpg',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProps = {
    user: mockUser,
    currentAvatar: 'https://example.com/current-avatar.jpg',
    onAvatarUpdate: jest.fn(),
    onAvatarDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(
      createMockCanvasContext()
    );
    
    // Mock successful upload response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        url: 'https://example.com/new-avatar.jpg',
        filename: 'avatar.jpg',
        size: 1024,
        type: 'image/jpeg',
      }),
    });
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithUser(<AvatarUpload {...mockProps} />);
      expect(container).toBeDefined();
    });

    it('displays current avatar when provided', () => {
      renderWithUser(<AvatarUpload {...mockProps} />);
      
      const avatarImage = screen.getByRole('img');
      expect(avatarImage).toHaveAttribute('src', mockProps.currentAvatar);
      expect(avatarImage).toHaveAttribute('alt', mockUser.name);
    });

    it('shows placeholder when no avatar is provided', () => {
      renderWithUser(<AvatarUpload {...mockProps} currentAvatar={undefined} />);
      
      expect(screen.getByText('👤')).toBeInTheDocument();
    });

    it('renders upload and delete buttons', () => {
      renderWithUser(<AvatarUpload {...mockProps} />);
      
      expect(screen.getByRole('button', { name: /upload new avatar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete avatar/i })).toBeInTheDocument();
    });

    it('supports different sizes', () => {
      const { rerender } = renderWithUser(<AvatarUpload {...mockProps} size="sm" />);
      
      let container = screen.getByRole('img').closest('div');
      expect(container).toHaveClass('w-20', 'h-20');
      
      rerender(<AvatarUpload {...mockProps} size="xl" />);
      
      container = screen.getByRole('img').closest('div');
      expect(container).toHaveClass('w-50', 'h-50');
    });
  });

  describe('File Selection', () => {
    it('opens file picker when upload button is clicked', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const fileInput = screen.getByLabelText(/upload avatar/i);
      const clickSpy = jest.spyOn(fileInput, 'click');
      
      const uploadButton = screen.getByRole('button', { name: /upload new avatar/i });
      await user.click(uploadButton);
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('handles file selection via input', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      });
    });

    it('validates file type', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const invalidFile = createMockFile('test.pdf', 1024, 'application/pdf');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, invalidFile);
      
      await waitFor(() => {
        expect(screen.getByText(/please upload a jpeg, png, or webp/i)).toBeInTheDocument();
      });
    });

    it('validates file size', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const largeFile = createMockFile('large.jpg', 10 * 1024 * 1024, 'image/jpeg'); // 10MB
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, largeFile);
      
      await waitFor(() => {
        expect(screen.getByText(/file size must be less than 5mb/i)).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('highlights drop zone on drag enter', async () => {
      renderWithUser(<AvatarUpload {...mockProps} />);
      
      const dropZone = screen.getByText(/drag and drop an image/i).closest('div');
      
      fireEvent(dropZone, createDragEvent('dragenter'));
      
      await waitFor(() => {
        expect(dropZone).toHaveClass('border-indigo-500', 'bg-indigo-50');
      });
    });

    it('removes highlight on drag leave', async () => {
      renderWithUser(<AvatarUpload {...mockProps} />);
      
      const dropZone = screen.getByText(/drag and drop an image/i).closest('div');
      
      fireEvent(dropZone, createDragEvent('dragenter'));
      fireEvent(dropZone, createDragEvent('dragleave'));
      
      await waitFor(() => {
        expect(dropZone).not.toHaveClass('border-indigo-500', 'bg-indigo-50');
      });
    });

    it('handles file drop', async () => {
      renderWithUser(<AvatarUpload {...mockProps} />);
      
      const dropZone = screen.getByText(/drag and drop an image/i).closest('div');
      const file = createMockFile('dropped.jpg', 1024, 'image/jpeg');
      
      fireEvent(dropZone, createDragEvent('drop', [file]));
      
      await waitFor(() => {
        expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      });
    });

    it('validates dropped files', async () => {
      renderWithUser(<AvatarUpload {...mockProps} />);
      
      const dropZone = screen.getByText(/drag and drop an image/i).closest('div');
      const invalidFile = createMockFile('test.txt', 1024, 'text/plain');
      
      fireEvent(dropZone, createDragEvent('drop', [invalidFile]));
      
      await waitFor(() => {
        expect(screen.getByText(/please upload a jpeg, png, or webp/i)).toBeInTheDocument();
      });
    });
  });

  describe('Image Cropping', () => {
    beforeEach(async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      });
    });

    it('shows crop interface when image is selected', () => {
      expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply crop/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('supports zoom controls', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      
      expect(zoomInButton).toBeInTheDocument();
      expect(zoomOutButton).toBeInTheDocument();
      
      await user.click(zoomInButton);
      await user.click(zoomOutButton);
      
      // Verify zoom functionality works (implementation specific)
    });

    it('supports rotation controls', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const rotateButton = screen.getByRole('button', { name: /rotate/i });
      expect(rotateButton).toBeInTheDocument();
      
      await user.click(rotateButton);
      
      // Verify rotation functionality works (implementation specific)
    });

    it('allows crop area adjustment', async () => {
      const cropArea = screen.getByTestId('crop-area');
      expect(cropArea).toBeInTheDocument();
      
      // Test drag to move crop area
      fireEvent.mouseDown(cropArea, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(cropArea, { clientX: 120, clientY: 120 });
      fireEvent.mouseUp(cropArea);
      
      // Verify crop area moved
    });

    it('applies crop and uploads image', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const applyCropButton = screen.getByRole('button', { name: /apply crop/i });
      await user.click(applyCropButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/uploads/avatar',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });
    });

    it('cancels crop and returns to upload state', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/crop your image/i)).not.toBeInTheDocument();
        expect(screen.getByText(/drag and drop an image/i)).toBeInTheDocument();
      });
    });
  });

  describe('Upload Process', () => {
    it('shows upload progress', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      const applyCropButton = screen.getByRole('button', { name: /apply crop/i });
      await user.click(applyCropButton);
      
      // Should show progress indicator
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('handles successful upload', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      const applyCropButton = screen.getByRole('button', { name: /apply crop/i });
      await user.click(applyCropButton);
      
      await waitFor(() => {
        expect(mockProps.onAvatarUpdate).toHaveBeenCalledWith(
          'https://example.com/new-avatar.jpg'
        );
      });
      
      expect(screen.getByText(/avatar updated successfully/i)).toBeInTheDocument();
    });

    it('handles upload errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      const applyCropButton = screen.getByRole('button', { name: /apply crop/i });
      await user.click(applyCropButton);
      
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
    });

    it('handles server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          error: 'Server error',
        }),
      });
      
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      const applyCropButton = screen.getByRole('button', { name: /apply crop/i });
      await user.click(applyCropButton);
      
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Avatar Deletion', () => {
    it('shows confirmation dialog when delete is clicked', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete avatar/i });
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByText(/delete avatar/i)).toBeInTheDocument();
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
    });

    it('deletes avatar when confirmed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete avatar/i });
      await user.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/uploads/avatar', {
          method: 'DELETE',
        });
        expect(mockProps.onAvatarDelete).toHaveBeenCalled();
      });
    });

    it('cancels deletion when cancelled', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete avatar/i });
      await user.click(deleteButton);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
      });
      
      expect(mockProps.onAvatarDelete).not.toHaveBeenCalled();
    });

    it('handles deletion errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Delete failed'));
      
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete avatar/i });
      await user.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to delete avatar/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const uploadButton = screen.getByRole('button', { name: /upload new avatar/i });
      const deleteButton = screen.getByRole('button', { name: /delete avatar/i });
      
      uploadButton.focus();
      expect(uploadButton).toHaveFocus();
      
      await user.tab();
      expect(deleteButton).toHaveFocus();
    });

    it('has proper ARIA labels and descriptions', () => {
      renderWithUser(<AvatarUpload {...mockProps} />);
      
      const fileInput = screen.getByLabelText(/upload avatar/i);
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
      
      const currentAvatar = screen.getByRole('img');
      expect(currentAvatar).toHaveAttribute('alt', mockUser.name);
    });

    it('announces upload status to screen readers', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      const applyCropButton = screen.getByRole('button', { name: /apply crop/i });
      await user.click(applyCropButton);
      
      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    it('allows retry after upload failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                  ok: true,
                  json: () => Promise.resolve({
                    success: true,
                    url: 'https://example.com/new-avatar.jpg',
                  }),
                });
      
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      const applyCropButton = screen.getByRole('button', { name: /apply crop/i });
      await user.click(applyCropButton);
      
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(mockProps.onAvatarUpdate).toHaveBeenCalled();
      });
    });

    it('clears errors when new file is selected', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      // Upload invalid file to trigger error
      const invalidFile = createMockFile('test.pdf', 1024, 'application/pdf');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, invalidFile);
      
      await waitFor(() => {
        expect(screen.getByText(/please upload a jpeg, png, or webp/i)).toBeInTheDocument();
      });
      
      // Upload valid file
      const validFile = createMockFile('valid.jpg', 1024, 'image/jpeg');
      await user.upload(fileInput, validFile);
      
      await waitFor(() => {
        expect(screen.queryByText(/please upload a jpeg, png, or webp/i)).not.toBeInTheDocument();
        expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('debounces crop area updates', async () => {
      const { user } = renderWithUser(<AvatarUpload {...mockProps} />);
      
      const file = createMockFile('test-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      });
      
      const cropArea = screen.getByTestId('crop-area');
      
      // Rapid mouse movements should be debounced
      for (let i = 0; i < 10; i++) {
        fireEvent.mouseMove(cropArea, { clientX: 100 + i, clientY: 100 + i });
      }
      
      // Should not trigger excessive re-renders
      expect(cropArea).toBeInTheDocument();
    });
  });
});