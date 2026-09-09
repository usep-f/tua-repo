import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  ExternalLink,
  BookOpen,
  GraduationCap,
  Calendar,
  Tag,
  Bookmark,
  Folder,
  MoreVertical,
  Share2,
  Check,
} from 'lucide-react';
import { NursingDocument } from '../types';
import { getDocumentPublicUrl } from '../lib/supabase';
import { useUserActivity } from '../context/UserActivityContext';
import { FOLDER_THEMES } from '../lib/folderThemes';
import { MoveToFolderModal } from './MoveToFolderModal';

interface DocumentCardProps {
  document: NursingDocument;
  onPreview: (doc: NursingDocument) => void;
  onOpenFull: (doc: NursingDocument) => void;
  onRequestCreateFolder?: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onPreview,
  onOpenFull,
  onRequestCreateFolder,
}) => {
  const {
    isBookmarked,
    toggleBookmark,
    folders,
    getDocFolder,
    assignDocToFolder,
    createFolder,
  } = useUserActivity();

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const bookmarked = isBookmarked(document.id);
  const isThesis = document.document_type === 'Thesis';
  const assignedFolder = bookmarked ? getDocFolder(document.id) : undefined;
  const folderTheme = assignedFolder ? FOLDER_THEMES[assignedFolder.color] : undefined;

  // Handle click outside for more actions menu
  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreMenuOpen]);

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(document);
  };

  const handleMoreMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMoreMenuOpen(prev => !prev);
  };

  const handleOpenMoveModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsMoreMenuOpen(false);
    setIsMoveModalOpen(true);
  };

  const handleCopyShareLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const docUrl = `${window.location.origin}/?view=viewer&id=${document.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(docUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        setIsMoreMenuOpen(false);
      });
    }
  };

  return (
    <>
      <div
        id={`doc-card-${document.id}`}
        className="group relative flex flex-col justify-between p-3.5 sm:p-4.5 md:p-5 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-xl border border-white/10 hover:border-amber-400/40 shadow-xl hover:shadow-2xl hover:shadow-blue-950/40 transition-all duration-300 transform hover:-translate-y-1 w-full max-w-full min-w-0 box-border"
      >
        {/* Top metadata & action controls: Responsive Row with natural wrap */}
        <div className="w-full min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-y-2.5 gap-x-2 mb-3.5 w-full min-w-0">
            {/* Left metadata group: Document Type Badge & Academic Year */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              {/* 1. Document Type Badge */}
              <span
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide uppercase shrink-0 ${
                  isThesis
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isThesis ? (
                  <GraduationCap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="whitespace-nowrap">{document.document_type}</span>
              </span>

              {/* 2. Academic Year */}
              <div className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-mono text-slate-400 bg-slate-800/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-white/5 shrink-0 whitespace-nowrap">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span>AY {document.academic_year}</span>
              </div>
            </div>

            {/* Right action controls: Folder/Category Button → Bookmark Button */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {/* 3. Folder/Category Button */}
              <button
                id={`btn-card-folder-${document.id}`}
                onClick={handleOpenMoveModal}
                className={`w-8 h-8 rounded-lg border transition-all active:scale-95 flex items-center justify-center shrink-0 ${
                  assignedFolder && folderTheme
                    ? `${folderTheme.bg} ${folderTheme.text} ${folderTheme.border}`
                    : 'bg-slate-800/60 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800 hover:border-amber-400/30'
                }`}
                title={assignedFolder ? `Folder: ${assignedFolder.name} (Click to Move to Folder)` : 'Move to Folder / Category'}
                aria-label="Move to Folder"
              >
                <Folder className="w-3.5 h-3.5 shrink-0" />
              </button>

              {/* 4. Bookmark Button */}
              <button
                id={`btn-card-bookmark-${document.id}`}
                onClick={handleBookmarkToggle}
                className={`w-8 h-8 rounded-lg border transition-all active:scale-95 flex items-center justify-center shrink-0 ${
                  bookmarked
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm shadow-amber-500/20'
                    : 'bg-slate-800/60 text-slate-400 border-white/10 hover:text-amber-300 hover:bg-slate-800 hover:border-amber-400/30'
                }`}
                title={bookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
                aria-label={bookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
              >
                <Bookmark
                  className={`w-3.5 h-3.5 shrink-0 transition-all ${
                    bookmarked ? 'fill-amber-400 text-amber-400 scale-105' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Assigned Folder Badge (if document is filed into a custom folder) */}
          {assignedFolder && folderTheme && (
            <div className="mb-2 max-w-full min-w-0">
              <button
                onClick={handleOpenMoveModal}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium border transition-all hover:scale-102 max-w-full truncate ${folderTheme.badge}`}
                title={`In folder "${assignedFolder.name}". Click to move or unfile.`}
              >
                <Folder className={`w-3 h-3 shrink-0 ${folderTheme.iconColor}`} />
                <span className="truncate max-w-[180px] sm:max-w-[220px]">{assignedFolder.name}</span>
              </button>
            </div>
          )}

          {/* Title */}
          <h3
            onClick={() => onOpenFull(document)}
            className="text-base sm:text-lg font-semibold text-slate-100 group-hover:text-amber-200 transition-colors line-clamp-2 mb-2 cursor-pointer break-words"
            title={document.title}
          >
            {document.title}
          </h3>

          {/* Authors */}
          <p className="text-xs text-slate-300 font-medium mb-3 line-clamp-1 break-words">
            <span className="text-slate-500">By: </span>
            {Array.isArray(document.authors) ? document.authors.join(', ') : document.authors}
          </p>

          {/* Program & Category Badges */}
          <div className="flex flex-wrap gap-1.5 mb-4 max-w-full min-w-0">
            <span className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-white/5 font-medium max-w-full truncate">
              {document.program}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-blue-950/40 text-blue-300 border border-blue-500/20 font-medium max-w-full truncate">
              <Tag className="w-2.5 h-2.5 text-blue-400 shrink-0" />
              <span className="truncate">{document.category}</span>
            </span>
          </div>

          {/* Description snippet */}
          {document.description && (
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-5 break-words">
              {document.description}
            </p>
          )}
        </div>

        {/* Action Buttons: Preview, Open Full PDF, and ⋯ More Actions Menu */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-1.5 sm:gap-2 mt-auto w-full min-w-0">
          <button
            id={`btn-card-preview-${document.id}`}
            onClick={() => onPreview(document)}
            className="flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs font-medium transition-all active:scale-95"
          >
            <Eye className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="truncate">Preview PDF</span>
          </button>

          <button
            id={`btn-card-full-${document.id}`}
            onClick={() => onOpenFull(document)}
            className="flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <span className="truncate">Open Full</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </button>

          {/* ⋯ More Actions Button & Dropdown Menu */}
          <div className="relative shrink-0" ref={moreMenuRef}>
            <button
              id={`btn-card-more-${document.id}`}
              onClick={handleMoreMenuToggle}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition-all active:scale-95 flex items-center justify-center shrink-0 ${
                isMoreMenuOpen
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white'
              }`}
              title="More actions"
              aria-label="More actions"
              aria-expanded={isMoreMenuOpen}
            >
              <MoreVertical className="w-4 h-4 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {isMoreMenuOpen && (
              <div
                className="absolute right-0 bottom-full mb-2 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 z-40 animate-scaleUp text-left"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-2.5 py-1.5 border-b border-white/10 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Document Options
                  </span>
                </div>

                {/* Move to Folder - Visibly present in the ⋯ menu */}
                <button
                  id={`btn-card-action-move-${document.id}`}
                  onClick={handleOpenMoveModal}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-300 hover:bg-amber-500/15 hover:text-amber-200 transition-colors group/item"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder className="w-4 h-4 text-amber-400 shrink-0 group-hover/item:scale-110 transition-transform" />
                    <span className="truncate">Move to Folder</span>
                  </div>
                  {assignedFolder && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 truncate max-w-[70px]">
                      {assignedFolder.name}
                    </span>
                  )}
                </button>

                {/* Remove Bookmark / Bookmark File */}
                <button
                  id={`btn-card-action-bookmark-${document.id}`}
                  onClick={e => {
                    handleBookmarkToggle(e);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Bookmark
                    className={`w-4 h-4 shrink-0 ${
                      bookmarked ? 'text-amber-400 fill-amber-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{bookmarked ? 'Remove Bookmark' : 'Bookmark File'}</span>
                </button>

                {/* Copy Link */}
                <button
                  id={`btn-card-action-share-${document.id}`}
                  onClick={handleCopyShareLink}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Share2 className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Move to Folder Modal */}
      <MoveToFolderModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        documentId={document.id}
        documentTitle={document.title}
        currentFolder={assignedFolder}
        folders={folders}
        onAssignToFolder={assignDocToFolder}
        onCreateFolder={createFolder}
      />
    </>
  );
};

