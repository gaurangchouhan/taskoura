import React, { useState } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useAddTestCase } from '../../hooks/useQuality';

interface AddTestCaseFormProps {
  taskId: string;
  projectId?: string;
  onSuccess?: () => void;
}

export const AddTestCaseForm: React.FC<AddTestCaseFormProps> = ({
  taskId,
  projectId,
  onSuccess,
}) => {
  const [description, setDescription] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [passed, setPassed] = useState(true);

  const { mutate: addTestCase, isPending } = useAddTestCase(taskId, projectId);

  const isFormValid = description.trim().length > 0 && expectedResult.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isPending) return;

    addTestCase(
      {
        description: description.trim(),
        expectedResult: expectedResult.trim(),
        passed,
      },
      {
        onSuccess: () => {
          setDescription('');
          setExpectedResult('');
          setPassed(true);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <form
      data-testid="add-test-case-form"
      onSubmit={handleSubmit}
      className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3.5"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800">Add Test Case</h4>
        <span className="text-xs text-slate-500">Manual QA Verification</span>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="testcase-desc"
          className="block text-xs font-semibold text-slate-700"
        >
          Description <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="testcase-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. User navigates to Settings and toggles dark mode"
          disabled={isPending}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition placeholder:text-slate-400 resize-none disabled:bg-slate-50"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="testcase-expected"
          className="block text-xs font-semibold text-slate-700"
        >
          Expected Result <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          id="testcase-expected"
          value={expectedResult}
          onChange={(e) => setExpectedResult(e.target.value)}
          placeholder="e.g. Theme immediately updates and persists in local storage"
          disabled={isPending}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition placeholder:text-slate-400 disabled:bg-slate-50"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="relative flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            id="testcase-passed"
            checked={passed}
            onChange={(e) => setPassed(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-700">
            Passed verification
          </span>
        </label>

        <button
          type="submit"
          disabled={!isFormValid || isPending}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition shadow-sm whitespace-nowrap shrink-0"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Add Test Case</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default AddTestCaseForm;
