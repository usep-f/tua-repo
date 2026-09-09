/**
 * Authentication and authorization utilities for The Maltese Archive.
 * Enforces email domain restrictions and university identity validation.
 */

// Official Trinity University of Asia domain
const TUA_DOMAIN = '@tua.edu.ph';

/**
 * Validates whether an email belongs to the required institutional domain
 * or authorized administrator account.
 * Performed case-insensitively to prevent capitalization edge cases.
 */
export function isTuaEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalized = email.trim().toLowerCase();

  // Allow developer / primary administrator account
  if (normalized === 'songhyoki19@gmail.com') {
    return true;
  }

  // Basic email structure check before domain inspection
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@tua\.edu\.ph$/i;
  if (!emailRegex.test(normalized)) {
    return false;
  }

  return normalized.endsWith(TUA_DOMAIN) && normalized.length > TUA_DOMAIN.length;
}

/**
 * Password strength rules for secure repository accounts.
 */
export interface PasswordStrengthResult {
  isValid: boolean;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
  };
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isValid = checks.length && checks.uppercase && checks.lowercase && checks.number;
  return { isValid, checks };
}

/**
 * Maps raw auth errors to professional, user-friendly messages.
 * Does not expose raw JSON or internal technical stack traces.
 */
export function sanitizeAuthError(error: any): string {
  if (!error) return 'An unexpected error occurred during authentication.';

  const message = typeof error === 'string' ? error : error.message || '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid_grant') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('wrong password')
  ) {
    return 'Unable to sign in. Please check your email and password.';
  }

  if (
    normalized.includes('token') && (normalized.includes('expired') || normalized.includes('invalid')) ||
    normalized.includes('otp') && (normalized.includes('expired') || normalized.includes('invalid')) ||
    normalized.includes('recovery link') ||
    normalized.includes('link is invalid') ||
    normalized.includes('link has expired')
  ) {
    return 'This password recovery link is invalid or has expired. Please request a new link.';
  }

  if (
    normalized.includes('different from') ||
    normalized.includes('same password') ||
    normalized.includes('should be different')
  ) {
    return 'Your new password cannot be the same as your previous password.';
  }

  if (normalized.includes('email not confirmed') || normalized.includes('unconfirmed')) {
    return 'Please check your institutional email to confirm your account before signing in.';
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('too many attempts') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('security purposes')
  ) {
    return 'Too many attempts. For security purposes, please wait a few moments before trying again.';
  }

  if (normalized.includes('user already registered') || normalized.includes('already exists')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }

  if (normalized.includes('password should be at least')) {
    return 'Password must be at least 8 characters long and contain letters and numbers.';
  }

  return 'Unable to complete request. Please verify your information and try again.';
}

