import React, { useState } from 'react';
import {
  X,
  Database,
  Key,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Server,
  FolderTree,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_SETUP_SQL } from '../lib/supabase';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { credentials, saveCredentials, resetCredentials, isConfigured, checkConnection } = useAuth();
  const [urlInput, setUrlInput] = useState(credentials.url);
  const [keyInput, setKeyInput] = useState(credentials.anonKey);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const cleanUrl = urlInput.trim();
    const cleanKey = keyInput.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({ success: false, msg: 'Both Supabase URL and Anon Key are required.' });
      setTesting(false);
      return;
    }

    try {
      const saved = await saveCredentials(cleanUrl, cleanKey);
      if (saved) {
        setTestResult({
          success: true,
          msg: 'Connected to Supabase! You can now authenticate and upload documents.',
        });
      } else {
        setTestResult({ success: false, msg: 'Could not connect to Supabase with provided details.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: err.message || 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-950/60 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-serif">Supabase Backend Configuration</h2>
              <p className="text-xs text-slate-400">PostgreSQL Database, Storage Bucket & Authentication</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                isConfigured ? 'bg-emerald-400 shadow-lg shadow-emerald-400/30 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-slate-200">
              {isConfigured ? 'Supabase Credentials Active' : 'Supabase Not Connected Yet'}
            </span>
          </div>

          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px]"
          >
            <span>Supabase Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSave} className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Supabase Project URL
            </label>
            <input
              type="url"
              required
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://xyzproject.supabase.co"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Supabase Public Anon Key (Project Settings → API → anon public)
            </label>
            <input
              type="password"
              required
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-amber-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Never use the secret service-role key. Only public anon key is safe in client code.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                resetCredentials();
                setUrlInput('');
                setKeyInput('');
                setTestResult(null);
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear Stored Credentials
            </button>

            <button
              type="submit"
              disabled={testing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {testing ? 'Testing Connection...' : 'Save & Connect Supabase'}
            </button>
          </div>
        </form>

        {/* SQL Migration Script Copy Box */}
        <div className="pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>SQL Tables, Admin Roles & Storage Setup Script</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Run this in your Supabase SQL Editor. It sets up <code className="text-amber-300">documents</code>, role management via <code className="text-amber-300">user_roles</code>, and RLS security policies.
              </p>
            </div>

            <button
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL</span>
                </>
              )}
            </button>
          </div>

          <div className="mb-3 p-3 rounded-xl bg-blue-950/40 border border-blue-500/20 text-blue-200 text-[11px]">
            <p className="font-semibold text-blue-300">How to designate your user as Admin:</p>
            <ol className="list-decimal list-inside space-y-1 mt-1 text-slate-300">
              <li>Create your user in <strong className="text-white">Supabase Dashboard → Authentication → Users</strong></li>
              <li>In Supabase SQL Editor, run the setup script below to create the SELECT policy on <code className="text-amber-300 font-mono">public.user_roles</code> allowing authenticated users to read their role: <code className="text-amber-300 font-mono">CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);</code></li>
              <li>Insert your admin role: <code className="text-amber-300 font-mono">INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = 'your-email@domain.com' ON CONFLICT (user_id) DO UPDATE SET role = 'admin';</code></li>
            </ol>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-48 leading-relaxed">
            {SUPABASE_SETUP_SQL}
          </pre>
        </div>
      </div>
    </div>
  );
};
