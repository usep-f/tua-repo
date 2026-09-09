import React, { useEffect, useState } from 'react';
import { formatKeywords } from '../lib/utils';
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  BookOpen,
  Tag,
  Share2,
  Check,
  FileText,
  UserCheck,
  Clock,
  Bookmark,
  Folder,
  ChevronDown,
} from 'lucide-react';
import { NursingDocument, FolderColor } from '../types';
import { fetchDocumentById } from '../lib/documentService';
import { PdfViewer } from '../components/PdfViewer';
import { getDocumentPublicUrl } from '../lib/supabase';
import { useUserActivity } from '../context/UserActivityContext';
import { FOLDER_THEMES } from '../lib/folderThemes';
import { FolderAssignMenu } from '../components/FolderAssignMenu';
import { FolderModal } from '../components/FolderModal';

interface DocumentViewerPageProps {
  documentId: string;
  initialDocument?: NursingDocument | null;
  onBack: () => void;
}

export const DocumentViewerPage: React.FC<DocumentViewerPageProps> = ({
  documentId,
  initialDocument,
  onBack,
}) => {
  const [document, setDocument] = useState<NursingDocument | null>(initialDocument || null);
  const [loading, setLoading] = useState<boolean>(!initialDocument);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  const {
    isBookmarked,
    toggleBookmark,
    trackView,
    folders,
    getDocFolder,
    assignDocToFolder,
    createFolder,
  } = useUserActivity();

  useEffect(() => {
    if (!initialDocument && documentId) {
      setLoading(true);
      fetchDocumentById(documentId)
        .then(doc => {
          setDocument(doc);
          if (doc) {
            trackView(doc);
          }
        })
        .catch(err => console.error('Failed to load document:', err))
        .finally(() => setLoading(false));
    } else if (initialDocument) {
      trackView(initialDocument);
    }
  }, [documentId, initialDocument, trackView]);

  const docPath = document?.storage_path || document?.file_path || (document as any)?.file_url || '';
  const publicPdfUrl = docPath ? getDocumentPublicUrl(docPath) : (document?.public_url || '');

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin mb-4" />
        <p className="text-slate-300 font-medium text-sm">Loading document details and PDF...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 mb-4">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-80" />
          <h3 className="text-lg font-semibold mb-1">Document Not Found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            The requested nursing thesis or Grand Case Presentation could not be retrieved from the repository.
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Repository</span>
        </button>
      </div>
    );
  }

  const isThesis = document.document_type === 'Thesis';
  const keywordList = formatKeywords(document.keywords);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fadeIn">
      {/* Back button and quick actions banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <button
          id="btn-back-repository"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold tracking-wide transition-all active:scale-95 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Repository</span>
        </button>

        {/* Desktop quick actions banner */}
        <div className="hidden xl:flex items-center gap-2.5">
          <button
            id="btn-viewer-bookmark"
            onClick={() => toggleBookmark(document)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
              isBookmarked(document.id)
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-sm shadow-amber-500/10'
                : 'bg-slate-900/80 hover:bg-slate-800 border-white/10 text-slate-300 hover:text-amber-300'
            }`}
            title={isBookmarked(document.id) ? 'Remove from bookmarks' : 'Add to bookmarks'}
          >
            <Bookmark
              className={`w-3.5 h-3.5 transition-all ${
                isBookmarked(document.id) ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
            <span>{isBookmarked(document.id) ? 'Bookmarked' : 'Bookmark'}</span>
          </button>

          {/* Folder Assignment Menu Trigger (when bookmarked) */}
          {isBookmarked(document.id) && (() => {
            const assignedFolder = getDocFolder(document.id);
            const folderTheme = assignedFolder ? FOLDER_THEMES[assignedFolder.color] : undefined;
            return (
              <div className="relative">
                <button
                  id="btn-viewer-folder"
                  onClick={() => setIsFolderMenuOpen(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                    assignedFolder && folderTheme
                      ? `${folderTheme.bg} ${folderTheme.text} ${folderTheme.border}`
                      : 'bg-slate-900/80 hover:bg-slate-800 border-white/10 text-slate-300'
                  }`}
                  title={assignedFolder ? `Folder: ${assignedFolder.name} (Click to change)` : 'Assign to folder'}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline truncate max-w-[120px]">
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
            );
          })()}

          <button
            id="btn-share-doc"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-medium transition-all"
            title="Copy URL link to this document"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Responsive layout:
          Desktop layout (xl: 1280px+): Metadata panel on the left (xl:col-span-5), sticky PDF viewer on the right (xl:col-span-7)
          Tablet & Mobile layout (< 1280px): Title and metadata first, action controls second, PDF viewer below */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left Column (Desktop) / First Section (Mobile & Tablet): Title, Metadata & Action Controls */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl space-y-6">
            {/* Document Type Badge & Academic Year */}
            <div className="flex items-center justify-between gap-3">
              <span
                className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
                  isThesis
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isThesis ? (
                  <GraduationCap className="w-4 h-4 text-blue-400" />
                ) : (
                  <BookOpen className="w-4 h-4 text-amber-400" />
                )}
                <span>{document.document_type}</span>
              </span>

              <span className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1 rounded-full border border-white/5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>AY {document.academic_year}</span>
              </span>
            </div>

            {/* Document Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug tracking-tight">
                {document.title}
              </h1>
            </div>

            {/* Authors */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Authors / Researchers
              </span>
              <p className="text-sm font-medium text-slate-200">
                {document.authors}
              </p>
            </div>

            {/* Program & Clinical Category */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Program
                </span>
                <span className="font-semibold text-slate-200">{document.program}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Category
                </span>
                <span className="font-semibold text-blue-300">{document.category}</span>
              </div>
            </div>

            {/* Description / Abstract */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Description & Abstract
              </span>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-white/5 max-h-60 overflow-y-auto whitespace-pre-line">
                {document.description || 'No description provided.'}
              </p>
            </div>

            {/* Keywords */}
            {keywordList.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  Keywords & Subject Headings
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {keywordList.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-blue-950/40 text-blue-200 text-xs border border-blue-500/20 font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Archival Metadata Details */}
            <div className="pt-4 border-t border-white/10 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">File Name:</span>
                <span className="font-mono text-[11px] text-slate-300 truncate max-w-[200px]">
                  {document.file_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Archived Date:</span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {new Date(document.uploaded_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Tablet & Mobile Action Buttons & Controls (Step 3: Title -> Metadata -> Actions/Controls -> PDF) */}
            <div className="pt-4 border-t border-white/10 xl:hidden space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Document Actions
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="btn-viewer-bookmark-mobile"
                  onClick={() => toggleBookmark(document)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-95 touch-manipulation ${
                    isBookmarked(document.id)
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-sm shadow-amber-500/10'
                      : 'bg-slate-950/80 hover:bg-slate-800 border-white/10 text-slate-300 hover:text-amber-300'
                  }`}
                  title={isBookmarked(document.id) ? 'Remove from bookmarks' : 'Add to bookmarks'}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 transition-all ${
                      isBookmarked(document.id) ? 'fill-amber-400 text-amber-400' : ''
                    }`}
                  />
                  <span>{isBookmarked(document.id) ? 'Bookmarked' : 'Bookmark'}</span>
                </button>

                {isBookmarked(document.id) && (() => {
                  const assignedFolder = getDocFolder(document.id);
                  const folderTheme = assignedFolder ? FOLDER_THEMES[assignedFolder.color] : undefined;
                  return (
                    <div className="relative">
                      <button
                        id="btn-viewer-folder-mobile"
                        onClick={() => setIsFolderMenuOpen(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-95 touch-manipulation ${
                          assignedFolder && folderTheme
                            ? `${folderTheme.bg} ${folderTheme.text} ${folderTheme.border}`
                            : 'bg-slate-950/80 hover:bg-slate-800 border-white/10 text-slate-300'
                        }`}
                        title={assignedFolder ? `Folder: ${assignedFolder.name} (Click to change)` : 'Assign to folder'}
                      >
                        <Folder className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">
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
                        align="left"
                      />
                    </div>
                  );
                })()}

                <button
                  id="btn-share-doc-mobile"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-medium transition-all active:scale-95 touch-manipulation"
                  title="Copy URL link to this document"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Desktop) / Second Section (Tablet & Mobile): PDF Viewer (Always below title, metadata, and controls on tablet/mobile) */}
        <div className="xl:col-span-7 xl:sticky xl:top-24 min-h-0 w-full">
          <PdfViewer
            url={publicPdfUrl}
            storagePath={docPath}
            fileName={document.file_name}
            title={document.title}
          />
        </div>
      </div>

      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onSave={(name, color) => {
          const newFolder = createFolder(name, color);
          if (document) {
            assignDocToFolder(document.id, newFolder.id);
          }
        }}
      />
    </div>
  );
};
