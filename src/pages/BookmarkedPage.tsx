import React, { useState, useEffect } from 'react';
import { formatKeywords } from '../lib/utils';
import {
  Bookmark,
  BookOpen,
  GraduationCap,
  Search,
  ArrowLeft,
  Trash2,
  Filter,
  Sparkles,
  RefreshCw,
  Folder,
  FolderPlus,
  FolderMinus,
  Edit2,
  FolderOpen,
  AlertCircle,
  MoreVertical,
  Plus,
} from 'lucide-react';
import { NursingDocument, BookmarkFolder, FolderColor } from '../types';
import { DocumentCard } from '../components/DocumentCard';
import { FolderModal } from '../components/FolderModal';
import { MoveFilesToFolderModal } from '../components/MoveFilesToFolderModal';
import { useUserActivity } from '../context/UserActivityContext';
import { FOLDER_THEMES } from '../lib/folderThemes';

interface BookmarkedPageProps {
  onPreviewDocument: (doc: NursingDocument) => void;
  onOpenFullDocument: (doc: NursingDocument) => void;
  onBrowseRepository: () => void;
  onReturnHome: () => void;
  onNavigateFolders?: () => void;
}

export const BookmarkedPage: React.FC<BookmarkedPageProps> = ({
  onPreviewDocument,
  onOpenFullDocument,
  onBrowseRepository,
  onReturnHome,
  onNavigateFolders,
}) => {
  const {
    bookmarkedDocuments,
    bookmarkedIds,
    clearAllBookmarks,
    reconcileBookmarks,
    isLoadingBookmarks,
    folders,
    docFolderMap,
    createFolder,
    updateFolder,
    deleteFolder,
    assignMultipleDocsToFolder,
    getFolderDocCount,
    getUnfiledDocCount,
  } = useUserActivity();

  // Active view state
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all' | 'unfiled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'All' | 'Thesis' | 'Grand Case Presentation'>('All');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Folder modal state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<BookmarkFolder | null>(null);

  // Move files to folder modal state
  const [isMoveFilesModalOpen, setIsMoveFilesModalOpen] = useState(false);

  // Delete folder confirmation state
  const [folderToDelete, setFolderToDelete] = useState<BookmarkFolder | null>(null);

  // Reconcile bookmarks with database once on initial mount of Bookmarked Files page
  useEffect(() => {
    reconcileBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If active folder no longer exists, revert to 'all'
  useEffect(() => {
    if (
      selectedFolderId !== 'all' &&
      selectedFolderId !== 'unfiled' &&
      !folders.some(f => f.id === selectedFolderId)
    ) {
      setSelectedFolderId('all');
    }
  }, [folders, selectedFolderId]);

  // Handle open create modal
  const handleOpenCreateFolder = () => {
    setFolderToEdit(null);
    setIsFolderModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEditFolder = (folder: BookmarkFolder) => {
    setFolderToEdit(folder);
    setIsFolderModalOpen(true);
  };

  // Save folder (create or edit)
  const handleSaveFolder = (name: string, color: FolderColor) => {
    if (folderToEdit) {
      updateFolder(folderToEdit.id, { name, color });
    } else {
      const newFolder = createFolder(name, color);
      setSelectedFolderId(newFolder.id);
    }
  };

  // Confirm delete folder:
  // "When deleting a folder, do not delete the bookmarked files inside it. Instead, move those files back to the general All Bookmarked Files view."
  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete) return;
    deleteFolder(folderToDelete.id);
    if (selectedFolderId === folderToDelete.id) {
      setSelectedFolderId('all');
    }
    setFolderToDelete(null);
  };

  // 1. Filter by Folder
  const folderDocuments = bookmarkedDocuments.filter(doc => {
    if (!doc) return false;
    if (selectedFolderId === 'all') return true;
    if (selectedFolderId === 'unfiled') {
      const fId = docFolderMap[doc.id];
      return !fId || !folders.some(f => f.id === fId);
    }
    return docFolderMap[doc.id] === selectedFolderId;
  });

  // 2. Filter by Type and Search
  const filteredDocuments = folderDocuments.filter(doc => {
    if (!doc) return false;
    // Type filter
    if (selectedType !== 'All' && doc.document_type !== selectedType) {
      return false;
    }
    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = doc.title?.toLowerCase().includes(q);
      const matchAuthors = doc.authors?.toLowerCase().includes(q);
      const matchKeywords = formatKeywords(doc.keywords).some(k => k.toLowerCase().includes(q));
      const matchCategory = doc.category?.toLowerCase().includes(q);
      const matchProgram = doc.program?.toLowerCase().includes(q);
      return matchTitle || matchAuthors || matchKeywords || matchCategory || matchProgram;
    }
    return true;
  });

  const totalTheses = bookmarkedDocuments.filter(d => d && d.document_type === 'Thesis').length;
  const totalGCPs = bookmarkedDocuments.filter(d => d && d.document_type === 'Grand Case Presentation').length;
  const unfiledCount = getUnfiledDocCount();

  const activeFolder =
    selectedFolderId !== 'all' && selectedFolderId !== 'unfiled'
      ? folders.find(f => f.id === selectedFolderId)
      : null;

  const activeTheme = activeFolder ? FOLDER_THEMES[activeFolder.color] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fadeIn w-full min-w-0">
      {/* Top Breadcrumb / Return Navigation */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          id="btn-back-repo-from-bookmarks"
          onClick={onBrowseRepository}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Explore Repository</span>
        </button>

        <div className="flex items-center gap-3">
          {bookmarkedDocuments.length > 0 && (
            <button
              onClick={() => reconcileBookmarks()}
              disabled={isLoadingBookmarks}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 hover:text-slate-200 text-xs transition-all disabled:opacity-50"
              title="Verify availability of bookmarked files"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingBookmarks ? 'animate-spin text-amber-400' : ''}`} />
              <span>Sync Status</span>
            </button>
          )}
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Personal Collection</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-serif uppercase tracking-tight">
            Bookmarked Files
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Your saved nursing theses and Grand Case Presentations. Organize documents into custom color-coded folders for focused revision and research.
          </p>
        </div>

        {/* Header Action Buttons & Counters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Create Folder Button */}
          <button
            id="btn-create-folder-header"
            onClick={handleOpenCreateFolder}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-semibold transition-all active:scale-95 shadow-sm shadow-amber-500/10"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Create Folder</span>
          </button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 border border-white/10 text-xs">
            <span className="text-slate-400 font-medium">Saved:</span>
            <span className="font-bold text-amber-400 font-mono text-sm">
              {bookmarkedDocuments.length}
            </span>
            <span className="text-slate-500 text-[11px]">
              ({totalTheses} {totalTheses === 1 ? 'Thesis' : 'Theses'}, {totalGCPs} GCP{totalGCPs === 1 ? '' : 's'})
            </span>
          </div>

          {bookmarkedDocuments.length > 0 && (
            <div>
              {showClearConfirm ? (
                <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/40 p-1.5 rounded-xl animate-fadeIn">
                  <span className="text-[11px] text-red-300 pl-2">Clear all bookmarks?</span>
                  <button
                    onClick={() => {
                      clearAllBookmarks();
                      setShowClearConfirm(false);
                      setSelectedFolderId('all');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-all"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-red-950/30 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-300 text-xs font-medium transition-all"
                  title="Remove all saved bookmarks"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Empty State when no bookmarks exist at all */}
      {bookmarkedDocuments.length === 0 ? (
        <div className="p-10 sm:p-16 rounded-3xl bg-slate-900/40 border border-white/10 text-center max-w-xl mx-auto my-12 backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white font-serif">
            You haven't bookmarked any files yet.
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            Click the bookmark icon on any nursing thesis or Grand Case Presentation in the repository to store it here for fast retrieval. You can also organize them into color-coded folders.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              id="btn-explore-repo-empty"
              onClick={onBrowseRepository}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore Scholarly Repository</span>
            </button>

            <button
              onClick={onReturnHome}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* FOLDERS ORGANIZATION BAR */}
          <div className="mt-8 pt-2">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>Folder Organization</span>
              </span>

              {folders.length === 0 && (
                <span className="text-xs text-slate-500 italic">
                  Optional: Create custom folders to categorize your collection
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {/* "All Bookmarked Files" Tab */}
              <button
                id="tab-folder-all"
                onClick={() => setSelectedFolderId('all')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium shrink-0 transition-all ${
                  selectedFolderId === 'all'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20 font-semibold'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-slate-800'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>All Bookmarks</span>
                <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">
                  {bookmarkedDocuments.length}
                </span>
              </button>

              {/* "Unfiled / General" Tab (if user has created folders and has unfiled files) */}
              {folders.length > 0 && (
                <button
                  id="tab-folder-unfiled"
                  onClick={() => setSelectedFolderId('unfiled')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium shrink-0 transition-all ${
                    selectedFolderId === 'unfiled'
                      ? 'bg-slate-700/50 text-slate-200 border border-slate-500/50 font-semibold'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-slate-800'
                  }`}
                >
                  <FolderMinus className="w-3.5 h-3.5 text-slate-400" />
                  <span>Unfiled</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">
                    {unfiledCount}
                  </span>
                </button>
              )}

              {/* User Custom Folders */}
              {folders.map(folder => {
                const theme = FOLDER_THEMES[folder.color] || FOLDER_THEMES.amber;
                const isSelected = selectedFolderId === folder.id;
                const count = getFolderDocCount(folder.id);

                return (
                  <button
                    key={folder.id}
                    id={`tab-folder-${folder.id}`}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium shrink-0 border transition-all ${
                      isSelected
                        ? theme.badgeActive
                        : `${theme.bg} ${theme.border} text-slate-300 hover:text-white ${theme.hoverBg}`
                    }`}
                  >
                    <Folder className={`w-3.5 h-3.5 ${theme.iconColor}`} />
                    <span className="truncate max-w-[140px]">{folder.name}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px] font-mono">
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* Add New Folder Button */}
              <button
                id="btn-create-folder-tab"
                onClick={handleOpenCreateFolder}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-dashed border-amber-500/40 transition-all shrink-0 active:scale-95"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>
            </div>
          </div>

          {/* ACTIVE FOLDER BANNER (When viewing a specific folder or unfiled) */}
          {activeFolder && activeTheme && (
            <div
              className={`my-6 p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${activeTheme.bg} ${activeTheme.border} animate-fadeIn`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${activeTheme.bg} ${activeTheme.border}`}
                >
                  <FolderOpen className={`w-5 h-5 ${activeTheme.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-white font-serif truncate">
                      {activeFolder.name}
                    </h2>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${activeTheme.badge}`}>
                      {activeTheme.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {getFolderDocCount(activeFolder.id)} bookmarked {getFolderDocCount(activeFolder.id) === 1 ? 'file' : 'files'} in this folder
                  </p>
                </div>
              </div>

              {/* Folder Actions Menu: Move Files, Rename, Change Color, Delete */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  id={`btn-move-files-folder-${activeFolder.id}`}
                  onClick={() => setIsMoveFilesModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all active:scale-95 shadow-md shadow-amber-500/20"
                  title={`Select and move existing bookmarked files into "${activeFolder.name}"`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Move Files</span>
                </button>

                <button
                  id={`btn-edit-folder-${activeFolder.id}`}
                  onClick={() => handleOpenEditFolder(activeFolder)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs font-medium transition-all"
                  title="Rename folder or customize color theme"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Folder</span>
                </button>

                <button
                  id={`btn-delete-folder-${activeFolder.id}`}
                  onClick={() => setFolderToDelete(activeFolder)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-red-950/40 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-300 text-xs font-medium transition-all"
                  title="Delete this folder (saved files will remain safe in All Bookmarks)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}

          {selectedFolderId === 'unfiled' && (
            <div className="my-6 p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/5">
                  <FolderMinus className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white font-serif">Unfiled Bookmarks</h2>
                  <p className="text-xs text-slate-400">
                    {unfiledCount} {unfiledCount === 1 ? 'file' : 'files'} not assigned to any folder
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenCreateFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create Folder for These</span>
              </button>
            </div>
          )}

          {/* Controls: Search & Document Type Filter Tabs */}
          <div className="my-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-white/10 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setSelectedType('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedType === 'All'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All in View ({folderDocuments.length})
              </button>

              <button
                onClick={() => setSelectedType('Thesis')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedType === 'Thesis'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Theses</span>
              </button>

              <button
                onClick={() => setSelectedType('Grand Case Presentation')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedType === 'Grand Case Presentation'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>GCPs</span>
              </button>
            </div>

            {/* Quick Search within bookmarks */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter saved documents..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
              />
            </div>
          </div>

          {/* Grid of Bookmarked Documents or Empty Folder States */}
          {folderDocuments.length === 0 ? (
            /* Empty folder state */
            <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/40 border border-white/10 text-center max-w-lg mx-auto my-8 backdrop-blur-xl">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 border ${
                  activeTheme ? `${activeTheme.bg} ${activeTheme.border}` : 'bg-slate-800 border-white/10'
                }`}
              >
                <Folder className={`w-7 h-7 ${activeTheme ? activeTheme.iconColor : 'text-slate-400'}`} />
              </div>

              <h3 className="text-lg font-bold text-white font-serif">
                {activeFolder ? `"${activeFolder.name}" is empty` : 'No unfiled bookmarks'}
              </h3>

              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {activeFolder
                  ? 'Organize your bookmarks by selecting files to move into this folder, or click the folder icon on any document card.'
                  : 'All your bookmarked documents have been assigned to custom folders.'}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {activeFolder && (
                  <button
                    id={`btn-empty-folder-move-files-${activeFolder.id}`}
                    onClick={() => setIsMoveFilesModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Move Files to this Folder</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedFolderId('all')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-white/10 transition-all"
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                  <span>View All Bookmarks</span>
                </button>
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            /* Search yielded no matches in this folder */
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-white/5 text-center max-w-md mx-auto my-8">
              <Search className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-200">No matching bookmarks found</p>
              <p className="text-xs text-slate-400 mt-1">
                No saved documents matched "{searchQuery}" in this view.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('All');
                }}
                className="mt-4 px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-medium"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            /* Document Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full max-w-full min-w-0">
              {filteredDocuments.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onPreview={onPreviewDocument}
                  onOpenFull={onOpenFullDocument}
                  onRequestCreateFolder={handleOpenCreateFolder}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* CREATE / EDIT FOLDER MODAL */}
      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setFolderToEdit(null);
        }}
        onSave={handleSaveFolder}
        folderToEdit={folderToEdit}
      />

      {/* DELETE FOLDER CONFIRMATION MODAL */}
      {folderToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setFolderToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-scaleUp"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-serif">Delete Folder?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 mb-5 text-xs text-slate-300 space-y-2">
              <p>
                Are you sure you want to delete folder <strong className="text-white font-semibold">"{folderToDelete.name}"</strong>?
              </p>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                <span>
                  <strong>Files will not be deleted:</strong> All bookmarked files in this folder will remain safely preserved in your general <em>All Bookmarked Files</em> view.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-600/20"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE FILES TO FOLDER MODAL */}
      {activeFolder && (
        <MoveFilesToFolderModal
          isOpen={isMoveFilesModalOpen}
          onClose={() => setIsMoveFilesModalOpen(false)}
          targetFolder={activeFolder}
          bookmarkedDocuments={bookmarkedDocuments}
          docFolderMap={docFolderMap}
          folders={folders}
          onMoveFiles={(docIds, targetFolderId) => {
            assignMultipleDocsToFolder(docIds, targetFolderId);
          }}
        />
      )}
    </div>
  );
};
