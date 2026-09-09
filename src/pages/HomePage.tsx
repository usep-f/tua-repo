import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  GraduationCap,
  BookOpen,
  ArrowRight,
  FileText,
  FileUp,
  Clock,
  Trash2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Layers,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { NursingDocument } from '../types';
import { fetchRecentDocuments, fetchRepositoryStats, RepositoryStats } from '../lib/documentService';
import { DocumentCard } from '../components/DocumentCard';
import { InstitutionalCrests } from '../components/InstitutionalCrests';
import { useUserActivity } from '../context/UserActivityContext';
import { useAuth } from '../context/AuthContext';
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
  onNavigateView?: (view: any) => void;
}

const POPULAR_TOPICS = [
  'Pediatric Care',
  'Pathophysiology',
  'Critical Care Nursing',
  'Evidence-Based Practice',
  'Clinical Trajectories',
];

export const HomePage: React.FC<HomePageProps> = ({
  onSearchSubmit,
  onSelectDocumentType,
  onBrowseAll,
  onPreviewDocument,
  onOpenFullDocument,
  onNavigateView,
}) => {
  const { user, isAdmin } = useAuth();
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
      .catch((err) => {
        console.error('Failed to load homepage data:', err);
        if (isMounted) setLoading(false);
      });

    reconcileRecentlyViewed();

    return () => {
      isMounted = false;
    };
  }, [reconcileRecentlyViewed]);

  const filteredHistory = searchQuery.trim()
    ? searchHistory.filter((item) => item.toLowerCase().includes(searchQuery.trim().toLowerCase()))
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
        setSelectedIndex((prev) => (prev < filteredHistory.length - 1 ? prev + 1 : 0));
        setShowHistoryDropdown(true);
      }
    } else if (e.key === 'ArrowUp') {
      if (filteredHistory.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredHistory.length - 1));
        setShowHistoryDropdown(true);
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < filteredHistory.length && showHistoryDropdown) {
        e.preventDefault();
        handleSelectHistoryItem(filteredHistory[selectedIndex]);
      }
    }
  };

  const handleUploadDocumentClick = () => {
    if (isAdmin) {
      onNavigateView?.('admin-upload');
    } else if (user) {
      onNavigateView?.('student-submit');
    } else {
      onNavigateView?.('login');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#050c1a] text-slate-100 antialiased animate-fadeIn">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: ROYAL BLUE ARCHED DOME WITH AMBIENT CANDLELIGHT GLOW     */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#081226] via-[#0d214a] to-[#153472] rounded-b-[3.5rem] md:rounded-b-[5.5rem] border-b border-amber-500/25 shadow-2xl shadow-blue-950/80 min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] flex flex-col justify-center py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 text-center select-none">
        {/* Layered Scholarly Open Books Collage Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src="/assets/background-books.webp"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center opacity-25 mix-blend-luminosity brightness-90 contrast-125 select-none scale-105"
            loading="eager"
          />
          {/* Rich Royal Blue Atmospheric Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#081226]/85 via-[#0d214a]/70 to-[#153472]/90 mix-blend-multiply" />
          {/* Radial Center Vignette for Enhanced Text Legibility */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(13,33,74,0.3)_0%,_rgba(5,12,26,0.85)_85%)]" />
        </div>

        {/* Ambient Candlelight Sunburst on Upper Left */}
        <div className="absolute -top-24 -left-20 w-[480px] h-[480px] bg-gradient-to-br from-amber-400/25 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Ambient Royal Blue Fill on Upper Right */}
        <div className="absolute top-10 -right-20 w-[420px] h-[420px] bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Center Glow Halo */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[320px] bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />

        {/* Geometric Micro-Dot Matrix */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Floating Research Manuscript Papers (Left Ambient Deck) */}
        <div className="hidden xl:block absolute left-8 lg:left-14 top-1/2 -translate-y-1/2 pointer-events-none z-0">
          <div
            className="animate-float-slow w-48 rounded-xl bg-white/95 p-3.5 shadow-2xl shadow-black/60 border border-slate-200/80 text-left transform -rotate-6 transition-transform"
            style={{ ['--paper-rotate' as any]: '-6deg' }}
          >
            <div className="flex items-center gap-1.5 mb-2 border-b border-slate-100 pb-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Thesis Abstract
              </span>
            </div>
            <p className="text-[10px] font-serif font-bold text-slate-900 leading-tight">
              Clinical Trajectories in Pediatric Critical Care
            </p>
            <div className="mt-2 space-y-1">
              <div className="h-1 bg-slate-200 rounded w-full" />
              <div className="h-1 bg-slate-200 rounded w-5/6" />
              <div className="h-1 bg-slate-200 rounded w-4/6" />
            </div>
            <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400 font-mono">
              <span>SLCN Research</span>
              <span className="text-emerald-600 font-bold">Approved</span>
            </div>
          </div>
        </div>

        {/* Floating Research Manuscript Papers (Right Ambient Deck) */}
        <div className="hidden xl:block absolute right-8 lg:right-14 top-1/2 -translate-y-1/2 pointer-events-none z-0">
          <div
            className="animate-float-delayed w-48 rounded-xl bg-white/95 p-3.5 shadow-2xl shadow-black/60 border border-slate-200/80 text-left transform rotate-6 transition-transform"
            style={{ ['--paper-rotate' as any]: '6deg' }}
          >
            <div className="flex items-center gap-1.5 mb-2 border-b border-slate-100 pb-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Grand Case Presentation
              </span>
            </div>
            <p className="text-[10px] font-serif font-bold text-slate-900 leading-tight">
              Multidisciplinary Management: Type 1 Diabetes
            </p>
            <div className="mt-2 space-y-1">
              <div className="h-1 bg-slate-200 rounded w-full" />
              <div className="h-1 bg-slate-200 rounded w-4/5" />
              <div className="h-1 bg-slate-200 rounded w-3/4" />
            </div>
            <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400 font-mono">
              <span>TUA Archive</span>
              <span className="text-blue-600 font-bold">Peer-Reviewed</span>
            </div>
          </div>
        </div>

        {/* Main Hero Foreground Content */}
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Dual Institutional Heraldic Crests: Trinity University of Asia & St. Luke's College of Nursing */}
          <InstitutionalCrests size="md" className="mb-6 justify-center" />

          {/* Monumental Headline */}
          <h1 className="text-3xl min-[420px]:text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight uppercase font-serif drop-shadow-lg leading-tight sm:leading-none max-w-full break-words">
            Centralized Nursing Knowledge Repository
          </h1>

          {/* Institutional Mission Quote */}
          <p className="text-sm sm:text-base md:text-lg text-slate-200/90 max-w-2xl sm:max-w-3xl mx-auto mt-4 leading-relaxed font-light italic drop-shadow-sm">
            &ldquo;A modern digital archive for nursing theses and Grand Case Presentations.&rdquo;
          </p>

          {/* High-Contrast Glassmorphism Search Pill Bar */}
          <div ref={searchContainerRef} className="mt-8 sm:mt-10 max-w-2xl mx-auto relative">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative rounded-full bg-slate-950/80 backdrop-blur-2xl border border-white/20 p-2 shadow-2xl shadow-black/50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/25 transition-all flex items-center">
                <div className="pl-4 pr-2 text-slate-400">
                  <Search className="w-5 h-5 text-amber-400" />
                </div>
                <input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
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
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  <span>Search</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Quick Topic Chips */}
            <div className="mt-3 flex items-center justify-center flex-wrap gap-2 text-xs">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Trending:</span>
              </span>
              {POPULAR_TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => {
                    setSearchQuery(topic);
                    onSearchSubmit(topic);
                  }}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-amber-300 text-[11px] transition-all hover:scale-105 active:scale-95"
                >
                  {topic}
                </button>
              ))}
            </div>

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
        </div>

        {/* Subtle Scroll Down Indicator at Arch Bottom */}
        <div
          onClick={() => {
            const el = document.getElementById('discovery-tier');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 text-slate-400/70 hover:text-amber-300 transition-colors flex flex-col items-center gap-1 cursor-pointer pointer-events-auto group z-20"
        >
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400/60 group-hover:text-amber-300 transition-colors">
            Scroll to Explore
          </span>
          <div className="w-5 h-5 rounded-full border border-white/10 group-hover:border-amber-400/40 flex items-center justify-center animate-bounce transition-colors">
            <ChevronDown className="w-3 h-3 text-amber-400/80" />
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. DISCOVERY TIER: LUMINOUS IVORY / CHAMPAGNE ACADEMIC ACTION PORTAL      */}
      {/* ========================================================================= */}
      <section id="discovery-tier" className="bg-[#f5f8fc] text-slate-900 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 relative">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-serif tracking-tight">
              Explore what&apos;s been discovered.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 font-sans leading-relaxed">
              Navigate peer-reviewed clinical theses, comprehensive case pathophysiology, or contribute new academic outputs to the digital repository.
            </p>
          </div>

          {/* 3 Double-Bezel Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Card 1: Browse Theses */}
            <div
              id="card-browse-theses"
              onClick={() => onSelectDocumentType('Thesis')}
              className="group relative rounded-3xl p-1.5 bg-gradient-to-b from-blue-200/70 to-slate-200/50 border border-blue-300/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="bg-white rounded-[calc(1.5rem-0.375rem)] p-7 flex flex-col justify-between h-full border border-white">
                <div>
                  {/* Icon Circle */}
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all mb-5">
                    <GraduationCap className="w-6 h-6" />
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Browse Theses
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Empirical nursing inquiries, clinical research methodologies, and evidence-based reviews.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 group-hover:text-blue-800 transition-colors">
                    Explore Theses
                  </span>
                  <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Browse Grand Case Presentations */}
            <div
              id="card-browse-gcps"
              onClick={() => onSelectDocumentType('Grand Case Presentation')}
              className="group relative rounded-3xl p-1.5 bg-gradient-to-b from-indigo-200/70 to-slate-200/50 border border-indigo-300/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="bg-white rounded-[calc(1.5rem-0.375rem)] p-7 flex flex-col justify-between h-full border border-white">
                <div>
                  {/* Icon Circle */}
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all mb-5">
                    <BookOpen className="w-6 h-6" />
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    Browse Grand Case Presentations
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Comprehensive patient pathophysiology, clinical management, and nursing care trajectories.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 group-hover:text-indigo-800 transition-colors">
                    Explore GCPs
                  </span>
                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Upload Document */}
            <div
              id="card-upload-document"
              onClick={handleUploadDocumentClick}
              className="group relative rounded-3xl p-1.5 bg-gradient-to-b from-amber-200/70 to-amber-100/40 border border-amber-300/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="bg-white rounded-[calc(1.5rem-0.375rem)] p-7 flex flex-col justify-between h-full border border-white">
                <div>
                  {/* Icon Circle */}
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all mb-5">
                    <FileUp className="w-6 h-6" />
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                    Upload Document
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Add new findings, clinical studies, and academic work to the growing nursing collection.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 group-hover:text-amber-800 transition-colors">
                    {isAdmin ? 'Upload to Repository' : user ? 'Submit Manuscript' : 'Sign In to Submit'}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 16 Statistics: Total Documents, Total Theses, Total GCPs */}
          <div className="mt-14 pt-8 border-t border-slate-300/60 grid grid-cols-3 gap-4 max-w-2xl mx-auto text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-serif">
                {stats.totalDocuments}
              </div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1 font-mono">
                Total Documents
              </p>
            </div>

            <div className="border-x border-slate-300/60">
              <div className="text-3xl sm:text-4xl font-extrabold text-blue-700 font-serif">
                {stats.totalTheses}
              </div>
              <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mt-1 font-mono">
                Total Theses
              </p>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-600 font-serif">
                {stats.totalGCPs}
              </div>
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mt-1 font-mono">
                Total GCPs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. GROUNDED READING ROOM: RECENTLY VIEWED & RECENTLY ADDED SHOWCASE        */}
      {/* ========================================================================= */}
      <section className="bg-[#050c1a] text-slate-100 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-white/10 flex-1">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Part A: Personal Reading History ("Recently Viewed") */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all active:scale-95"
                  title="Clear your recently viewed history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear History</span>
                </button>
              )}
            </div>

            {recentlyViewed.length === 0 ? (
              <div className="p-8 sm:p-10 rounded-2xl bg-slate-900/40 border border-white/5 text-center max-w-md mx-auto">
                <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-200">No reading history recorded yet.</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Nursing theses and Grand Case Presentations you open or preview will appear here for fast access.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 w-full max-w-full min-w-0">
                {recentlyViewed.slice(0, 8).map((item) => (
                  <DocumentCard
                    key={item.documentId}
                    document={item.document}
                    onPreview={onPreviewDocument}
                    onOpenFull={onOpenFullDocument}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Part B: Latest Scholarly Additions ("Recently Added") */}
          <div className="pt-10 border-t border-white/5">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono block">
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
                {[1, 2, 3, 4].map((n) => (
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
                {recentDocs.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onPreview={onPreviewDocument}
                    onOpenFull={onOpenFullDocument}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
