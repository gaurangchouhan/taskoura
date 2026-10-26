import React, { useState } from 'react';
import { Bug as BugIcon, Beaker } from 'lucide-react';
import { ProjectMember } from '../../types/member';
import { useBugs, useTestCases } from '../../hooks/useQuality';
import { BugsTab } from './BugsTab';
import { TestCasesTab } from './TestCasesTab';

interface QualitySectionProps {
  taskId: string;
  projectId?: string;
  memberMap: Map<string, ProjectMember>;
  initialTab?: 'bugs' | 'test-cases';
}

export const QualitySection: React.FC<QualitySectionProps> = ({
  taskId,
  projectId,
  memberMap,
  initialTab = 'bugs',
}) => {
  const [activeTab, setActiveTab] = useState<'bugs' | 'test-cases'>(initialTab);
  const { data: bugs = [] } = useBugs(taskId);
  const { data: testCases = [] } = useTestCases(taskId);

  const openBugsCount = bugs.filter((b) => b.status !== 'Resolved').length;

  return (
    <div
      data-testid="section-bugs-tests"
      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-4"
    >
      {/* Header and Tab Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Quality & Verification</h3>
          <p className="text-xs text-slate-500">Defect tracking and functional test cases</p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-xl">
          <button
            type="button"
            data-testid="tab-button-bugs"
            onClick={() => setActiveTab('bugs')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'bugs'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BugIcon className="w-3.5 h-3.5" />
            <span>Bugs</span>
            {openBugsCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                {openBugsCount}
              </span>
            ) : bugs.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                {bugs.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            data-testid="tab-button-test-cases"
            onClick={() => setActiveTab('test-cases')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'test-cases'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Beaker className="w-3.5 h-3.5" />
            <span>Test cases</span>
            {testCases.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                {testCases.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Body */}
      {activeTab === 'bugs' ? (
        <BugsTab
          taskId={taskId}
          projectId={projectId}
          memberMap={memberMap}
        />
      ) : (
        <TestCasesTab
          taskId={taskId}
          projectId={projectId}
          memberMap={memberMap}
        />
      )}
    </div>
  );
};

export default QualitySection;
