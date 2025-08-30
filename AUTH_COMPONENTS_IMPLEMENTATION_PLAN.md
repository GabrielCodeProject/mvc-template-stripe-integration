# Authentication Form Components Implementation Plan

## Overview
This document outlines the implementation plan for creating a complete authentication flow with form components that respect the existing MVC pattern, using server actions for form handling and maintaining consistency with the UserManager implementation.

## 1. Component Structure (`/src/components/auth/`)

### Core Components

#### **AuthManager.tsx** - Main Orchestrator Component
- Manages authentication state and flow (similar to UserManager pattern)
- Handles navigation between different auth forms
- Coordinates with server actions
- Manages loading and error states globally

#### **LoginForm.tsx** - Login Form Component
- Email/password inputs with validation
- Remember me checkbox functionality
- Link to forgot password flow
- OAuth provider buttons integration
- Error handling and display

#### **RegisterForm.tsx** - Registration Form Component
- Name, email, password fields with validation
- Password strength indicator integration
- Terms acceptance checkbox
- Email verification notice display
- Success messaging and redirect logic

#### **ForgotPasswordForm.tsx** - Password Reset Request
- Email input for reset link
- Success/error messaging
- Rate limiting awareness
- Clear instructions for users

#### **ResetPasswordForm.tsx** - New Password Form
- Password and confirm password fields
- Token validation from URL
- Password strength requirements display
- Success redirect to login

#### **TwoFactorForm.tsx** - 2FA Verification
- TOTP code input (6 digits)
- Backup code option toggle
- Remember device option
- Clear error messaging for invalid codes

### Profile Components

#### **ProfileManager.tsx** - User Profile Management
- Display user information
- Edit profile form integration
- Security settings access
- Account statistics display

#### **SecuritySettings.tsx** - Security Management
- 2FA setup/disable functionality
- Password change form
- Active sessions list with revoke options
- Logout all devices button
- Security audit log

### Utility Components

#### **PasswordStrengthIndicator.tsx** - Visual Password Strength
- Real-time strength calculation
- Visual indicator (progress bar)
- Requirements checklist
- Color-coded feedback

#### **OAuthProviders.tsx** - Social Login Buttons
- Google, GitHub, Discord buttons
- Provider-specific styling
- Loading states during OAuth flow
- Error handling for OAuth failures

#### **SessionList.tsx** - Active Sessions Display
- Device/browser information
- IP address and location (if available)
- Last activity timestamp
- Individual session revoke buttons

#### **AuthGuard.tsx** - Protected Route Wrapper
- Session validation
- Redirect to login if unauthorized
- Loading state while checking auth
- Children rendering when authorized

## 2. Form Patterns Following MVC

### State Management Pattern
```typescript
// Local state for forms (similar to UserEditForm)
const [formData, setFormData] = useState<LoginData>({
  email: '',
  password: '',
  rememberMe: false
});

const [errors, setErrors] = useState<FormErrors>({});
const [isSubmitting, setIsSubmitting] = useState(false);
const [successMessage, setSuccessMessage] = useState('');
```

### Server Action Integration
```typescript
// Use server actions instead of API routes
import { loginAction } from '@/actions/auth.actions';
import { useAction } from 'next-safe-action/hooks';

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);
  setErrors({});
  
  const result = await loginAction(formData);
  
  if (result?.success) {
    // Handle success - redirect or update UI
    router.push(result.redirectUrl || '/dashboard');
  } else {
    setErrors(result?.errors || { general: 'An error occurred' });
  }
  setIsSubmitting(false);
};
```

### Validation Pattern
```typescript
// Client-side validation (enhancement)
const validateForm = (): boolean => {
  const newErrors: FormErrors = {};
  
  if (!formData.email) {
    newErrors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    newErrors.email = 'Invalid email format';
  }
  
  if (!formData.password) {
    newErrors.password = 'Password is required';
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

## 3. Component Features

### LoginForm Features
- **Client-side validation** with real-time feedback
- **Loading states** during submission (spinner, disabled buttons)
- **Error display** (field-specific and general errors)
- **Progressive enhancement** (works without JavaScript)
- **OAuth provider integration** with provider buttons
- **Remember me functionality** for extended sessions
- **Redirect to original URL** after successful login
- **Password visibility toggle** for better UX

### RegisterForm Features
- **Password strength validation** with visual feedback
- **Email uniqueness check** (async validation)
- **Terms and conditions acceptance** requirement
- **Email verification flow** initiation
- **Auto-login after registration** (configurable)
- **Welcome email trigger** through server action
- **Form field tooltips** for help text
- **Success state** with next steps guidance

### Security Features
- **2FA setup** with QR code display
- **Backup codes generation** and secure display
- **Session management** with device information
- **Password change** with current password verification
- **Security audit log** display
- **Suspicious activity alerts**
- **Account recovery options**
- **Privacy settings management**

## 4. Styling Approach (Consistent with UserManager)

### Form Styling Patterns
```typescript
// Input styling pattern from UserEditForm
<input
  type="email"
  className={`
    w-full px-3 py-2 border rounded-md 
    focus:outline-none focus:ring-2 focus:ring-indigo-500 
    dark:bg-gray-700 dark:text-gray-100
    ${errors.email 
      ? 'border-red-500 dark:border-red-400' 
      : 'border-gray-300 dark:border-gray-600'
    }
  `}
  placeholder="email@example.com"
