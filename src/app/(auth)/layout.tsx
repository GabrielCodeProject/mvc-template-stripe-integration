import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Authentication - MVC Template',
  description: 'Sign in to your account or create a new one.',
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-5 dark:opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />
      
      {/* Header */}
      <div className="relative z-10 pt-8 pb-4">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              MVC Template
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Stripe Integration & Authentication
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="text-gray-600 dark:text-gray-400">Loading...</span>
              </div>
            </div>
          </div>
        }>
          {children}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 mt-12">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="space-y-4">
            <div className="flex justify-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
              <a href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Terms
              </a>
              <a href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Privacy
              </a>
              <a href="/support" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Support
              </a>
            </div>
            
            <div className="text-xs text-gray-400 dark:text-gray-500">
              <p>
                &copy; {new Date().getFullYear()} MVC Template. All rights reserved.
              </p>
              <p className="mt-1">
                Built with Next.js, TypeScript, and Tailwind CSS
              </p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}