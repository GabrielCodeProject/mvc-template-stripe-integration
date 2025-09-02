"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract OAuth parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Parse state to get provider information
        let provider = 'unknown';
        if (state) {
          try {
            const decoded = JSON.parse(atob(state));
            provider = decoded.provider || 'unknown';
          } catch (e) {
            console.error('Failed to decode state parameter:', e);
          }
        }

        if (error) {
          setStatus('error');
          setMessage(`OAuth Error: ${errorDescription || error}`);
          
          // Send error to parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-callback',
              provider,
              error: errorDescription || error,
            }, window.location.origin);
          }
          
          // Close popup after delay
          setTimeout(() => {
            window.close();
          }, 3000);
          
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization code or state parameter');
          
          // Send error to parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-callback',
              provider,
              error: 'Missing authorization code or state parameter',
            }, window.location.origin);
          }
          
          setTimeout(() => {
            window.close();
          }, 3000);
          
          return;
        }

        setStatus('success');
        setMessage('Authorization successful! Completing connection...');

        // Send success data to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-callback',
            provider,
            code,
            state,
          }, window.location.origin);
        }

        // Close popup after brief delay
        setTimeout(() => {
          window.close();
        }, 1500);

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred during OAuth callback');
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-callback',
            error: 'Unexpected error during callback processing',
          }, window.location.origin);
        }
        
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          <div className="text-center">
            {/* Status Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4">
              {status === 'processing' && (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              )}
              {status === 'success' && (
                <div className="text-green-500 text-4xl">✅</div>
              )}
              {status === 'error' && (
                <div className="text-red-500 text-4xl">❌</div>
              )}
            </div>

            {/* Status Title */}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {status === 'processing' && 'Processing Authorization'}
              {status === 'success' && 'Authorization Successful'}
              {status === 'error' && 'Authorization Error'}
            </h2>

            {/* Status Message */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>

            {/* Additional Information */}
            {status === 'processing' && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Please wait while we complete your account connection...
              </p>
            )}
            
            {status === 'success' && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                This window will close automatically.
              </p>
            )}
            
            {status === 'error' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  This window will close automatically, or you can close it manually.
                </p>
                <button
                  onClick={() => window.close()}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full mx-auto">
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Loading OAuth Callback
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please wait while we process your authorization...
              </p>
            </div>
          </div>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}