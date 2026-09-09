import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Sparkles,
  FileText,
  Shield,
  Layers,
  ChevronRight,
  Database,
  Calendar,
  Clock,
  Trash2,
} from 'lucide-react';
import { NursingDocument } from '../types';
import { fetchRecentDocuments, fetchRepositoryStats, RepositoryStats } from '../lib/documentService';
import { DocumentCard } from '../components/DocumentCard';
import { useUserActivity } from '../context/UserActivityContext';
import {
  getSearchHistory,
  saveSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory as clearSharedSearchHistory,
} from '../lib/searchHistory';

interface HomePageProps {
  onSearchSubmit: (query: string) => void;
  onSelectDocumentType: (type: 'Thesis' | 'Grand Case Presentation') => void;
  onBrowseAll: () => void;
  onPreviewDocument: (doc: NursingDocument) => void;
  onOpenFullDocument: (doc: NursingDocument) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSearchSubmit,
  onSelectDocumentType,
  onBrowseAll,
  onPreviewDocument,
  onOpenFullDocument,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<RepositoryStats>({
    totalDocuments: 0,
    totalTheses: 0,
    totalGCPs: 0,
    academicYearsCount: 0,
    years: [],
  });
  const [recentDocs, setRecentDocs] = useState<NursingDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const { recentlyViewed, clearRecentlyViewed, reconcileRecentlyViewed } = useUserActivity();

