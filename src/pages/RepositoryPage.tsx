import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  Filter,
  GraduationCap,
  BookOpen,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RotateCcw,
  Tag,
  FileQuestion,
  Loader2,
  Clock,
} from 'lucide-react';
import { NursingDocument, RepositoryFilters, AcademicProgram, DocumentType } from '../types';
import { fetchDocuments, PaginatedResult } from '../lib/documentService';
import { DocumentCard } from '../components/DocumentCard';
import {
  getSearchHistory,
  saveSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory as clearSharedSearchHistory,
} from '../lib/searchHistory';

interface RepositoryPageProps {
  initialFilters?: Partial<RepositoryFilters>;
  onPreviewDocument: (doc: NursingDocument) => void;
  onOpenFullDocument: (doc: NursingDocument) => void;
}

const ACADEMIC_YEARS = ['All', '2027', '2026', '2025', '2024', '2023', '2022', '2021', '2020'];
const DOCUMENT_TYPES = ['All', 'Thesis', 'Grand Case Presentation'];
const PROGRAMS = [
  'All',
  'BS Nursing',
  'MS Nursing',
  'DNP',
  'PhD Nursing',
  'Post-Master\'s Certificate',
];
const CATEGORIES = [
  'All',
  'Maternal and Child Nursing',
  'Community and Public Health Nursing',
  'Critical Care and Emergency Nursing',
  'Medical-Surgical Nursing',
  'Mental Health and Psychiatric Nursing',
  'Geriatric Nursing & Long-term Care',
  'Pediatric Nursing',
  'Nursing Administration and Leadership',
  'Evidence-Based Practice and Quality Improvement',
  'Informatics & Healthcare Technology',
];

