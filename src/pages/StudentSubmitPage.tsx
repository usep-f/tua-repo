import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  GraduationCap,
  User,
  Mail,
  Phone,
  Shield,
  RefreshCw,
  Eye,
  X,
  AlertTriangle,
  Clock,
  FileCheck,
  Building,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';

interface StudentSubmitPageProps {
  onReturnHome: () => void;
  onBrowseRepository: () => void;
  onViewGuidelines: () => void;
}

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
  if (day === 0 || day === 6) return false;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  return !OFFICIAL_HOLIDAYS_2026.includes(dateStr);
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
  return currentDate.toISOString();
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const StudentSubmitPage: React.FC<StudentSubmitPageProps> = ({
  onReturnHome,
  onBrowseRepository,
  onViewGuidelines,
}) => {
  const { user, isAdmin } = useAuth();

  // Submissions list state
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState<boolean>(true);

  // Form state
  const [documentType, setDocumentType] = useState<'thesis' | 'gcp'>('thesis');
  
  // Files
  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  const [terminationReportFile, setTerminationReportFile] = useState<File | null>(null);
  const [approvalSheetFile, setApprovalSheetFile] = useState<File | null>(null);

  // Metadata
  const [leadProponentName, setLeadProponentName] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [description, setDescription] = useState<string>('');
  const [keywordsInput, setKeywordsInput] = useState<string>('');

  // Revision / Editing mode state
  const [revisingSubmissionId, setRevisingSubmissionId] = useState<string | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subToDelete, setSubToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load user profile & existing submissions on mount
  useEffect(() => {
    async function loadInitialData() {
      if (!user) return;
      setEmail(user.email || '');

      const supabase = getSupabase();
      if (!supabase) return;

      try {
        // 1. Fetch profile to pre-fill lead proponent details
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileData) {
          if (profileData.full_name) setLeadProponentName(profileData.full_name);
          if (profileData.contact_number) setContactNumber(profileData.contact_number);
        }

        // 2. Fetch student's submissions
        await fetchMySubmissions(user.id);
      } catch (err) {
        console.warn('Error loading initial submission data:', err);
      } finally {
        setIsLoadingSubmissions(false);
      }
    }

    loadInitialData();
  }, [user]);

  const fetchMySubmissions = async (userId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data: subsData, error: subsError } = await supabase
        .from('manuscript_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });

      if (subsError) {
        console.warn('Error fetching submissions:', subsError);
      } else {
        const subsWithFiles = await Promise.all(
          (subsData || []).map(async (sub) => {
            const { data: filesData, error: filesError } = await supabase
              .from('manuscript_submission_files')
              .select('*')
              .eq('submission_id', sub.id);

            if (filesError) {
              console.warn(`Error fetching files for submission ${sub.id}:`, filesError);
            }

            return {
              ...sub,
              manuscript_submission_files: filesData || []
            };
          })
        );
        setMySubmissions(subsWithFiles || []);
      }
    } catch (err) {
      console.warn('Exception fetching submissions:', err);
    }
  };

  const validateFile = (f: File | null): { isValid: boolean; errorMsg: string | null } => {
    if (!f) return { isValid: false, errorMsg: 'File is missing.' };
    if (!f.name.toLowerCase().endsWith('.pdf') || f.type !== 'application/pdf') {
      return { isValid: false, errorMsg: 'Only PDF files are accepted.' };
    }
    if (f.size > MAX_FILE_SIZE) {
      return { isValid: false, errorMsg: 'File exceeds the 50 MB limit.' };
    }
    return { isValid: true, errorMsg: null };
  };

  const handleStartRevision = (sub: any) => {
    setRevisingSubmissionId(sub.id);
    setDocumentType(sub.document_type || 'Thesis');
    setLeadProponentName(sub.lead_proponent_name || '');
    setContactNumber(sub.contact_number || '');
    setEmail(sub.email || user?.email || '');
    setDescription(sub.description || '');
    if (Array.isArray(sub.keywords)) {
      setKeywordsInput(sub.keywords.join(', '));
    } else {
      setKeywordsInput(sub.keywords || '');
    }
    setManuscriptFile(null);
    setTerminationReportFile(null);
    setApprovalSheetFile(null);
    setError(null);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleCancelRevision = () => {
    setRevisingSubmissionId(null);
    setManuscriptFile(null);
    setTerminationReportFile(null);
    setApprovalSheetFile(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!user) {
      setError('You must be signed in to submit a manuscript.');
      return;
    }

    if (!leadProponentName.trim() || !contactNumber.trim() || !email.trim()) {
      setError('Please provide Lead Proponent Name, Contact Number, and Email Address.');
      return;
    }

    // Validate files depending on document type
    if (!manuscriptFile && !revisingSubmissionId) {
      setError('Final Defended Manuscript PDF is required.');
      return;
    }

    if (manuscriptFile) {
      const v = validateFile(manuscriptFile);
      if (!v.isValid) {
        setError(`Manuscript File: ${v.errorMsg}`);
        return;
      }
    }

    if (documentType === 'thesis') {
      if (!approvalSheetFile && !revisingSubmissionId) {
        setError('Signed Approval Sheet is required for Theses.');
        return;
      }
      if (!terminationReportFile && !revisingSubmissionId) {
        setError('Signed Termination Report is required for Theses.');
        return;
      }
    } else {
      // gcp
      if (!approvalSheetFile && !revisingSubmissionId) {
        setError('Signed Approval Sheet is required for Grand Case Presentations.');
        return;
      }
    }

    if (!description.trim()) {
      setError(documentType === 'thesis' ? 'Thesis Abstract / Summary is required.' : 'Short Description is required.');
      return;
    }
    const kwList = keywordsInput.split(',').map(k => k.trim()).filter(Boolean);
    if (kwList.length < 5) {
      setError('Please provide at least five (5) main keywords.');
      return;
    }

    if (terminationReportFile) {
      const v = validateFile(terminationReportFile);
      if (!v.isValid) {
        setError(`Termination Report: ${v.errorMsg}`);
        return;
      }
    }

    if (approvalSheetFile) {
      const v = validateFile(approvalSheetFile);
      if (!v.isValid) {
        setError(`Approval Sheet: ${v.errorMsg}`);
        return;
      }
    }

    setIsSubmitting(true);
    setUploadProgress(10);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client connection error.');
      setIsSubmitting(false);
      return;
    }

    try {
      let submissionId = revisingSubmissionId;
      const nowIso = new Date().toISOString();
      const deadlineIso = calculateEvaluationDeadline(new Date());

      const keywordsArray = keywordsInput
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);

      if (!submissionId) {
        // Create new manuscript submission record
        const { data: subData, error: subError } = await supabase
          .from('manuscript_submissions')
          .insert({
            user_id: user.id,
            document_type: documentType,
            lead_proponent_name: leadProponentName.trim(),
            contact_number: contactNumber.trim(),
            email: email.trim(),
            description: description.trim() || null,
            keywords: keywordsArray,
            submitted_at: nowIso,
            evaluation_deadline: deadlineIso,
            status: 'Pending',
          })
          .select('id')
          .single();

        if (subError || !subData) {
          throw new Error(subError?.message || 'Failed to create manuscript submission record.');
        }
        submissionId = subData.id;
      } else {
        // Update existing submission record and set status back to Pending if it was Revision Required
        const { error: updateError } = await supabase
          .from('manuscript_submissions')
          .update({
            document_type: documentType,
            lead_proponent_name: leadProponentName.trim(),
            contact_number: contactNumber.trim(),
            email: email.trim(),
            description: description.trim() || null,
            keywords: keywordsArray,
            status: 'Pending',
            updated_at: nowIso,
          })
          .eq('id', submissionId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      setUploadProgress(40);

      // Upload files to private bucket: manuscript-submissions
      const filesToUpload = [
        { file: manuscriptFile, label: 'manuscript' },
        { file: terminationReportFile, label: 'termination-report' },
        { file: approvalSheetFile, label: 'approval-sheet' },
      ].filter(item => item.file !== null);

      let uploadedCount = 0;
      for (const item of filesToUpload) {
        const fileObj = item.file as File;
        const cleanFileName = fileObj.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const storagePath = `${user.id}/${submissionId}/${item.label}_${Date.now()}_${cleanFileName}`;

        const { error: storageError } = await supabase.storage
          .from('manuscript-submissions')
          .upload(storagePath, fileObj, { upsert: true });

        if (storageError) {
          throw new Error(`Storage upload failed for ${fileObj.name}: ${storageError.message}`);
        }

        // Insert file metadata into public.manuscript_submission_files
        const { error: fileRecordError } = await supabase
          .from('manuscript_submission_files')
          .insert({
            submission_id: submissionId,
            file_name: fileObj.name,
            file_type: fileObj.type || 'application/pdf',
            file_size: fileObj.size,
            storage_path: storagePath,
          });

        if (fileRecordError) {
          console.warn('Warning inserting file record:', fileRecordError.message);
        }

        uploadedCount++;
        setUploadProgress(40 + Math.floor((uploadedCount / filesToUpload.length) * 50));
      }

      setUploadProgress(100);
      setSuccessMessage(
        revisingSubmissionId
          ? 'Manuscript revision successfully submitted and files updated for administrative review!'
          : 'Manuscript successfully submitted to the review queue!'
      );

      setRevisingSubmissionId(null);
      setManuscriptFile(null);
      setTerminationReportFile(null);
      setApprovalSheetFile(null);

      // Refresh submissions
      await fetchMySubmissions(user.id);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleConfirmDelete = async () => {
    if (!subToDelete || !user) return;
    const supabase = getSupabase();
    if (!supabase) return;

    setIsDeleting(true);
    try {
      // 1. Gather all storage paths for files attached to this submission
      const files = subToDelete.manuscript_submission_files || [];
      const storagePaths = files.map((f: any) => f.storage_path).filter(Boolean);

      // 2. Delete actual PDF files from the private manuscript-submissions Storage bucket first
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('manuscript-submissions')
          .remove(storagePaths);

        if (storageError) {
          throw new Error(`Storage deletion failed: ${storageError.message}`);
        }
      }

      // 3. Delete file records from public.manuscript_submission_files explicitly
      const { error: filesDbError } = await supabase
        .from('manuscript_submission_files')
        .delete()
        .eq('submission_id', subToDelete.id);

      if (filesDbError) {
        throw new Error(`Failed to delete file metadata records: ${filesDbError.message}`);
      }

      // 4. Permanently delete the manuscript submission from public.manuscript_submissions with ownership verification auth.uid() = user_id
      const { error: subDbError } = await supabase
        .from('manuscript_submissions')
        .delete()
        .eq('id', subToDelete.id)
        .eq('user_id', user.id);

      if (subDbError) {
        throw new Error(`Failed to delete submission record: ${subDbError.message}`);
      }

      // 5. Update UI state immediately
      setMySubmissions(prev => prev.filter(s => s.id !== subToDelete.id));
      setSuccessMessage('Submission deleted successfully.');
      setSubToDelete(null);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Delete submission error:', err);
      setError(err.message || 'An unexpected error occurred while deleting the submission.');
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fadeIn">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-amber-500 p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400 font-serif font-black">
              ✛
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight">
              Student Manuscript Submission
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              The Maltese Archive • Nursing Repository & Review Portal
            </p>
          </div>
        </div>

        <button
          onClick={onBrowseRepository}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all"
        >
          Browse Repository
        </button>
      </div>

      {/* GUIDELINES BOX */}
      <div className="mb-10 p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-amber-500/30 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5 text-amber-400">
            <Shield className="w-5 h-5" />
            <h2 className="text-sm font-bold uppercase tracking-wider font-serif text-amber-300">
              GUIDELINES FOR SUBMISSION
            </h2>
          </div>
          <button
            onClick={onViewGuidelines}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors flex items-center gap-1 shrink-0"
          >
            <span>View Detailed Submission Guidelines</span>
          </button>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
            <li>All submissions are subject to <strong className="text-white font-semibold">administrative review</strong> within <strong className="text-white font-semibold">seven (7) working days</strong>, excluding <strong className="text-white font-semibold">weekends</strong> and <strong className="text-white font-semibold">official holidays</strong>.</li>
            <li><strong className="text-white font-semibold">PDF files only</strong>.</li>
            <li>Each file must not exceed <strong className="text-white font-semibold">50 MB</strong>.</li>
            <li>Provide the active <strong className="text-white font-semibold">contact number</strong> and valid <strong className="text-white font-semibold">email address</strong> of the <strong className="text-white font-semibold">lead proponent</strong>.</li>
            <li>Submit only the <strong className="text-white font-semibold">final defended manuscript</strong> (<strong className="text-white font-semibold">drafts</strong>, <strong className="text-white font-semibold">revisions</strong>, or <strong className="text-white font-semibold">incomplete manuscripts</strong> are not considered).</li>
            <li>Provide at least <strong className="text-white font-semibold">five (5) keywords</strong> for indexing and search retrieval.</li>
            <li>Provide the <strong className="text-white font-semibold">Abstract/Summary</strong> and <strong className="text-white font-semibold">five main keywords</strong> typed or pasted directly into the form for both <strong className="text-white font-semibold">Thesis Manuscripts</strong> and <strong className="text-white font-semibold">Graduate Capstone Projects (GCPs)</strong>.</li>
          </ul>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mt-4">
            ⚠️ All submissions are subject to <strong className="text-amber-200 font-bold">administrative review</strong>.
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-200">Submission Validation Notice</p>
            <p className="text-red-300/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-200">Success!</p>
            <p className="text-emerald-300/90 mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* SUBMISSION FORM CONTAINER */}
      <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl mb-12">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white font-serif">
              {revisingSubmissionId ? 'Revise Manuscript Submission' : 'New Manuscript Deposit'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Fill in proponent details, select document classification, and attach required PDFs.
            </p>
          </div>
          {revisingSubmissionId && (
            <button
              type="button"
              onClick={handleCancelRevision}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 border border-red-500/30"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Revision</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Document Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Document Classification <span className="text-amber-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setDocumentType('thesis')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 ${
                  documentType === 'thesis'
                    ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-serif font-bold ${documentType === 'thesis' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  Th
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-100">Thesis</p>
                  <p className="text-[11px] text-slate-400">Requires 3 PDFs: Manuscript, Termination Report, Approval Sheet</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDocumentType('gcp')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 ${
                  documentType === 'gcp'
                    ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-serif font-bold ${documentType === 'gcp' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  GCP
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-100">Grand Case Presentation (GCP)</p>
                  <p className="text-[11px] text-slate-400">Requires 2 PDFs + Description + 5 Keywords</p>
                </div>
              </button>
            </div>
          </div>

          {/* Lead Proponent Information */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Lead Proponent Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={leadProponentName}
                onChange={e => setLeadProponentName(e.target.value)}
                placeholder="e.g. Maria Clara Santos, RN"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Contact Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={contactNumber}
                onChange={e => setContactNumber(e.target.value)}
                placeholder="e.g. +63 912 345 6789"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-amber-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. student@tua.edu.ph"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Abstract / Summary & Five Main Keywords (Required for both Thesis and GCP) */}
          <div className="space-y-4 pt-2 border-t border-white/10 animate-fadeIn">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {documentType === 'thesis' ? 'Abstract / Summary' : 'Short Description / Abstract'} <span className="text-amber-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={documentType === 'thesis' ? 'Type or paste the abstract/summary of your thesis here...' : 'Provide a concise clinical summary of the grand case presentation...'}
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 leading-relaxed font-sans"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {documentType === 'thesis' ? 'Type or paste the abstract/summary of your thesis here.' : 'Provide a concise clinical summary or abstract.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Five Main Keywords (comma-separated) <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={keywordsInput}
                onChange={e => setKeywordsInput(e.target.value)}
                placeholder="e.g. Nursing Informatics, Patient Outcomes, Clinical Trial, Healthcare Quality, Evidence-Based Practice"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Provide at least five (5) main keywords separated by commas for indexing and search retrieval.
              </p>
            </div>
          </div>

          {/* FILE UPLOAD ZONES */}
          <div className="space-y-6 pt-4 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                Required PDF Documents
              </h4>
              <p className="text-xs text-amber-300/90 font-mono bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                ⚠️ File size limit: Each uploaded file must not exceed 50 MB. Only PDF files are accepted.
              </p>
            </div>

            {/* 1. Final Defended Manuscript */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                1. Final Defended Manuscript <span className="text-amber-400">*</span>
              </label>
              <div className="border border-white/15 rounded-2xl p-4 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 truncate">
                  <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {manuscriptFile ? manuscriptFile.name : 'No manuscript PDF attached'}
                    </p>
                    {manuscriptFile && (
                      <p className="text-[10px] text-slate-400 font-mono">
                        {(manuscriptFile.size / (1024 * 1024)).toFixed(1)} MB • {manuscriptFile.size <= MAX_FILE_SIZE ? '✓ Valid PDF' : '✕ Exceeds 50 MB'}
                      </p>
                    )}
                  </div>
                </div>
                <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer shrink-0 text-center">
                  <span>Browse PDF</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setManuscriptFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* 2. Signed Approval Sheet */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                2. Signed Approval Sheet <span className="text-amber-400">*</span>
              </label>
              <div className="border border-white/15 rounded-2xl p-4 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 truncate">
                  <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {approvalSheetFile ? approvalSheetFile.name : 'No approval sheet PDF attached'}
                    </p>
                    {approvalSheetFile && (
                      <p className="text-[10px] text-slate-400 font-mono">
                        {(approvalSheetFile.size / (1024 * 1024)).toFixed(1)} MB • {approvalSheetFile.size <= MAX_FILE_SIZE ? '✓ Valid PDF' : '✕ Exceeds 50 MB'}
                      </p>
                    )}
                  </div>
                </div>
                <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer shrink-0 text-center">
                  <span>Browse PDF</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setApprovalSheetFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* 3. Signed Termination Report (Only for Thesis) */}
            {documentType === 'thesis' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  3. Signed Termination Report <span className="text-amber-400">*</span>
                </label>
                <div className="border border-white/15 rounded-2xl p-4 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 truncate">
                    <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-medium text-slate-200 truncate">
                        {terminationReportFile ? terminationReportFile.name : 'No termination report PDF attached'}
                      </p>
                      {terminationReportFile && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          {(terminationReportFile.size / (1024 * 1024)).toFixed(1)} MB • {terminationReportFile.size <= MAX_FILE_SIZE ? '✓ Valid PDF' : '✕ Exceeds 50 MB'}
                        </p>
                      )}
                    </div>
                  </div>
                  <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer shrink-0 text-center">
                    <span>Browse PDF</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setTerminationReportFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {isSubmitting && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                <span>Uploading files to private manuscript-submissions storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-amber-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>SUBMITTING MANUSCRIPT...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>{revisingSubmissionId ? 'SUBMIT REVISED MANUSCRIPT' : 'SUBMIT MANUSCRIPT'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MY SUBMISSIONS SECTION */}
      <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div>
            <h3 className="text-xl font-bold text-white font-serif">
              My Submissions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Track evaluation deadlines, current status, administrative feedback, and revisions.
            </p>
          </div>
          <button
            onClick={() => user && fetchMySubmissions(user.id)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {isLoadingSubmissions ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Loading your submissions...
          </div>
        ) : mySubmissions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            You have not submitted any manuscripts yet.
          </div>
        ) : (
          <div className="space-y-4">
            {mySubmissions.map(sub => {
              const statusColor =
                sub.status === 'Approved' || sub.status === 'Published'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : sub.status === 'Revision Required'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : sub.status === 'Rejected'
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

              return (
                <div
                  key={sub.id}
                  className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-serif">
                            {sub.document_type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Lead Proponent: {sub.lead_proponent_name} • {sub.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      {sub.status === 'Revision Required' && (
                        <button
                          onClick={() => handleStartRevision(sub)}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition-all"
                        >
                          Revise Submission
                        </button>
                      )}
                      <button
                        onClick={() => setSubToDelete(sub)}
                        className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold transition-all"
                      >
                        Delete Submission
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-white/5">
                    <div>
                      <span className="text-slate-400 block font-medium">Submitted Date</span>
                      <span className="text-slate-200 font-mono">
                        {new Date(sub.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Evaluation Deadline</span>
                      <span className="text-amber-300 font-mono">
                        {sub.evaluation_deadline ? new Date(sub.evaluation_deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '7 Business Days'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Last Updated</span>
                      <span className="text-slate-300 font-mono">
                        {sub.updated_at ? new Date(sub.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'None'}
                      </span>
                    </div>
                  </div>

                  {sub.admin_feedback && (
                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200">
                      <span className="font-bold uppercase tracking-wider text-amber-400 block mb-1">Administrative Feedback:</span>
                      <p>{sub.admin_feedback}</p>
                    </div>
                  )}

                  {sub.manuscript_submission_files && sub.manuscript_submission_files.length > 0 && (
                    <div className="pt-2 text-xs text-slate-400">
                      <span className="font-semibold text-slate-300 block mb-1">Attached Files ({sub.manuscript_submission_files.length}):</span>
                      <div className="flex flex-wrap gap-2">
                        {sub.manuscript_submission_files.map((f: any) => (
                          <span key={f.id} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>{f.file_name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {subToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-serif font-bold text-white">Delete this submission?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently remove this manuscript submission and its attached files. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSubToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
