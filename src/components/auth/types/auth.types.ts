// Auth form types following the existing patterns from UserEditForm

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface RegisterFormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
  general?: string;
}

export interface AuthState {
  loading: boolean;
  error: string | null;
  success: string | null;
  requires2FA: boolean;
  requiresVerification: boolean;
}

export interface OAuth2FAData {
  user: Record<string, unknown>;
  requires2FA: boolean;
  twoFactorToken?: string;
}

export interface AuthManagerState {
  currentForm:
    | "login"
    | "register"
    | "2fa"
    | "forgot-password"
    | "reset-password"
    | null;
  authState: AuthState;
  user: Record<string, unknown> | null;
  twoFactorData: OAuth2FAData | null;
}

// Password strength types (enhanced)
export interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  entropy: boolean;
  common: boolean;
}

export interface PasswordStrength {
  score: number; // 0-100
  level: 'weak' | 'fair' | 'good' | 'strong';
  entropy: number;
  feedback: string[];
  requirements: PasswordRequirements;
}

// Legacy interface for backward compatibility
export interface LegacyPasswordStrength {
  score: number; // 0-4
  feedback: string[];
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  minLength: boolean;
}

// OAuth provider types
export type OAuthProvider = "google";

export interface OAuthProviderConfig {
  name: string;
  icon: string;
  color: string;
  textColor: string;
}

// Form submission result types
export interface AuthActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  serverError?: string;
  validationErrors?: Record<string, string[]>;
}

export interface LoginActionResult extends AuthActionResult {
  data?: {
    user: Record<string, unknown>;
    requires2FA?: boolean;
    sessionExpires?: string;
  };
}

export interface RegisterActionResult extends AuthActionResult {
  data?: {
    requiresVerification: boolean;
    message: string;
  };
}

// Forgot Password form types
export interface ForgotPasswordFormData {
  email: string;
}

export interface ForgotPasswordFormErrors {
  email?: string;
  general?: string;
}

// Reset Password form types
export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordFormErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
  token?: string;
}

// Password reset action result types
export interface ForgotPasswordActionResult extends AuthActionResult {
  data?: {
    message: string;
  };
}

export interface ResetPasswordActionResult extends AuthActionResult {
  data?: {
    message: string;
  };
}