/>

// Error message styling
{errors.email && (
  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
    {errors.email}
  </p>
)}
```

### Button Patterns
```typescript
// Primary button (submit actions)
<button className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
  Sign In
</button>

// Secondary button (cancel, back)
<button className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">
  Cancel
</button>

// Danger button (delete, logout)
<button className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">
  Delete Account
</button>

// OAuth buttons (provider-specific)
<button className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
  <Icon /> Continue with Google
</button>
```

### Layout Patterns
```typescript
// Form container
<div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
    {/* Form content */}
  </div>
</div>

// Form header
<div className="mb-6">
  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
    Sign In
  </h2>
  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
    Welcome back! Please sign in to your account.
  </p>
</div>
```

## 5. Directory Structure

```
src/components/auth/
├── forms/
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── ForgotPasswordForm.tsx
│   ├── ResetPasswordForm.tsx
│   ├── TwoFactorForm.tsx
│   └── ChangePasswordForm.tsx
├── profile/
│   ├── ProfileManager.tsx
│   ├── ProfileEditForm.tsx
│   ├── SecuritySettings.tsx
│   └── AccountSettings.tsx
├── shared/
│   ├── PasswordStrengthIndicator.tsx
│   ├── OAuthProviders.tsx
│   ├── SessionList.tsx
│   ├── AuthGuard.tsx
│   ├── EmailVerificationNotice.tsx
│   └── TwoFactorSetup.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useSession.ts
│   └── useFormValidation.ts
├── types/
│   ├── auth.types.ts
│   └── form.types.ts
├── AuthManager.tsx
└── index.ts (barrel exports)
```

## 6. Integration with Existing System

### Model Integration
- Use existing `AuthUser` model for user data representation
- Leverage `Session` model for session display and management
- Utilize validation methods from models (`validate()`, `verifyPassword()`)
- Maintain consistent data transformation (`toJSON()`, `fromJSON()`)

### Service Integration
- Call `AuthService` methods through server actions
- Use `SessionService` for session management operations
- Leverage existing validation utilities from `auth-utils.ts`
- Maintain singleton pattern consistency

### Repository Integration
- Access user data through `AuthRepository`
- Session persistence via `SessionRepository`
- Maintain data consistency across layers
- Use existing query patterns

### Navigation Integration
```
src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   ├── reset-password/
│   │   └── page.tsx
│   ├── verify-email/
│   │   └── page.tsx
│   └── layout.tsx (auth layout)
├── (protected)/
│   ├── dashboard/
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   └── layout.tsx (protected layout)
```

## 7. Progressive Enhancement

### Form Submission
- Forms work without JavaScript using server actions
- Client-side validation as enhancement layer
- Optimistic UI updates where appropriate
- Graceful fallback for failed JavaScript

### Error Handling
- Server-side validation as primary defense
- Client-side validation for better UX
- Graceful degradation for older browsers
- Clear error messaging at all levels

### Loading States
- Skeleton screens for data loading
- Button loading states during submission
- Progress indicators for multi-step processes
- Smooth transitions between states

## 8. Type Safety

### Form Type Definitions
```typescript
// Form data types
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

// Error types
interface FormErrors {
  [key: string]: string | undefined;
  general?: string;
}

// Response types
interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  session?: Session;
  errors?: FormErrors;
  message?: string;
  redirectUrl?: string;
  requires2FA?: boolean;
}

