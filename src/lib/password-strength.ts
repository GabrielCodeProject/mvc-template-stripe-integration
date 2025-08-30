/**
 * Password strength utilities for comprehensive password validation
 * Includes Shannon entropy calculation, common password detection, and pattern analysis
 */

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

// Common passwords list (subset for client-side validation)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', '12345678', '12345',
  'qwerty', 'abc123', 'password123', 'admin', 'letmein',
  'welcome', 'monkey', '1234567890', 'dragon', 'master',
  'hello', 'login', 'pass', 'password1', '123123',
  'football', 'baseball', 'welcome123', 'sunshine', 'iloveyou',
  'princess', 'admin123', 'test', 'guest', 'user',
  '000000', '111111', '123321', '654321', '696969'
]);

// Common keyboard patterns
const KEYBOARD_PATTERNS = [
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  '1234567890', 'qwerty', 'asdf', 'zxcv',
  'qwe', 'asd', 'zxc', '123', '456', '789'
];

/**
 * Calculate Shannon entropy of a string
 * Higher entropy indicates more randomness/complexity
 */
function calculateEntropy(password: string): number {
  const chars = password.split('');
  const frequencies: Record<string, number> = {};
  
  // Count character frequencies
  chars.forEach(char => {
    frequencies[char] = (frequencies[char] || 0) + 1;
  });
  
  // Calculate entropy
  let entropy = 0;
  const length = password.length;
  
  Object.values(frequencies).forEach(count => {
    const probability = count / length;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  });
  
  return entropy * length; // Total entropy
}

/**
 * Check if password contains common patterns
 */
function hasCommonPatterns(password: string): boolean {
  const lower = password.toLowerCase();
  
  // Check keyboard patterns
  for (const pattern of KEYBOARD_PATTERNS) {
    if (lower.includes(pattern) || lower.includes(pattern.split('').reverse().join(''))) {
      return true;
    }
  }
  
  // Check sequential numbers
  if (/(\d)\1{2,}/.test(password)) return true; // Repeated digits
  if (/0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210/.test(password)) {
    return true;
  }
  
  // Check sequential letters
  if (/abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz/.test(lower)) {
    return true;
  }
  
  return false;
}

/**
 * Check if password is a common password
 */
function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  
  // Exact match
  if (COMMON_PASSWORDS.has(lower)) return true;
  
  // Check with common number suffixes
  const basePassword = lower.replace(/\d+$/, '');
  if (COMMON_PASSWORDS.has(basePassword)) return true;
  
  // Check reversed common passwords
  const reversed = lower.split('').reverse().join('');
  if (COMMON_PASSWORDS.has(reversed)) return true;
  
  return false;
}

/**
 * Get character set size for entropy calculation
 * Note: Currently unused but kept for potential future enhancements
 */
// function getCharacterSetSize(password: string): number {
//   let size = 0;
//   
//   if (/[a-z]/.test(password)) size += 26;
//   if (/[A-Z]/.test(password)) size += 26;
//   if (/\d/.test(password)) size += 10;
//   if (/[^A-Za-z0-9]/.test(password)) size += 32; // Common symbols
//   
//   return size;
// }

/**
 * Calculate comprehensive password strength
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      level: 'weak',
      entropy: 0,
      feedback: ['Password is required'],
      requirements: {
        length: false,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
        entropy: false,
        common: true
      }
    };
  }

  // Calculate requirements
  const requirements: PasswordRequirements = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[^A-Za-z0-9]/.test(password),
    entropy: false, // Will be calculated below
    common: !isCommonPassword(password) && !hasCommonPatterns(password)
  };

  // Calculate entropy
  const entropy = calculateEntropy(password);
  requirements.entropy = entropy >= 50;

  // Generate feedback
  const feedback: string[] = [];
  if (!requirements.length) feedback.push('Use at least 12 characters');
  if (!requirements.uppercase) feedback.push('Include uppercase letters (A-Z)');
  if (!requirements.lowercase) feedback.push('Include lowercase letters (a-z)');
  if (!requirements.numbers) feedback.push('Include numbers (0-9)');
  if (!requirements.symbols) feedback.push('Include symbols (!@#$%^&*)');
  if (!requirements.entropy) feedback.push('Increase complexity and randomness');
  if (!requirements.common) feedback.push('Avoid common passwords and patterns');

  // Calculate score based on requirements and entropy
  const requirementScore = Object.values(requirements).filter(Boolean).length;
  let score = (requirementScore / 7) * 70; // 70% weight for requirements

  // Add entropy bonus
  const entropyBonus = Math.min(30, (entropy / 80) * 30); // 30% weight for entropy
  score += entropyBonus;

  // Penalties for common patterns or passwords
  if (!requirements.common) {
    score *= 0.5;
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine strength level
  let level: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 25) level = 'weak';
  else if (score < 50) level = 'fair';
  else if (score < 75) level = 'good';
  else level = 'strong';

  return {
    score,
    level,
    entropy: Math.round(entropy * 10) / 10,
    feedback,
    requirements
  };
}

/**
 * Get color class for password strength level
 */
export function getStrengthColor(level: 'weak' | 'fair' | 'good' | 'strong'): string {
  switch (level) {
    case 'weak': return 'bg-red-500 dark:bg-red-600';
    case 'fair': return 'bg-yellow-500 dark:bg-yellow-600';
    case 'good': return 'bg-blue-500 dark:bg-blue-600';
    case 'strong': return 'bg-green-500 dark:bg-green-600';
  }
}

/**
 * Get text color class for password strength level
 */
export function getStrengthTextColor(level: 'weak' | 'fair' | 'good' | 'strong'): string {
  switch (level) {
    case 'weak': return 'text-red-600 dark:text-red-400';
    case 'fair': return 'text-yellow-600 dark:text-yellow-400';
    case 'good': return 'text-blue-600 dark:text-blue-400';
    case 'strong': return 'text-green-600 dark:text-green-400';
  }
}

/**
 * Get strength level display text
 */
export function getStrengthText(level: 'weak' | 'fair' | 'good' | 'strong'): string {
  switch (level) {
    case 'weak': return 'Weak';
    case 'fair': return 'Fair';
    case 'good': return 'Good';
    case 'strong': return 'Strong';
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}