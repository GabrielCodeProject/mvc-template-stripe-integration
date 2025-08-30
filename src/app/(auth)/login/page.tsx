import { Metadata } from 'next';
import AuthManager from '@/components/auth/AuthManager';

export const metadata: Metadata = {
  title: 'Sign In - MVC Template',
  description: 'Sign in to your account to access your dashboard and manage your subscription.',
};

export default function LoginPage() {
  return <AuthManager />;
}