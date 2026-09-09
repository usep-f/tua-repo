import React, { useEffect, useState } from 'react';
import {
  Plus,
  FileText,
  Eye,
  Edit,
  RefreshCw,
  Trash2,
  Calendar,
  GraduationCap,
  BookOpen,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  X,
  Upload,
  Layers,
  Database,
  ShieldCheck,
  LogOut,
  Activity,
  Terminal,
  Copy,
  Check,
  Info,
  AlertCircle,
  HelpCircle,
  Play,
  Hash,
  AlertOctagon,
} from 'lucide-react';
import { NursingDocument, DocumentType, AcademicProgram, DuplicateCheckResult } from '../types';
import {
  fetchDocuments,
  fetchRepositoryStats,
  deleteDocument,
  updateDocumentMetadata,
  replaceDocumentPdf,
  RepositoryStats,
} from '../lib/documentService';
import { useAuth } from '../context/AuthContext';
import { getSupabase, getActiveSupabaseCredentials } from '../lib/supabase';
import {
  calculateFileSha256,
  checkExactFileDuplicate,
  checkDocumentDuplicates,
  backfillAllDocumentHashes,
} from '../lib/duplicateDetection';
import { DuplicateWarningModal } from '../components/DuplicateWarningModal';

interface AdminDashboardPageProps {
  onNavigateUpload: () => void;
  onViewDocument: (doc: NursingDocument) => void;
  onOpenSetupGuide: () => void;
  onLogout: () => void;
}

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

