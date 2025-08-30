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
  user: any;
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
  user: any | null;
  twoFactorData: OAuth2FAData | null;
}

// Password strength types
export interface PasswordStrength {
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
  data?: any;
  serverError?: string;
  validationErrors?: Record<string, string[]>;
}

export interface LoginActionResult extends AuthActionResult {
  data?: {
    user: any;
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
