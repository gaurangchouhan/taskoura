import React, { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Plus, ChevronUp, Beaker, Sparkles } from 'lucide-react';
import { ProjectMember } from '../../types/member';
import { useTestCases } from '../../hooks/useQuality';
import { TestSummary } from './TestSummary';
import { AddTestCaseForm } from './AddTestCaseForm';
import { AiTestCasesPanel } from '../ai/AiTestCasesPanel';
import { formatTimeAgo } from '../comments/CommentItem';

interface TestCasesTabProps {
  taskId: string;
  projectId?: string;
  memberMap: Map<string, ProjectMember>;
}

export const TestCasesTab: React.FC<TestCasesTabProps> = ({
  taskId,
  projectId,
  memberMap,
}) => {
  const { data: testCases = [], isLoading } = useTestCases(taskId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  return (
    <div data-testid="tab-test-cases" className="space-y-4">
      {/* Top summary strip */}
      <TestSummary testCases={testCases} />

      {/* Action / Add button */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Test Executions ({testCases.length})
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="generate-ai-test-cases-btn"
            onClick={() => {
              setShowAiPanel((prev) => !prev);
              setShowAddForm(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1 rounded-lg transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate with AI</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddForm((prev) => !prev);
              setShowAiPanel(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
          >
            {showAddForm ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Hide Form</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Test Case</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI Test Cases Panel */}
      {showAiPanel && (
        <AiTestCasesPanel
          taskId={taskId}
          projectId={projectId}
          onSaved={() => setShowAiPanel(false)}
          onClose={() => setShowAiPanel(false)}
        />
      )}

      {/* Add form */}
      {showAddForm && (
        <AddTestCaseForm
          taskId={taskId}
          projectId={projectId}
          onSuccess={() => setShowAddForm(false)}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-xs">Loading test cases...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && testCases.length === 0 && (
        <div
          data-testid="empty-test-cases"
          className="py-10 px-4 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50"
        >
          <Beaker className="w-7 h-7 mx-auto mb-2 text-slate-400 stroke-[1.5]" />
          <p className="text-xs font-semibold text-slate-700">No test cases recorded yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Log functional test runs to track verification criteria and pass rates.
          </p>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Test Case</span>
            </button>
          )}
        </div>
      )}

      {/* Test cases list */}
      {!isLoading && testCases.length > 0 && (
        <div className="space-y-2.5">
          {testCases.map((tc) => {
            const member = memberMap.get(tc.executedBy);
            const executorName = member ? member.userName : 'Unknown tester';
            const initials = member?.userName
              ? member.userName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : '?';

            return (
              <div
                key={tc.id}
                data-testid={`test-case-item-${tc.id}`}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 break-words">
                      {tc.description}
                    </p>
                    <p className="text-xs text-slate-600 break-words">
                      <span className="font-semibold text-slate-500">Expected:</span>{' '}
                      {tc.expectedResult}
                    </p>
                  </div>

                  {/* Pass / Fail Chip */}
                  <div className="shrink-0">
                    {tc.passed ? (
                      <span
                        data-testid="chip-pass"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Pass
                      </span>
                    ) : (
                      <span
                        data-testid="chip-fail"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        Fail
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <span>
                      Executed by <span className="font-medium text-slate-700">{executorName}</span>
                    </span>
                  </div>
                  <span>{formatTimeAgo(tc.executedAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TestCasesTab;
