import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, UserPlus, Fingerprint, ShieldCheck, Mail, X, AlertCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import api from '../api/client';

export interface ProjectMember {
  id: number;
  userId: number;
  userEmail?: string;
  userName?: string;
  role: string;
  joinedAt?: string;
}

export const TeamPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${projectId}/members`);
      setMembers(res.data || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingInvite(true);
    setInviteMsg(null);

    try {
      await api.post(`/projects/${projectId}/members`, {
        userEmail: inviteEmail,
        role: inviteRole,
      });
      setInviteMsg('Team member invited successfully!');
      setInviteEmail('');
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteMsg(null);
      }, 1500);
      fetchMembers();
    } catch (err) {
      setInviteMsg('Failed to invite member. Please verify user email.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  return (
    <AppShell>
      <div className="p-6 lg:p-10 w-full max-w-[1680px] mx-auto">
        {/* Navigation Tabs Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/projects" className="hover:text-[#1E2761] transition-colors font-medium">Projects</Link>
            <span>/</span>
            <span className="font-semibold text-[#1E2761]">Project #{projectId}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading font-extrabold text-2xl lg:text-3xl text-[#1E2761]">Team & Project Roles</h2>
              <p className="text-sm text-slate-500 mt-1">
                Manage team members, assign agile roles, and verify physical biometric hardware slot pairing.
              </p>
            </div>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold shadow-sm transition-all self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          </div>

          <div className="flex items-center gap-8 mt-6 border-b border-slate-200 text-sm font-semibold">
            <Link
              to={`/projects/${projectId}/board`}
              className="text-slate-500 hover:text-slate-800 pb-3 transition-colors"
            >
              Board
            </Link>
            <span className="text-[#00A896] border-b-2 border-[#00A896] pb-3 cursor-pointer font-bold">
              Team ({members.length})
            </span>
            <Link
              to={`/projects/${projectId}/dashboard`}
              className="text-slate-500 hover:text-slate-800 pb-3 transition-colors"
            >
              Analytics
            </Link>
            <Link
              to={`/projects/${projectId}/calendar`}
              className="text-slate-500 hover:text-slate-800 pb-3 transition-colors"
            >
              Calendar
            </Link>
            <Link
              to={`/projects/${projectId}/ai-planner`}
              className="text-slate-500 hover:text-slate-800 pb-3 transition-colors"
            >
              AI QA Suite
            </Link>
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F1F5FD] border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-4 px-6">Member</th>
                  <th className="py-4 px-6">Project Role</th>
                  <th className="py-4 px-6">Fingerprint Slot</th>
                  <th className="py-4 px-6">Lab Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 text-sm">
                      Loading team members...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 text-sm">
                      No members invited yet. Click "Invite Member" above.
                    </td>
                  </tr>
                ) : (
                  members.map((m, idx) => (
                    <tr key={m.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1E2761] to-[#CADCFC] text-white flex items-center justify-center font-bold text-sm uppercase shadow-2xs">
                            {m.userName?.charAt(0) || m.userEmail?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-[#1E2761] text-sm">{m.userName || 'Student Teammate'}</p>
                            <p className="text-xs text-slate-400">{m.userEmail || `User #${m.userId}`}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#F1F5FD] text-[#1E2761] border border-[#CADCFC]/60">
                          {m.role || 'Member'}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 font-mono text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md inline-flex border border-slate-200">
                          <Fingerprint className="w-4 h-4 text-[#00A896]" />
                          <span>Slot #{idx + 1}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Active Lab
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        {m.role?.toLowerCase() === 'owner' ? (
                          <span className="text-slate-400 italic text-xs">(Owner)</span>
                        ) : (
                          <button className="text-red-500 hover:text-red-700 font-semibold text-xs transition-colors">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite Member Modal (Stitch Screen 8) */}
        {isInviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E2761]/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-modal border border-slate-200 p-7">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <h3 className="font-heading font-bold text-lg text-[#1E2761]">Invite Team Member</h3>
                <button onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {inviteMsg && (
                <div className="mb-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
                  {inviteMsg}
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Role in project</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#00A896]"
                  >
                    <option value="Member">Member (Developer / QA)</option>
                    <option value="Contributor">Contributor</option>
                    <option value="Owner">Co-Owner</option>
                  </select>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  The user must have an active Taskoura account. An invitation and project access key will be linked automatically.
                </p>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInvite}
                    className="px-6 py-2.5 rounded-lg bg-[#00A896] hover:bg-[#008C7D] text-white text-sm font-semibold shadow-sm transition-all"
                  >
                    {submittingInvite ? 'Inviting...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
