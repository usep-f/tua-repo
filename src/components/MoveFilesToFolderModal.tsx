import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Folder,
  Search,
  Check,
  BookOpen,
  GraduationCap,
  Tag,
  Calendar,
  CheckSquare,
  Square,
  AlertCircle,
  ArrowRight,
  FolderInput,
} from 'lucide-react';
import { NursingDocument, BookmarkFolder } from '../types';
import { FOLDER_THEMES } from '../lib/folderThemes';

interface MoveFilesToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFolder: BookmarkFolder;
  bookmarkedDocuments: NursingDocument[];
  docFolderMap: Record<string, string>;
  folders: BookmarkFolder[];
  onMoveFiles: (documentIds: string[], targetFolderId: string) => void;
}

export const MoveFilesToFolderModal: React.FC<MoveFilesToFolderModalProps> = ({
  isOpen,
  onClose,
  targetFolder,
  bookmarkedDocuments,
  docFolderMap,
  folders,
  onMoveFiles,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state whenever modal opens or folder changes
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setSearchQuery('');
      setIsSubmitting(false);
    }
  }, [isOpen, targetFolder.id]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 1. Available files: ONLY bookmarked files NOT currently in targetFolder
  const availableDocs = useMemo(() => {
    return bookmarkedDocuments.filter(doc => {
      if (!doc || !doc.id) return false;
      return docFolderMap[doc.id] !== targetFolder.id;
    });
  }, [bookmarkedDocuments, docFolderMap, targetFolder.id]);

  // 2. Filtered by search query
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return availableDocs;
    const q = searchQuery.toLowerCase().trim();
    return availableDocs.filter(doc => {
      const matchTitle = doc.title?.toLowerCase().includes(q);
      const matchAuthors = Array.isArray(doc.authors)
        ? doc.authors.join(', ').toLowerCase().includes(q)
        : (doc.authors || '').toLowerCase().includes(q);
      const matchCategory = doc.category?.toLowerCase().includes(q);
      const matchProgram = doc.program?.toLowerCase().includes(q);
      const matchType = doc.document_type?.toLowerCase().includes(q);
      return matchTitle || matchAuthors || matchCategory || matchProgram || matchType;
    });
  }, [availableDocs, searchQuery]);

  // Select all visible toggle
  const allFilteredSelected =
    filteredDocs.length > 0 &&
    filteredDocs.every(doc => selectedIds.includes(doc.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered items
      const filteredIdSet = new Set(filteredDocs.map(d => d.id));
      setSelectedIds(prev => prev.filter(id => !filteredIdSet.has(id)));
    } else {
      // Add all filtered items to selection
      const newIds = new Set(selectedIds);
      filteredDocs.forEach(d => newIds.add(d.id));
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelect = (docId: string) => {
    setSelectedIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleMove = () => {
    if (selectedIds.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      onMoveFiles(selectedIds, targetFolder.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const targetTheme = FOLDER_THEMES[targetFolder.color] || FOLDER_THEMES.amber;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-white/15 rounded-3xl shadow-2xl shadow-blue-950/60 overflow-hidden animate-scaleUp text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${targetTheme.bg} ${targetTheme.border}`}
            >
              <FolderInput className={`w-5 h-5 ${targetTheme.iconColor}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Move Files Into Folder
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${targetTheme.badge}`}
                >
                  {targetTheme.label}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white font-serif truncate">
                Move Files to "{targetFolder.name}"
              </h3>
            </div>
          </div>

          <button
            id="btn-close-move-files-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Select All Bar */}
        <div className="px-6 py-4 border-b border-white/10 bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="input-search-move-files"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search bookmarked files to move..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Select All Checkbox */}
          {filteredDocs.length > 0 && (
            <button
              id="btn-select-all-move-files"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-white/10 text-xs font-medium text-slate-200 hover:text-white transition-all active:scale-95 shrink-0"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {allFilteredSelected
                  ? 'Deselect All'
                  : `Select All (${filteredDocs.length})`}
              </span>
            </button>
          )}
        </div>

        {/* File List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5 custom-scrollbar min-h-[260px] max-h-[440px]">
          {bookmarkedDocuments.length === 0 ? (
            /* User has 0 bookmarked files */
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-white/5">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-200">No Bookmarked Files</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                You haven't bookmarked any files yet. Browse the repository and bookmark documents to organize them into folders.
              </p>
            </div>
          ) : availableDocs.length === 0 ? (
            /* All bookmarked files are already inside this folder */
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-white/5">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3 p-2 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
              <p className="text-sm font-bold text-slate-200">
                All Bookmarked Files Are in This Folder
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                All {bookmarkedDocuments.length} of your bookmarked files are already placed inside "{targetFolder.name}".
              </p>
            </div>
          ) : filteredDocs.length === 0 ? (
            /* Search query returned 0 results */
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-white/5">
              <Search className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-200">No matching files found</p>
              <p className="text-xs text-slate-400 mt-1">
                No bookmarked files outside this folder matched "{searchQuery}".
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            /* List of Selectable Bookmarked Files */
            filteredDocs.map(doc => {
              const isSelected = selectedIds.includes(doc.id);
              const currentFolderId = docFolderMap[doc.id];
              const currentFolder = currentFolderId
                ? folders.find(f => f.id === currentFolderId)
                : null;
              const currentFolderTheme = currentFolder
                ? FOLDER_THEMES[currentFolder.color]
                : null;

              return (
                <div
                  key={doc.id}
                  id={`move-file-row-${doc.id}`}
                  onClick={() => handleToggleSelect(doc.id)}
                  className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-slate-950/40 hover:bg-slate-800/60 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleToggleSelect(doc.id);
                      }}
                      className="focus:outline-none"
                      aria-label={isSelected ? 'Deselect file' : 'Select file'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-amber-400 fill-amber-500/20" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                          doc.document_type === 'Thesis'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {doc.document_type === 'Thesis' ? (
                          <GraduationCap className="w-3 h-3 text-blue-400" />
                        ) : (
                          <BookOpen className="w-3 h-3 text-amber-400" />
                        )}
                        <span>{doc.document_type}</span>
                      </span>

                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-white/5">
                        AY {doc.academic_year}
                      </span>

                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-white/5 font-mono">
                        {doc.program}
                      </span>

                      {/* Current Location Badge */}
                      {currentFolder && currentFolderTheme ? (
                        <span
                          className={`ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${currentFolderTheme.badge}`}
                          title={`Currently inside "${currentFolder.name}"`}
                        >
                          <Folder className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[120px]">
                            Currently: {currentFolder.name}
                          </span>
                        </span>
                      ) : (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/5">
                          Currently: All Bookmarked Files
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-white font-serif leading-snug line-clamp-2">
                      {doc.title}
                    </h4>

                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      <span className="text-slate-500">By: </span>
                      {Array.isArray(doc.authors) ? doc.authors.join(', ') : doc.authors}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              <strong className="text-amber-400 font-mono text-sm font-bold">
                {selectedIds.length}
              </strong>{' '}
              {selectedIds.length === 1 ? 'file' : 'files'} selected
            </span>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-[11px] text-slate-400 hover:text-white underline ml-2"
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              id="btn-cancel-move-files"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
            >
              Cancel
            </button>

            <button
              id="btn-confirm-move-selected-files"
              onClick={handleMove}
              disabled={selectedIds.length === 0 || isSubmitting}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                selectedIds.length > 0 && !isSubmitting
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <span>Move Selected Files</span>
              {selectedIds.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-950/20 text-slate-950 font-mono text-[11px]">
                  {selectedIds.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