const ACADEMIC_YEARS = ['2027', '2026', '2025', '2024', '2023', '2022', '2021', '2020'];
const PROGRAMS: AcademicProgram[] = [
  'BS Nursing',
  'MS Nursing',
  'DNP',
  'PhD Nursing',
  'Post-Master\'s Certificate',
];

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onNavigateUpload,
  onViewDocument,
  onOpenSetupGuide,
  onLogout,
}) => {
  const { user, isAdmin, userRole } = useAuth();
  const [stats, setStats] = useState<RepositoryStats>({
    totalDocuments: 0,
    totalTheses: 0,
    totalGCPs: 0,
    academicYearsCount: 0,
    years: [],
  });

  const [documents, setDocuments] = useState<NursingDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');

  // Modals state
  const [docToDelete, setDocToDelete] = useState<NursingDocument | null>(null);
  const [docToEdit, setDocToEdit] = useState<NursingDocument | null>(null);
  const [docToReplace, setDocToReplace] = useState<NursingDocument | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editAuthors, setEditAuthors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editType, setEditType] = useState<DocumentType>('Thesis');
  const [editProgram, setEditProgram] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Replace PDF form state
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [replaceDuplicateResult, setReplaceDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [showReplaceDuplicateWarning, setShowReplaceDuplicateWarning] = useState<boolean>(false);
  const [bypassReplaceDuplicate, setBypassReplaceDuplicate] = useState<boolean>(false);
  const [replaceFileHash, setReplaceFileHash] = useState<string | null>(null);
  const [isCheckingReplaceHash, setIsCheckingReplaceHash] = useState<boolean>(false);
  const [isBackfillingHashes, setIsBackfillingHashes] = useState<boolean>(false);

  // Diagnostic State for RLS and Admin Authorization Flow
  const [copiedId, setCopiedId] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<{
    testedAt: string | null;
    isRunning: boolean;
    userId: string;
    userEmail: string;
    projectHost: string;
    // user_roles query
    roleQueryStatus: string;
    roleRowsCount: number;
    roleRowsData: any;
    roleReturned: string | null;
    isAppAdmin: boolean;
    roleErrorCode: string | null;
    roleErrorMessage: string | null;
    roleErrorDetails: string | null;
    roleErrorHint: string | null;
    // Probes
    docsSelectStatus: string;
    docsSelectMessage: string | null;
    rpcAdminStatus: string;
    rpcAdminValue: boolean | null;
    rpcAdminMessage: string | null;
    // Preflight insert probe
    preflightStatus: string | null;
    preflightMessage: string | null;
    preflightIsRunning: boolean;
  }>({
    testedAt: null,
    isRunning: false,
    userId: user?.id || '',
    userEmail: user?.email || '',
    projectHost: '',
    roleQueryStatus: 'Pending initial check...',
    roleRowsCount: 0,
    roleRowsData: null,
    roleReturned: null,
    isAppAdmin: isAdmin,
    roleErrorCode: null,
    roleErrorMessage: null,
    roleErrorDetails: null,
    roleErrorHint: null,
    docsSelectStatus: 'Pending...',
    docsSelectMessage: null,
    rpcAdminStatus: 'Pending...',
    rpcAdminValue: null,
    rpcAdminMessage: null,
    preflightStatus: null,
    preflightMessage: null,
    preflightIsRunning: false,
  });

  const runDiagnosticCheck = async () => {
    const supabase = getSupabase();
    const creds = getActiveSupabaseCredentials();
    let host = 'Unknown';
    try {
      if (creds.url) {
        host = new URL(creds.url).origin;
      }
    } catch {
      host = creds.url || 'Not configured';
    }

    if (!supabase || !user?.id) {
      setDiagnosticData(prev => ({
        ...prev,
        testedAt: new Date().toLocaleTimeString(),
        isRunning: false,
        userId: user?.id || 'No active user session',
        userEmail: user?.email || 'N/A',
        projectHost: host,
        roleQueryStatus: 'No active Supabase user session detected.',
      }));
      return;
    }

    setDiagnosticData(prev => ({ ...prev, isRunning: true }));

    try {
      // 1. Direct query to public.user_roles where user_id = auth.uid()
      const { data: roleData, error: roleError, status: httpStatus } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      const rowsCount = roleData?.length ?? 0;
      const firstRole = roleData?.[0]?.role ?? null;
      const isConsidered = (firstRole || '').toLowerCase().trim() === 'admin';

      // 2. Probe public.documents SELECT permission (crucial for .insert().select() flows)
      const { data: docSample, error: docSelectError } = await supabase
        .from('documents')
        .select('id, title, uploaded_by')
        .limit(1);

      // 3. Probe public.is_admin() RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('is_admin');

      setDiagnosticData(prev => ({
        ...prev,
        testedAt: new Date().toLocaleTimeString(),
        isRunning: false,
        userId: user.id,
        userEmail: user.email || 'N/A',
        projectHost: host,
        roleQueryStatus: roleError ? `Failed (HTTP ${httpStatus})` : `Query Succeeded (HTTP ${httpStatus})`,
        roleRowsCount: rowsCount,
        roleRowsData: roleData,
        roleReturned: firstRole ?? (rowsCount === 0 ? '(0 rows returned in public.user_roles)' : 'null'),
        isAppAdmin: isConsidered,
        roleErrorCode: roleError?.code || null,
        roleErrorMessage: roleError?.message || null,
        roleErrorDetails: roleError?.details || null,
        roleErrorHint: roleError?.hint || null,
        docsSelectStatus: docSelectError ? 'Blocked by RLS' : 'Allowed (Select policy active)',
        docsSelectMessage: docSelectError
          ? `[Code: ${docSelectError.code || 'ERR'}] ${docSelectError.message}${docSelectError.details ? ` - ${docSelectError.details}` : ''}`
          : `Readable: ${docSample?.length ?? 0} document row(s) accessed`,
        rpcAdminStatus: rpcError ? 'Function not found or error' : 'Available',
        rpcAdminValue: rpcError ? null : Boolean(rpcData),
        rpcAdminMessage: rpcError ? `[Code: ${rpcError.code || 'ERR'}] ${rpcError.message}` : `Evaluated as: ${String(rpcData)}`,
      }));
    } catch (e: any) {
      setDiagnosticData(prev => ({
        ...prev,
        testedAt: new Date().toLocaleTimeString(),
        isRunning: false,
        roleQueryStatus: 'Exception while executing diagnostic',
        roleErrorMessage: e.message || 'Unexpected diagnostic error',
      }));
    }
  };

  // Run Document INSERT Pre-Flight Probe Test
  const runPreflightInsertTest = async () => {
    const supabase = getSupabase();
    if (!supabase || !user?.id) return;

    setDiagnosticData(prev => ({
      ...prev,
      preflightIsRunning: true,
      preflightStatus: 'Testing...',
      preflightMessage: 'Submitting dry-run INSERT into public.documents with uploaded_by = ' + user.id,
    }));

    try {
      const probePayload = {
        title: '__DIAGNOSTIC_RLS_PROBE__',
        authors: 'Diagnostic System Probe',
        academic_year: '2026',
        document_type: 'Thesis',
        program: 'BSN',
        category: 'Evidence-Based Practice and Quality Improvement',
        keywords: 'probe, test, rls',
        description: 'Temporary row testing RLS insert and select policies',
        file_name: 'probe.pdf',
        storage_path: 'probes/probe-test.pdf',
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.id,
      };

      const { data: insertResult, error: insertError } = await supabase
        .from('documents')
        .insert([probePayload])
        .select()
        .single();

      if (insertError) {
        setDiagnosticData(prev => ({
          ...prev,
          preflightIsRunning: false,
          preflightStatus: 'BLOCKED BY RLS / DB',
          preflightMessage: `[Code: ${insertError.code || 'ERR'}] ${insertError.message}${insertError.details ? ` (Details: ${insertError.details})` : ''}${insertError.hint ? ` (Hint: ${insertError.hint})` : ''}`,
        }));
      } else {
        // Immediately clean up the probe document
        if (insertResult?.id) {
          await supabase.from('documents').delete().eq('id', insertResult.id);
        }
        setDiagnosticData(prev => ({
          ...prev,
          preflightIsRunning: false,
          preflightStatus: 'SUCCESS - PERMITTED',
          preflightMessage: 'The INSERT policy and SELECT policy on public.documents accepted the row with your auth.uid()! (Test row was cleanly deleted).',
        }));
      }
    } catch (err: any) {
      setDiagnosticData(prev => ({
        ...prev,
        preflightIsRunning: false,
        preflightStatus: 'EXCEPTION',
        preflightMessage: err.message || 'Unknown preflight error',
      }));
    }
  };

  useEffect(() => {
    if (user?.id) {
      runDiagnosticCheck();
    }
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, docsResult] = await Promise.all([
        fetchRepositoryStats(),
        fetchDocuments({
          query: searchQuery,
          academicYear: selectedYear,
          documentType: selectedType,
          program: 'All',
          category: 'All',
          sortBy: 'newest',
          page: 1,
        }, 100),
      ]);
      setStats(statsData);
      setDocuments(docsResult.data);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedType, selectedYear]);

  // Open Edit Modal
  const handleOpenEdit = (doc: NursingDocument) => {
    setDocToEdit(doc);
    setEditTitle(doc.title);
    setEditAuthors(doc.authors);
    setEditYear(doc.academic_year);
    setEditType(doc.document_type);
    setEditProgram(doc.program);
    setEditCategory(doc.category);
    setEditKeywords(doc.keywords || '');
    setEditDescription(doc.description || '');
    setActionError(null);
  };

  // Submit Edit Metadata
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setActionError('Access Denied: Administrator privileges are required.');
      return;
    }
    if (!docToEdit) return;
    setIsProcessing(true);
    setActionError(null);

    try {
      await updateDocumentMetadata(docToEdit.id, {
        title: editTitle,
        authors: editAuthors,
        academic_year: editYear,
        document_type: editType,
        program: editProgram,
        category: editCategory,
        keywords: editKeywords,
        description: editDescription,
      });

      setDocToEdit(null);
      setActionSuccess('Metadata updated successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update document metadata');
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Replace PDF Modal
  const handleOpenReplace = (doc: NursingDocument) => {
    setDocToReplace(doc);
    setReplaceFile(null);
    setReplaceFileHash(null);
    setReplaceDuplicateResult(null);
    setShowReplaceDuplicateWarning(false);
    setBypassReplaceDuplicate(false);
    setActionError(null);
  };

  // Immediate file selection handler for Replace PDF
  const handleReplaceFileSelected = async (selectedFile: File | null) => {
    setReplaceFile(selectedFile);
    setReplaceFileHash(null);
    setReplaceDuplicateResult(null);
    setShowReplaceDuplicateWarning(false);
    setBypassReplaceDuplicate(false);
    setActionError(null);

    if (!selectedFile || !docToReplace) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.type !== 'application/pdf') {
      setActionError('Only standard PDF files are permitted for replacement.');
      return;
    }

    try {
      setIsCheckingReplaceHash(true);
      const hash = await calculateFileSha256(selectedFile);
      setReplaceFileHash(hash);

      // Check exact duplicate excluding the document being replaced!
      const exactCheck = await checkExactFileDuplicate(hash, docToReplace.id);
      if (exactCheck.isDuplicate && exactCheck.matchedDocument) {
        const matchObj = {
          document: exactCheck.matchedDocument,
          similarityScore: 100,
          reasons: ['Exact SHA-256 cryptographic file signature match with another repository document'],
          severity: 'exact' as const,
          isExactFile: true,
        };
        setReplaceDuplicateResult({
          hasDuplicates: true,
          exactMatch: matchObj,
          matches: [matchObj],
          fileHash: hash,
        });
        // Immediately show the duplicate warning modal!
        setShowReplaceDuplicateWarning(true);
      }
    } catch (err) {
      console.warn('Error checking replace duplicate hash:', err);
    } finally {
      setIsCheckingReplaceHash(false);
    }
  };

  // Backfill/Populate missing SHA-256 hashes on legacy documents
  const handleBackfillHashes = async () => {
    setIsBackfillingHashes(true);
    setActionError(null);
    try {
      const result = await backfillAllDocumentHashes();
      if (result.updatedCount > 0) {
        setActionSuccess(`Successfully populated SHA-256 hashes for ${result.updatedCount} older document(s).`);
      } else if (result.errors > 0) {
        setActionError(`Backfill encountered ${result.errors} error(s). Please verify storage permissions.`);
      } else {
        setActionSuccess('All documents in repository already have verified SHA-256 hashes.');
      }
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to backfill document hashes.');
    } finally {
      setIsBackfillingHashes(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Submit Replace PDF
  const handleConfirmReplace = async (e?: React.FormEvent, bypassDuplicateCheck = false) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      setActionError('Access Denied: Administrator privileges are required.');
      return;
    }
    if (!docToReplace || !replaceFile) return;

    if (!replaceFile.name.toLowerCase().endsWith('.pdf') || replaceFile.type !== 'application/pdf') {
      setActionError('Only standard PDF files are permitted for replacement.');
      return;
    }

    // Duplicate check excluding self
    if (!bypassDuplicateCheck && !bypassReplaceDuplicate) {
      try {
        const dupCheck = await checkDocumentDuplicates({
          file: replaceFile,
          title: docToReplace.title,
          authors: docToReplace.authors,
          academicYear: docToReplace.academic_year,
          documentType: docToReplace.document_type,
          program: docToReplace.program,
          excludeDocumentId: docToReplace.id, // Exclude the document being replaced!
        });

        if (dupCheck.hasDuplicates) {
          setReplaceDuplicateResult(dupCheck);
          setShowReplaceDuplicateWarning(true);
          return;
        }
      } catch (dupErr) {
        console.warn('Duplicate check during replacement error:', dupErr);
      }
    }

    setBypassReplaceDuplicate(false);
    setIsProcessing(true);
    setActionError(null);

    try {
      await replaceDocumentPdf(
        docToReplace.id,
        docToReplace.storage_path,
        replaceFile,
        docToReplace.document_type,
        docToReplace.academic_year,
        docToReplace.program
      );

      setDocToReplace(null);
      setReplaceFile(null);
      setActionSuccess('PDF successfully replaced in Supabase Storage and database updated.');
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to replace PDF file.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!isAdmin) {
      setActionError('Access Denied: Administrator privileges are required.');
      return;
    }
    if (!docToDelete) return;
    setIsProcessing(true);
    setActionError(null);

    try {
      await deleteDocument(docToDelete.id, docToDelete.storage_path);
      setDocToDelete(null);
      setActionSuccess('Document permanently deleted from database and storage.');
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete document.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Top Banner with Admin Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight font-serif">
              Administrator Dashboard
            </h1>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
              <span>Logged in as:</span>
              <span className="text-amber-300 font-mono font-medium">{user?.email || 'admin'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider">
                Role: {isAdmin ? (userRole || 'admin') : 'Unverified'}
              </span>
              <span className="text-slate-500 text-[10px] font-mono hidden sm:inline">
                auth.uid: {user?.id}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSetupGuide}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all"
            title="View Database Schema & Storage Configuration"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Database Setup</span>
          </button>

          <button
            id="btn-admin-add-doc"
            onClick={onNavigateUpload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ ADD DOCUMENT</span>
          </button>

          <button
            id="btn-admin-logout"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-red-500/20 hover:text-red-300 text-slate-400 border border-white/10 transition-colors"
            title="Log Out of Administrator Mode"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action alerts */}
      {actionSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* TEMPORARY AUTHORIZATION & RLS DIAGNOSTIC PANEL */}
      <div id="diagnostic-panel" className="mb-10 rounded-2xl bg-slate-900/95 border-2 border-amber-500/30 shadow-2xl overflow-hidden">
        {/* Panel Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Authorization & Row Level Security (RLS) Diagnostics
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold uppercase">
                  Live Probe
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Directly inspecting authenticated identity, <code className="text-amber-300">public.user_roles</code> query, and table RLS policies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runDiagnosticCheck}
              disabled={diagnosticData.isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              title="Re-execute live query to public.user_roles and permission probes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${diagnosticData.isRunning ? 'animate-spin' : ''}`} />
              <span>{diagnosticData.isRunning ? 'Testing...' : 'Re-run Diagnostics'}</span>
            </button>
            <button
              onClick={runPreflightInsertTest}
              disabled={diagnosticData.preflightIsRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              title="Executes a dry-run insert into public.documents to verify if RLS allows this user"
            >
              <Play className={`w-3.5 h-3.5 ${diagnosticData.preflightIsRunning ? 'animate-spin' : ''}`} />
              <span>{diagnosticData.preflightIsRunning ? 'Testing Insert...' : 'Test Document INSERT'}</span>
            </button>
            <button
              onClick={handleBackfillHashes}
              disabled={isBackfillingHashes}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              title="Calculates and saves SHA-256 hashes for all legacy documents that currently have NULL hashes"
            >
              <Hash className={`w-3.5 h-3.5 ${isBackfillingHashes ? 'animate-spin' : ''}`} />
              <span>{isBackfillingHashes ? 'Backfilling Hashes...' : 'Backfill Document Hashes'}</span>
            </button>
          </div>
        </div>

        {/* Panel Content - 6 Core Diagnostic Checks */}
        <div className="p-6 space-y-6">
          {/* Top Info Grid: Identity & Project */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Authenticated user.id (UUID) */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                1. Authenticated Supabase User ID (auth.uid)
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-amber-300 font-bold break-all">
                  {diagnosticData.userId || 'No session'}
                </span>
                {diagnosticData.userId && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(diagnosticData.userId);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                    title="Copy auth.uid UUID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500">
                Must match the <code className="text-slate-400 font-mono">user_id</code> column in <code className="text-slate-400 font-mono">public.user_roles</code>.
              </p>
            </div>

            {/* 2. Authenticated user email */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                2. Authenticated User Email
              </span>
              <div className="font-mono text-xs text-white font-medium break-all">
                {diagnosticData.userEmail || 'N/A'}
              </div>
              <p className="text-[10px] text-slate-500">
                Informational only; authorization relies on <code className="text-slate-400 font-mono">auth.uid()</code> in <code className="text-slate-400 font-mono">user_roles</code>.
              </p>
            </div>

            {/* Item A: Supabase Project Endpoint (Host) */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Connected Supabase Project Endpoint
              </span>
              <div className="font-mono text-xs text-blue-300 font-medium truncate">
                {diagnosticData.projectHost || 'Not configured'}
              </div>
              <p className="text-[10px] text-slate-500">
                Verifies the app connects to the expected Supabase project (no secrets exposed).
              </p>
            </div>
          </div>

          {/* Core Table Query Inspection: public.user_roles */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Query Result: <code className="text-amber-300 font-mono">SELECT * FROM public.user_roles WHERE user_id = '{diagnosticData.userId || 'auth.uid()'}'</code>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  diagnosticData.roleRowsCount > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {diagnosticData.roleRowsCount} row(s) returned
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Checked: {diagnosticData.testedAt || 'Just now'}
                </span>
              </div>
            </div>

            {/* Query details columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* 4. Role returned from user_roles */}
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-semibold block">
                  4. Role Returned from user_roles
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold font-mono ${
                    diagnosticData.roleReturned === 'admin'
                      ? 'text-emerald-400'
                      : diagnosticData.roleReturned
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}>
                    {diagnosticData.roleReturned ?? 'None'}
                  </span>
                  {diagnosticData.roleReturned === 'admin' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      MATCHES ADMIN
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Value of the <code className="text-slate-400 font-mono">role</code> column for this user.
                </p>
              </div>

              {/* 5. Whether application considers the user an admin */}
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-semibold block">
                  5. Application Considers User Admin?
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold font-mono ${
                    diagnosticData.isAppAdmin ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {diagnosticData.isAppAdmin ? 'TRUE (Authorized as Admin)' : 'FALSE (Not Admin)'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  {diagnosticData.isAppAdmin
                    ? 'Evaluated strictly from public.user_roles row.'
                    : 'Requires role === "admin" in public.user_roles.'}
                </p>
              </div>

              {/* 6. Exact Supabase error code / message if role query fails */}
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-semibold block">
                  6. Supabase Role Query Error
                </span>
                {diagnosticData.roleErrorMessage ? (
                  <div className="text-red-300 font-mono text-[11px] space-y-0.5">
                    <p className="font-bold text-red-400">
                      Code: {diagnosticData.roleErrorCode || 'N/A'}
                    </p>
                    <p className="break-all">{diagnosticData.roleErrorMessage}</p>
                    {diagnosticData.roleErrorDetails && (
                      <p className="text-[10px] text-slate-400">Details: {diagnosticData.roleErrorDetails}</p>
                    )}
                    {diagnosticData.roleErrorHint && (
                      <p className="text-[10px] text-slate-400">Hint: {diagnosticData.roleErrorHint}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>None (Query returned HTTP 200 OK)</span>
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  Reveals if SELECT policy on <code className="text-slate-400 font-mono">user_roles</code> blocked reading.
                </p>
              </div>
            </div>

            {/* Toggle Raw JSON Response */}
            <div className="pt-2">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-[11px] text-slate-400 hover:text-white font-mono flex items-center gap-1.5 transition-colors"
              >
                <span>{showRawJson ? '▼ Hide' : '▶ View'} Raw <code className="text-amber-300">user_roles</code> Database Row JSON</span>
              </button>

              {showRawJson && (
                <div className="mt-2 p-3 rounded-lg bg-slate-900 border border-white/10 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <pre>{JSON.stringify(diagnosticData.roleRowsData, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>

          {/* RLS Policy Probes for Hypothesis E: "Another RLS policy is blocking the database operation" */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  RLS Table Probes: <code className="text-blue-300 font-mono">public.documents</code> & Functions
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Helps pinpoint whether <code className="text-amber-300">documents</code> SELECT policy or <code className="text-amber-300">is_admin()</code> is missing
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Probe A: documents SELECT permission */}
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Probe A: SELECT on public.documents
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    diagnosticData.docsSelectStatus.includes('Allowed')
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}>
                    {diagnosticData.docsSelectStatus}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-300 break-all">
                  {diagnosticData.docsSelectMessage}
                </p>
                <p className="text-[10px] text-slate-500">
                  Note: PostgREST requires SELECT permission when calling <code className="text-slate-400 font-mono">.insert().select()</code>. If documents lacks a SELECT policy, inserts with RETURNING * will fail with RLS.
                </p>
              </div>

              {/* Probe B: public.is_admin() RPC function */}
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Probe B: RPC public.is_admin()
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    diagnosticData.rpcAdminStatus === 'Available'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {diagnosticData.rpcAdminStatus}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-300 break-all">
                  {diagnosticData.rpcAdminMessage}
                </p>
                <p className="text-[10px] text-slate-500">
                  Tests if your database has a <code className="text-slate-400 font-mono">public.is_admin()</code> SECURITY DEFINER function for document policies.
                </p>
              </div>
            </div>

            {/* Probe C: Preflight INSERT Result Banner */}
            {diagnosticData.preflightStatus && (
              <div className={`mt-3 p-3 rounded-lg border text-xs font-mono space-y-1 ${
                diagnosticData.preflightStatus.includes('SUCCESS')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {diagnosticData.preflightStatus.includes('SUCCESS') ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span>Document INSERT Preflight Result: {diagnosticData.preflightStatus}</span>
                </div>
                <p className="text-[11px] break-all">{diagnosticData.preflightMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 13: Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Documents
            </span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-white font-serif">
            {stats.totalDocuments}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Stored in Supabase database</p>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Total Theses
            </span>
            <GraduationCap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-blue-300 font-serif">
            {stats.totalTheses}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">theses/ storage branch</p>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Total GCPs
            </span>
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-amber-300 font-serif">
            {stats.totalGCPs}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">gcps/ storage branch</p>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Academic Years
            </span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-slate-200 font-serif">
            {stats.academicYearsCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.years.slice(0, 3).join(', ')} {stats.years.length > 3 ? '...' : ''}
          </p>
        </div>
      </div>

      {/* Table & Document Management Section */}
      <div className="rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Table Controls (Search, Filters) */}
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="admin-search-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search repository..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="All">All Types</option>
              <option value="Thesis">Theses</option>
              <option value="Grand Case Presentation">GCPs</option>
            </select>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="All">All Years</option>
              {ACADEMIC_YEARS.map(yr => (
                <option key={yr} value={yr}>
                  AY {yr}
                </option>
              ))}
            </select>

            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
              title="Refresh Repository List"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-semibold">Document Title</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Year & Program</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Uploaded</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span>Loading documents from Supabase...</span>
                    </div>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <p className="text-sm font-medium text-slate-300">No documents found in this view.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click the "+ ADD DOCUMENT" button above to upload the first nursing document.
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-100 max-w-xs">
                      <div className="truncate font-semibold group-hover:text-amber-200 transition-colors" title={doc.title}>
                        {doc.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {doc.authors}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
                          doc.document_type === 'Thesis'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {doc.document_type}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-slate-200 font-mono">AY {doc.academic_year}</div>
                      <div className="text-[11px] text-slate-400">{doc.program}</div>
                    </td>

                    <td className="px-6 py-4 max-w-[180px]">
                      <span className="truncate block text-slate-300 text-[11px] bg-slate-950/40 px-2 py-0.5 rounded border border-white/5">
                        {doc.category}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* View */}
                        <button
                          id={`btn-admin-view-${doc.id}`}
                          onClick={() => onViewDocument(doc)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-600/80 text-slate-300 hover:text-white transition-colors"
                          title="View Document & Full PDF"
                          aria-label="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Metadata */}
                        <button
                          id={`btn-admin-edit-${doc.id}`}
                          onClick={() => handleOpenEdit(doc)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-amber-500/80 text-slate-300 hover:text-slate-950 transition-colors"
                          title="Edit Document Metadata"
                          aria-label="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Replace PDF */}
                        <button
                          id={`btn-admin-replace-${doc.id}`}
                          onClick={() => handleOpenReplace(doc)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-600/80 text-slate-300 hover:text-white transition-colors"
                          title="Replace Uploaded PDF File"
                          aria-label="Replace PDF"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          id={`btn-admin-delete-${doc.id}`}
                          onClick={() => setDocToDelete(doc)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-600/80 text-slate-300 hover:text-white transition-colors"
                          title="Delete Document from Database & Storage"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDIT DOCUMENT METADATA */}
      {docToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white font-serif">Edit Document Metadata</h3>
              <button onClick={() => setDocToEdit(null)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Authors</label>
                <input
                  type="text"
                  required
                  value={editAuthors}
                  onChange={e => setEditAuthors(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Academic Year</label>
                  <select
                    value={editYear}
                    onChange={e => setEditYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs"
                  >
                    {ACADEMIC_YEARS.map(yr => (
                      <option key={yr} value={yr}>
                        AY {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Document Type</label>
                  <select
                    value={editType}
                    onChange={e => setEditType(e.target.value as DocumentType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs"
                  >
                    <option value="Thesis">Thesis</option>
                    <option value="Grand Case Presentation">Grand Case Presentation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Program</label>
                  <select
                    value={editProgram}
                    onChange={e => setEditProgram(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs"
                  >
                    {PROGRAMS.map(prog => (
                      <option key={prog} value={prog}>
                        {prog}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Keywords</label>
                <input
                  type="text"
                  value={editKeywords}
                  onChange={e => setEditKeywords(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Description / Abstract</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-xs"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDocToEdit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REPLACE PDF MODAL */}
      {docToReplace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white font-serif">Replace PDF Document</h3>
                <p className="text-xs text-slate-400 mt-0.5">Upload new PDF binary to replace the existing file</p>
              </div>
              <button onClick={() => setDocToReplace(null)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-slate-950 border border-white/10 text-xs">
              <span className="text-slate-500 block mb-1">Target Document:</span>
              <p className="font-semibold text-slate-200">{docToReplace.title}</p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">Current file: {docToReplace.file_name}</p>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleConfirmReplace} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Select New PDF File (.pdf only)
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  onChange={e => handleReplaceFileSelected(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                />
              </div>

              {replaceFile && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">{replaceFile.name}</span>
                      <span className="text-slate-500 ml-2">({(replaceFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                    {replaceFileHash && (
                      <span className="font-mono text-[10px] text-slate-400" title={replaceFileHash}>
                        SHA-256: {replaceFileHash.slice(0, 8)}...{replaceFileHash.slice(-6)}
                      </span>
                    )}
                  </div>

                  {isCheckingReplaceHash ? (
                    <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>Checking if replacement PDF matches any existing repository document...</span>
                    </div>
                  ) : replaceDuplicateResult?.hasDuplicates ? (
                    <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 text-xs text-red-200 flex items-start gap-2.5">
                      <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <p className="font-bold text-red-300">Exact Duplicate Detected</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          This PDF is identical to another document in the archive: "{replaceDuplicateResult.matches[0].document.title}".
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowReplaceDuplicateWarning(true)}
                          className="mt-1.5 text-[11px] text-amber-300 hover:underline font-semibold"
                        >
                          Review Duplicate Details
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>✓ SHA-256 verified: No duplicate binary in archive.</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Notice: The new PDF will be uploaded to Supabase Storage first. Once the database reference is updated, the previous PDF will be safely removed from Storage.
              </p>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDocToReplace(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !replaceFile}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {isProcessing ? 'Uploading & Replacing...' : 'Confirm Replacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-serif">Confirm Deletion</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Are you sure you want to permanently delete:
              <br />
              <strong className="text-amber-200 block mt-1.5 p-2.5 rounded-lg bg-slate-950 border border-white/10 font-sans">
                {docToDelete.title}
              </strong>
            </p>

            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed">
              This action will remove the document metadata from the Supabase PostgreSQL table and delete the physical PDF file (<code className="text-slate-300">{docToDelete.storage_path}</code>) from Supabase Storage. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 disabled:opacity-50"
              >
                {isProcessing ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Modal for Replace PDF */}
      <DuplicateWarningModal
        isOpen={showReplaceDuplicateWarning}
        duplicateResult={replaceDuplicateResult}
        newDocumentInfo={{
          title: docToReplace?.title || '',
          authors: docToReplace?.authors || '',
          academicYear: docToReplace?.academic_year || '',
          documentType: docToReplace?.document_type || '',
          program: docToReplace?.program || '',
          fileName: replaceFile?.name,
        }}
        onClose={() => setShowReplaceDuplicateWarning(false)}
        onUploadAnyway={() => {
          setShowReplaceDuplicateWarning(false);
          setBypassReplaceDuplicate(true);
          handleConfirmReplace(undefined, true);
        }}
        onViewDocument={(doc) => onViewDocument(doc)}
        isSubmitting={isProcessing}
      />
    </div>
  );
};
