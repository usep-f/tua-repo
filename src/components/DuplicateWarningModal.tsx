import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Eye,
  X,
  CheckCircle2,
  ArrowRight,
  FileText,
  Calendar,
  GraduationCap,
  BookOpen,
  User,
  ShieldAlert,
} from 'lucide-react';
import { NursingDocument, DuplicateCheckResult, DuplicateMatch } from '../types';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  duplicateResult: DuplicateCheckResult | null;
  newDocumentInfo: {
    title: string;
    authors: string;
    academicYear: string;
    documentType: string;
    program: string;
    fileName?: string;
  };
  onClose: () => void;
  onUploadAnyway: () => void;
  onViewDocument: (doc: NursingDocument) => void;
  isSubmitting?: boolean;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  duplicateResult,
  newDocumentInfo,
  onClose,
  onUploadAnyway,
  onViewDocument,
  isSubmitting = false,
}) => {
  if (!isOpen || !duplicateResult || !duplicateResult.hasDuplicates) return null;

  const isExact = !!duplicateResult.exactMatch;
  const matches = duplicateResult.matches;
  const matchCount = matches.length;
  const primaryMatch = matches[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Banner */}
        <div
          className={`p-6 sm:p-7 border-b ${
            isExact
              ? 'bg-gradient-to-r from-red-950/80 via-red-900/40 to-slate-900 border-red-500/30'
              : 'bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border-amber-500/30'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isExact
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                }`}
              >
                {isExact ? (
                  <AlertOctagon className="w-6 h-6 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded-md ${
                      isExact
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isExact ? '🔴 Exact Duplicate' : '⚠️ Possible Duplicate Detected'}
                  </span>
                  {matchCount > 1 && (
                    <span className="text-xs text-slate-400">
                      ({matchCount} potential matches found)
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mt-1.5 tracking-tight">
                  {isExact
                    ? 'This exact PDF already exists in The Maltese Archive.'
                    : 'Potential Duplicate Document Detected'}
                </h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {isExact
                    ? 'The cryptographic SHA-256 file signature matches an existing repository document. The administrator must review before deciding.'
                    : 'We found an existing document that may be the same as the file you are trying to upload. Please review below.'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close warning"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Matches Content */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5 flex-1">
          {/* New Document being uploaded summary */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
                You Are Attempting to Upload
              </span>
              {newDocumentInfo.fileName && (
                <span className="font-mono text-slate-400 truncate max-w-[200px]">
                  {newDocumentInfo.fileName}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-100 line-clamp-2 font-serif">
              {newDocumentInfo.title || 'Untitled Document'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-400 text-[11px]">
              <span>AY {newDocumentInfo.academicYear}</span>
              <span>•</span>
              <span>{newDocumentInfo.program}</span>
              <span>•</span>
              <span>{newDocumentInfo.documentType}</span>
              {newDocumentInfo.authors && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[240px]">
                    Authors: {newDocumentInfo.authors}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* List of existing matching documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Existing Repository Document{matches.length > 1 ? `s (${matches.length})` : ''}
              </h3>
              <span className="text-[11px] text-slate-400">
                Sorted by highest similarity
              </span>
            </div>

            <div className="space-y-3.5">
              {matches.map((match, index) => {
                const doc = match.document;
                const isExactItem = match.isExactFile || match.similarityScore >= 99;

                return (
                  <div
                    key={doc.id || index}
                    className={`p-4 rounded-2xl border transition-all ${
                      isExactItem
                        ? 'bg-red-950/20 border-red-500/40 hover:border-red-500/60'
                        : match.similarityScore >= 85
                        ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
                        : 'bg-slate-950/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Match score chip */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                              isExactItem
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : match.similarityScore >= 85
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {isExactItem ? '100% Exact Match' : `${match.similarityScore}% Similarity`}
                          </span>

                          <span className="text-xs font-medium text-slate-400">
                            {match.severity === 'exact'
                              ? 'Exact PDF File'
                              : match.severity === 'highly_likely'
                              ? 'Highly Likely Duplicate'
                              : 'Possible Duplicate'}
                          </span>
                        </div>

                        {/* Document Title */}
                        <h4 className="text-sm font-bold text-white font-serif tracking-tight line-clamp-2">
                          {doc.title}
                        </h4>

                        {/* Metadata fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300 pt-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-slate-400 font-medium">Type:</span>
                            <span className="truncate">{doc.document_type}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-slate-400 font-medium">Program:</span>
                            <span className="truncate">{doc.program}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-slate-400 font-medium">Year:</span>
                            <span>{doc.academic_year}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-slate-400 font-medium">File:</span>
                            <span className="font-mono text-[11px] text-slate-400 truncate">
                              {doc.file_name}
                            </span>
                          </div>
                        </div>

                        {doc.authors && (
                          <p className="text-xs text-slate-400 pt-0.5">
                            <span className="text-slate-400 font-medium">Authors: </span>
                            <span className="text-slate-300">{doc.authors}</span>
                          </p>
                        )}

                        {/* Detection reasons */}
                        {match.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {match.reasons.map((reason, rIdx) => (
                              <span
                                key={rIdx}
                                className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-white/10 text-slate-300 font-mono"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* View Existing Document Action */}
                      <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                        <button
                          type="button"
                          id={`btn-view-duplicate-${doc.id}`}
                          onClick={() => onViewDocument(doc)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-colors group"
                        >
                          <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          <span>View Existing Document</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer Decisions */}
        <div className="p-5 sm:p-6 bg-slate-950/80 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            Administrator discretion: You can cancel to make changes or proceed with upload.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-cancel-duplicate-upload"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-white/10 disabled:opacity-50"
            >
              Cancel Upload
            </button>

            <button
              type="button"
              id="btn-upload-duplicate-anyway"
              onClick={onUploadAnyway}
              disabled={isSubmitting}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                isExact
                  ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-600/20'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Upload Anyway</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
