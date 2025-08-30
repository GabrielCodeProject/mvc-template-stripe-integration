"use client";

import { useEffect, useMemo, useState } from 'react';
import { 
  calculatePasswordStrength,
  getStrengthColor,
  getStrengthTextColor,
  getStrengthText,
  debounce,
  type PasswordStrength
} from '@/lib/password-strength';

interface PasswordStrengthIndicatorProps {
  password: string;
  onChange?: (strength: PasswordStrength) => void;
  className?: string;
  showRequirements?: boolean;
  minStrength?: 'weak' | 'fair' | 'good' | 'strong';
  debounceMs?: number;
}

const CheckIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="currentColor"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const XIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={`w-4 h-4 ${className}`}
    fill="currentColor"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

export default function PasswordStrengthIndicator({
  password,
  onChange,
  className = "",
  showRequirements = true,
  minStrength = 'fair',
  debounceMs = 300
}: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState<PasswordStrength | null>(null);

  // Debounced calculation for performance
  const debouncedCalculate = useMemo(() => {
    return debounce((password: string) => {
      const result = calculatePasswordStrength(password);
      setStrength(result);
      onChange?.(result);
    }, debounceMs);
  }, [onChange, debounceMs]);

  // Calculate strength when password changes
  useEffect(() => {
    if (password) {
      debouncedCalculate(password);
    } else {
      setStrength(null);
      onChange?.(calculatePasswordStrength(''));
    }
  }, [password, debouncedCalculate, onChange]);

  // Memoized strength level order for comparison
  const strengthLevels = useMemo(() => ['weak', 'fair', 'good', 'strong'], []);
  const minStrengthIndex = strengthLevels.indexOf(minStrength);
  const meetsMinStrength = strength ? strengthLevels.indexOf(strength.level) >= minStrengthIndex : false;

  // Don't render if no password
  if (!password || !strength) {
    return null;
  }

  const requirementItems = [
    { key: 'length', label: 'At least 12 characters', met: strength.requirements.length },
    { key: 'uppercase', label: 'Uppercase letter (A-Z)', met: strength.requirements.uppercase },
    { key: 'lowercase', label: 'Lowercase letter (a-z)', met: strength.requirements.lowercase },
    { key: 'numbers', label: 'Number (0-9)', met: strength.requirements.numbers },
    { key: 'symbols', label: 'Symbol (!@#$%^&*)', met: strength.requirements.symbols },
    { key: 'entropy', label: 'High complexity (50+ bits entropy)', met: strength.requirements.entropy },
    { key: 'common', label: 'Not a common password', met: strength.requirements.common }
  ];

  return (
    <div className={`space-y-3 ${className}`} role="region" aria-label="Password strength indicator">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Password strength
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${getStrengthTextColor(strength.level)}`}>
              {getStrengthText(strength.level)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {strength.score}/100
            </span>
          </div>
        </div>
        
        <div className="relative">
          {/* Background bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            {/* Progress fill */}
            <div
              className={`h-2 rounded-full transition-all duration-500 ease-out ${getStrengthColor(strength.level)}`}
              style={{ width: `${strength.score}%` }}
              role="progressbar"
              aria-valuenow={strength.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Password strength: ${strength.score} out of 100`}
            />
          </div>
          
          {/* Strength level markers */}
          <div className="absolute top-0 left-0 w-full h-2 flex justify-between items-center pointer-events-none">
            {[25, 50, 75].map((marker, index) => (
              <div
                key={marker}
                className="w-0.5 h-2 bg-white dark:bg-gray-800 opacity-50"
                style={{ marginLeft: index === 0 ? '25%' : '25%' }}
              />
            ))}
          </div>
        </div>
        
        {/* Entropy information */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Entropy: {strength.entropy} bits</span>
          {!meetsMinStrength && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Minimum: {getStrengthText(minStrength)}
            </span>
          )}
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password Requirements
          </h4>
          <div className="grid grid-cols-1 gap-1">
            {requirementItems.map((item) => (
              <div
                key={item.key}
                className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                  item.met 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}
                role="listitem"
                aria-label={`${item.label}: ${item.met ? 'met' : 'not met'}`}
              >
                <div className={`flex-shrink-0 ${item.met ? 'text-green-500' : 'text-gray-400'}`}>
                  {item.met ? (
                    <CheckIcon className="text-green-500 dark:text-green-400" />
                  ) : (
                    <XIcon className="text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <span className={item.met ? 'line-through opacity-75' : ''}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {strength.feedback.length > 0 && (
        <div 
          className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
          role="alert"
          aria-live="polite"
        >
          <h5 className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
            Suggestions:
          </h5>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            {strength.feedback.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-amber-500 mt-0.5">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success indicator when strong */}
      {strength.level === 'strong' && meetsMinStrength && (
        <div 
          className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <CheckIcon className="text-green-500 dark:text-green-400 flex-shrink-0" />
            <span className="text-xs font-medium text-green-800 dark:text-green-200">
              Excellent! Your password is strong and secure.
            </span>
          </div>
        </div>
      )}
      
      {/* Accessibility: Screen reader only summary */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Password strength is {strength.level} with a score of {strength.score} out of 100. 
        {strength.requirements.length && strength.requirements.uppercase && 
         strength.requirements.lowercase && strength.requirements.numbers && 
         strength.requirements.symbols && strength.requirements.entropy && 
         strength.requirements.common ? 'All requirements are met.' : 
        `${Object.values(strength.requirements).filter(Boolean).length} out of 7 requirements are met.`}
      </div>
    </div>
  );
}