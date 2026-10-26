import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGenerateTestCases } from '../../hooks/useAi';
import { useAddTestCase } from '../../hooks/useQuality';
import { AiLoading } from './AiLoading';
import { AiError } from './AiError';

interface AiTestCasesPanelProps {
  taskId: string;
  projectId?: string;
  onSaved?: () => void;
  onClose?: () => void;
}

export const AiTestCasesPanel: React.FC<AiTestCasesPanelProps> = ({
  taskId,
  projectId,
  onSaved,
  onClose,
}) => {
  const {
    mutate: generateTestCases,
    data: generatedData,
    isPending: isGenerating,
    error: generateError,
  } = useGenerateTestCases(taskId);

  const { mutateAsync: addTestCaseAsync } = useAddTestCase(taskId, projectId);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Trigger generation immediately on mount
  useEffect(() => {
    generateTestCases();
  }, [taskId, generateTestCases]);

  // Select all by default once data arrives
  useEffect(() => {
    if (generatedData?.testCases) {
      const all = new Set<number>(generatedData.testCases.map((_, i) => i));
      setSelectedIndices(all);
    }
  }, [generatedData]);

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!generatedData?.testCases) return;
    if (selectedIndices.size === generatedData.testCases.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(generatedData.testCases.map((_, i) => i)));
    }
  };

  const handleSaveSelected = async () => {
    if (!generatedData?.testCases) return;
    const selected = generatedData.testCases.filter((_, i) => selectedIndices.has(i));
    if (selected.length === 0) return;

    setIsSaving(true);
    try {
      // Save each one through F7's useAddTestCase with passed: false via Promise.allSettled
      const results = await Promise.allSettled(
        selected.map((tc) =>
          addTestCaseAsync({
            description: tc.title,
            expectedResult: tc.expectedResult,
            passed: false,
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed === 0) {
        toast.success(`Saved all ${succeeded} test cases`);
      } else {
        toast.success(`Saved ${succeeded} of ${results.length} test cases (${failed} failed)`);
      }

      onSaved?.();
      onClose?.();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-testid="ai-test-cases-panel"
      className="p-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-white shadow-sm space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-indigo-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">AI Test Generator</h4>
            <p className="text-xs text-slate-500">Autonomous QA scenario synthesis</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating || isSaving}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            aria-label="Close AI test cases panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading state */}
      {isGenerating && (
        <AiLoading
          message="Synthesizing test scenarios with AI..."
          subMessage="Evaluating task description, functional boundaries, and edge conditions..."
        />
      )}

      {/* Error state */}
      {generateError && !isGenerating && (
        <AiError
          error={generateError}
          message="The AI service is unavailable, try again"
          onRetry={() => generateTestCases()}
        />
      )}

      {/* Generated list */}
      {!isGenerating && !generateError && generatedData && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-semibold text-indigo-600 hover:text-indigo-700 transition"
            >
              {selectedIndices.size === generatedData.testCases.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
            <span className="text-slate-500 font-medium">
              {selectedIndices.size} of {generatedData.testCases.length} selected
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
            {generatedData.testCases.map((tc, idx) => {
              const isChecked = selectedIndices.has(idx);

              return (
                <div
                  key={idx}
                  data-testid={`generated-test-case-${idx}`}
                  className={`p-3 rounded-xl border transition ${
                    isChecked
                      ? 'border-indigo-200 bg-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 opacity-60'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      aria-label={`Select test case ${tc.title}`}
                      data-testid={`checkbox-test-case-${idx}`}
                      onChange={() => toggleSelect(idx)}
                      disabled={isSaving}
                      className="w-4 h-4 mt-0.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 break-words">
                        {tc.title}
                      </p>
                      <p className="text-xs text-slate-600 break-words">
                        <span className="font-semibold text-slate-500">Expected:</span>{' '}
                        {tc.expectedResult}
                      </p>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="pt-2 border-t border-indigo-100 flex items-center justify-end gap-2.5">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              data-testid="save-selected-test-cases-btn"
              disabled={selectedIndices.size === 0 || isSaving}
              onClick={handleSaveSelected}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition shadow-xs whitespace-nowrap shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Saving test cases...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 shrink-0" />
                  <span>Save selected ({selectedIndices.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiTestCasesPanel;
