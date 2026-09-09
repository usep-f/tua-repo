import React from 'react';
import { ShieldAlert, ArrowLeft, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AccessDeniedPageProps {
  onReturnToRepository: () => void;
  onReturnToHome: () => void;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  onReturnToRepository,
  onReturnToHome,
}) => {
  const { user } = useAuth();

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-red-500/20 p-8 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto mb-5 shadow-lg shadow-red-500/10">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold font-serif text-white tracking-tight mb-2">
          Access Denied
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
          This administrative section is restricted to authorized archive personnel.
          Your account{' '}
          <span className="font-mono text-slate-300 font-medium">
            {user?.email || 'user'}
          </span>{' '}
          does not possess administrator privileges in the database records.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            id="btn-access-denied-repo"
            onClick={onReturnToRepository}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs uppercase tracking-wider transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Go to Repository</span>
          </button>

          <button
            id="btn-access-denied-home"
            onClick={onReturnToHome}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
