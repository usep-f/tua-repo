import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  getSupabase,
  getActiveSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  resetSupabaseInstance,
  verifyAdminRoleInDatabase,
} from '../lib/supabase';
import { isTuaEmail, sanitizeAuthError } from '../lib/authUtils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  userRole: 'admin' | 'user' | null;
  roleCheckError: string | null;
  isCheckingRole: boolean;
  isConfigured: boolean;
  connectionError: string | null;
  credentials: { url: string; anonKey: string };
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (val: boolean) => void;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  clearPasswordRecoveryState: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    isAdmin?: boolean;
    userId?: string;
    userEmail?: string;
  }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  refreshUserRole: () => Promise<boolean>;
  saveCredentials: (url: string, anonKey: string) => Promise<boolean>;
  resetCredentials: () => void;
  checkConnection: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [roleCheckError, setRoleCheckError] = useState<string | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState(getActiveSupabaseCredentials());
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  // Helper to verify and set role for a given user directly from public.user_roles
  const checkAndSetUserRole = async (currentUser: User | null): Promise<boolean> => {
    if (!currentUser || !currentUser.id) {
      setIsAdmin(false);
      setUserRole(null);
      setRoleCheckError(null);
      return false;
    }

    setIsCheckingRole(true);
    setRoleCheckError(null);
    try {
      // Query public.user_roles where user_id = auth.uid() (currentUser.id)
      const res = await verifyAdminRoleInDatabase(currentUser);
      const adminStatus = Boolean(res.isAdmin);
      setIsAdmin(adminStatus);
      setUserRole(adminStatus ? 'admin' : 'user');
      if (!adminStatus && res.error) {
        setRoleCheckError(res.error);
      }
      return adminStatus;
    } catch (err: any) {
      console.warn('Notice: Non-admin or unassigned role in public.user_roles:', err?.message);
      setIsAdmin(false);
      setUserRole('user');
      setRoleCheckError(null);
      return false;
    } finally {
      setIsCheckingRole(false);
    }
  };

  // Initialize and check connection
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);
      const creds = getActiveSupabaseCredentials();
      setCredentials(creds);

      if (!creds.url || !creds.anonKey) {
        setIsConfigured(false);
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        setIsConfigured(false);
        setIsLoading(false);
        return;
      }

      setIsConfigured(true);

      try {
        // Subscribe to standard auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted) return;

          console.log('[AuthContext] onAuthStateChange event:', event);

          if (event === 'PASSWORD_RECOVERY') {
            setIsPasswordRecovery(true);
          }

          if (currentSession?.user) {
            const userEmail = currentSession.user.email || '';
            if (!isTuaEmail(userEmail)) {
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
              setIsAdmin(false);
              setUserRole(null);
            } else {
              setSession(currentSession);
              setUser(currentSession.user);
              await checkAndSetUserRole(currentSession.user);
            }
          } else {
            setUser(null);
            setSession(null);
            setIsAdmin(false);
            setUserRole(null);
          }
        });

        // Query initial session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Supabase getSession warning:', error.message);
        }

        if (isMounted && initialSession?.user) {
          const userEmail = initialSession.user.email || '';
          if (!isTuaEmail(userEmail)) {
            console.warn('Session belongs to non-institutional account; signing out.');
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setIsAdmin(false);
            setUserRole(null);
          } else {
            setSession(initialSession);
            setUser(initialSession.user);
            setConnectionError(null);
            await checkAndSetUserRole(initialSession.user);
          }
        }

        return () => {
          subscription.unsubscribe();
        };
      } catch (err: any) {
        console.error('Error connecting to Supabase:', err);
        if (isMounted) {
          setConnectionError(err.message || 'Could not connect to Supabase');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshUserRole = async (): Promise<boolean> => {
    if (!user) return false;
    return await checkAndSetUserRole(user);
  };

  const checkConnection = async (): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('documents').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        console.warn('Supabase ping check:', error.message);
      }
      return true;
    } catch {
      return false;
    }
  };

  const saveCredentialsHandler = async (url: string, anonKey: string): Promise<boolean> => {
    try {
      saveSupabaseCredentials(url, anonKey);
      resetSupabaseInstance();
      setCredentials({ url, anonKey });
      setIsConfigured(true);
      setConnectionError(null);

      const client = getSupabase();
      if (client) {
        const { data } = await client.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await checkAndSetUserRole(data.session.user);
        }
      }
      return true;
    } catch (err: any) {
      setConnectionError(err.message || 'Invalid Supabase connection parameters');
      return false;
    }
  };

  const resetCredentialsHandler = () => {
    clearSupabaseCredentials();
    resetSupabaseInstance();
    setCredentials({ url: '', anonKey: '' });
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setUserRole(null);
    setIsConfigured(false);
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = (email || '').trim();

    // 1. Enforce institutional domain restriction
    if (!isTuaEmail(normalizedEmail)) {
      return {
        success: false,
        error: 'Unable to sign in with this account.',
      };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        error: 'Unable to sign in. Repository service is currently unavailable.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        return {
          success: false,
          error: sanitizeAuthError(error),
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: 'Unable to sign in. Please check your email and password.',
        };
      }

      // 2. Double-check returned user record domain
      if (!isTuaEmail(data.user.email)) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Unable to sign in with this account.',
        };
      }

      setUser(data.user);
      setSession(data.session);

      // 3. Determine user role from public.user_roles
      const hasAdminRole = await checkAndSetUserRole(data.user);

      return {
        success: true,
        isAdmin: hasAdminRole,
        userId: data.user.id,
        userEmail: data.user.email,
      };
    } catch (err: any) {
      return {
        success: false,
        error: sanitizeAuthError(err),
      };
    }
  };

  const signUp = async (email: string, password: string) => {
    const normalizedEmail = (email || '').trim();

    // 1. Enforce institutional domain restriction
    if (!isTuaEmail(normalizedEmail)) {
      return {
        success: false,
        error: 'Unable to sign in with this account.',
      };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        error: 'Repository service is currently unavailable.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        return {
          success: false,
          error: sanitizeAuthError(error),
        };
      }

      if (data.session && data.user) {
        // Enforce domain check on created user
        if (!isTuaEmail(data.user.email)) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Unable to sign in with this account.',
          };
        }

        setUser(data.user);
        setSession(data.session);
        await checkAndSetUserRole(data.user);
        return {
          success: true,
          message: 'Account created and signed in successfully.',
        };
      }

      return {
        success: true,
        message: 'Account created! Please check your institutional email to complete verification if required.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: sanitizeAuthError(err),
      };
    }
  };

  // Standard Supabase Password Reset Flow:
  // Dispatches a password recovery link to the user's institutional email address
  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return {
        success: false,
        message: '',
        error: 'Please enter your institutional email address.',
      };
    }

    if (!isTuaEmail(normalizedEmail)) {
      return {
        success: false,
        message: '',
        error: 'Access is restricted to authorized @tua.edu.ph institutional accounts.',
      };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        message: '',
        error: 'Repository authentication service is currently unavailable.',
      };
    }

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        return {
          success: false,
          message: '',
          error: sanitizeAuthError(error),
        };
      }

      return {
        success: true,
        message: 'A password reset link has been sent to your institutional email. Please check your inbox.',
      };
    } catch (err: any) {
      console.error('Password reset request error:', err);
      return {
        success: false,
        message: '',
        error: sanitizeAuthError(err),
      };
    }
  };

  const updatePassword = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Repository authentication service is currently unavailable.' };
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: sanitizeAuthError(error) };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Update password error:', err);
      return { success: false, error: sanitizeAuthError(err) };
    }
  };

  const clearPasswordRecoveryState = async () => {
    setIsPasswordRecovery(false);
  };

  const signOut = async () => {
    setIsPasswordRecovery(false);
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        userRole,
        roleCheckError,
        isCheckingRole,
        isConfigured,
        connectionError,
        credentials,
        isPasswordRecovery,
        setIsPasswordRecovery,
        requestPasswordReset,
        updatePassword,
        clearPasswordRecoveryState,
        signIn,
        signUp,
        signOut,
        refreshUserRole,
        saveCredentials: saveCredentialsHandler,
        resetCredentials: resetCredentialsHandler,
        checkConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


