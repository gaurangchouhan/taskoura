import React, { useState } from 'react';
import { Loader2, Plus, Bug as BugIcon, Check, ShieldAlert } from 'lucide-react';
import { Bug, BugSeverity } from '../../types/quality';
import { ProjectMember } from '../../types/member';
import { useBugs, useResolveBug } from '../../hooks/useQuality';
import { ReportBugModal } from './ReportBugModal';
import { formatTimeAgo } from '../comments/CommentItem';

interface BugsTabProps {
  taskId: string;
  projectId?: string;
  memberMap: Map<string, ProjectMember>;
}

export function getSeverityChip(severity: BugSeverity | string) {
  switch (severity) {
    case 'Critical':
      return {
        label: 'Critical',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'High':
      return {
        label: 'High',
        className: 'bg-orange-50 text-orange-700 border-orange-200',
      };
    case 'Medium':
      return {
        label: 'Medium',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'Low':
    default:
      return {
        label: 'Low',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

export function getStatusChip(status: string) {
  if (status === 'Resolved') {
    return {
      label: 'Resolved',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  return {
    label: 'Open',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

export const BugsTab: React.FC<BugsTabProps> = ({
  taskId,
  projectId,
  memberMap,
}) => {
  const { data: bugs = [], isLoading } = useBugs(taskId);
  const { mutate: resolveBug, isPending: isResolving } = useResolveBug(taskId, projectId);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const openBugsCount = bugs.filter((b) => b.status !== 'Resolved').length;

  return (
    <div data-testid="tab-bugs" className="space-y-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Reported Defects ({bugs.length})
          </h4>
          {openBugsCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {openBugsCount} open
            </span>
          )}
        </div>

        <button
          type="button"
          data-testid="report-bug-btn"
          onClick={() => setIsReportModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>Report Bug</span>
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-rose-600" />
          <span className="text-xs">Loading bugs...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && bugs.length === 0 && (
        <div
          data-testid="empty-bugs"
          className="py-10 px-4 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50"
        >
          <BugIcon className="w-7 h-7 mx-auto mb-2 text-slate-400 stroke-[1.5]" />
          <p className="text-xs font-semibold text-slate-700">No bugs reported</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Zero defects currently logged against this task.
          </p>
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report First Defect</span>
          </button>
        </div>
      )}

      {/* Bug List */}
      {!isLoading && bugs.length > 0 && (
        <div className="space-y-2.5">
          {bugs.map((bug) => {
            const severityChip = getSeverityChip(bug.severity);
            const statusChip = getStatusChip(bug.status);

            const reporter = memberMap.get(bug.reportedBy);
            const reporterName = reporter ? reporter.userName : 'Unknown reporter';

            const assignee = bug.assignedTo ? memberMap.get(bug.assignedTo) : null;
            const assigneeName = bug.assignedTo
              ? assignee
                ? assignee.userName
                : 'Unassigned'
              : 'Unassigned';

            const isOpen = bug.status !== 'Resolved';

            return (
              <div
                key={bug.id}
                data-testid={`bug-item-${bug.id}`}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-sm space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Severity chip */}
                    <span
                      data-testid={`severity-chip-${bug.severity.toLowerCase()}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm ${severityChip.className}`}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      {severityChip.label}
                    </span>

                    {/* Status chip */}
                    <span
                      data-testid={`status-chip-${bug.status.toLowerCase()}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm ${statusChip.className}`}
                    >
                      {statusChip.label}
                    </span>
                  </div>

                  {/* Resolve button on Open bugs only */}
                  {isOpen && (
                    <button
                      type="button"
                      data-testid={`resolve-bug-${bug.id}`}
                      disabled={isResolving}
                      onClick={() => resolveBug(bug.id)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>

                {/* Bug Description if present */}
                {bug.description && (
                  <p className="text-sm text-slate-800 break-words whitespace-pre-wrap">
                    {bug.description}
                  </p>
                )}

                {/* Footer metadata: reporter, assignee, createdAt */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>
                      Reported by:{' '}
                      <span className="font-semibold text-slate-700">{reporterName}</span>
                    </span>
                    <span>
                      Assignee:{' '}
                      <span className="font-semibold text-slate-700">{assigneeName}</span>
                    </span>
                  </div>
                  <span>{formatTimeAgo(bug.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <ReportBugModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        taskId={taskId}
        projectId={projectId}
        memberMap={memberMap}
      />
    </div>
  );
};

export default BugsTab;