// Props interfaces
interface AuthFormProps {
  onSuccess?: (user: AuthUser) => void;
  onError?: (error: string) => void;
  redirectUrl?: string;
}
```

## 9. Implementation Order

### Phase 1: Core Authentication (Week 1)
1. **LoginForm.tsx** - Basic login functionality
2. **RegisterForm.tsx** - User registration flow
3. **AuthManager.tsx** - Main orchestrator
4. **Basic auth pages** - Login and register pages
5. **Integration tests** - Core auth flow testing

### Phase 2: Password Management (Week 1-2)
1. **ForgotPasswordForm.tsx** - Password reset request
2. **ResetPasswordForm.tsx** - New password setting
3. **PasswordStrengthIndicator.tsx** - Visual feedback
4. **Email templates** - Reset password emails
5. **Token validation** - Secure token handling

### Phase 3: Enhanced Security (Week 2)
1. **TwoFactorForm.tsx** - 2FA verification
2. **SecuritySettings.tsx** - Security management
3. **SessionList.tsx** - Active sessions display
4. **TwoFactorSetup.tsx** - QR code and backup codes
5. **Security audit log** - Activity tracking

### Phase 4: Profile Management (Week 2-3)
1. **ProfileManager.tsx** - Profile orchestrator
2. **ProfileEditForm.tsx** - Profile editing
3. **AccountSettings.tsx** - Account preferences
4. **OAuth integration** - Social provider linking
5. **Avatar upload** - Profile picture management

### Phase 5: Polish & Guards (Week 3)
1. **AuthGuard.tsx** - Route protection
2. **Loading states** - Skeleton screens
3. **Error boundaries** - Error handling
4. **Accessibility** - ARIA labels, keyboard nav
5. **Mobile optimization** - Responsive design

## 10. Key Implementation Notes

### Consistency Requirements
- **Follow exact patterns** from UserManager components
- **Maintain naming conventions** established in codebase
- **Use consistent error handling** patterns
- **Apply same validation approaches** throughout

### Technical Requirements
- **Server Actions**: Use auth.actions.ts for all form submissions
- **Validation**: Client-side for UX, server-side for security
- **State Management**: Local state only, no global state management
- **Error Handling**: Consistent with UserManager error patterns
- **Styling**: Use existing Tailwind patterns and dark mode support
- **Type Safety**: Full TypeScript with proper interfaces
- **Progressive Enhancement**: Forms functional without JavaScript

### Security Requirements
- **CSRF Protection**: Handled by server actions
- **XSS Prevention**: Proper input sanitization
- **SQL Injection**: Prevented by Prisma ORM
- **Rate Limiting**: Implement on auth endpoints
- **Session Security**: Secure, httpOnly cookies
- **Password Policy**: Minimum 8 chars, complexity requirements
- **2FA Support**: TOTP standard implementation

### Performance Requirements
- **Code Splitting**: Lazy load auth components
- **Bundle Size**: Keep components lightweight
- **Caching**: Cache user data appropriately
- **Optimistic Updates**: Where safe and appropriate
- **Image Optimization**: For OAuth provider logos
- **Font Loading**: Optimize for form inputs

### Accessibility Requirements
- **ARIA Labels**: All form inputs properly labeled
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Proper announcements
- **Focus Management**: Clear focus indicators
- **Error Announcements**: Live regions for errors
- **Color Contrast**: WCAG AA compliance

## 11. Testing Strategy

### Unit Tests
- Model validation methods
- Service business logic
- Utility functions
- Component rendering

### Integration Tests
- Form submission flows
- Server action integration
- Session management
- Error handling paths

### E2E Tests
- Complete auth flows
- Password reset journey
- 2FA setup and usage
- Profile management

### Security Tests
- Input validation
- XSS prevention
- CSRF protection
- Rate limiting

## 12. Documentation Requirements

### Component Documentation
- Props documentation with JSDoc
- Usage examples in Storybook
- README for each major component
- Inline comments for complex logic

### API Documentation
- Server action signatures
- Response formats
- Error codes
- Rate limits

### User Documentation
- Authentication flow diagrams
- Security best practices
- Troubleshooting guide
- FAQ section

## 13. Monitoring & Analytics

### Metrics to Track
- Login success/failure rates
- Registration conversion
- Password reset requests
- 2FA adoption rate
- Session duration
- OAuth provider usage

### Error Tracking
- Failed login attempts
- Validation errors
- Server errors
- OAuth failures
- Session expiry issues

### Security Monitoring
- Suspicious login patterns
- Brute force attempts
- Account takeover attempts
- Unusual session activity

## Conclusion

This implementation plan provides a comprehensive approach to building authentication components that:
- Respect the existing MVC pattern
- Maintain consistency with current components
- Provide excellent user experience
- Ensure security best practices
- Support progressive enhancement
- Enable future scalability

The phased approach allows for iterative development while maintaining a functional authentication system at each phase completion.