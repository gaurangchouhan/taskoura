import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Trash2, 
  AlertTriangle, 
  X, 
  Check, 
  UserCheck 
} from 'lucide-react';
import { ProjectMember } from '../../types/member';
import { Avatar } from '../common/Avatar';

interface MemberRowProps {
  member: ProjectMember;
  isCurrent: boolean;
  canManage: boolean;
  isLastOwner: boolean;
  onUpdateRole: (userId: string, newRole: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

export const MemberRow: React.FC<MemberRowProps> = ({
  member,
  isCurrent,
  canManage,
  isLastOwner,
  onUpdateRole,
  onRemove,
}) => {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);

  const [selectedRole, setSelectedRole] = useState<'Owner' | 'Member'>(
    (member.role as 'Owner' | 'Member') || 'Member'
  );
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [isSubmittingRemove, setIsSubmittingRemove] = useState(false);

  // Determine initials
  const getInitials = (name?: string, email?: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const initials = getInitials(member.userName, member.userEmail);

  // Removal restrictions
  const isSelf = isCurrent;
  const isOnlyOwner = member.role === 'Owner' && isLastOwner;
  const cannotRemove = isSelf || isOnlyOwner;
  const removeExplanation = isSelf
    ? 'You cannot remove yourself from the project'
    : isOnlyOwner
    ? 'Cannot remove the last Owner of the project'
    : undefined;

  // Handle role change submit
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRole || selectedRole === member.role) {
      setIsRoleModalOpen(false);
      return;
    }

    if (isOnlyOwner && selectedRole === 'Member') {
      return;
    }

    setIsSubmittingRole(true);
    try {
      await onUpdateRole(member.userId, selectedRole);
      setIsRoleModalOpen(false);
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Handle remove submit
  const handleRemoveConfirm = async () => {
    if (cannotRemove || isSubmittingRemove) return;

    setIsSubmittingRemove(true);
    try {
      await onRemove(member.userId);
      setIsRemoveModalOpen(false);
    } finally {
      setIsSubmittingRemove(false);
    }
  };

  return (
    <>
      <div
        data-testid={`member-row-${member.userId}`}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-b-0 gap-3"
      >
        {/* User Info (Avatar + Name + Email) */}
        <div className="flex items-center gap-3.5 min-w-0">
          <Avatar
            src={member.avatarUrl}
            name={member.userName}
            email={member.userEmail}
            size="md"
            className="rounded-2xl shadow-xs tracking-wider"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 truncate">
                {member.userName || member.userEmail}
              </span>

              {isCurrent && (
                <span
                  data-testid="you-badge"
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0"
                >
                  You
                </span>
              )}
            </div>

            <p className="text-sm text-slate-500 truncate mt-0.5">
              {member.userEmail}
            </p>
          </div>
        </div>

        {/* Role & Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0">
          {/* Role badge */}
          {member.role === 'Owner' ? (
            <span
              data-testid="role-badge"
              className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Owner</span>
            </span>
          ) : (
            <span
              data-testid="role-badge"
              className="text-xs font-semibold px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>{member.role || 'Member'}</span>
            </span>
          )}

          {/* Explanation if removal is blocked (for Owner viewing) */}
          {canManage && removeExplanation && (
            <span
              data-testid="remove-blocked-explanation"
              className="hidden lg:inline-block text-xs text-slate-400 font-medium"
            >
              {removeExplanation}
            </span>
          )}

          {/* Management Controls (Owner Only) */}
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole((member.role as 'Owner' | 'Member') || 'Member');
                  setIsRoleModalOpen(true);
                }}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-colors cursor-pointer"
              >
                Change role
              </button>

              <button
                type="button"
                disabled={cannotRemove}
                title={removeExplanation}
                onClick={() => setIsRemoveModalOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change Role Modal */}
      {isRoleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingRole) {
              setIsRoleModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 id="role-modal-title" className="text-lg font-bold text-slate-900">
                  Change Member Role
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update permissions for <strong className="text-slate-800">{member.userName || member.userEmail}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                disabled={isSubmittingRole}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="change-role-select" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Select Role
                </label>
                <select
                  id="change-role-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'Owner' | 'Member')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white transition-colors cursor-pointer"
                >
                  <option value="Member">Member</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>

              {isOnlyOwner && selectedRole === 'Member' && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Cannot demote the last Owner of the project. Assign another Owner first.
                  </span>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  disabled={isSubmittingRole}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole || (isOnlyOwner && selectedRole === 'Member')}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingRole ? 'Saving...' : 'Save Role'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Removal Modal */}
      {isRemoveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingRemove) {
              setIsRemoveModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="remove-modal-title" className="text-base font-bold text-slate-900">
                    {cannotRemove ? 'Cannot Remove Member' : 'Remove Team Member'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {cannotRemove ? 'Action not allowed' : 'Confirm removal from project'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRemoveModalOpen(false)}
                disabled={isSubmittingRemove}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-sm text-slate-600 leading-relaxed">
              {cannotRemove ? (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="font-medium">
                    {removeExplanation || 'This member cannot be removed.'}
                  </p>
                </div>
              ) : (
                <p>
                  Are you sure you want to remove{' '}
                  <strong className="text-slate-900">{member.userName}</strong> (
                  {member.userEmail}) from this project? They will lose access to all
                  tasks, boards, and workspace settings.
                </p>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => setIsRemoveModalOpen(false)}
                disabled={isSubmittingRemove}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                {cannotRemove ? 'Close' : 'Cancel'}
              </button>
              {!cannotRemove && (
                <button
                  type="button"
                  onClick={handleRemoveConfirm}
                  disabled={isSubmittingRemove}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isSubmittingRemove ? 'Removing...' : 'Confirm Remove'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MemberRow;
