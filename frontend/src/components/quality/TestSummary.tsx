import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { TestCase } from '../../types/quality';

interface TestSummaryProps {
  testCases: TestCase[];
}

export const TestSummary: React.FC<TestSummaryProps> = ({ testCases }) => {
  const passedCount = testCases.filter((tc) => tc.passed).length;
  const failedCount = testCases.filter((tc) => !tc.passed).length;
  const total = testCases.length;
  const passRate = total > 0 ? Math.round((passedCount / total) * 100) : 0;

  return (
    <div
      data-testid="test-summary"
      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <div className="flex items-center gap-3">
        <span
          data-testid="test-summary-text"
          className="font-semibold text-slate-800"
        >
          {passedCount} passed, {failedCount} failed
        </span>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {passedCount} Passed
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            {failedCount} Failed
          </span>
        </div>
      </div>
      {total > 0 && (
        <div className="text-xs font-medium text-slate-500">
          Pass rate: <span className="font-bold text-slate-800">{passRate}%</span>
        </div>
      )}
    </div>
  );
};

export default TestSummary;
