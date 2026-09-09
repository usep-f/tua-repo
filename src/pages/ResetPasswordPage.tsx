import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ArrowLeft,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { isTuaEmail, validatePasswordStrength, sanitizeAuthError } from '../lib/authUtils';
import { useAuth } from '../context/AuthContext';

interface ResetPasswordPageProps {
  onReturnToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onReturnToLogin }) => {
  const { clearPasswordRecoveryState, signOut } = useAuth();

  // Page states
  const [isVerifyingLink, setIsVerifyingLink] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form input states
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live password validation
  const strength = useMemo(() => validatePasswordStrength(newPassword), [newPassword]);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmNewPassword;
  const canSubmit = strength.isValid && passwordsMatch && !isSubmitting;

  useEffect(() => {
    let isMounted = true;

    // Check for explicit error parameters sent in URL hash or query by Supabase
    // e.g. #error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
    const checkUrlErrors = (): boolean => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(search);

      const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
      const error = hashParams.get('error') || searchParams.get('error');

      if (errorCode || error) {
        if (errorCode === 'otp_expired' || (errorDesc && errorDesc.toLowerCase().includes('expired'))) {
          setLinkError('This password recovery link has expired. Please request a new link.');
        } else if (errorDesc) {
          setLinkError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
        } else {
          setLinkError('This password recovery link is invalid or has already been used.');
        }
        setIsVerifyingLink(false);
        return true;
      }
      return false;
    };

    if (checkUrlErrors()) {
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLinkError('Repository authentication service is currently unavailable.');
      setIsVerifyingLink(false);
      return;
    }

    // 1. Subscribe to Supabase auth events (specifically PASSWORD_RECOVERY)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log('[ResetPasswordPage] onAuthStateChange event:', event);

      if (event === 'PASSWORD_RECOVERY' || session) {
        if (session?.user) {
          const email = session.user.email || '';
          if (email && !isTuaEmail(email)) {
            setLinkError('This account is not authorized for institutional password recovery.');
            setIsVerifyingLink(false);
            return;
          }
          setUserEmail(email);
        }
        setLinkError(null);
        setIsVerifyingLink(false);
      }
    });

    // 2. Query current session (in case detectSessionInUrl already processed the tokens)
    const verifyInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('[ResetPasswordPage] getSession error:', error);
          if (isMounted) {
            setLinkError(sanitizeAuthError(error));
            setIsVerifyingLink(false);
          }
          return;
        }

        if (session?.user) {
          const email = session.user.email || '';
          if (email && !isTuaEmail(email)) {
            if (isMounted) {
              setLinkError('This account is not authorized for institutional password recovery.');
              setIsVerifyingLink(false);
            }
            return;
          }
          if (isMounted) {
            setUserEmail(email);
            setLinkError(null);
            setIsVerifyingLink(false);
          }
        } else {
          // Give Supabase client a brief moment to finish async hash token extraction
          setTimeout(async () => {
            if (!isMounted) return;
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData?.session?.user) {
              setUserEmail(retryData.session.user.email || '');
              setLinkError(null);
            } else {
              // Check if URL actually had recovery tokens
              const hash = window.location.hash || '';
              const search = window.location.search || '';
              const hasRecoveryToken =
                hash.includes('access_token') ||
                hash.includes('type=recovery') ||
                search.includes('code=') ||
                search.includes('type=recovery');

              if (!hasRecoveryToken) {
                setLinkError(
                  'No active password recovery request found. Please request a new recovery link from the login page.'
                );
              }
            }
            setIsVerifyingLink(false);
          }, 600);
        }
      } catch (err: any) {
        console.error('[ResetPasswordPage] Verification exception:', err);
        if (isMounted) {
          setLinkError('Unable to verify password reset authorization. Please try again.');
          setIsVerifyingLink(false);
        }
      }
    };

    verifyInitialSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Submit new password via Supabase standard updateUser
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!strength.isValid) {
      setSubmitError('Please ensure your password meets all security requirements.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setSubmitError('Passwords do not match. Please re-enter your confirmation password.');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setSubmitError('Repository authentication service is currently unavailable.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Standard Supabase Auth password update
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setSubmitError(sanitizeAuthError(error));
        return;
      }

      // Password updated successfully
      setIsSuccess(true);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      console.error('[ResetPasswordPage] updateUser error:', err);
      setSubmitError(sanitizeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Return to Login handler
  const handleReturnToLogin = async () => {
    try {
      await clearPasswordRecoveryState();
      await signOut();
    } catch {
      // Clean up fallback
    }
    onReturnToLogin();
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

      {/* Centered Recovery Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div
          id="reset-password-card"
          className="w-full max-w-[440px] rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 p-7 sm:p-9"
        >
          {/* 1. Verifying token / checking session state */}
          {isVerifyingLink ? (
            <div className="py-10 text-center space-y-4 animate-fadeIn">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-950 border border-white/10 shadow-lg">
                <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-medium text-slate-200">Verifying Recovery Authorization</h2>
                <p className="text-xs text-slate-400">Connecting to secure institutional auth...</p>
              </div>
            </div>
          ) : linkError ? (
            /* 2. Error State: Expired or Invalid Link */
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-950/40 border border-red-500/20 mb-1 shadow-lg shadow-red-950/20">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white tracking-tight font-serif">
                  Invalid or Expired Link
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {linkError}
                </p>
              </div>

              <div className="pt-2">
                <button
                  id="btn-request-new-link"
                  type="button"
                  onClick={handleReturnToLogin}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Request New Password Reset</span>
                </button>
              </div>
            </div>
          ) : isSuccess ? (
            /* 3. Success State: Password Changed Successfully */
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 mb-1 shadow-lg shadow-emerald-950/30">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <h1 id="reset-success-heading" className="text-2xl font-bold text-white tracking-tight font-serif">
                  Password Updated Successfully
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Your institutional archive password has been updated. You can now use your new password to sign in.
                </p>
              </div>

              <div className="pt-3">
                <button
                  id="btn-return-login"
                  type="button"
                  onClick={handleReturnToLogin}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>Return to Sign In</span>
                </button>
              </div>
            </div>
          ) : (
            /* 4. Active Reset Password Form */
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-blue-900/60 to-slate-900 border border-white/10 mb-4 shadow-lg shadow-blue-950/40">
                  <ShieldCheck className="w-7 h-7 text-amber-400" />
                </div>

                <h1 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight font-serif">
                  Create New Password
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Choose a strong, secure password for your archive account.
                </p>

                {userEmail && (
                  <div className="mt-3 inline-block py-1 px-3 rounded-lg bg-slate-950/60 border border-white/5 font-mono text-xs text-amber-300">
                    {userEmail}
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {submitError && (
                <div
                  id="reset-error-alert"
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{submitError}</div>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} noValidate className="space-y-4">
                {/* New Password */}
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="new-password"
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      autoFocus
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-colors disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirm-new-password"
                      name="confirmNewPassword"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-colors disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                      aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Requirements Checklist */}
                <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3.5 space-y-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Password Requirements
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        strength.checks.length ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 ${
                          strength.checks.length ? 'opacity-100' : 'opacity-30'
                        }`}
                      />
                      <span>At least 8 characters</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        strength.checks.uppercase ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 ${
                          strength.checks.uppercase ? 'opacity-100' : 'opacity-30'
                        }`}
                      />
                      <span>One uppercase letter</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        strength.checks.lowercase ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 ${
                          strength.checks.lowercase ? 'opacity-100' : 'opacity-30'
                        }`}
                      />
                      <span>One lowercase letter</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        strength.checks.number ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 ${
                          strength.checks.number ? 'opacity-100' : 'opacity-30'
                        }`}
                      />
                      <span>One number (0-9)</span>
                    </div>
                  </div>

                  {confirmNewPassword.length > 0 && (
                    <div className="pt-2 mt-1 border-t border-white/5">
                      <div
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          passwordsMatch ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        <Check
                          className={`w-3.5 h-3.5 ${
                            passwordsMatch ? 'opacity-100' : 'opacity-40'
                          }`}
                        />
                        <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Action Button */}
                <div className="pt-2">
                  <button
                    id="btn-update-password"
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Updating password...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleReturnToLogin}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="relative z-10 py-4 px-6 text-center text-[11px] text-slate-400 border-t border-white/5 bg-slate-950/40 backdrop-blur-md flex items-center justify-center gap-2">
        <img src="/assets/trinity.webp" alt="TUA" className="w-4 h-4 object-contain inline-block" />
        <img src="/assets/college-of-nursing.webp" alt="SLCN" className="w-4 h-4 object-contain inline-block" />
        <span>Trinity University of Asia • St. Luke&apos;s College of Nursing Archive</span>
      </footer>
    </div>
  );
};
