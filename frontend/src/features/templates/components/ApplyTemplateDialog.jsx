import React, { useState } from 'react';
import { LayoutTemplate, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useApplyTemplate } from '../hooks';

/**
 * ConfirmDialog for applying a template to a project.
 * Stating: "This adds M tasks to <project name>".
 * Disables button while pending to prevent double application.
 * Shows "This template is no longer available" on 404 error.
/**
 * @param {{
 *   isOpen?: boolean;
 *   onClose?: () => void;
 *   template?: any;
 *   projectId?: string;
 *   projectName?: string;
 *   onSuccess?: (result: any) => void;
 * }} props
 */
export const ApplyTemplateDialog = ({
  isOpen = false,
  onClose = () => {},
  template = null,
  projectId = '',
  projectName = 'this project',
  onSuccess = undefined,
}) => {
  const [errorMessage, setErrorMessage] = useState('');

  const applyMutation = useApplyTemplate(projectId, {
    onSuccess: (data) => {
      setErrorMessage('');
      onSuccess?.(data);
      onClose();
    },
    onError: (error) => {
      const status = error?.response?.status;
      if (status === 404) {
        setErrorMessage('This template is no longer available');
      } else {
        const msg =
          error?.response?.data?.message || error?.message || 'Failed to apply template';
        setErrorMessage(msg);
      }
    },
  });

  if (!isOpen || !template) return null;

  const handleApply = () => {
    if (applyMutation.isPending) return;
    setErrorMessage('');
    applyMutation.mutate({
      projectId,
      key: template.key,
    });
  };

  const handleClose = () => {
    if (applyMutation.isPending) return;
    setErrorMessage('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-template-title"
      data-testid="apply-template-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !applyMutation.isPending) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h3 id="apply-template-title" className="text-lg font-bold text-slate-900">
                Apply Template
              </h3>
              <p className="text-xs text-slate-500 font-medium">{template.name}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={applyMutation.isPending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-5 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
              This adds {template.taskCount} tasks to {projectName}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Tasks will be generated across {template.moduleCount} modules and initialized in the{' '}
              <span className="font-semibold text-slate-700">Backlog</span> column.
            </p>
          </div>

          {/* 404 or other error display */}
          {errorMessage && (
            <div
              data-testid="apply-template-error"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-fade-in"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={applyMutation.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            data-testid="confirm-apply-template-btn"
            onClick={handleApply}
            disabled={applyMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {applyMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <span>Apply Template</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplyTemplateDialog;
