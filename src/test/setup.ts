import React from 'react';
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  // Increase timeout for complex component interactions
  asyncUtilTimeout: 5000,
});

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage(props: any) {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return React.createElement('img', props);
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-safe-action
jest.mock('next-safe-action/hooks', () => ({
  useAction: jest.fn(),
}));

// Setup window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver for components that use it
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});

window.IntersectionObserver = mockIntersectionObserver;

// Mock ResizeObserver for components that use it
const mockResizeObserver = jest.fn();
mockResizeObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});

window.ResizeObserver = mockResizeObserver;

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL for file upload tests
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader for file upload tests
const mockFileReader = jest.fn();
mockFileReader.prototype.readAsDataURL = jest.fn();
mockFileReader.prototype.readAsArrayBuffer = jest.fn();
mockFileReader.prototype.readAsText = jest.fn();

Object.defineProperty(mockFileReader.prototype, 'onload', {
  set: jest.fn(),
  get: jest.fn(),
});

Object.defineProperty(mockFileReader.prototype, 'onerror', {
  set: jest.fn(),
  get: jest.fn(),
});

global.FileReader = mockFileReader as any;

// Mock canvas for image processing tests
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  drawImage: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  createImageData: jest.fn(),
  setTransform: jest.fn(),
  resetTransform: jest.fn(),
  canvas: {
    width: 0,
    height: 0,
  },
}) as any;

HTMLCanvasElement.prototype.toBlob = jest.fn();
HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,test');

// Console error handling for tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress console errors/warnings in tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

import { server } from './mocks/server';

// Setup MSW server for all tests
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

// Global test utilities
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export const mockIntersectionObserverEntry = (isIntersecting: boolean) => ({
  isIntersecting,
  boundingClientRect: {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  },
  intersectionRatio: isIntersecting ? 1 : 0,
  intersectionRect: {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  },
  rootBounds: {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  },
  target: document.createElement('div'),
  time: Date.now(),
});