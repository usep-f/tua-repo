import React, { useState } from 'react';
import {
  Folder,
  FolderMinus,
  Check,
  Plus,
  X,
  FileText,
  Bookmark,
} from 'lucide-react';
import { BookmarkFolder, FolderColor } from '../types';
import { FOLDER_THEMES } from '../lib/folderThemes';
import { FolderModal } from './FolderModal';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle?: string;
  currentFolder?: BookmarkFolder;
  folders: BookmarkFolder[];
  onAssignToFolder: (documentId: string, folderId: string | null) => void;
  onCreateFolder?: (name: string, color?: FolderColor) => BookmarkFolder;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  currentFolder,
  folders,
  onAssignToFolder,
  onCreateFolder,
}) => {
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleSelectFolder = (folderId: string | null) => {
    onAssignToFolder(documentId, folderId);
    onClose();
  };

  const handleCreateNewFolder = (name: string, color: FolderColor) => {
    if (onCreateFolder) {
      const newFolder = onCreateFolder(name, color);
      // Immediately assign document to this newly created folder
      onAssignToFolder(documentId, newFolder.id);
      setIsNewFolderModalOpen(false);
      onClose();
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-folder-modal-title"
      >
        <div
          className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-white/15 rounded-3xl p-6 shadow-2xl animate-scaleUp text-left"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                <Folder className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="move-folder-modal-title"
                  className="text-lg font-bold text-white font-serif tracking-tight"
                >
                  Move to Folder
                </h2>
                <p className="text-xs text-slate-400 truncate">
                  Select a destination folder for this saved file
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Document Title Snippet */}
          {documentTitle && (
            <div className="my-4 p-3 rounded-2xl bg-slate-950/60 border border-white/5 flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-amber-400/80 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-snug">
                  {documentTitle}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400">
                  <span>Current location:</span>
                  <span className="font-semibold text-amber-300">
                    {currentFolder ? currentFolder.name : 'All Bookmarked Files (Unfiled)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Destination Folder List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 my-3 custom-scrollbar">
            {/* 1. All Bookmarked Files / No Folder Option */}
            <button
              id="btn-move-dest-all"
              type="button"
              onClick={() => handleSelectFolder(null)}
              className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all text-left ${
                !currentFolder
                  ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm shadow-amber-500/10'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5 hover:border-white/15 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Radio Circle */}
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    !currentFolder
                      ? 'border-amber-400 bg-amber-400/20'
                      : 'border-slate-500 bg-slate-800'
                  }`}
                >
                  {!currentFolder && (
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>

                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center shrink-0 text-slate-300">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    All Bookmarked Files
                  </p>
                  <p className="text-[11px] text-slate-400">
                    No specific folder (general bookmarks collection)
                  </p>
                </div>
              </div>

              {!currentFolder && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-semibold uppercase tracking-wider shrink-0">
                  Current
                </span>
              )}
            </button>

            {/* 2. User's Custom Folders */}
            {folders.map(folder => {
              const theme = FOLDER_THEMES[folder.color] || FOLDER_THEMES.amber;
              const isCurrent = currentFolder?.id === folder.id;

              return (
                <button
                  key={folder.id}
                  id={`btn-move-dest-${folder.id}`}
                  type="button"
                  onClick={() => handleSelectFolder(folder.id)}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all text-left ${
                    isCurrent
                      ? `${theme.bg} ${theme.border} text-white shadow-sm`
                      : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5 hover:border-white/15 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Radio Circle */}
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isCurrent
                          ? `${theme.border} ${theme.bg}`
                          : 'border-slate-500 bg-slate-800'
                      }`}
                    >
                      {isCurrent && (
                        <div className={`w-2 h-2 rounded-full ${theme.dot}`} />
                      )}
                    </div>

                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${theme.bg} ${theme.border}`}
                    >
                      <Folder className={`w-4 h-4 ${theme.iconColor}`} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {folder.name}
                      </p>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {theme.label} folder
                      </p>
                    </div>
                  </div>

                  {isCurrent ? (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider shrink-0 ${theme.badge}`}>
                      Current
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">
                      Select
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions Footer */}
          <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between gap-3">
            {onCreateFolder && (
              <button
                type="button"
                id="btn-move-create-folder"
                onClick={() => setIsNewFolderModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Inline Create Folder Modal if requested */}
      {onCreateFolder && (
        <FolderModal
          isOpen={isNewFolderModalOpen}
          onClose={() => setIsNewFolderModalOpen(false)}
          onSave={handleCreateNewFolder}
        />
      )}
    </>
  );
};
