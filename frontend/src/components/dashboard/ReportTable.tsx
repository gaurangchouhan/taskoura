import React from 'react';
import { Download, Printer, Sparkles, TrendingUp, TrendingDown, Users, Award } from 'lucide-react';
import { MemberPerformanceReport } from '../../types/dashboard';

interface ReportTableProps {
  members: MemberPerformanceReport[];
  aiSummary?: string;
  projectName?: string;
}

export function generateCsvContent(members: MemberPerformanceReport[]): string {
  const headers = [
    'Member Name',
    'Tasks Assigned',
    'Tasks Completed',
    'On-Time Completions',
    'Late Completions',
    'Average Delay (Days)',
    'Rework Count',
    'Bugs Assigned',
    'Bugs Fixed',
    'Avg Bug Turnaround (Hours)',
    'Test Cases Executed',
    'Test Cases Passed',
  ];

  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = members.map((m) => [
    escapeCsv(m.name),
    escapeCsv(m.tasksAssigned),
    escapeCsv(m.tasksCompleted),
    escapeCsv(m.onTimeCompletions),
    escapeCsv(m.lateCompletions),
    escapeCsv(m.averageDelayDays),
    escapeCsv(m.reworkCount),
    escapeCsv(m.bugsAssigned),
    escapeCsv(m.bugsFixed),
    escapeCsv(m.avgBugTurnaroundHours),
    escapeCsv(m.testCasesExecuted),
    escapeCsv(m.testCasesPassed),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export const ReportTable: React.FC<ReportTableProps> = ({
  members,
  aiSummary,
  projectName = 'Project',
}) => {
  const handleDownloadCsv = () => {
    const csvContent = generateCsvContent(members);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${projectName.toLowerCase().replace(/\s+/g, '_')}_performance_report.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // Find best and worst indicators across members
  const maxCompleted = Math.max(...members.map((m) => m.tasksCompleted), 0);
  const maxDelay = Math.max(...members.map((m) => m.averageDelayDays), 0);
  const maxRework = Math.max(...members.map((m) => m.reworkCount), 0);

  return (
    <div data-testid="report-container" className="space-y-6">
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header, nav, .no-print, button {
            display: none !important;
          }
          .print-clean {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #e2e8f0 !important;
            padding: 8px 10px !important;
          }
        }
      `}</style>

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Member Performance & Engineering Velocity
            </h3>
            <p className="text-xs text-slate-500">
              Audit member throughput, quality turnaround, and test deliverables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            data-testid="print-report-btn"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            data-testid="download-csv-btn"
            onClick={handleDownloadCsv}
            disabled={members.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 rounded-xl shadow-md shadow-sky-500/20 transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Optional AI Summary */}
      {aiSummary && (
        <div
          data-testid="report-ai-summary"
          className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white border border-indigo-100/80 shadow-xs flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Executive AI Performance Summary
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed break-words font-medium">
              {aiSummary}
            </p>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden print-clean">
        {members.length === 0 ? (
          <div
            data-testid="empty-report"
            className="py-16 text-center text-slate-400 space-y-2"
          >
            <Users className="w-8 h-8 stroke-[1.5] mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No member data recorded</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Assign and complete tasks or test cases to generate performance statistics.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="report-table"
              className="w-full text-left border-collapse text-xs"
            >
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Contributor</th>
                  <th className="py-3 px-4 text-center">Assigned</th>
                  <th className="py-3 px-4 text-center">Completed</th>
                  <th className="py-3 px-4 text-center">On-Time / Late</th>
                  <th className="py-3 px-4 text-center">Avg Delay</th>
                  <th className="py-3 px-4 text-center">Rework</th>
                  <th className="py-3 px-4 text-center">Bugs (Done/Tot)</th>
                  <th className="py-3 px-4 text-center">Bug Turnaround</th>
                  <th className="py-3 px-4 text-center">QA Tests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const isTopCompleter = maxCompleted > 0 && m.tasksCompleted === maxCompleted;
                  const isHighDelay = maxDelay > 0 && m.averageDelayDays === maxDelay && m.averageDelayDays > 2;
                  const isHighRework = maxRework > 0 && m.reworkCount === maxRework && m.reworkCount > 3;

                  return (
                    <tr
                      key={m.userId}
                      data-testid={`report-row-${m.userId}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          {isTopCompleter && (
                            <span
                              title="Top Deliverer"
                              className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"
                            >
                              <Award className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assigned */}
                      <td className="py-3.5 px-4 text-center text-slate-600">
                        {m.tasksAssigned}
                      </td>

                      {/* Completed */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-bold ${
                            isTopCompleter
                              ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200'
                              : 'text-slate-900'
                          }`}
                        >
                          {m.tasksCompleted}
                        </span>
                      </td>

                      {/* On-Time / Late */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-emerald-600 font-medium">{m.onTimeCompletions}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={`font-medium ${m.lateCompletions > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {m.lateCompletions}
                        </span>
                      </td>

                      {/* Average Delay (days) */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isHighDelay
                              ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200'
                              : m.averageDelayDays === 0
                              ? 'text-slate-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {isHighDelay && <TrendingUp className="w-3 h-3 text-rose-500" />}
                          <span>{m.averageDelayDays} days</span>
                        </span>
                      </td>

                      {/* Rework */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-semibold ${
                            isHighRework
                              ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200'
                              : m.reworkCount === 0
                              ? 'text-slate-500'
                              : 'text-slate-700'
                          }`}
                        >
                          {m.reworkCount}
                        </span>
                      </td>

                      {/* Bugs */}
                      <td className="py-3.5 px-4 text-center text-slate-700 font-medium">
                        <span className="text-emerald-600">{m.bugsFixed}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-slate-600">{m.bugsAssigned}</span>
                      </td>

                      {/* Bug Turnaround (hours) */}
                      <td className="py-3.5 px-4 text-center text-slate-600">
                        {m.avgBugTurnaroundHours > 0 ? `${m.avgBugTurnaroundHours} hrs` : '—'}
                      </td>

                      {/* QA Tests */}
                      <td className="py-3.5 px-4 text-center text-slate-700 font-medium">
                        <span className="text-purple-700 font-semibold">{m.testCasesPassed}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-slate-500">{m.testCasesExecuted}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportTable;
