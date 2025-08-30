import { Metadata } from 'next';
import AuthManager from '@/components/auth/AuthManager';

export const metadata: Metadata = {
  title: 'Create Account - MVC Template',
  description: 'Create a new account to get started with our platform and access premium features.',
};

export default function RegisterPage() {
  return <AuthManager />;
}