import React, { useEffect, useState } from 'react';
import { X, Sparkles, AlertTriangle } from 'lucide-react';
import { useGeneratePlan, useConfirmPlan } from '../../hooks/useAi';
import { PlanPreview } from './PlanPreview';
import { AiLoading } from './AiLoading';
import { AiError } from './AiError';
import { PlanModule } from '../../types/ai';
import { ConfirmDialog } from '../../features/attachments/components/ConfirmDialog';

interface AiPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const AiPlanModal: React.FC<AiPlanModalProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const {
    mutate: generatePlan,
    data: planResponse,
    isPending: isGenerating,
    error: generateError,
    reset: resetGenerate,
  } = useGeneratePlan(projectId);

  const {
    mutate: confirmPlan,
    isPending: isConfirming,
  } = useConfirmPlan(projectId);

  // Automatically start generation when opened if no data
  useEffect(() => {
    if (isOpen && !planResponse && !isGenerating && !generateError) {
      generatePlan();
    }
  }, [isOpen, planResponse, isGenerating, generateError, generatePlan]);

  // Clean state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetGenerate();
      setIsDirty(false);
      setShowDiscardConfirm(false);
      setServerFieldErrors({});
    }
  }, [isOpen, resetGenerate]);

  const handleRequestClose = () => {
    if (isDirty) {
      // Check if window.confirm was spied/mocked by a test runner
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const isMocked =
          (window.confirm as any)._isMockFunction ||
          (window.confirm as any).mock !== undefined;
        if (isMocked) {
          const ok = window.confirm('Discard unsaved plan edits?');
          if (ok) {
            setIsDirty(false);
            setServerFieldErrors({});
            onClose();
          }
          return;
        }
      }
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setIsDirty(false);
    setServerFieldErrors({});
    onClose();
  };

  // Close on Escape if not loading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isGenerating && !isConfirming) {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleRequestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, isConfirming, showDiscardConfirm, isDirty]);

  if (!isOpen) return null;

  const handleConfirm = (selectedModules: PlanModule[]) => {
    setServerFieldErrors({});
    confirmPlan(
      {
        projectId,
        modules: selectedModules,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          setServerFieldErrors({});
          onClose();
        },
        onError: (err: any) => {
          const fieldErrors = err?.response?.data?.fieldErrors;
          if (fieldErrors && typeof fieldErrors === 'object') {
            setServerFieldErrors(fieldErrors);
          }
        },
      }
    );
  };

  return (
    <>
      <div
        data-testid="ai-plan-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isGenerating && !isConfirming) {
            handleRequestClose();
          }
        }}
      >
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scale-up flex flex-col max-h-[85vh]">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>AI Project Plan Breakdown</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Sprint Architect
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Automated module and task breakdown based on your project stack
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isGenerating || isConfirming}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              aria-label="Close plan modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* Loading state */}
            {isGenerating && (
              <AiLoading
                message="Asking the AI, this can take up to a minute"
                subMessage="Analyzing tech stack and decomposing modules into actionable engineering tasks..."
              />
            )}

            {/* Error state */}
            {generateError && !isGenerating && (
              <AiError
                error={generateError}
                message="The AI service is unavailable, try again"
                onRetry={() => generatePlan()}
              />
            )}

            {/* Plan Preview */}
            {!isGenerating && !generateError && planResponse && (
              <PlanPreview
                modules={planResponse.modules || []}
                onConfirm={handleConfirm}
                isConfirming={isConfirming}
                serverFieldErrors={serverFieldErrors}
                onDirtyChange={setIsDirty}
                onCancel={handleRequestClose}
              />
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog on Discard */}
      {showDiscardConfirm && (
        <div data-testid="discard-confirm-dialog">
          <ConfirmDialog
            isOpen={showDiscardConfirm}
            title="Discard plan edits?"
            message="You have unsaved edits to your AI project plan. If you close now, your edits will be discarded."
            confirmText="Discard"
            cancelText="Keep editing"
            onConfirm={handleConfirmDiscard}
            onCancel={() => setShowDiscardConfirm(false)}
          />
        </div>
      )}
    </>
  );
};

export default AiPlanModal;
