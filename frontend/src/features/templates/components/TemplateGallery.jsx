import React, { useState } from 'react';
import { LayoutTemplate, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useTemplates } from '../hooks';
import { TemplateCard } from './TemplateCard';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';

/**
 * SlideOver / Modal gallery showing available workflow templates.
 */
export const TemplateGallery = ({
  isOpen = false,
  onClose = () => {},
  projectId = '',
  projectName = 'this project',
  onTemplateApplied = undefined,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const { data, isLoading, isError, error, refetch } = useTemplates();

  if (!isOpen) return null;

  const templates = data?.templates || [];

  const handleApplySuccess = (result) => {
    setSelectedTemplate(null);
    onTemplateApplied?.(result);
    onClose();
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-gallery-title"
        data-testid="template-gallery"
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="w-full max-w-4xl max-h-[85vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-sky-50/30">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                <LayoutTemplate className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="template-gallery-title" className="text-xl font-bold text-slate-900">
                    Project Templates
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                    <Sparkles className="w-3 h-3" />
                    <span>Instant Setup</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a production-ready blueprint to automatically scaffold modules and tasks.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close template gallery"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div
                data-testid="templates-loading"
                className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400"
              >
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                <span className="text-sm font-medium">Loading templates...</span>
              </div>
            ) : isError ? (
              <div
                data-testid="templates-error"
                className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Failed to load templates
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  {error?.message || 'Could not fetch template repository.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : templates.length === 0 ? (
              <div
                data-testid="templates-empty"
                className="flex flex-col items-center justify-center py-16 text-slate-400 text-center"
              >
                <LayoutTemplate className="w-10 h-10 mb-2 text-slate-300" />
                <p className="text-sm font-medium">No templates available right now.</p>
              </div>
            ) : (
              <div
                data-testid="templates-grid"
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {templates.map((tpl) => (
                  <TemplateCard
                    key={tpl.key}
                    template={tpl}
                    onApply={(t) => setSelectedTemplate(t)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
            <span>
              Applying a template adds pre-configured tasks without overwriting existing work.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Apply Confirmation Dialog */}
      {selectedTemplate && (
        <ApplyTemplateDialog
          isOpen={Boolean(selectedTemplate)}
          onClose={() => setSelectedTemplate(null)}
          template={selectedTemplate}
          projectId={projectId}
          projectName={projectName}
          onSuccess={handleApplySuccess}
        />
      )}
    </>
  );
};

export default TemplateGallery;
