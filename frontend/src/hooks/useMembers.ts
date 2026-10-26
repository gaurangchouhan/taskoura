import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  getMembers,
  inviteMember,
  updateRole,
  removeMember,
} from '../services/memberService';
import { ProjectMember, InviteMemberRequest, UpdateRoleRequest } from '../types/member';
import { useAuth } from '../context/AuthContext';

export const useMembers = (projectId?: string) => {
  return useQuery<ProjectMember[]>({
    queryKey: queryKeys.projects.members(projectId || ''),
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return await getMembers(projectId);
    },
    enabled: Boolean(projectId),
  });
};

export const useMemberMap = (projectId?: string): Map<string, ProjectMember> => {
  const { data: members = [] } = useMembers(projectId);

  return useMemo(() => {
    const map = new Map<string, ProjectMember>();
    members.forEach((m) => {
      map.set(m.userId, m);
    });
    // Convenience properties if inspected
    (map as any).memberMap = map;
    (map as any).data = map;
    (map as any).members = members;
    return map;
  }, [members]);
};

export interface CurrentMembershipResult {
  membership: ProjectMember | undefined;
  isOwner: boolean;
  role?: string;
  isLoading: boolean;
  isError: boolean;
  id?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export const useCurrentMembership = (projectId?: string): CurrentMembershipResult => {
  const { user } = useAuth();
  const { data: members = [], isLoading, isError } = useMembers(projectId);

  const membership = useMemo(() => {
    if (!user) return undefined;
    return members.find(
      (m) =>
        (user.id && m.userId === user.id) ||
        (user.email && m.userEmail?.toLowerCase() === user.email?.toLowerCase())
    );
  }, [members, user]);

  const isOwner = membership?.role === 'Owner';

  return {
    membership,
    isOwner,
    role: membership?.role,
    isLoading,
    isError,
    id: membership?.id,
    userId: membership?.userId,
    userName: membership?.userName,
    userEmail: membership?.userEmail,
  };
};

export const useInviteMember = (defaultProjectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    ProjectMember,
    Error,
    { projectId?: string; email: string; role?: string }
  >({
    mutationFn: (variables) => {
      const pId = variables.projectId || defaultProjectId;
      if (!pId) throw new Error('Project ID is required');
      return inviteMember(pId, {
        email: variables.email,
        role: variables.role || 'Member',
      });
    },
    onSuccess: (_, variables) => {
      const pId = variables.projectId || defaultProjectId;
      if (pId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.members(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(pId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
    },
  });
};

export const useUpdateRole = (defaultProjectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    ProjectMember,
    Error,
    { projectId?: string; userId: string; role: string }
  >({
    mutationFn: ({ projectId, userId, role }) => {
      const pId = projectId || defaultProjectId;
      if (!pId) throw new Error('Project ID is required');
      return updateRole(pId, userId, { role });
    },
    onSuccess: (_, variables) => {
      const pId = variables.projectId || defaultProjectId;
      if (pId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.members(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(pId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
    },
  });
};

export const useRemoveMember = (defaultProjectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { projectId?: string; userId: string } | string
  >({
    mutationFn: (args) => {
      const userId = typeof args === 'string' ? args : args.userId;
      const pId = typeof args === 'object' && args.projectId ? args.projectId : defaultProjectId;
      if (!pId) throw new Error('Project ID is required');
      return removeMember(pId, userId);
    },
    onSuccess: (_, args) => {
      const pId = typeof args === 'object' && args.projectId ? args.projectId : defaultProjectId;
      if (pId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.members(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(pId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
    },
  });
};

export default {
  useMembers,
  useMemberMap,
  useCurrentMembership,
  useInviteMember,
  useUpdateRole,
  useRemoveMember,
};
