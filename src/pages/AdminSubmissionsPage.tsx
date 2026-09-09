import React, { useState, useEffect } from 'react';
import { formatKeywords } from '../lib/utils';
import {
  FileText,
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  User,
  Mail,
  Phone,
  RefreshCw,
  Eye,
  Download,
  Filter,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';

interface AdminSubmissionsPageProps {
  onBackToDashboard: () => void;
  onViewDocument?: (doc: any) => void;
}

export const AdminSubmissionsPage: React.FC<AdminSubmissionsPageProps> = ({
  onBackToDashboard,
}) => {
  const { isAdmin } = useAuth();

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Status update modal state
  const [newStatus, setNewStatus] = useState<string>('Under Review');
  const [adminFeedback, setAdminFeedback] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: subsData, error: subsError } = await supabase
        .from('manuscript_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (subsError) {
        console.warn('Error fetching manuscript submissions:', subsError);
        setSubmissions([]);
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
        setSubmissions(subsWithFiles);

        if (selectedSub) {
          const refreshed = subsWithFiles.find(s => s.id === selectedSub.id);
          if (refreshed) {
            setSelectedSub(refreshed);
          }
        }
      }
    } catch (err) {
      console.warn('Exception fetching manuscript submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    setIsUpdating(true);
    setSuccessMsg(null);

    const supabase = getSupabase();
    if (!supabase) {
      setIsUpdating(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('manuscript_submissions')
        .update({
          status: newStatus,
          admin_feedback: adminFeedback.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSub.id);

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMsg('Submission status and feedback updated successfully!');
      await fetchSubmissions();

      // Update selected sub in place
      setSelectedSub({
        ...selectedSub,
        status: newStatus,
        admin_feedback: adminFeedback.trim() || null,
        updated_at: new Date().toISOString(),
      });

      setTimeout(() => {
        setSuccessMsg(null);
      }, 3500);
    } catch (err: any) {
      alert('Failed to update submission status: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadFile = async (storagePath: string, fileName: string) => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase.storage
        .from('manuscript-submissions')
        .download(storagePath);

      if (error || !data) {
        throw new Error(error?.message || 'Download failed.');
      }

      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert('Could not download file from private bucket: ' + err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-slate-900 border border-red-500/30 rounded-2xl text-center">
        <h2 className="text-xl font-serif font-bold text-white mb-2">Access Denied</h2>
        <p className="text-sm text-slate-400 mb-6">
          Access to Manuscript Submissions is restricted to administrators verified in public.user_roles.
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

  const filteredSubmissions = submissions.filter(sub => {
    if (statusFilter === 'All') return true;
    return sub.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fadeIn">
      {/* Header & Back */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-3 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Back to Admin Dashboard</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight flex items-center gap-3">
            <span>Manuscript Submissions</span>
            <span className="px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
              {submissions.length} Total
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Statuses</option>
              <option value="Pending" className="bg-slate-900">Pending</option>
              <option value="Under Review" className="bg-slate-900">Under Review</option>
              <option value="Revision Required" className="bg-slate-900">Revision Required</option>
              <option value="Approved" className="bg-slate-900">Approved</option>
              <option value="Rejected" className="bg-slate-900">Rejected</option>
              <option value="Published" className="bg-slate-900">Published</option>
            </select>
          </div>

          <button
            onClick={fetchSubmissions}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SUBMISSIONS LIST */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-900/60 rounded-3xl border border-white/10">
              Loading manuscript submissions from database...
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-900/60 rounded-3xl border border-white/10">
              No manuscript submissions found.
            </div>
          ) : (
            filteredSubmissions.map(sub => {
              const isSelected = selectedSub?.id === sub.id;
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
                  onClick={() => {
                    setSelectedSub(sub);
                    setNewStatus(sub.status || 'Under Review');
                    setAdminFeedback(sub.admin_feedback || '');
                  }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900/90 border-amber-500/60 shadow-xl shadow-amber-500/5'
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-serif">
                            {sub.document_type === 'thesis' ? 'Thesis' : sub.document_type === 'gcp' ? 'Grand Case Presentation (GCP)' : sub.document_type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-0.5">
                          {sub.lead_proponent_name}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(sub.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5 font-mono">
                    <span>Deadline: {sub.evaluation_deadline ? new Date(sub.evaluation_deadline).toLocaleDateString() : '7 Business Days'}</span>
                    <span>{sub.manuscript_submission_files?.length || 0} Files Attached</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* SUBMISSION DETAIL & REVIEW PANEL */}
        <div className="lg:col-span-1">
          {selectedSub ? (
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/15 shadow-2xl sticky top-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <h3 className="text-base font-bold text-white font-serif">
                  Review Submission
                </h3>
                <button
                  onClick={() => setSelectedSub(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  {successMsg}
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Document Classification</span>
                  <span className="text-white font-bold text-sm font-serif">
                    {selectedSub.document_type === 'thesis' ? 'Thesis' : selectedSub.document_type === 'gcp' ? 'Grand Case Presentation (GCP)' : selectedSub.document_type}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-medium">Lead Proponent</span>
                  <span className="text-slate-200">{selectedSub.lead_proponent_name}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block font-medium">Contact</span>
                    <span className="text-slate-200 font-mono text-[11px]">{selectedSub.contact_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Email</span>
                    <span className="text-slate-200 font-mono text-[11px] truncate block">{selectedSub.email}</span>
                  </div>
                </div>

                {selectedSub.description && (
                  <div>
                    <span className="text-slate-400 block font-medium">Description</span>
                    <p className="text-slate-300 mt-0.5 bg-slate-950 p-2.5 rounded-xl border border-white/5">{selectedSub.description}</p>
                  </div>
                )}

                {selectedSub.keywords && (
                  <div>
                    <span className="text-slate-400 block font-medium">Keywords</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formatKeywords(selectedSub.keywords).map((kw: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 text-[10px] font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached Files */}
                <div className="pt-2 border-t border-white/10">
                  <span className="text-slate-300 font-bold block mb-2 font-serif">Submitted Files ({selectedSub.manuscript_submission_files?.length || 0})</span>
                  <div className="space-y-2">
                    {selectedSub.manuscript_submission_files?.map((file: any) => (
                      <div key={file.id} className="p-2.5 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-[11px] text-slate-200 truncate font-mono">{file.file_name}</span>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(file.storage_path, file.file_name)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Update Form */}
                <form onSubmit={handleUpdateStatus} className="pt-4 border-t border-white/10 space-y-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
                      Update Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-slate-200 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Revision Required">Revision Required</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Published">Published</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
                      Administrative Feedback / Notes
                    </label>
                    <textarea
                      rows={3}
                      value={adminFeedback}
                      onChange={e => setAdminFeedback(e.target.value)}
                      placeholder="Provide feedback or revision instructions for the student proponent..."
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/15 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUpdating ? 'Saving...' : 'Save Status & Feedback'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-900/60 rounded-3xl border border-white/10 sticky top-8">
              Select a manuscript submission from the list to view files, metadata, and update review status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
