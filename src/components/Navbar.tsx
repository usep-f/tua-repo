import React, { useState, useEffect } from 'react';
import {
  Shield,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  FileUp,
  Bookmark,
  Home,
  BookOpen,
  FolderTree,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUserActivity } from '../context/UserActivityContext';

interface NavbarProps {
  currentView: 'home' | 'repository' | 'admin-login' | 'admin-dashboard' | 'admin-upload' | 'admin-manuscripts' | 'student-submit' | 'submission-guidelines' | 'viewer' | 'bookmarks' | 'folders' | 'profile';
  onNavigate: (view: 'home' | 'repository' | 'admin-login' | 'admin-dashboard' | 'admin-upload' | 'admin-manuscripts' | 'student-submit' | 'submission-guidelines' | 'bookmarks' | 'folders' | 'profile') => void;
  onOpenSetupModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
}) => {
  const { user, isAdmin, signOut } = useAuth();
  const { bookmarkedIds } = useUserActivity();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const handleNavClick = (view: 'home' | 'repository' | 'admin-login' | 'admin-dashboard' | 'admin-upload' | 'admin-manuscripts' | 'student-submit' | 'submission-guidelines' | 'bookmarks' | 'folders' | 'profile') => {
    onNavigate(view);
    setSidebarOpen(false);
  };

  return (
    <>
      <nav className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Left: Hamburger Button & Logo / Brand */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                aria-label="Open navigation"
                title="Open navigation"
              >
                <Menu className="w-5 h-5 text-amber-400" />
              </button>

              <div
                id="nav-brand-logo"
                onClick={() => onNavigate('home')}
                className="flex items-center gap-3 cursor-pointer group shrink-0"
              >
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-amber-500 p-0.5 shadow-lg shadow-blue-900/30 group-hover:shadow-amber-500/20 transition-all duration-300">
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                    <div className="text-amber-400 font-serif font-black text-lg group-hover:scale-110 transition-transform">
                      ✛
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-xs sm:text-sm font-bold tracking-wider text-white font-serif uppercase leading-tight group-hover:text-amber-200 transition-colors">
                    THE MALTESE
                  </span>
                  <span className="text-xs sm:text-sm font-bold tracking-wider text-white font-serif uppercase leading-tight group-hover:text-amber-200 transition-colors">
                    ARCHIVE
                  </span>
                  <span className="block text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5 font-sans">
                    NURSING REPOSITORY
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Buttons: User status / Auth pill / Logout */}
            <div className="flex items-center gap-3">
              {isAdmin ? (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('profile')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span className="truncate max-w-[140px] font-mono text-[11px]">{user?.email}</span>
                    <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  </button>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : user ? (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('profile')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-800 transition-all"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="truncate max-w-[160px] font-mono text-[11px]">{user.email}</span>
                  </button>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Collapsible Sidebar / Navigation Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-80 bg-slate-950 border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 to-amber-500 p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center text-amber-400 font-serif font-black">
                ✛
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-serif tracking-wide uppercase">
                Maltese Archive
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">Nursing Repository</p>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            aria-label="Close navigation"
            title="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* User Status Banner inside Sidebar */}
          {user && (
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center gap-3">
              {isAdmin ? (
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <UserIcon className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-200 truncate">{user.email}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {isAdmin ? 'Administrator' : 'Verified User'}
                </p>
              </div>
            </div>
          )}

          {/* MAIN Section */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Main
            </div>
            <div className="space-y-1">
              <button
                onClick={() => handleNavClick('home')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentView === 'home'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Home className={`w-4 h-4 ${currentView === 'home' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Home</span>
              </button>

              <button
                onClick={() => handleNavClick('repository')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentView === 'repository'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <BookOpen className={`w-4 h-4 ${currentView === 'repository' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Repository</span>
              </button>
            </div>
          </div>

          {/* LIBRARY Section */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Library
            </div>
            <div className="space-y-1">
              <button
                onClick={() => handleNavClick('bookmarks')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentView === 'bookmarks'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bookmark className={`w-4 h-4 ${currentView === 'bookmarks' ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                  <span>Bookmarked Files</span>
                </div>
                {bookmarkedIds.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {bookmarkedIds.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleNavClick('folders')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentView === 'folders'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <FolderTree className={`w-4 h-4 ${currentView === 'folders' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Folders / Collections</span>
              </button>

              {!isAdmin && user && (
                <button
                  onClick={() => handleNavClick('student-submit')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    currentView === 'student-submit'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <FileUp className={`w-4 h-4 ${currentView === 'student-submit' ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>Submit Manuscript</span>
                </button>
              )}

              <button
                onClick={() => handleNavClick('submission-guidelines')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  currentView === 'submission-guidelines'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <BookOpen className={`w-4 h-4 ${currentView === 'submission-guidelines' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Submission Guidelines</span>
              </button>
            </div>
          </div>

          {/* ACCOUNT Section */}
          {user && (
            <div>
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Account
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleNavClick('profile')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    currentView === 'profile'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <UserIcon className={`w-4 h-4 ${currentView === 'profile' ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>Profile</span>
                </button>
              </div>
            </div>
          )}

          {/* ADMIN Section */}
          {isAdmin && (
            <div>
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-amber-500/80 font-mono">
                Administration
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleNavClick('admin-dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    currentView === 'admin-dashboard'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                      : 'text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10'
                  }`}
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Admin Dashboard</span>
                </button>

                <button
                  onClick={() => handleNavClick('admin-upload')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    currentView === 'admin-upload'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                      : 'text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10'
                  }`}
                >
                  <FileUp className="w-4 h-4 text-amber-400" />
                  <span>Upload Document</span>
                </button>

                <button
                  onClick={() => handleNavClick('admin-manuscripts')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    currentView === 'admin-manuscripts'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                      : 'text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10'
                  }`}
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Manuscript Submissions</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer / Sign Out */}
        {user && (
          <div className="p-4 border-t border-white/10 bg-slate-950/50">
            <button
              onClick={() => {
                signOut();
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};


