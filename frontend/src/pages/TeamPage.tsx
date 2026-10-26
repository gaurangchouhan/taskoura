import React from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Users, Shield, UserCheck } from 'lucide-react';
import { useMembers, useCurrentMembership, useUpdateRole, useRemoveMember } from '../hooks/useMembers';
import { useAuth } from '../context/AuthContext';
import { InviteMemberForm } from '../components/members/InviteMemberForm';
import { MemberRow } from '../components/members/MemberRow';
import { Project } from '../types/project';

export const TeamPage: React.FC = () => {
  const { projectId: rawProjectId, id: rawId } = useParams<{ projectId?: string; id?: string }>();
  const outletContext = useOutletContext<{ project?: Project } | null>();
  const projectId = rawProjectId || rawId || outletContext?.project?.id || '';

  const { user } = useAuth();
  const { data: members = [], isLoading: isMembersLoading } = useMembers(projectId);
  const { isOwner } = useCurrentMembership(projectId);

  const { mutateAsync: updateRole } = useUpdateRole(projectId);
  const { mutateAsync: removeMember } = useRemoveMember(projectId);

  const ownerCount = members.filter((m) => m.role === 'Owner').length;

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateRole({ projectId, userId, role: newRole });
      toast.success('Member role updated successfully');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to update member role';
      toast.error(msg);
      throw err;
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember({ projectId, userId });
      toast.success('Member removed from project');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to remove member';
      toast.error(msg);
      throw err;
    }
  };

  if (isMembersLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs" />
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="w-48 h-6 bg-slate-200 rounded-md" />
          <div className="space-y-3 pt-2">
            <div className="w-full h-14 bg-slate-100 rounded-2xl" />
            <div className="w-full h-14 bg-slate-100 rounded-2xl" />
            <div className="w-full h-14 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Member Section (Owner only) */}
      {isOwner && (
        <section aria-label="Invite Members">
          <InviteMemberForm projectId={projectId} />
        </section>
      )}

      {/* Member List Card */}
      <section
        aria-label="Team Members"
        className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden"
      >
        {/* Card Header */}
        <div className="p-6 sm:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Project Team</h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {isOwner
                  ? 'Manage access permissions and member assignments for this project.'
                  : 'Collaborators actively contributing to this project.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-500" />
              <span className="font-medium">{ownerCount} {ownerCount === 1 ? 'Owner' : 'Owners'}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-sky-500" />
              <span className="font-medium">{members.length - ownerCount} Members</span>
            </div>
          </div>
        </div>

        {/* Member Rows */}
        {members.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">No members found in this project.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100" data-testid="members-list">
            {members.map((member) => {
              const isCurrent = Boolean(
                (user?.id && member.userId === user.id) ||
                (user?.email && member.userEmail?.toLowerCase() === user.email?.toLowerCase())
              );

              return (
                <MemberRow
                  key={member.id}
                  member={member}
                  isCurrent={isCurrent}
                  canManage={isOwner}
                  isLastOwner={member.role === 'Owner' && ownerCount <= 1}
                  onUpdateRole={handleUpdateRole}
                  onRemove={handleRemoveMember}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default TeamPage;
