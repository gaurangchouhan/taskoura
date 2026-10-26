import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { Project } from '../../types/project';
import { useDeleteProject } from '../../hooks/useProjects';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [confirmationName, setConfirmationName] = useState('');
  const { mutateAsync: deleteProject, isPending } = useDeleteProject();

  useEffect(() => {
    if (isOpen) {
      setConfirmationName('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const isExactMatch = confirmationName === project.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isExactMatch || isPending) return;

    try {
      await deleteProject(project.id);
      onClose();
    } catch {
      // 403, 404, and other error toasts and navigation are handled by useDeleteProject hook
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 id="delete-project-modal-title" className="text-lg font-bold text-slate-900">
                Delete project
              </h3>
              <p className="text-xs text-slate-500 font-medium">This action cannot be undone</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning / Consequences explanation */}
        <div className="my-5 p-4 rounded-2xl bg-rose-50/70 border border-rose-100/90 flex gap-3 text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm leading-relaxed text-rose-950">
            <span className="font-semibold block mb-1">Warning: Deletion is permanent</span>
            Tasks, comments, bugs, attachments and activity for this project will be removed from Taskoura.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="confirm-project-name"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              To confirm, type <span className="font-bold text-slate-900 select-all font-mono">"{project.name}"</span> below:
            </label>
            <input
              id="confirm-project-name"
              data-testid="delete-project-input"
              type="text"
              autoFocus
              disabled={isPending}
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder={project.name}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              data-testid="cancel-delete-project-button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="confirm-delete-project-button"
              disabled={!isExactMatch || isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              <span>{isPending ? 'Deleting...' : 'Delete project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteProjectModal;
