import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  FolderTree,
  Tag,
  Calendar,
  GraduationCap,
  BookOpen,
  User,
  Layers,
  X,
  AlertTriangle,
  AlertOctagon,
  Search,
  Eye,
  ShieldAlert,
  Hash,
  Binary,
} from 'lucide-react';
import {
  DocumentType,
  AcademicProgram,
  NursingDocument,
  DuplicateCheckResult,
  DuplicateMatch,
} from '../types';
import { uploadDocument } from '../lib/documentService';
import { constructStoragePath, getProgramCode, getDocumentPublicUrl } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  calculateFileSha256,
  checkExactFileDuplicate,
  checkMetadataDuplicates,
} from '../lib/duplicateDetection';
import { DuplicateWarningModal } from '../components/DuplicateWarningModal';

interface AdminUploadPageProps {
  onBackToDashboard: () => void;
  onUploadSuccess: () => void;
  onViewDocument?: (doc: NursingDocument) => void;
}

const ACADEMIC_YEARS = ['2027', '2026', '2025', '2024', '2023', '2022', '2021', '2020'];
const PROGRAMS: AcademicProgram[] = [
  'BS Nursing',
  'MS Nursing',
  'DNP',
  'PhD Nursing',
  'Post-Master\'s Certificate',
];
const CATEGORIES = [
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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB in bytes

const OFFICIAL_HOLIDAYS_2026 = [
  '2026-01-01',
  '2026-03-31',
  '2026-05-01',
  '2026-06-07',
  '2026-08-15',
  '2026-09-08',
  '2026-09-21',
  '2026-12-08',
  '2026-12-13',
  '2026-12-25',
];

const isBusinessDay = (date: Date): boolean => {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sunday or Saturday
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  if (OFFICIAL_HOLIDAYS_2026.includes(dateStr)) return false;
  return true;
};

const calculateEvaluationDeadline = (startDate: Date = new Date()): string => {
  let currentDate = new Date(startDate.getTime());
  let added = 0;
  while (added < 7) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isBusinessDay(currentDate)) {
      added++;
    }
  }
  return currentDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const submissionDateStr = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const evaluationDeadlineStr = calculateEvaluationDeadline(new Date());

interface FileValidationResult {
  isValid: boolean;
  errorMsg: string | null;
  formattedSize: string;
}

const validatePdfFile = (f: File | null): FileValidationResult => {
  if (!f) {
    return { isValid: false, errorMsg: 'No file selected.', formattedSize: '0 MB' };
  }
  const sizeMB = f.size / (1024 * 1024);
  const formattedSize = `${sizeMB >= 1 ? sizeMB.toFixed(1) + ' MB' : (f.size / 1024).toFixed(1) + ' KB'}`;
  
  if (!f.name.toLowerCase().endsWith('.pdf') || f.type !== 'application/pdf') {
    return { isValid: false, errorMsg: 'Only PDF files are accepted.', formattedSize };
  }
  if (f.size > MAX_FILE_SIZE) {
    return { isValid: false, errorMsg: 'File exceeds the 50 MB limit. Please select a smaller PDF.', formattedSize };
  }
  return { isValid: true, errorMsg: null, formattedSize };
};

