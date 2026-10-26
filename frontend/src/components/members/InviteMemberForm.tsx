import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Mail, AlertCircle, ChevronDown } from 'lucide-react';
import { useInviteMember } from '../../hooks/useMembers';
import { ProjectMember } from '../../types/member';
import { getErrorMessage } from '../../lib/errors';

interface InviteMemberFormProps {
  projectId: string;
  onMemberInvited?: (member: ProjectMember) => void;
}

export const InviteMemberForm: React.FC<InviteMemberFormProps> = ({
  projectId,
  onMemberInvited,
}) => {
  const { mutateAsync: inviteMember, isPending } = useInviteMember(projectId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Owner' | 'Member'>('Member');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isPending) return;

    setErrorMessage('');

    try {
      const created = await inviteMember({
        projectId,
        email: email.trim(),
        role,
      });

      toast.success(`${created.userName || created.userEmail} has been added to the team.`);
      setEmail('');
      setRole('Member');
      setErrorMessage('');
      if (onMemberInvited) {
        onMemberInvited(created);
      }
    } catch (err: unknown) {
      const axErr = err as {
        response?: {
          status?: number;
          data?: unknown;
        };
        message?: string;
      };

      const status = axErr.response?.status;
      const data = axErr.response?.data as { message?: string; error?: string } | undefined;
      const rawMsg = data?.message || axErr.message || '';

      if (status === 404 || rawMsg.toLowerCase().includes('not found')) {
        setErrorMessage('No user found with this email');
        toast.error('No user found with this email');
      } else if (status === 409 || rawMsg.toLowerCase().includes('already')) {
        setErrorMessage('This person is already on the team');
        toast.error('This person is already on the team');
      } else {
        const fallbackMsg = getErrorMessage(err);
        setErrorMessage(fallbackMsg);
        toast.error(fallbackMsg);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Invite Team Member</h2>
          <p className="text-sm text-slate-500">
            Invite a registered user to collaborate on this workspace.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Email input */}
          <div className="sm:col-span-6">
            <label htmlFor="invite-email" className="block text-sm font-semibold text-slate-700 mb-1.5 leading-none">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="colleague@example.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Role select (Owner and Member only) */}
          <div className="sm:col-span-3">
            <label htmlFor="invite-role" className="block text-sm font-semibold text-slate-700 mb-1.5 leading-none">
              Role
            </label>
            <div className="relative">
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'Owner' | 'Member')}
                className="w-full h-11 appearance-none pl-3.5 pr-8 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none bg-white transition-colors cursor-pointer"
              >
                <option value="Member">Member</option>
                <option value="Owner">Owner</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Submit button */}
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="w-full h-11 px-5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>{isPending ? 'Inviting...' : 'Invite Member'}</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="invite-error"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium flex items-center gap-2 animate-fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default InviteMemberForm;