export const RepositoryPage: React.FC<RepositoryPageProps> = ({
  initialFilters,
  onPreviewDocument,
  onOpenFullDocument,
}) => {
  const [filters, setFilters] = useState<RepositoryFilters>({
    query: initialFilters?.query || '',
    academicYear: initialFilters?.academicYear || 'All',
    documentType: initialFilters?.documentType || 'All',
    program: initialFilters?.program || 'All',
    category: initialFilters?.category || 'All',
    sortBy: initialFilters?.sortBy || 'newest',
    page: initialFilters?.page || 1,
  });

  const [debouncedQuery, setDebouncedQuery] = useState(filters.query);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [results, setResults] = useState<PaginatedResult<NursingDocument>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 6,
    totalPages: 1,
  });

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

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters(prev => ({ ...prev, query: debouncedQuery, page: 1 }));
    }, 350);
    return () => clearTimeout(handler);
  }, [debouncedQuery]);

  // Fetch documents on filter change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchDocuments(filters, 6)
      .then(res => {
        if (isMounted) {
          setResults(res);
        }
      })
      .catch(err => {
        console.error('Failed to fetch documents:', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [filters]);

  const handleResetFilters = () => {
    setDebouncedQuery('');
    setFilters({
      query: '',
      academicYear: 'All',
      documentType: 'All',
      program: 'All',
      category: 'All',
      sortBy: 'newest',
      page: 1,
    });
  };

  const filteredHistory = debouncedQuery.trim()
    ? searchHistory.filter(item => item.toLowerCase().includes(debouncedQuery.trim().toLowerCase()))
    : searchHistory;

  const handleRepoSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowHistoryDropdown(false);
    const trimmed = debouncedQuery.trim();
    if (trimmed) {
      const updated = saveSearchHistory(trimmed);
      setSearchHistory(updated);
      setFilters(prev => ({ ...prev, query: trimmed, page: 1 }));
    }
  };

  const handleSelectHistoryItem = (query: string) => {
    setDebouncedQuery(query);
    setShowHistoryDropdown(false);
    const updated = saveSearchHistory(query);
    setSearchHistory(updated);
    setFilters(prev => ({ ...prev, query, page: 1 }));
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

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= results.totalPages) {
      setFilters(prev => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fadeIn w-full min-w-0">
      {/* Section 7 Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/20 mb-3">
          Institutional Digital Repository
        </span>
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight uppercase font-serif">
          THE MALTESE ARCHIVE
        </h1>
        <h2 className="text-base sm:text-lg font-semibold text-amber-300/90 tracking-wide uppercase mt-2">
          Nursing Knowledge Repository
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto mt-2 leading-relaxed">
          A centralized digital archive for nursing theses and Grand Case Presentations.
        </p>
      </div>

      {/* Large Glassmorphism Search Bar with History Dropdown */}
      <div ref={searchContainerRef} className="max-w-3xl mx-auto mb-8 relative">
        <form onSubmit={handleRepoSearchSubmit} className="relative rounded-2xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl shadow-blue-950/40 focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all flex items-center">
          <div className="pl-3.5 pr-2 text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="main-repo-search"
            type="text"
            value={debouncedQuery}
            onChange={e => {
              setDebouncedQuery(e.target.value);
              setSelectedIndex(-1);
              setShowHistoryDropdown(true);
            }}
            onFocus={() => {
              const history = getSearchHistory();
              setSearchHistory(history);
              if (history.length > 0) {
                setShowHistoryDropdown(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search titles, authors, keywords, abstract..."
            className="w-full bg-transparent px-2 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {debouncedQuery && (
            <button
              type="button"
              onClick={() => setDebouncedQuery('')}
              className="pr-3 text-slate-400 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shrink-0 ml-1"
          >
            Search
          </button>
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

      {/* Filter and Sorting Toolbar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 mb-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Filters: Academic Year, Document Type, Program, Category */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Document Type */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden sm:inline">Type:</span>
              <select
                id="filter-doc-type"
                value={filters.documentType}
                onChange={e => setFilters(prev => ({ ...prev, documentType: e.target.value, page: 1 }))}
                className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type === 'All' ? 'All Document Types' : type}
                  </option>
                ))}
              </select>
            </div>

            {/* Academic Year */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden sm:inline">Year:</span>
              <select
                id="filter-academic-year"
                value={filters.academicYear}
                onChange={e => setFilters(prev => ({ ...prev, academicYear: e.target.value, page: 1 }))}
                className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
              >
                {ACADEMIC_YEARS.map(yr => (
                  <option key={yr} value={yr}>
                    {yr === 'All' ? 'All Academic Years' : `AY ${yr}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Program */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden sm:inline">Program:</span>
              <select
                id="filter-program"
                value={filters.program}
                onChange={e => setFilters(prev => ({ ...prev, program: e.target.value, page: 1 }))}
                className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
              >
                {PROGRAMS.map(prog => (
                  <option key={prog} value={prog}>
                    {prog === 'All' ? 'All Programs' : prog}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden sm:inline">Category:</span>
              <select
                id="filter-category"
                value={filters.category}
                onChange={e => setFilters(prev => ({ ...prev, category: e.target.value, page: 1 }))}
                className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400 max-w-[160px] truncate"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Sorting and Reset */}
          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="filter-sort-by"
                value={filters.sortBy}
                onChange={e => setFilters(prev => ({ ...prev, sortBy: e.target.value as any, page: 1 }))}
                className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
              </select>
            </div>

            <button
              onClick={handleResetFilters}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Reset all filters"
              aria-label="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Result Count and Status */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-6 px-1">
        <span>
          Showing <span className="text-slate-200 font-semibold">{results.data.length}</span> of{' '}
          <span className="text-slate-200 font-semibold">{results.total}</span> documents
        </span>
        {filters.query && (
          <span className="text-amber-300 font-mono text-[11px]">
            Filtered by: "{filters.query}"
          </span>
        )}
      </div>

      {/* Document Cards Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-300">Searching archive database...</p>
        </div>
      ) : results.data.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-white/5 p-8 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto mb-4 border border-white/10">
            <FileQuestion className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 font-serif">No Documents Match Your Query</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            We couldn't find any nursing theses or Grand Case Presentations with the selected criteria. Try clearing filters or searching for alternative keywords.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full max-w-full min-w-0">
          {results.data.map(doc => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onPreview={onPreviewDocument}
              onOpenFull={onOpenFullDocument}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {results.totalPages > 1 && (
        <div className="mt-12 pt-6 border-t border-white/10 flex items-center justify-center gap-2">
          <button
            id="btn-page-prev"
            onClick={() => handlePageChange(results.page - 1)}
            disabled={results.page <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900/80 text-slate-300 text-xs border border-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1 px-2 text-xs font-mono">
            {Array.from({ length: results.totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  p === results.page
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            id="btn-page-next"
            onClick={() => handlePageChange(results.page + 1)}
            disabled={results.page >= results.totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900/80 text-slate-300 text-xs border border-white/10 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