export const AdminUploadPage: React.FC<AdminUploadPageProps> = ({
  onBackToDashboard,
  onUploadSuccess,
  onViewDocument,
}) => {
  const { user, isAdmin } = useAuth();

  // Selected File & Hash State
  const [file, setFile] = useState<File | null>(null);
  const [terminationReportFile, setTerminationReportFile] = useState<File | null>(null);
  const [approvalSheetFile, setApprovalSheetFile] = useState<File | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<'Pending' | 'Under Review' | 'Revision Required' | 'Approved' | 'Rejected' | 'Published'>('Under Review');

  const [fileHash, setFileHash] = useState<string | null>(null);
  const [isHashingFile, setIsHashingFile] = useState<boolean>(false);
  const [isCheckingFileHash, setIsCheckingFileHash] = useState<boolean>(false);
  const [exactDuplicateMatch, setExactDuplicateMatch] = useState<DuplicateMatch | null>(null);

  // Form Metadata State
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [academicYear, setAcademicYear] = useState('2026');
  const [documentType, setDocumentType] = useState<DocumentType>('Thesis');
  const [program, setProgram] = useState<string>('BS Nursing');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');

  // Metadata Duplicate Check State
  const [isCheckingMetadata, setIsCheckingMetadata] = useState<boolean>(false);
  const [metadataMatches, setMetadataMatches] = useState<DuplicateMatch[]>([]);

  // Combined Duplicate Result & Modal State
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [showDuplicateWarningModal, setShowDuplicateWarningModal] = useState<boolean>(false);
  const [hasDismissedWarning, setHasDismissedWarning] = useState<boolean>(false);

  // Upload Process State
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Authorization check
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-slate-900 border border-red-500/30 rounded-2xl text-center">
        <h2 className="text-xl font-serif font-bold text-white mb-2">Access Denied</h2>
        <p className="text-sm text-slate-400 mb-6">
          Uploading repository documents requires administrator authorization in public.user_roles.
        </p>
        <button
          onClick={onBackToDashboard}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Computed automatic folder preview
  const estimatedFolder = `${documentType === 'Thesis' ? 'theses' : 'gcps'}/${academicYear}/${getProgramCode(program)}/[unique_file_id].pdf`;

  const validateFile = (selectedFile: File): string | null => {
    const res = validatePdfFile(selectedFile);
    return res.errorMsg;
  };

  const handleFileSelected = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);
    setFileHash(null);
    setExactDuplicateMatch(null);
    setShowDuplicateWarningModal(false);
    setHasDismissedWarning(false);

    const validationErr = validateFile(selectedFile);
    if (validationErr) {
      setError(validationErr);
      setFile(null);
      return;
    }

    setIsHashingFile(true);
    let hash = '';
    try {
      hash = await calculateFileSha256(selectedFile);
      setFileHash(hash);
    } catch (hashErr) {
      console.error('Error calculating file SHA-256:', hashErr);
      setError('Failed to compute cryptographic hash for the selected PDF.');
      setIsHashingFile(false);
      return;
    } finally {
      setIsHashingFile(false);
    }

    setIsCheckingFileHash(true);
    try {
      const exactCheck = await checkExactFileDuplicate(hash);
      if (exactCheck.isDuplicate && exactCheck.matchedDocument) {
        const matchItem: DuplicateMatch = {
          document: exactCheck.matchedDocument,
          similarityScore: 100,
          reasons: ['Exact SHA-256 cryptographic file signature match (identical PDF bytes)'],
          severity: 'exact',
          isExactFile: true,
        };
        setExactDuplicateMatch(matchItem);

        const currentMetadataMatches = metadataMatches.filter(
          m => m.document.id !== matchItem.document.id
        );
        const combined = [matchItem, ...currentMetadataMatches];

        setDuplicateResult({
          hasDuplicates: true,
          exactMatch: matchItem,
          matches: combined,
          fileHash: hash,
        });

        setShowDuplicateWarningModal(true);
      } else {
        setExactDuplicateMatch(null);
        setDuplicateResult({
          hasDuplicates: metadataMatches.length > 0,
          exactMatch: null,
          matches: metadataMatches,
          fileHash: hash,
        });
      }
    } catch (checkErr) {
      console.error('Error checking exact duplicate in Supabase:', checkErr);
    } finally {
      setIsCheckingFileHash(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileHash(null);
    setExactDuplicateMatch(null);
    setShowDuplicateWarningModal(false);
    setHasDismissedWarning(false);
    setError(null);

    setDuplicateResult({
      hasDuplicates: metadataMatches.length > 0,
      exactMatch: null,
      matches: metadataMatches,
      fileHash: undefined,
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    if (title.trim().length >= 4) {
      const timer = setTimeout(async () => {
        setIsCheckingMetadata(true);
        try {
          const matches = await checkMetadataDuplicates({
            title,
            authors,
            academicYear,
            documentType,
            program,
            excludeDocIdFromExact: exactDuplicateMatch?.document.id,
          });
          setMetadataMatches(matches);

          const combined: DuplicateMatch[] = [];
          if (exactDuplicateMatch) {
            combined.push(exactDuplicateMatch);
          }
          for (const m of matches) {
            if (!exactDuplicateMatch || m.document.id !== exactDuplicateMatch.document.id) {
              combined.push(m);
            }
          }

          setDuplicateResult({
            hasDuplicates: combined.length > 0,
            exactMatch: exactDuplicateMatch,
            matches: combined,
            fileHash: fileHash || undefined,
          });
        } catch (err) {
          console.error('Metadata similarity check failed:', err);
        } finally {
          setIsCheckingMetadata(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setMetadataMatches([]);
      if (exactDuplicateMatch) {
        setDuplicateResult({
          hasDuplicates: true,
          exactMatch: exactDuplicateMatch,
          matches: [exactDuplicateMatch],
          fileHash: fileHash || undefined,
        });
      } else {
        setDuplicateResult({
          hasDuplicates: false,
          exactMatch: null,
          matches: [],
          fileHash: fileHash || undefined,
        });
      }
    }
  }, [title, authors, academicYear, documentType, program, exactDuplicateMatch, fileHash]);

  const handleViewExistingDocument = (doc: NursingDocument) => {
    if (onViewDocument) {
      onViewDocument(doc);
    } else {
      const docPath = doc.storage_path || doc.file_path || '';
      const publicUrl = docPath ? getDocumentPublicUrl(docPath) : (doc.public_url || '');
      if (publicUrl) {
        window.open(publicUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const executeUpload = async () => {
    if (!file) return;

    setIsSubmitting(true);
    setUploadProgress(10);
    setError(null);

    try {
      await uploadDocument(
        {
          file,
          file_hash: fileHash || undefined,
          title,
          authors,
          academic_year: academicYear,
          document_type: documentType,
          program,
          category,
          keywords,
          description,
        },
        user?.id,
        (progress) => setUploadProgress(progress)
      );

      setSuccess(true);
      setUploadProgress(100);

      setTimeout(() => {
        onUploadSuccess();
      }, 1400);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!file) {
      setError('Please select or drop a valid Final Defended Manuscript PDF.');
      return;
    }
    const primaryValidation = validatePdfFile(file);
    if (!primaryValidation.isValid) {
      setError(`Final Defended Manuscript: ${primaryValidation.errorMsg}`);
      return;
    }
    if (terminationReportFile) {
      const termVal = validatePdfFile(terminationReportFile);
      if (!termVal.isValid) {
        setError(`Signed Termination Report: ${termVal.errorMsg}`);
        return;
      }
    }
    if (approvalSheetFile) {
      const appVal = validatePdfFile(approvalSheetFile);
      if (!appVal.isValid) {
        setError(`Signed Approval Sheet: ${appVal.errorMsg}`);
        return;
      }
    }

    if (!title.trim()) {
      setError('Please provide a document title.');
      return;
    }
    if (!authors.trim()) {
      setError('Please specify the authors / researchers.');
      return;
    }
    if (!academicYear.trim()) {
      setError('Please select an Academic Year.');
      return;
    }
    if (!program.trim()) {
      setError('Please select an Academic Program.');
      return;
    }

    if (!hasDismissedWarning && duplicateResult?.hasDuplicates) {
      setShowDuplicateWarningModal(true);
      return;
    }

    await executeUpload();
  };

  const handleUploadAnyway = async () => {
    setShowDuplicateWarningModal(false);
    setHasDismissedWarning(true);
    await executeUpload();
  };

  const handleCancelDuplicateWarning = () => {
    setShowDuplicateWarningModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Dashboard</span>
        </button>

        <div className="text-right">
          <span className="text-xs text-amber-400 font-mono">SUPABASE STORAGE</span>
          <p className="text-xs text-slate-400">Target Bucket: maltese-archive</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-blue-950/50">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
            Manuscript Submission & Upload
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deposit verified nursing theses, grand case presentations, and required submission documents into the repository.
          </p>
        </div>

        {/* 1. SUBMISSION STATUS INFORMATION SECTION */}
        <div className="mb-8 p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Submission Status Information</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Active Workflow
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div>
              <span className="text-slate-400 block font-medium">Submitted</span>
              <span className="text-white font-semibold">{submissionDateStr}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Evaluation Deadline</span>
              <span className="text-amber-300 font-semibold">{evaluationDeadlineStr} (7 Business Days)</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Status</span>
              <select
                value={submissionStatus}
                onChange={(e: any) => setSubmissionStatus(e.target.value)}
                className="mt-1 bg-slate-900 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus:outline-none focus:border-amber-400"
              >
                <option value="Pending">Pending</option>
                <option value="Under Review">Under Review</option>
                <option value="Revision Required">Revision Required</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Published">Published</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. 50 MB FILE SIZE WARNING */}
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">File Size & Format Restrictions</p>
            <p className="text-amber-300/90">
              ⚠️ File size limit: Each uploaded file must not exceed 50 MB. Only PDF files are accepted. This applies to all manuscript and document files in the submission.
            </p>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-red-200">Validation & Upload Error</p>
              <p className="text-red-300/90">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-200">Submission Complete & Verified!</p>
              <p className="text-emerald-300/90 mt-0.5">
                All document files were successfully validated and stored in Supabase Storage.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* File Upload Zone 1: Final Defended Manuscript */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Final Defended Manuscript <span className="text-amber-400">*</span>
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                isDragging
                  ? 'border-amber-400 bg-amber-500/10'
                  : exactDuplicateMatch
                  ? 'border-red-500/60 bg-red-950/20'
                  : file
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : 'border-white/15 bg-slate-950/60 hover:border-amber-400/40 hover:bg-slate-950/80'
              }`}
            >
              <input
                id="pdf-file-input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileInputChange}
                disabled={isSubmitting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                      file.size > MAX_FILE_SIZE
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-100">{file.name}</p>
                  <p className="text-xs text-slate-300 font-mono">
                    Type: application/pdf • Size: {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <div className="mt-1">
                    {file.size <= MAX_FILE_SIZE ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ✓ Valid PDF
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                        ✕ File exceeds the 50 MB limit
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Remove and choose another file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Drag and drop your Final Manuscript PDF here, or <span className="text-amber-400 underline">browse files</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF format only • Max 50 MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* File Upload Zone 2: Signed Termination Report (Optional / Additional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Signed Termination Report <span className="text-slate-500 font-normal">(Optional PDF)</span>
            </label>
            <div className="border border-white/15 rounded-2xl p-4 bg-slate-950/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 truncate">
                <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {terminationReportFile ? terminationReportFile.name : 'No termination report attached'}
                  </p>
                  {terminationReportFile && (
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(terminationReportFile.size / (1024 * 1024)).toFixed(1)} MB • {terminationReportFile.size <= MAX_FILE_SIZE ? '✓ Valid PDF' : '✕ Exceeds 50 MB'}
                    </p>
                  )}
                </div>
              </div>
              <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer shrink-0">
                <span>Browse</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const f = e.target.files[0];
                      const val = validatePdfFile(f);
                      if (!val.isValid) {
                        setError(`Termination Report: ${val.errorMsg}`);
                      } else {
                        setError(null);
                        setTerminationReportFile(f);
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* File Upload Zone 3: Signed Approval Sheet */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Signed Approval Sheet <span className="text-slate-500 font-normal">(Optional PDF)</span>
            </label>
            <div className="border border-white/15 rounded-2xl p-4 bg-slate-950/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 truncate">
                <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {approvalSheetFile ? approvalSheetFile.name : 'No approval sheet attached'}
                  </p>
                  {approvalSheetFile && (
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(approvalSheetFile.size / (1024 * 1024)).toFixed(1)} MB • {approvalSheetFile.size <= MAX_FILE_SIZE ? '✓ Valid PDF' : '✕ Exceeds 50 MB'}
                    </p>
                  )}
                </div>
              </div>
              <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer shrink-0">
                <span>Browse</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const f = e.target.files[0];
                      const val = validatePdfFile(f);
                      if (!val.isValid) {
                        setError(`Approval Sheet: ${val.errorMsg}`);
                      } else {
                        setError(null);
                        setApprovalSheetFile(f);
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* METADATA FORM FIELDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-white/10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Document Title <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Clinical Efficacy of..."
                className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Authors / Researchers <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={authors}
                onChange={e => setAuthors(e.target.value)}
                placeholder="e.g. Santos, M., Alcantara, J."
                className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Document Type <span className="text-amber-400">*</span>
              </label>
              <select
                value={documentType}
                onChange={e => setDocumentType(e.target.value as DocumentType)}
                className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                <option value="Thesis">Thesis</option>
                <option value="Grand Case Presentation">Grand Case Presentation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Academic Program <span className="text-amber-400">*</span>
              </label>
              <select
                value={program}
                onChange={e => setProgram(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                {PROGRAMS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Academic Year <span className="text-amber-400">*</span>
              </label>
              <select
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                {ACADEMIC_YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nursing Specialty Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="e.g. hypertension, patient care, pediatrics"
              className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Abstract / Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide a summary of the academic study or clinical case presentation..."
              className="w-full rounded-xl bg-slate-950 border border-white/15 p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-y"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (file ? file.size > MAX_FILE_SIZE : false)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting ({uploadProgress}%)...</span>
                </>
              ) : (
                <span>Submit Manuscript & Files</span>
              )}
            </button>
          </div>
        </form>

      </div>

      {/* Duplicate Warning Modal */}
      <DuplicateWarningModal
        isOpen={showDuplicateWarningModal}
        duplicateResult={duplicateResult}
        newDocumentInfo={{
          title: title.trim() || 'Untitled Document (Pending Title)',
          authors: authors.trim() || 'Unspecified Authors',
          academicYear,
          documentType,
          program,
          fileName: file?.name,
        }}
        onClose={handleCancelDuplicateWarning}
        onUploadAnyway={handleUploadAnyway}
        onViewDocument={handleViewExistingDocument}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
