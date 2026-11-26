import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, AlertTriangle, Layers, Calendar, Code2, Server, Database, CheckCircle2, Fingerprint, Loader2 } from 'lucide-react';
import { useCreateProject } from '../../hooks/useProjects';
import { useBiolockStatus, useEnrollment } from '../../hooks/useBiolock';
import { biolockService } from '../../services/biolockService';
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
  const { data: biolockStatus } = useBiolockStatus();
  const {
    step: enrollmentStep,
    errorReason: enrollmentError,
    startEnrollment,
    isEnrolling,
  } = useEnrollment();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frontendStack, setFrontendStack] = useState('');
  const [backendStack, setBackendStack] = useState('');
  const [databaseStack, setDatabaseStack] = useState('');
  const [testingStack, setTestingStack] = useState('');
  const [deadline, setDeadline] = useState('');
  const [nameError, setNameError] = useState('');
  const [biolockEnabled, setBiolockEnabled] = useState(false);

  // If enrollment fails, do not silently enable it
  useEffect(() => {
    if (enrollmentStep === 'FAILED') {
      setBiolockEnabled(false);
    }
  }, [enrollmentStep]);

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

      if (biolockEnabled && biolockStatus?.enabled) {
        try {
          await biolockService.updateProjectBiometricSetting(created.id, true);
        } catch (bioErr) {
          console.warn('Failed to enable BioLock setting on project', bioErr);
        }
      }

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
      <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-slate-100 shrink-0">
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
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer min-h-[36px]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
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

          {/* Fingerprint Security Section (Only shown when BioLock feature is enabled) */}
          {biolockStatus?.enabled && (
            <div
              data-testid="fingerprint-security-section"
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800 block">Fingerprint Security</span>
                    <span className="text-xs text-slate-500 block">
                      Require biometric verification to approve access to restricted project documents
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="biolock-toggle"
                    checked={biolockEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked && !biolockStatus.credential) {
                        if (!biolockStatus.device) {
                          toast.error('A BioLock hardware device is required. Please register one in Profile Security settings.');
                          return;
                        }
                      }
                      setBiolockEnabled(checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {biolockEnabled && (
                <div className="pt-2 border-t border-slate-200/60 text-xs">
                  {biolockStatus.credential && biolockStatus.credential.status === 'ACTIVE' ? (
                    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>Fingerprint already registered. It will be reused for this project.</span>
                    </div>
                  ) : !biolockStatus.device ? (
                    <div className="text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>BioLock device required before you can enable fingerprint security.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-slate-600">
                        No fingerprint is registered yet. Please enroll your fingerprint to enable security.
                      </p>
                      {enrollmentStep === 'IDLE' && (
                        <button
                          type="button"
                          onClick={startEnrollment}
                          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                          Enroll my fingerprint
                        </button>
                      )}
                      {isEnrolling && (
                        <div className="p-3 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                          <span>Place your finger on the device twice...</span>
                        </div>
                      )}
                      {enrollmentStep === 'FAILED' && (
                        <div className="text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl">
                          {enrollmentError || 'Enrollment failed. BioLock disabled.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          </div>

          {/* Sticky Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-white/95 backdrop-blur-xs flex items-center justify-end gap-3 shrink-0 safe-bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-5 py-2.5 min-h-[44px] text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
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
