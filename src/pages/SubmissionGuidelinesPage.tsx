import React from 'react';
import { BookOpen, ArrowLeft, Shield, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface SubmissionGuidelinesPageProps {
  onReturnToSubmit: () => void;
  onBrowseRepository: () => void;
}

export const SubmissionGuidelinesPage: React.FC<SubmissionGuidelinesPageProps> = ({
  onReturnToSubmit,
  onBrowseRepository,
}) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fadeIn">
      {/* Top navigation header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={onReturnToSubmit}
          className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Back to Submit Manuscript</span>
        </button>

        <button
          onClick={onBrowseRepository}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all"
        >
          Browse Repository
        </button>
      </div>

      {/* Main Content Container */}
      <div className="p-6 sm:p-12 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-amber-500/30 shadow-2xl relative overflow-hidden space-y-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Title Banner */}
        <div className="border-b border-white/10 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-emerald-500/30 p-1 flex items-center justify-center shadow-md" title="Trinity University of Asia">
                <img src="/assets/trinity.webp" alt="Trinity University of Asia" className="w-full h-full object-contain" />
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-amber-500/30 p-1 flex items-center justify-center shadow-md" title="St. Luke's College of Nursing">
                <img src="/assets/college-of-nursing.webp" alt="College of Nursing" className="w-full h-full object-contain" />
              </div>
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
              The Maltese Archive • Digital Repository Policy
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white font-serif tracking-tight mt-2">
            Guidelines for Manuscript Submission
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-sans">
            Official instructions for repository submission, evaluation, administrative review, and inclusion in the digital repository.
          </p>
        </div>

        {/* Section I */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-amber-300 font-serif border-b border-white/10 pb-2">
            I. General Guidelines
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 font-sans">
            <li className="pl-1">
              All manuscripts submitted to The Maltese Archive Digital Repository shall undergo an evaluation process and <strong className="text-white font-semibold">administrative review</strong> within <strong className="text-white font-semibold">seven (7) working days</strong>, excluding <strong className="text-white font-semibold">weekends</strong> and <strong className="text-white font-semibold">official holidays</strong>. Approval of submissions shall be conducted by the authorized administrators.
            </li>
            <li className="pl-1">
              The repository shall accept <strong className="text-white font-semibold">PDF files only</strong>, not exceeding <strong className="text-white font-semibold">50 MB</strong>. Manuscripts submitted in other file formats will not be processed.
            </li>
            <li className="pl-1">
              The submission must include the contact information of the <strong className="text-white font-semibold">lead proponent</strong>, including:
              <ul className="list-disc list-inside space-y-1 pl-6 mt-2 text-slate-300">
                <li>Active <strong className="text-white font-semibold">contact number</strong></li>
                <li>Valid <strong className="text-white font-semibold">email address</strong></li>
              </ul>
            </li>
            <li className="pl-1">
              Only the <strong className="text-white font-semibold">final defended manuscript</strong> shall be accepted for repository submission. <strong className="text-white font-semibold">Drafts</strong>, <strong className="text-white font-semibold">revisions</strong>, or <strong className="text-white font-semibold">incomplete manuscripts</strong> shall not be considered.
            </li>
            <li className="pl-1">
              All students submitting manuscripts shall provide at least <strong className="text-white font-semibold">five (5) keywords</strong> relevant to their submitted paper for indexing, categorization, and efficient search retrieval within the repository.
            </li>
          </ol>
        </section>

        {/* Section II */}
        <section className="space-y-6 pt-4 border-t border-white/10">
          <h2 className="text-lg font-bold text-amber-300 font-serif border-b border-white/10 pb-2">
            II. Specific Submission Requirements
          </h2>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white font-serif uppercase tracking-wider">
              A. <strong className="text-white font-bold">Thesis Manuscripts</strong>
            </h3>
            <p className="text-xs text-slate-400">
              Proponents submitting <strong className="text-white font-semibold">Thesis Manuscripts</strong> must provide the following documents:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-300 pl-2">
              <li className="pl-1"><strong className="text-white font-semibold">Final Defended Manuscript</strong> (PDF format)</li>
              <li className="pl-1"><strong className="text-white font-semibold">Signed Termination Report</strong></li>
              <li className="pl-1"><strong className="text-white font-semibold">Signed Approval Sheet</strong> duly signed by the members of the panel and the Dean of Nursing</li>
              <li className="pl-1"><strong className="text-white font-semibold">Abstract/Summary</strong> (typed or pasted directly into the form)</li>
              <li className="pl-1"><strong className="text-white font-semibold">Five main keywords</strong> (typed directly into the form)</li>
            </ol>
          </div>

          <div className="space-y-4 pt-3">
            <h3 className="text-sm font-bold text-white font-serif uppercase tracking-wider">
              B. <strong className="text-white font-bold">Graduate Capstone Projects (GCPs)</strong>
            </h3>
            <p className="text-xs text-slate-400">
              Proponents submitting <strong className="text-white font-semibold">Graduate Capstone Projects (GCPs)</strong> must provide the following requirements:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-300 pl-2">
              <li className="pl-1"><strong className="text-white font-semibold">Final Defended Manuscript</strong> (PDF format)</li>
              <li className="pl-1"><strong className="text-white font-semibold">Signed Approval Sheet</strong></li>
              <li className="pl-1">A <strong className="text-white font-semibold">brief description/abstract</strong> of the project (typed or pasted into the form)</li>
              <li className="pl-1"><strong className="text-white font-semibold">Five (5) main keywords</strong> relevant to the manuscript for indexing and search purposes</li>
            </ol>
          </div>
        </section>

        {/* Section III */}
        <section className="space-y-3 pt-4 border-t border-white/10">
          <h2 className="text-lg font-bold text-amber-300 font-serif border-b border-white/10 pb-2">
            III. <strong className="text-amber-300 font-bold">Compliance Requirement</strong>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
            Submissions that do not meet the stated requirements shall be returned to the proponents for completion and compliance before evaluation and approval.
          </p>
        </section>

        {/* Bottom Navigation */}
        <div className="pt-8 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={onReturnToSubmit}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Submit Manuscript</span>
          </button>
        </div>
      </div>
    </div>
  );
};