  useEffect(() => {
    setSearchHistory(getSearchHistory());

    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowHistoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchRepositoryStats(), fetchRecentDocuments(4)])
      .then(([statsRes, docsRes]) => {
        if (isMounted) {
          setStats(statsRes);
          setRecentDocs(docsRes);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load homepage data:', err);
        if (isMounted) setLoading(false);
      });

    reconcileRecentlyViewed();

    return () => {
      isMounted = false;
    };
  }, [reconcileRecentlyViewed]);

  const filteredHistory = searchQuery.trim()
    ? searchHistory.filter(item => item.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : searchHistory;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowHistoryDropdown(false);
    const trimmed = searchQuery.trim();
    if (trimmed) {
      const updated = saveSearchHistory(trimmed);
      setSearchHistory(updated);
      onSearchSubmit(trimmed);
    } else {
      onBrowseAll();
    }
  };

  const handleSelectHistoryItem = (query: string) => {
    setSearchQuery(query);
    setShowHistoryDropdown(false);
    const updated = saveSearchHistory(query);
    setSearchHistory(updated);
    onSearchSubmit(query);
  };

  const handleRemoveHistoryItem = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    const updated = removeSearchHistoryItem(query);
    setSearchHistory(updated);
  };

  const handleClearHistory = () => {
    clearSharedSearchHistory();
    setSearchHistory([]);
    setShowHistoryDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowHistoryDropdown(false);
    } else if (e.key === 'ArrowDown') {
      if (filteredHistory.length > 0) {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredHistory.length - 1 ? prev + 1 : 0));
        setShowHistoryDropdown(true);
      }
    } else if (e.key === 'ArrowUp') {
      if (filteredHistory.length > 0) {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredHistory.length - 1));
        setShowHistoryDropdown(true);
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < filteredHistory.length && showHistoryDropdown) {
        e.preventDefault();
        handleSelectHistoryItem(filteredHistory[selectedIndex]);
      }
    }
  };

  return (
    <div className="min-h-screen pb-16 animate-fadeIn">
      {/* HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Decorative background radial lighting & mesh */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-28 left-1/3 -translate-x-1/2 w-[300px] h-[200px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Institutional Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wider uppercase mb-6 shadow-lg shadow-amber-500/5 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Digital Scholarly Repository</span>
          </div>

          {/* Hero Main Heading */}
          <h1 className="text-3xl min-[400px]:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight uppercase font-serif drop-shadow-sm max-w-full break-words">
            THE MALTESE ARCHIVE
          </h1>

          <p className="text-sm sm:text-lg md:text-xl font-semibold text-amber-300/90 tracking-wide uppercase mt-3 font-sans">
            Centralized Nursing Knowledge Repository
          </p>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl sm:max-w-3xl mx-auto mt-4 leading-relaxed font-light italic">
            "A centralized digital repository for nursing theses and grand case presentations, providing an organized and accessible platform for preserving academic outputs, facilitating information retrieval, and promoting the continued use and dissemination of nursing knowledge."
          </p>

          {/* Large Glassmorphism Search Bar with History Dropdown */}
          <div ref={searchContainerRef} className="mt-8 sm:mt-10 max-w-2xl mx-auto relative">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative rounded-2xl bg-slate-900/80 backdrop-blur-2xl border border-white/20 p-2 shadow-2xl shadow-blue-950/60 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/25 transition-all flex items-center">
                <div className="pl-4 pr-3 text-slate-400">
                  <Search className="w-5 h-5 text-amber-400" />
                </div>
                <input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setSelectedIndex(-1);
                    setShowHistoryDropdown(true);
                  }}
                  onFocus={() => {
                    if (searchHistory.length > 0) {
                      setShowHistoryDropdown(true);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search titles, authors, keywords, clinical topics..."
                  className="w-full bg-transparent px-2 py-3 text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
                />
                <button
                  id="btn-hero-search-submit"
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  <span>Search</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Search History Dropdown */}
            {showHistoryDropdown && filteredHistory.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/20 shadow-2xl z-50 overflow-hidden animate-fadeIn text-left">
                <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recent searches</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {filteredHistory.length} items
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto py-1 divide-y divide-white/5">
                  {filteredHistory.map((item, index) => (
                    <div
                      key={item}
                      onClick={() => handleSelectHistoryItem(item)}
                      className={`px-4 py-2.5 flex items-center justify-between text-xs text-slate-200 hover:bg-white/5 cursor-pointer transition-colors group ${
                        selectedIndex === index ? 'bg-white/10 text-white' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-amber-400/80 group-hover:rotate-45 transition-transform">↺</span>
                        <span className="truncate">{item}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveHistoryItem(e, item)}
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from history"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-2 border-t border-white/10 bg-slate-950/60 text-center">
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-[11px] font-medium text-slate-400 hover:text-red-300 transition-colors py-1 px-3 rounded-lg hover:bg-red-500/10"
                  >
                    Clear search history
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Access Cards: Browse Theses & Browse Grand Case Presentations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto text-left">
            {/* Quick Card 1: Browse Theses */}
            <div
              id="card-browse-theses"
              onClick={() => onSelectDocumentType('Thesis')}
              className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/60 to-slate-900/80 backdrop-blur-xl border border-blue-500/30 hover:border-blue-400/60 shadow-xl hover:shadow-2xl hover:shadow-blue-900/40 cursor-pointer transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-xs text-blue-300 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  <span>Explore</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-200 transition-colors">
                Browse Theses
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Empirical nursing inquiries, clinical research methodologies, and evidence-based reviews.
              </p>
            </div>

            {/* Quick Card 2: Browse Grand Case Presentations */}
            <div
              id="card-browse-gcps"
              onClick={() => onSelectDocumentType('Grand Case Presentation')}
              className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900/80 backdrop-blur-xl border border-amber-500/30 hover:border-amber-400/60 shadow-xl hover:shadow-2xl hover:shadow-amber-900/30 cursor-pointer transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs text-amber-300 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  <span>Explore</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors">
                Browse Grand Case Presentations
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Comprehensive patient pathophysiology, clinical management, and nursing care trajectories.
              </p>
            </div>
          </div>

          {/* Section 16 Statistics: Total Documents, Total Theses, Total GCPs */}
          <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-3 gap-4 max-w-xl mx-auto">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-serif">
                {stats.totalDocuments}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Total Documents
              </p>
            </div>

            <div className="text-center border-x border-white/10">
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-300 font-serif">
                {stats.totalTheses}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Total Theses
              </p>
            </div>

            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-serif">
                {stats.totalGCPs}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Total GCPs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RECENTLY VIEWED SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-16">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Personal Reading History</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-serif mt-1">
              Recently Viewed
            </h2>
          </div>

          {recentlyViewed.length > 0 && (
            <button
              id="btn-clear-recent-views"
              onClick={clearRecentlyViewed}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all"
              title="Clear your recently viewed history"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Clear History</span>
            </button>
          )}
        </div>

        {recentlyViewed.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-slate-900/40 border border-white/5 text-center max-w-md mx-auto">
            <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-200">No recently viewed files.</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Nursing theses and Grand Case Presentations you open or preview will appear here for fast access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 w-full max-w-full min-w-0">
            {recentlyViewed.slice(0, 12).map(item => (
              <DocumentCard
                key={item.documentId}
                document={item.document}
                onPreview={onPreviewDocument}
                onOpenFull={onOpenFullDocument}
              />
            ))}
          </div>
        )}
      </section>

      {/* RECENTLY ADDED SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Latest Scholarly Additions
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-serif mt-1">
              Recently Added
            </h2>
          </div>

          <button
            onClick={onBrowseAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors group"
          >
            <span>View Complete Repository</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 w-full max-w-full min-w-0">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className="h-64 rounded-2xl bg-slate-900/40 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : recentDocs.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/10 text-center max-w-md mx-auto">
            <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">Repository Awaiting Documents</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
              No academic theses or Grand Case Presentations have been uploaded to the database yet.
            </p>
            <button
              onClick={onBrowseAll}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700"
            >
              Go to Repository
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 w-full max-w-full min-w-0">
            {recentDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onPreview={onPreviewDocument}
                onOpenFull={onOpenFullDocument}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
