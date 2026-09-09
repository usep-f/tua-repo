import React, { useState, useEffect } from 'react';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Database,
  UserCheck,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Code2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminLoginPageProps {
  onSuccessRedirect: () => void;
  onBackToHome: () => void;
  onOpenSetupGuide: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onSuccessRedirect,
  onBackToHome,
  onOpenSetupGuide,
}) => {
  const {
    signIn,
    signUp,
    signOut,
    isConfigured,
    isAdmin,
    user,
    roleCheckError,
    refreshUserRole,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Role denial details
  const [unauthorizedDetails, setUnauthorizedDetails] = useState<{
    userId: string;
    email: string;
    roleError?: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState<string | null>(null);

  // If already logged in and confirmed admin, redirect immediately
  useEffect(() => {
    if (user && isAdmin) {
      onSuccessRedirect();
    } else if (user && !isAdmin) {
      setUnauthorizedDetails({
        userId: user.id,
        email: user.email || '',
        roleError: roleCheckError || undefined,
      });
    }
  }, [user, isAdmin, roleCheckError, onSuccessRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnauthorizedDetails(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.success) {
          if (res.isAdmin) {
            onSuccessRedirect();
          } else {
            setUnauthorizedDetails({
              userId: res.userId || '',
              email: res.userEmail || email,
              roleError: null,
            });
            setErrorMessage('Access Denied: Your account does not possess administrator privileges in public.user_roles.');
          }
        } else {
          setErrorMessage(res.error || 'Authentication failed. Please check your email and password.');
        }
      } else {
        const res = await signUp(email, password);
        if (res.success) {
          setSuccessMessage(res.message || 'Account created successfully in Supabase.');
          if (res.message?.includes('signed in')) {
            const verified = await refreshUserRole();
            if (verified) {
              setTimeout(() => {
                onSuccessRedirect();
              }, 1000);
            }
          }
        } else {
          setErrorMessage(res.error || 'Failed to create account.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshPermissions = async () => {
    setIsSubmitting(true);
    const verified = await refreshUserRole();
    setIsSubmitting(false);
    if (verified) {
      setSuccessMessage('Administrator role confirmed from public.user_roles! Redirecting to Dashboard...');
      setTimeout(() => onSuccessRedirect(), 1000);
    } else {
      setErrorMessage(
        roleCheckError ||
          'Account is still not verified as admin in public.user_roles. Ensure the row exists and RLS allows SELECT for auth.uid().'
      );
    }
  };

  const rlsPolicySql = `-- 1. Ensure authenticated users can read their own role from public.user_roles:
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);`;

  const roleInsertSql = unauthorizedDetails
    ? `-- 2. Ensure your user ID is registered as 'admin' in public.user_roles:
INSERT INTO public.user_roles (user_id, role)
VALUES ('${unauthorizedDetails.userId}', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';`
    : '';

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(label);
    setTimeout(() => setCopiedSql(null), 2500);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 animate-fadeIn">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 mb-6 text-xs text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Back to Repository</span>
        </button>

        {/* Login Box */}
        <div className="relative p-8 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-blue-950/60 overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <div className="inline-flex items-center justify-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-2xl bg-slate-950/80 border border-emerald-500/30 p-1.5 shadow-lg shadow-emerald-950/30 flex items-center justify-center"
                title="Trinity University of Asia"
              >
                <img
                  src="/assets/trinity.webp"
                  alt="Trinity University of Asia"
                  className="w-full h-full object-contain"
                />
              </div>
              <div
                className="w-12 h-12 rounded-2xl bg-slate-950/80 border border-amber-500/30 p-1.5 shadow-lg shadow-blue-950/30 flex items-center justify-center"
                title="St. Luke's College of Nursing"
              >
                <img
                  src="/assets/college-of-nursing.webp"
                  alt="St. Luke's College of Nursing"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase font-serif">
              THE MALTESE ARCHIVE
            </h1>
            <p className="text-sm font-semibold text-amber-300/90 tracking-wide uppercase mt-1">
              Administrator Access
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Sign in with your administrator account created in Supabase Authentication
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Missing Admin Role Guidance Box */}
          {unauthorizedDetails && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
              <div className="flex items-start gap-2">
                <UserCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-200">Supabase Role Verification</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    User: <strong className="text-white font-mono">{unauthorizedDetails.email}</strong>
                  </p>
                  <p className="text-slate-400 text-[10px] font-mono mt-0.5">
                    auth.uid(): <span className="text-amber-300 select-all">{unauthorizedDetails.userId}</span>
                  </p>
                </div>
              </div>

              {unauthorizedDetails.roleError && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/20 text-red-300 text-[11px]">
                  <strong>Database Result:</strong> {unauthorizedDetails.roleError}
                </div>
              )}

              <p className="text-slate-300 text-[11px] leading-relaxed">
                The application checks <code className="text-amber-300 font-mono">public.user_roles</code> where <code className="text-amber-300 font-mono">user_id = auth.uid()</code>. If you already created this table, ensure Row Level Security permits authenticated users to read their own row, or re-run the role assignment:
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(rlsPolicySql, 'rls')}
                    className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                  >
                    {copiedSql === 'rls' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied RLS Policy!</span>
                      </>
                    ) : (
                      <>
                        <Code2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Copy RLS Policy SQL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(roleInsertSql, 'insert')}
                    className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                  >
                    {copiedSql === 'insert' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied Insert SQL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Copy Role Insert SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRefreshPermissions}
                    disabled={isSubmitting}
                    className="flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>Re-check Role in Database</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      setUnauthorizedDetails(null);
                      setErrorMessage(null);
                    }}
                    className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 text-red-400 transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="admin-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@university.edu"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 transition-all"
                />
                <button
                  id="btn-toggle-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-admin-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 mt-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm tracking-wider uppercase shadow-xl shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>{mode === 'signin' ? 'SIGN IN' : 'CREATE ADMIN ACCOUNT'}</span>
              )}
            </button>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center relative z-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setErrorMessage(null);
                setSuccessMessage(null);
                setUnauthorizedDetails(null);
              }}
              className="text-xs text-slate-400 hover:text-amber-300 transition-colors"
            >
              {mode === 'signin'
                ? 'Setting up a fresh repository? Register initial administrator'
                : 'Already have an administrator account? Sign In'}
            </button>

            <button
              type="button"
              onClick={onOpenSetupGuide}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Supabase Schema, Roles & Storage Setup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
