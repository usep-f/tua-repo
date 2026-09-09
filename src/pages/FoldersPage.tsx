import React, { useState } from 'react';
import {
  Folder,
  FolderPlus,
  Bookmark,
  BookOpen,
  Trash2,
  Edit2,
  Plus,
  ArrowLeft,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { BookmarkFolder, FolderColor, NursingDocument } from '../types';
import { useUserActivity } from '../context/UserActivityContext';
import { FOLDER_THEMES } from '../lib/folderThemes';
import { FolderModal } from '../components/FolderModal';
import { MoveFilesToFolderModal } from '../components/MoveFilesToFolderModal';

interface FoldersPageProps {
  onNavigateBookmarks: () => void;
  onBrowseRepository: () => void;
  onReturnHome: () => void;
  onPreviewDocument: (doc: NursingDocument) => void;
  onOpenFullDocument: (doc: NursingDocument) => void;
}

export const FoldersPage: React.FC<FoldersPageProps> = ({
  onNavigateBookmarks,
  onBrowseRepository,
  onReturnHome,
  onPreviewDocument,
  onOpenFullDocument,
}) => {
  const {
    folders,
    bookmarkedDocuments,
    docFolderMap,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolderDocCount,
    reconcileBookmarks,
    isLoadingBookmarks,
  } = useUserActivity();

  // State for selected folder to view its content, or 'none'
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Folder modal state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<BookmarkFolder | null>(null);

  // Move files modal state
  const [isMoveFilesModalOpen, setIsMoveFilesModalOpen] = useState(false);

  // Delete folder state
  const [folderToDelete, setFolderToDelete] = useState<BookmarkFolder | null>(null);

  const handleOpenCreateFolder = () => {
    setFolderToEdit(null);
    setIsFolderModalOpen(true);
  };

  const handleOpenEditFolder = (folder: BookmarkFolder) => {
    setFolderToEdit(folder);
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = (name: string, color: FolderColor) => {
    if (folderToEdit) {
      updateFolder(folderToEdit.id, { name, color });
    } else {
      const newFolder = createFolder(name, color);
      setSelectedFolderId(newFolder.id);
    }
  };

  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete) return;
    deleteFolder(folderToDelete.id);
    if (selectedFolderId === folderToDelete.id) {
      setSelectedFolderId(null);
    }
    setFolderToDelete(null);
  };

  const activeFolder = folders.find(f => f.id === selectedFolderId);
  const activeTheme = activeFolder ? FOLDER_THEMES[activeFolder.color] : null;

  // Documents inside active folder
  const folderDocs = activeFolder
    ? bookmarkedDocuments.filter(doc => doc && docFolderMap[doc.id] === activeFolder.id)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fadeIn w-full min-w-0">
      {/* Top Breadcrumb / Navigation */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={onNavigateBookmarks}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>View Bookmarked Files</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => reconcileBookmarks()}
            disabled={isLoadingBookmarks}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 hover:text-slate-200 text-xs transition-all disabled:opacity-50"
            title="Sync bookmarks status"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingBookmarks ? 'animate-spin text-amber-400' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            <span>Organization System</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-serif uppercase tracking-tight">
            Folders & Collections
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Manage your custom color-coded folders to organize your saved research and nursing documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-create-folder-page"
            onClick={handleOpenCreateFolder}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create Folder</span>
          </button>
        </div>
      </div>

      {/* If viewing a specific folder content */}
      {activeFolder && activeTheme ? (
        <div className="mt-8 animate-fadeIn">
          {/* Folder Details Banner */}
          <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${activeTheme.bg} ${activeTheme.border}`}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="p-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white transition-all"
                title="Back to all folders"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${activeTheme.bg} ${activeTheme.border}`}>
                <FolderOpen className={`w-6 h-6 ${activeTheme.iconColor}`} />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white font-serif">{activeFolder.name}</h2>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${activeTheme.badge}`}>
                    {activeTheme.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {folderDocs.length} bookmarked {folderDocs.length === 1 ? 'file' : 'files'} in this collection
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setIsMoveFilesModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Move Files Here</span>
              </button>

              <button
                onClick={() => handleOpenEditFolder(activeFolder)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-medium transition-all"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => setFolderToDelete(activeFolder)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-red-950/40 border border-white/10 text-slate-400 hover:text-red-300 text-xs font-medium transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Folder Content Documents */}
          <div className="mt-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono mb-4">
              Documents in "{activeFolder.name}"
            </h3>

            {folderDocs.length === 0 ? (
              <div className="p-12 rounded-3xl bg-slate-900/40 border border-white/10 text-center max-w-md mx-auto my-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white font-serif">This folder is empty.</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Add bookmarked documents to this folder to organize them here.
                </p>
                <button
                  onClick={() => setIsMoveFilesModalOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Bookmarked Files</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {folderDocs.map(doc => (
                  <div key={doc.id} className="relative">
                    {/* Render standard DocumentCard */}
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {doc.document_type}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{doc.academic_year}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white line-clamp-2 hover:text-amber-300 transition-colors cursor-pointer" onClick={() => onPreviewDocument(doc)}>
                          {doc.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{doc.authors}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <button
                          onClick={() => onPreviewDocument(doc)}
                          className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Preview PDF</span>
                        </button>
                        <button
                          onClick={() => onOpenFullDocument(doc)}
                          className="text-xs text-slate-300 hover:text-white font-medium"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Folder Grid View */
        <div className="mt-8">
          {folders.length === 0 ? (
            <div className="p-12 sm:p-16 rounded-3xl bg-slate-900/40 border border-white/10 text-center max-w-xl mx-auto my-12 backdrop-blur-xl shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-bold text-white font-serif">No folders yet.</h2>

              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Create a folder to organize your bookmarked documents.
              </p>

              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  onClick={handleOpenCreateFolder}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Create Folder</span>
                </button>

                <button
                  onClick={onNavigateBookmarks}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
                >
                  View Bookmarked Files
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {folders.map(folder => {
                const theme = FOLDER_THEMES[folder.color] || FOLDER_THEMES.amber;
                const count = getFolderDocCount(folder.id);

                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`p-6 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between ${theme.bg} ${theme.border} group`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${theme.bg} ${theme.border}`}>
                          <Folder className={`w-5 h-5 ${theme.iconColor}`} />
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase ${theme.badge}`}>
                          {count} {count === 1 ? 'file' : 'files'}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white font-serif group-hover:text-amber-300 transition-colors">
                        {folder.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Custom color-coded collection for saved research files.
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Open Collection
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenEditFolder(folder)}
                          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
                          title="Edit Folder"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                        <button
                          onClick={() => setFolderToDelete(folder)}
                          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-red-950/40 text-slate-400 hover:text-red-300 transition-all"
                          title="Delete Folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Folder Create/Edit Modal */}
      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onSave={handleSaveFolder}
        folderToEdit={folderToEdit}
      />

      {/* Move Files to Folder Modal */}
      {activeFolder && (
        <MoveFilesToFolderModal
          isOpen={isMoveFilesModalOpen}
          onClose={() => setIsMoveFilesModalOpen(false)}
          folderId={activeFolder.id}
          folderName={activeFolder.name}
        />
      )}

      {/* Delete Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white font-serif mb-2">Delete Folder</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">"{folderToDelete.name}"</span>?
              Your bookmarked documents will remain safe and accessible in your main Bookmarked Files list.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
