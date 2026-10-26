import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, AlertTriangle, Layers, Calendar, Code2, Server, Database, CheckCircle2 } from 'lucide-react';
import { useCreateProject } from '../../hooks/useProjects';
import { Project } from '../../types/project';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (project: Project) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const { mutateAsync: createProject, isPending } = useCreateProject();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frontendStack, setFrontendStack] = useState('');
  const [backendStack, setBackendStack] = useState('');
  const [databaseStack, setDatabaseStack] = useState('');
  const [testingStack, setTestingStack] = useState('');
  const [deadline, setDeadline] = useState('');
  const [nameError, setNameError] = useState('');

  if (!isOpen) return null;

  const isDeadlineInPast = (dateStr: string): boolean => {
    if (!dateStr) return false;
    // Normalize to date comparison without time
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return false;
    const selectedDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate < today;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (e.target.value.trim()) {
      setNameError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Project title is required');
      return;
    }

    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        frontendStack: frontendStack.trim() || undefined,
        backendStack: backendStack.trim() || undefined,
        databaseStack: databaseStack.trim() || undefined,
        testingStack: testingStack.trim() || undefined,
        deadline: deadline || undefined,
      });

      toast.success('Project created successfully');
      setName('');
      setDescription('');
      setFrontendStack('');
      setBackendStack('');
      setDatabaseStack('');
      setTestingStack('');
      setDeadline('');
      setNameError('');

      onClose();
      if (onSuccess) {
        onSuccess(created);
      }
      navigate(`/app/projects/${created.id}`);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Failed to create project';
      toast.error(message);
    }
  };

  const hasPastDeadline = isDeadlineInPast(deadline);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 id="modal-title" className="text-xl font-bold text-slate-900">
              Create New Project
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Set project name, stack architecture, and target release milestone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-5">
          {/* Project Title (Required) */}
          <div>
            <label htmlFor="projectName" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Project Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="projectName"
              type="text"
              required
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Distributed Payment Engine"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-colors ${
                nameError
                  ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                  : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
              }`}
            />
            {nameError && (
              <p className="text-xs text-rose-500 mt-1 font-medium">{nameError}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="projectDescription" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              id="projectDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline feature objectives, technical scope, and team goals..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Frontend & Backend Stack Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="frontendStack" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Frontend Stack
              </label>
              <input
                id="frontendStack"
                type="text"
                value={frontendStack}
                onChange={(e) => setFrontendStack(e.target.value)}
                placeholder="e.g. React + TypeScript"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="backendStack" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Backend Stack
              </label>
              <input
                id="backendStack"
                type="text"
                value={backendStack}
                onChange={(e) => setBackendStack(e.target.value)}
                placeholder="e.g. Spring Boot 3.4"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Database & Testing Stack Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="databaseStack" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Database Stack
              </label>
              <input
                id="databaseStack"
                type="text"
                value={databaseStack}
                onChange={(e) => setDatabaseStack(e.target.value)}
                placeholder="e.g. PostgreSQL 16"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="testingStack" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Testing Stack
              </label>
              <input
                id="testingStack"
                type="text"
                value={testingStack}
                onChange={(e) => setTestingStack(e.target.value)}
                placeholder="e.g. JUnit 5 + Mockito"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Milestone Deadline with past warning */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="deadline" className="block text-sm font-semibold text-slate-700">
                Milestone Deadline
              </label>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full h-11 pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors cursor-pointer shadow-xs"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 absolute right-2.5 transition-colors cursor-pointer"
                  title="Clear date"
                  aria-label="Clear date"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {hasPastDeadline && (
              <div
                data-testid="deadline-warning"
                className="flex items-center gap-2 text-sm text-amber-800 font-medium mt-2 bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-xl animate-fade-in"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Warning: The selected deadline date is in the past.</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {isPending ? 'Creating...' : 'Initialize Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
