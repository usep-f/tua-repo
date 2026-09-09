import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserActivityProvider } from './context/UserActivityContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { RepositoryPage } from './pages/RepositoryPage';
import { DocumentViewerPage } from './pages/DocumentViewerPage';
import { BookmarkedPage } from './pages/BookmarkedPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUploadPage } from './pages/AdminUploadPage';
import { AdminSubmissionsPage } from './pages/AdminSubmissionsPage';
import { StudentSubmitPage } from './pages/StudentSubmitPage';
import { SubmissionGuidelinesPage } from './pages/SubmissionGuidelinesPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { FoldersPage } from './pages/FoldersPage';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { NursingDocument, RepositoryFilters } from './types';

export type AppView =
  | 'login'
  | 'reset-password'
  | 'home'
  | 'repository'
  | 'viewer'
  | 'bookmarks'
  | 'folders'
  | 'profile'
  | 'admin-dashboard'
  | 'admin-upload'
  | 'admin-manuscripts'
  | 'student-submit'
  | 'submission-guidelines'
  | 'access-denied';

function MainContent() {
  const { user, isAdmin, signOut, isLoading, isPasswordRecovery } = useAuth();

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedDocument, setSelectedDocument] = useState<NursingDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<NursingDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  const [repoFilters, setRepoFilters] = useState<Partial<RepositoryFilters>>({});

  // Sync with browser URL pathname and search parameters
  const handleUrlRoute = useCallback(() => {
    const pathname = window.location.pathname.toLowerCase();
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const params = new URLSearchParams(search);
    const docId = params.get('doc');
    const viewParam = params.get('view') as AppView;

    // Route: password recovery link or /reset-password route
    const isResetRoute =
      pathname === '/reset-password' ||
      pathname === '/reset-password/' ||
      hash.includes('type=recovery') ||
      search.includes('type=recovery') ||
      isPasswordRecovery;

    if (isResetRoute) {
      setCurrentView('reset-password');
      return;
    }

    if (!user) return;

    // If an authenticated user visits /login, redirect to home
    if (pathname === '/login') {
      window.history.replaceState(null, '', '/');
      setCurrentView('home');
      return;
    }

    if (docId) {
      setCurrentView('viewer');
    } else if (
      pathname === '/admin' ||
      pathname === '/admin/' ||
      viewParam === 'admin-dashboard'
    ) {
      if (isAdmin) {
        setCurrentView('admin-dashboard');
      } else {
        setCurrentView('access-denied');
      }
    } else if (
      pathname === '/admin/upload' ||
      pathname === '/admin/upload/' ||
      viewParam === 'admin-upload'
    ) {
      if (isAdmin) {
        setCurrentView('admin-upload');
      } else {
        setCurrentView('access-denied');
      }
    } else if (
      pathname === '/repository' ||
      pathname === '/repository/' ||
      viewParam === 'repository'
    ) {
      setCurrentView('repository');
    } else if (
      pathname === '/bookmarks' ||
      pathname === '/bookmarks/' ||
      viewParam === 'bookmarks'
    ) {
      setCurrentView('bookmarks');
    } else if (
      pathname === '/folders' ||
      pathname === '/folders/' ||
      viewParam === 'folders'
    ) {
      setCurrentView('folders');
    } else if (
      pathname === '/profile' ||
      pathname === '/profile/' ||
      viewParam === 'profile'
    ) {
      setCurrentView('profile');
    } else if (viewParam) {
      setCurrentView(viewParam);
    } else {
      setCurrentView('home');
    }
  }, [user, isAdmin, isPasswordRecovery]);

  useEffect(() => {
    handleUrlRoute();

    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, [handleUrlRoute]);

  // Open Preview Modal
  const handlePreviewDocument = (doc: NursingDocument) => {
    setPreviewDocument(doc);
    setIsPreviewOpen(true);
  };

  // Open Dedicated Full Document Viewer Page
  const handleOpenFullDocument = (doc: NursingDocument) => {
    setSelectedDocument(doc);
    setCurrentView('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigation handler with URL sync and permission checks
  const handleNavigate = (view: any) => {
    // Protected admin routes check
    if (view === 'admin-dashboard' || view === 'admin-upload' || view === 'admin-manuscripts') {
      if (!isAdmin) {
        if (window.location.pathname !== '/admin') {
          window.history.pushState(null, '', '/admin');
        }
        setCurrentView('access-denied');
        return;
      }

      if (window.location.pathname !== '/admin') {
        window.history.pushState(null, '', '/admin');
      }
    } else if (view === 'student-submit') {
      if (window.location.pathname !== '/student-submit') {
        window.history.pushState(null, '', '/student-submit');
      }
    } else if (view === 'submission-guidelines') {
      if (window.location.pathname !== '/submission-guidelines') {
        window.history.pushState(null, '', '/submission-guidelines');
      }
    } else if (view === 'repository') {
      if (window.location.pathname !== '/repository') {
        window.history.pushState(null, '', '/repository');
      }
    } else if (view === 'bookmarks') {
      if (window.location.pathname !== '/bookmarks') {
        window.history.pushState(null, '', '/bookmarks');
      }
    } else if (view === 'folders') {
      if (window.location.pathname !== '/folders') {
        window.history.pushState(null, '', '/folders');
      }
    } else if (view === 'profile') {
      if (window.location.pathname !== '/profile') {
        window.history.pushState(null, '', '/profile');
      }
    } else if (view === 'home') {
      if (window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
      }
    }

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Homepage search action
  const handleHeroSearch = (query: string) => {
    setRepoFilters({ query, page: 1 });
    handleNavigate('repository');
  };

  // Homepage quick card select
  const handleSelectDocType = (type: 'Thesis' | 'Grand Case Presentation') => {
    setRepoFilters({ documentType: type, page: 1 });
    handleNavigate('repository');
  };

  const handleLogout = async () => {
    await signOut();
    window.history.replaceState(null, '', '/login');
    setCurrentView('login');
  };

  // 1. Loading state while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050c1a] text-slate-100 flex flex-col items-center justify-center p-6 select-none">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center mb-5 shadow-2xl shadow-blue-950/60">
          <span className="text-amber-400 font-serif font-black text-3xl animate-pulse">✛</span>
        </div>
        <h1 className="font-serif text-lg tracking-widest text-slate-200 uppercase font-bold mb-2">
          THE MALTESE ARCHIVE
        </h1>
        <p className="text-xs text-slate-400 font-sans tracking-wide">
          Verifying institutional session...
        </p>
      </div>
    );
  }

  // 2. Password Reset route & recovery state
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const currentHash = typeof window !== 'undefined' ? window.location.hash : '';
  const currentSearch = typeof window !== 'undefined' ? window.location.search : '';

  const isResetPasswordView =
    currentView === 'reset-password' ||
    currentPath === '/reset-password' ||
    currentPath === '/reset-password/' ||
    currentHash.includes('type=recovery') ||
    currentSearch.includes('type=recovery') ||
    isPasswordRecovery;

  if (isResetPasswordView) {
    return (
      <ResetPasswordPage
        onReturnToLogin={() => {
          window.history.replaceState(null, '', '/login');
          setCurrentView('login');
        }}
      />
    );
  }

  // 3. Unauthenticated state: display login page
  if (!user) {
    if (currentPath !== '/login') {
      window.history.replaceState(null, '', '/login');
    }
    return (
      <LoginPage
        onSuccess={() => {
          window.history.replaceState(null, '', '/');
          setCurrentView('home');
        }}
      />
    );
  }

  // 4. Authenticated state: render full repository application
  return (
    <div className="min-h-screen flex flex-col bg-[#050c1a] text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 w-full overflow-x-hidden">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenSetupModal={() => setIsSetupModalOpen(true)}
      />

      {/* Main Views */}
      <main className="flex-1 w-full min-w-0">
        {currentView === 'home' && (
          <HomePage
            onSearchSubmit={handleHeroSearch}
            onSelectDocumentType={handleSelectDocType}
            onBrowseAll={() => {
              setRepoFilters({});
              setCurrentView('repository');
            }}
            onPreviewDocument={handlePreviewDocument}
            onOpenFullDocument={handleOpenFullDocument}
          />
        )}

        {currentView === 'repository' && (
          <RepositoryPage
            initialFilters={repoFilters}
            onPreviewDocument={handlePreviewDocument}
            onOpenFullDocument={handleOpenFullDocument}
          />
        )}

        {currentView === 'viewer' && (
          <DocumentViewerPage
            documentId={selectedDocument?.id || ''}
            initialDocument={selectedDocument}
            onBack={() => setCurrentView('repository')}
          />
        )}

        {currentView === 'bookmarks' && (
          <BookmarkedPage
            onPreviewDocument={handlePreviewDocument}
            onOpenFullDocument={handleOpenFullDocument}
            onBrowseRepository={() => handleNavigate('repository')}
            onReturnHome={() => handleNavigate('home')}
            onNavigateFolders={() => handleNavigate('folders')}
          />
        )}

        {currentView === 'folders' && (
          <FoldersPage
            onNavigateBookmarks={() => handleNavigate('bookmarks')}
            onBrowseRepository={() => handleNavigate('repository')}
            onReturnHome={() => handleNavigate('home')}
            onPreviewDocument={handlePreviewDocument}
            onOpenFullDocument={handleOpenFullDocument}
          />
        )}

        {currentView === 'profile' && (
          <ProfilePage
            onBackToHome={() => handleNavigate('home')}
            onBrowseRepository={() => handleNavigate('repository')}
          />
        )}

        {currentView === 'access-denied' && (
          <AccessDeniedPage
            onReturnToRepository={() => handleNavigate('repository')}
            onReturnToHome={() => handleNavigate('home')}
          />
        )}

        {currentView === 'admin-dashboard' && (
          isAdmin ? (
            <AdminDashboardPage
              onNavigateUpload={() => handleNavigate('admin-upload')}
              onViewDocument={handleOpenFullDocument}
              onOpenSetupGuide={() => setIsSetupModalOpen(true)}
              onLogout={handleLogout}
            />
          ) : (
            <AccessDeniedPage
              onReturnToRepository={() => handleNavigate('repository')}
              onReturnToHome={() => handleNavigate('home')}
            />
          )
        )}

        {currentView === 'admin-upload' && (
          isAdmin ? (
            <AdminUploadPage
              onBackToDashboard={() => handleNavigate('admin-dashboard')}
              onUploadSuccess={() => handleNavigate('admin-dashboard')}
              onViewDocument={handlePreviewDocument}
            />
          ) : (
            <AccessDeniedPage
              onReturnToRepository={() => handleNavigate('repository')}
              onReturnToHome={() => handleNavigate('home')}
            />
          )
        )}

        {currentView === 'admin-manuscripts' && (
          isAdmin ? (
            <AdminSubmissionsPage
              onBackToDashboard={() => handleNavigate('admin-dashboard')}
              onViewDocument={handlePreviewDocument}
            />
          ) : (
            <AccessDeniedPage
              onReturnToRepository={() => handleNavigate('repository')}
              onReturnToHome={() => handleNavigate('home')}
            />
          )
        )}

        {currentView === 'student-submit' && (
          <StudentSubmitPage
            onReturnHome={() => handleNavigate('home')}
            onBrowseRepository={() => handleNavigate('repository')}
            onViewGuidelines={() => handleNavigate('submission-guidelines')}
          />
        )}

        {currentView === 'submission-guidelines' && (
          <SubmissionGuidelinesPage
            onReturnToSubmit={() => handleNavigate('student-submit')}
            onBrowseRepository={() => handleNavigate('repository')}
          />
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-slate-950 border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 font-serif font-black text-base">✛</span>
            <span className="font-serif font-bold tracking-wider text-slate-200 uppercase">
              THE MALTESE ARCHIVE
            </span>
            <span className="text-slate-600">|</span>
            <span>Centralized Nursing Knowledge Repository</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400 text-[11px]">
            <span>Powered by Supabase (PostgreSQL & Storage)</span>
            <button
              onClick={() => handleNavigate('bookmarks')}
              className="hover:text-amber-300 transition-colors"
            >
              Bookmarks
            </button>
            <button
              onClick={() => setIsSetupModalOpen(true)}
              className="hover:text-amber-300 transition-colors"
            >
              Database Architecture
            </button>
            {isAdmin && (
              <button
                onClick={() => handleNavigate('admin-dashboard')}
                className="hover:text-amber-300 transition-colors font-medium text-amber-400/90"
              >
                Admin Console
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* PDF First-Page Preview Modal */}
      <PdfPreviewModal
        document={previewDocument}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewDocument(null);
        }}
        onOpenFullView={handleOpenFullDocument}
      />

      {/* Supabase Connection & SQL Migration Modal */}
      <SupabaseSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UserActivityProvider>
        <MainContent />
      </UserActivityProvider>
    </AuthProvider>
  );
}

