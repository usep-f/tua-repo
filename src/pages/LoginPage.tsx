import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ArrowLeft,
  KeyRound,
  Check,
  ShieldCheck,
  RefreshCw,
  MailCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isTuaEmail, validatePasswordStrength } from '../lib/authUtils';

interface LoginPageProps {
  onSuccess: () => void;
  initialRecovery?: boolean;
}

type RecoveryStep = 'request' | 'sent';

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const {
    signIn,
    signUp,
    requestPasswordReset,
  } = useAuth();

  // Primary mode: 'auth' (standard signin / signup) vs 'recovery' (password recovery flow)
  const [authFlow, setAuthFlow] = useState<'auth' | 'recovery'>('auth');

  // Authentication states
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Recovery flow states:
  // 'request': Enter email -> Send Reset Link
  // 'sent': Confirmation screen with resend link
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('request');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Shared status feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('maltese_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  // Standard Login / Registration submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      try {
        if (rememberMe) {
          localStorage.setItem('maltese_remembered_email', trimmedEmail);
        } else {
          localStorage.removeItem('maltese_remembered_email');
        }
      } catch {
        // Storage optional
      }

      if (mode === 'signin') {
        const result = await signIn(trimmedEmail, password);
        if (result.success) {
          onSuccess();
        } else {
          setErrorMessage(result.error || 'Failed to sign in. Please verify your credentials.');
        }
      } else {
        const result = await signUp(trimmedEmail, password);
        if (result.success) {
          setSuccessMessage(
            result.message || 'Registration successful! Please check your institutional email to confirm your account.'
          );
          setMode('signin');
          setPassword('');
          setConfirmPassword('');
        } else {
          setErrorMessage(result.error || 'Registration failed. Please try again.');
        }
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request Supabase password reset link
  const handleRequestResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmed = recoveryEmail.trim().toLowerCase();
    if (!trimmed) {
      setErrorMessage('Please enter your institutional email address.');
      return;
    }

    // Explicit institutional restriction
    if (!isTuaEmail(trimmed)) {
      setErrorMessage('Only authorized Trinity University of Asia accounts (@tua.edu.ph) are permitted.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(trimmed);
      if (res.success) {
        setRecoveryStep('sent');
        setResendCooldown(60);
      } else {
        setErrorMessage(res.error || 'Unable to send password reset email. Please try again.');
      }
    } catch {
      setErrorMessage('Unable to process your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend recovery email
  const handleResendLink = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await requestPasswordReset(recoveryEmail.trim());
      if (res.success) {
        setSuccessMessage('A fresh password reset link has been dispatched to your email.');
        setResendCooldown(60);
      } else {
        setErrorMessage(res.error || 'Unable to resend reset link.');
      }
    } catch {
      setErrorMessage('Unable to resend reset link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel recovery and go back to Sign In
  const handleCancelRecovery = () => {
    setAuthFlow('auth');
    setRecoveryStep('request');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#050c1a] text-slate-100 relative overflow-hidden">
      {/* Subtle academic background ambiance */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-blue-900/15 blur-[120px] rounded-full" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/5 blur-[100px] rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Institutional Top Brand Header */}
      <header className="relative z-10 py-6 px-6 sm:px-12 flex items-center justify-between border-b border-white/5 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center p-1 shadow-md" title="Trinity University of Asia">
              <img src="/assets/trinity.webp" alt="Trinity University of Asia" className="w-full h-full object-contain" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center p-1 shadow-md" title="St. Luke's College of Nursing">
              <img src="/assets/college-of-nursing.webp" alt="College of Nursing" className="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <span className="font-serif font-bold tracking-wider text-slate-200 uppercase text-sm sm:text-base">
              THE MALTESE ARCHIVE
            </span>
            <span className="block text-[10px] tracking-widest text-slate-400 font-sans uppercase">
              Nursing Repository
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <BookOpen className="w-3.5 h-3.5 text-amber-400/80" />
          <span className="hidden sm:inline">Research & Theses Portal</span>
        </div>
      </header>

      {/* Centered Authentication Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div
          id="auth-card"
          className="w-full max-w-[440px] rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 p-7 sm:p-9"
        >
          {/* ========================================================================= */}
          {/* 1. PASSWORD RECOVERY FLOW                                                 */}
          {/* ========================================================================= */}
          {authFlow === 'recovery' ? (
            <div className="space-y-6">
              {/* Recovery Header */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-blue-900/60 to-slate-900 border border-white/10 mb-4 shadow-lg shadow-blue-950/40">
                  {recoveryStep === 'sent' ? (
                    <MailCheck className="w-7 h-7 text-amber-400" />
                  ) : (
                    <KeyRound className="w-7 h-7 text-amber-400" />
                  )}
                </div>

                <h1
                  id="recovery-heading"
                  className="text-2xl sm:text-[26px] font-bold text-white tracking-tight font-serif"
                >
                  {recoveryStep === 'request' && 'Forgot your password?'}
                  {recoveryStep === 'sent' && 'Check Your Email'}
                </h1>

                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  {recoveryStep === 'request' &&
                    'Enter the email address associated with your account to receive a secure password reset link.'}
                  {recoveryStep === 'sent' &&
                    'A password recovery link has been dispatched to your institutional inbox.'}
                </p>
              </div>

              {/* Status & Error Feedback */}
              {errorMessage && (
                <div
                  id="recovery-error-alert"
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div
                  id="recovery-success-alert"
                  role="status"
                  className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{successMessage}</div>
                </div>
              )}

              {/* STEP 1: Enter Email -> Send Reset Link */}
              {recoveryStep === 'request' && (
                <form onSubmit={handleRequestResetLink} noValidate className="space-y-4">
                  <div>
                    <label
                      htmlFor="recovery-email"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="recovery-email"
                        name="recoveryEmail"
                        type="email"
                        autoComplete="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="student@tua.edu.ph"
                        disabled={isSubmitting}
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-colors disabled:opacity-60"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Only valid <span className="text-slate-400 font-mono">@tua.edu.ph</span> accounts are eligible for password recovery.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      id="btn-send-reset-link"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Sending reset link...</span>
                        </>
                      ) : (
                        <span>Send Reset Link</span>
                      )}
                    </button>
                  </div>

                  <div className="pt-3 text-center">
                    <button
                      type="button"
                      id="btn-back-to-signin-step1"
                      onClick={handleCancelRecovery}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Email Dispatched Screen */}
              {recoveryStep === 'sent' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-slate-300 space-y-2 text-center leading-relaxed">
                    <p className="text-slate-400">
                      Recovery link sent to:
                    </p>
                    <div className="inline-block py-1 px-3 rounded-lg bg-slate-900 border border-white/5 font-mono text-amber-300 font-medium text-xs break-all">
                      {recoveryEmail}
                    </div>
                    <p className="text-slate-400 pt-1 text-[11px]">
                      Open the email and click the recovery link to set your new password.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      id="btn-resend-reset-link"
                      onClick={handleResendLink}
                      disabled={resendCooldown > 0 || isSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                      <span>
                        {resendCooldown > 0
                          ? `Resend Link (${resendCooldown}s)`
                          : "Didn't receive the email? Resend Link"}
                      </span>
                    </button>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={handleCancelRecovery}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Return to Sign In</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. STANDARD AUTH FLOW (SIGN IN / CREATE ACCOUNT)                          */
            /* ========================================================================= */
            <>
              {/* Emblem & Title */}
              <div className="text-center mb-7">
                <div className="inline-flex items-center justify-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-950/60 to-slate-900 border border-emerald-500/20 p-1.5 shadow-lg shadow-emerald-950/40 flex items-center justify-center" title="Trinity University of Asia">
                    <img
                      src="/assets/trinity.webp"
                      alt="Trinity University of Asia"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-blue-900/60 to-slate-900 border border-amber-500/20 p-1.5 shadow-lg shadow-blue-950/40 flex items-center justify-center" title="St. Luke's College of Nursing">
                    <img
                      src="/assets/college-of-nursing.webp"
                      alt="College of Nursing"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <h1
                  id="login-heading"
                  className="text-2xl sm:text-[26px] font-bold text-white tracking-tight font-serif"
                >
                  {mode === 'signin' ? 'Hello and Welcome' : 'Create Account'}
                </h1>

                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  {mode === 'signin'
                    ? 'Sign in to continue to The Maltese Archive.'
                    : 'Register your account to access repository theses and presentations.'}
                </p>
              </div>

              {/* Feedback messages */}
              {errorMessage && (
                <div
                  id="auth-error-alert"
                  role="alert"
                  className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div
                  id="auth-success-alert"
                  role="status"
                  className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{successMessage}</div>
                </div>
              )}

              {/* Authentication Form */}
              <form onSubmit={handleAuthSubmit} noValidate className="space-y-4">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@tua.edu.ph"
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-colors disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-colors disabled:opacity-60"
                    />
                    <button
                      type="button"
                      id="btn-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password (only on signup mode) */}
                {mode === 'signup' && (
                  <div className="animate-fadeIn">
                    <label
                      htmlFor="login-confirm-password"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="login-confirm-password"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-colors disabled:opacity-60"
                      />
                    </div>
                  </div>
                )}

                {/* Remember Me & Forgot Password Row */}
                {mode === 'signin' && (
                  <div className="flex items-center justify-between pt-1">
                    <label
                      htmlFor="remember-me"
                      className="flex items-center gap-2 cursor-pointer select-none group"
                    >
                      <input
                        id="remember-me"
                        name="rememberMe"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400/50 focus:ring-offset-0 focus:ring-1"
                      />
                      <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                        Remember me
                      </span>
                    </label>

                    {/* Subtle Forgot Password Link */}
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => {
                        setAuthFlow('recovery');
                        setRecoveryStep('request');
                        setRecoveryEmail(email ? email.trim() : '');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-amber-400/90 hover:text-amber-300 font-medium transition-colors focus:outline-none"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="pt-2">
                  <button
                    id="btn-auth-submit"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>{mode === 'signin' ? 'Signing in...' : 'Registering...'}</span>
                      </>
                    ) : (
                      <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Mode Toggle */}
              <div className="mt-6 pt-5 border-t border-white/10 text-center">
                {mode === 'signin' ? (
                  <p className="text-xs text-slate-400">
                    First time accessing the repository?{' '}
                    <button
                      type="button"
                      id="btn-switch-to-signup"
                      onClick={() => {
                        setMode('signup');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-medium transition-colors focus:outline-none"
                    >
                      Create account
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Already registered?{' '}
                    <button
                      type="button"
                      id="btn-switch-to-signin"
                      onClick={() => {
                        setMode('signin');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-medium transition-colors focus:outline-none"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Institutional Footer */}
      <footer className="relative z-10 py-5 px-6 text-center text-xs text-slate-400 border-t border-white/5 bg-slate-950/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img src="/assets/trinity.webp" alt="Trinity University of Asia" className="w-4 h-4 object-contain" />
            <img src="/assets/college-of-nursing.webp" alt="College of Nursing" className="w-4 h-4 object-contain" />
            <span className="font-serif tracking-wider uppercase text-slate-300">
              THE MALTESE ARCHIVE
            </span>
            <span className="text-slate-500">|</span>
            <span>College of Nursing</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Official Research & Grand Case Presentation Archive
          </div>
        </div>
      </footer>
    </div>
  );
};
