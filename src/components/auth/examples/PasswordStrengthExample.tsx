"use client";

import { useState } from 'react';
import PasswordStrengthIndicator from '../PasswordStrengthIndicator';
import { PasswordStrength } from '../types/auth.types';

/**
 * Example component demonstrating how to use the PasswordStrengthIndicator
 * This can be used as a reference for integration into various forms
 */
export default function PasswordStrengthExample() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentStrength, setCurrentStrength] = useState<PasswordStrength | null>(null);

  const handlePasswordStrengthChange = (strength: PasswordStrength) => {
    setCurrentStrength(strength);
    console.log('Password strength updated:', strength);
  };

  const isPasswordValid = currentStrength && currentStrength.level !== 'weak';

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Password Strength Demo
      </h2>

      <div className="space-y-4">
        {/* Password Input */}
        <div>
          <label
            htmlFor="demo-password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="demo-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter a password to test strength"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
            >
              <span className="text-gray-500 dark:text-gray-400">
                {showPassword ? '🙈' : '👁️'}
              </span>
            </button>
          </div>
        </div>

        {/* Password Strength Indicator */}
        {password && (
          <PasswordStrengthIndicator
            password={password}
            onChange={handlePasswordStrengthChange}
            showRequirements={true}
            minStrength="good"
            className="mt-3"
          />
        )}

        {/* Example Form Actions */}
        <div className="pt-4 space-y-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Current Status:</strong>{' '}
            {password ? (
              <span className={isPasswordValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {isPasswordValid ? 'Password meets requirements' : 'Password needs improvement'}
              </span>
            ) : (
              'Enter a password'
            )}
          </div>
          
          <button
            type="button"
            disabled={!isPasswordValid}
            className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
              isPasswordValid
                ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                : 'text-gray-400 bg-gray-200 dark:bg-gray-600 cursor-not-allowed'
            }`}
          >
            {isPasswordValid ? 'Submit Form' : 'Improve Password Strength'}
          </button>
        </div>

        {/* Integration Examples */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Integration Tips:
          </h3>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Set <code>minStrength</code> to &quot;good&quot; or &quot;strong&quot; for sensitive applications</li>
            <li>• Use <code>showRequirements</code> to help users understand criteria</li>
            <li>• Handle <code>onChange</code> to validate forms in real-time</li>
            <li>• Component supports dark mode automatically</li>
            <li>• Debouncing is built-in for performance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Integration example for ResetPasswordForm
 * 
 * ```tsx
 * import PasswordStrengthIndicator from '../PasswordStrengthIndicator';
 * 
 * // In your form component:
 * const [newPassword, setNewPassword] = useState('');
 * const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
 * 
 * const handlePasswordStrengthChange = (strength: PasswordStrength) => {
 *   setPasswordStrength(strength);
 * };
 * 
 * const isPasswordValid = passwordStrength && passwordStrength.level !== 'weak';
 * 
 * // In your form validation:
 * if (!isPasswordValid) {
 *   setErrors({ password: 'Password is too weak' });
 *   return;
 * }
 * 
 * // In your JSX:
 * <PasswordStrengthIndicator
 *   password={newPassword}
 *   onChange={handlePasswordStrengthChange}
 *   showRequirements={true}
 *   minStrength="strong"
 * />
 * ```
 */

/**
 * Custom validation example
 * 
 * ```tsx
 * const validatePasswordWithStrength = (password: string, minLevel: 'weak' | 'fair' | 'good' | 'strong' = 'good') => {
 *   const strength = calculatePasswordStrength(password);
 *   const levels = ['weak', 'fair', 'good', 'strong'];
 *   const minIndex = levels.indexOf(minLevel);
 *   const currentIndex = levels.indexOf(strength.level);
 *   
 *   return {
 *     isValid: currentIndex >= minIndex,
 *     strength,
 *     message: currentIndex >= minIndex 
 *       ? 'Password meets requirements' 
 *       : `Password must be at least ${minLevel}`
 *   };
 * };
 * ```
 */