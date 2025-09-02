import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';

// Mock next-safe-action hook
export const createMockAction = (
  initialResult: any = null,
  initialStatus: 'idle' | 'executing' | 'hasSucceeded' | 'hasErrored' = 'idle'
) => {
  const mockExecute = jest.fn();
  const mockReset = jest.fn();

  return {
    execute: mockExecute,
    result: initialResult,
    status: initialStatus,
    isExecuting: initialStatus === 'executing',
    hasSucceeded: initialStatus === 'hasSucceeded',
    hasErrored: initialStatus === 'hasErrored',
    reset: mockReset,
    // Helper methods for testing
    __setResult: (result: any) => (mockExecute as any).__result = result,
    __setStatus: (status: typeof initialStatus) => (mockExecute as any).__status = status,
  };
};

// Custom render function that includes common providers and setup
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: UserEvent;
}

interface CustomRenderResult extends RenderResult {
  user: UserEvent;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): CustomRenderResult => {
  const { user = userEvent.setup(), ...renderOptions } = options;

  // Create a wrapper component if needed (e.g., for themes, contexts)
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <div data-testid="test-wrapper">
        {children}
      </div>
    );
  };

  const renderResult = render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });

  return {
    ...renderResult,
    user,
  };
};

// Convenience function for rendering components with user event
export const renderWithUser = (ui: ReactElement, options?: CustomRenderOptions) => {
  return renderWithProviders(ui, options);
};

// Helper to create mock files for upload testing
export const createMockFile = (
  name: string = 'test-image.jpg',
  size: number = 1024,
  type: string = 'image/jpeg'
): File => {
  const content = new Array(size).fill('a').join('');
  const file = new File([content], name, { type });
  
  // Add mock methods for testing
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  });
  
  return file;
};

// Helper to create mock FileList
export const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  // Add files as indexed properties
  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, {
      value: file,
      writable: false,
    });
  });

  return fileList as FileList;
};

// Helper to simulate drag and drop events
export const createDragEvent = (type: string, files: File[] = []) => {
  const event = new Event(type, { bubbles: true });
  
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: createMockFileList(files),
      types: ['Files'],
      getData: jest.fn(),
      setData: jest.fn(),
      clearData: jest.fn(),
      setDragImage: jest.fn(),
    },
    writable: false,
  });

  return event;
};

// Helper to wait for async operations
export const waitFor = (condition: () => boolean, timeout: number = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout after ${timeout}ms`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
};

// Helper to create mock canvas context for image processing tests
export const createMockCanvasContext = () => ({
  drawImage: jest.fn(),
  getImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  })),
  setTransform: jest.fn(),
  resetTransform: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  scale: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  rect: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  clip: jest.fn(),
  canvas: {
    width: 100,
    height: 100,
    toBlob: jest.fn(),
    toDataURL: jest.fn(() => 'data:image/png;base64,test'),
  },
});

// Helper to mock intersection observer entries
export const createMockIntersectionObserverEntry = (
  target: Element,
  isIntersecting: boolean = true
) => ({
  target,
  isIntersecting,
  intersectionRatio: isIntersecting ? 1 : 0,
  boundingClientRect: {
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  },
  intersectionRect: {
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  },
  rootBounds: {
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  },
  time: Date.now(),
});

// Helper to create mock form data for testing
export const createMockFormData = (data: Record<string, any>) => {
  const formData = new FormData();
  
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
    } else {
      formData.append(key, String(value));
    }
  });
  
  return formData;
};

// Helper to simulate window resize for responsive tests
export const resizeWindow = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  window.dispatchEvent(new Event('resize'));
};

// Helper to create mock clipboard API
export const createMockClipboard = () => ({
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue(''),
  write: jest.fn().mockResolvedValue(undefined),
  read: jest.fn().mockResolvedValue([]),
});

// Export default render function
export { render } from '@testing-library/react';
export default renderWithProviders;