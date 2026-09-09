import React, { useEffect, useState } from 'react';
import { X, ArrowRight, Bookmark, Folder, ChevronDown } from 'lucide-react';
import { NursingDocument, BookmarkFolder, FolderColor } from '../types';
import { PdfViewer } from './PdfViewer';
import { getDocumentPublicUrl } from '../lib/supabase';
import { useUserActivity } from '../context/UserActivityContext';
import { FOLDER_THEMES } from '../lib/folderThemes';
import { FolderAssignMenu } from './FolderAssignMenu';
import { FolderModal } from './FolderModal';

interface PdfPreviewModalProps {
  document: NursingDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullView: (doc: NursingDocument) => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  document,
  isOpen,
  onClose,
  onOpenFullView,
}) => {
  const {
    isBookmarked,
    toggleBookmark,
    trackView,
    folders,
    getDocFolder,
    assignDocToFolder,
    createFolder,
  } = useUserActivity();

  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && document) {
      trackView(document);
    }
  }, [isOpen, document, trackView]);

  if (!isOpen || !document) return null;

  const bookmarked = isBookmarked(document.id);
  const assignedFolder = bookmarked ? getDocFolder(document.id) : undefined;
  const folderTheme = assignedFolder ? FOLDER_THEMES[assignedFolder.color] : undefined;

  const docPath = document.storage_path || document.file_path || (document as any).file_url || '';
  const publicPdfUrl = docPath ? getDocumentPublicUrl(docPath) : (document.public_url || '');

  const handleCreateFolderAndAssign = (name: string, color: FolderColor) => {
    const newFolder = createFolder(name, color);
    assignDocToFolder(document.id, newFolder.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] flex flex-col bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl shadow-blue-950/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 overflow-hidden">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold tracking-wide uppercase shrink-0 ${
                document.document_type === 'Thesis'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {document.document_type}
            </span>
            <h3 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
              {document.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Bookmark button */}
            <button
              id="btn-preview-bookmark"
              onClick={() => toggleBookmark(document)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 shadow-sm ${
                bookmarked
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-amber-500/10'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border-white/10'
              }`}
              title={bookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
            >
              <Bookmark
                className={`w-3.5 h-3.5 transition-all ${
                  bookmarked ? 'fill-amber-400 text-amber-400' : ''
                }`}
              />
              <span className="hidden sm:inline">
                {bookmarked ? 'Bookmarked' : 'Bookmark'}
              </span>
            </button>

            {/* Folder Assign Button (when bookmarked) */}
            {bookmarked && (
              <div className="relative">
                <button
                  id="btn-preview-folder"
                  onClick={() => setIsFolderMenuOpen(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 shadow-sm ${
                    assignedFolder && folderTheme
                      ? `${folderTheme.bg} ${folderTheme.text} ${folderTheme.border}`
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                  }`}
                  title={assignedFolder ? `Folder: ${assignedFolder.name}` : 'Assign to folder'}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span className="hidden md:inline truncate max-w-[100px]">
                    {assignedFolder ? assignedFolder.name : 'Folder'}
                  </span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                </button>

                <FolderAssignMenu
                  isOpen={isFolderMenuOpen}
                  onClose={() => setIsFolderMenuOpen(false)}
                  documentId={document.id}
                  currentFolder={assignedFolder}
                  folders={folders}
                  onAssignToFolder={assignDocToFolder}
                  onCreateNewFolder={() => setIsFolderModalOpen(true)}
                  align="right"
                />
              </div>
            )}

            {/* Open Full View page */}
            <button
              id="btn-preview-open-full"
              onClick={() => {
                onClose();
                onOpenFullView(document);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-600/30"
            >
              <span>Full Viewer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              id="btn-preview-close"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: PDF Preview rendering page 1 preserving formatting */}
        <div className="flex-1 overflow-hidden p-4 sm:p-6 bg-slate-950/60 flex flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">Authors:</span>
              <span>{document.authors}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-medium">Year:</span>
              <span>{document.academic_year}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-medium">Program:</span>
              <span>{document.program}</span>
            </div>
            <span className="text-amber-400/90 font-mono text-[11px]">First Page Preview</span>
          </div>

          <div className="flex-1 min-h-[360px] sm:min-h-[480px] max-h-[620px] rounded-xl overflow-hidden border border-white/10">
            <PdfViewer
              url={publicPdfUrl}
              storagePath={docPath}
              fileName={document.file_name}
              title={document.title}
              initialPage={1}
              previewMode={true}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-900/90 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span className="text-slate-400 truncate max-w-sm">
            {document.category}
          </span>

          <button
            onClick={() => {
              onClose();
              onOpenFullView(document);
            }}
            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            <span>Open in Full Viewer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onSave={handleCreateFolderAndAssign}
      />
    </div>
  );
};
