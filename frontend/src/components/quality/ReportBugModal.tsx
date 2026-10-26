import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { BugSeverity } from '../../types/quality';
import { ProjectMember } from '../../types/member';
import { useReportBug } from '../../hooks/useQuality';

interface ReportBugModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  projectId?: string;
  memberMap: Map<string, ProjectMember>;
}

export const ReportBugModal: React.FC<ReportBugModalProps> = ({
  isOpen,
  onClose,
  taskId,
  projectId,
  memberMap,
}) => {
  const [severity, setSeverity] = useState<BugSeverity>('Medium');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');

  const { mutate: reportBug, isPending } = useReportBug(taskId, projectId);

  useEffect(() => {
    if (isOpen) {
      setSeverity('Medium');
      setDescription('');
      setAssignedTo('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const isFormValid = description.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isPending) return;

    reportBug(
      {
        severity,
        description: description.trim(),
        assignedTo: assignedTo ? assignedTo : null,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const memberList = Array.from(memberMap.values());

  return (
    <div
      data-testid="report-bug-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scale-up">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Report Defect / Bug</h3>
              <p className="text-xs text-slate-500">Log an issue identified on this task</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Severity & Assignee Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bug-severity"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Severity <span className="text-rose-500">*</span>
              </label>
              <select
                id="bug-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                disabled={isPending}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="bug-assignee"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Assignee
              </label>
              <select
                id="bug-assignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={isPending}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              >
                <option value="">Unassigned</option>
                {memberList.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userName} ({m.userEmail})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="bug-description"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Description & Reproduction <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="bug-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe steps to reproduce the issue, observed vs expected behavior..."
              disabled={isPending}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition placeholder:text-slate-400 resize-none disabled:bg-slate-50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-10 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-bug-btn"
              disabled={!isFormValid || isPending}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition shadow-sm whitespace-nowrap shrink-0"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Report Bug</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportBugModal;
