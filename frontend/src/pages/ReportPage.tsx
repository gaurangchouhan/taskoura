import React from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { ShieldAlert, Loader2, FileSpreadsheet } from 'lucide-react';
import { useReport } from '../hooks/useDashboard';
import { useCurrentMembership } from '../hooks/useMembers';
import { ReportTable } from '../components/dashboard/ReportTable';
import { Project } from '../types/project';

export const ReportPage: React.FC = () => {
  const { projectId: routeProjectId, id: routeId } = useParams<{
    projectId?: string;
    id?: string;
  }>();
  const projectId = routeProjectId || routeId || '';

  let outletContext: { project?: Project } | null = null;
  try {
    outletContext = useOutletContext<{ project?: Project } | null>();
  } catch {
    outletContext = null;
  }

  const { isOwner, isLoading: isCheckingMembership } = useCurrentMembership(projectId);
  const { data: report, isLoading: isLoadingReport, error } = useReport(projectId);

  // Check for 403 Forbidden either from backend error response or non-owner membership
  const isForbidden =
    (error &&
      typeof error === 'object' &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 403) ||
    (!isCheckingMembership && !isOwner);

  if (isCheckingMembership || (isLoadingReport && !isForbidden)) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-sky-600" />
        <span className="text-sm font-medium">Generating performance audit...</span>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div
        data-testid="report-forbidden"
        className="py-16 px-4 rounded-3xl border border-dashed border-rose-200 bg-rose-50/30 text-center space-y-4 max-w-lg mx-auto my-8"
      >
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
          <p
            data-testid="forbidden-message"
            className="text-sm font-medium text-rose-700 max-w-sm mx-auto"
          >
            Only the project owner can view the report.
          </p>
          <p className="text-xs text-slate-500">
            Performance metrics and member efficiency audits are restricted to the workspace administrator.
          </p>
        </div>
      </div>
    );
  }

  const members = report?.members || [];
  const aiSummary = report?.aiSummary;

  return (
    <div data-testid="project-report-page" className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Sprint Performance Audit</h2>
            <p className="text-xs text-slate-500">
              Confidential owner report of team efficiency, defect turnaround, and deliverables
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full self-start sm:self-auto">
          Owner Only
        </span>
      </div>

      <ReportTable
        members={members}
        aiSummary={aiSummary}
        projectName={outletContext?.project?.name || 'Workspace'}
      />
    </div>
  );
};

export default ReportPage;
