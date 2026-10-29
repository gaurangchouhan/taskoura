import { apiClient } from './api';
import { ProjectMember, InviteMemberRequest, UpdateRoleRequest } from '../types/member';

export const getMembers = async (projectId: string): Promise<ProjectMember[]> => {
  const { data } = await apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`);
  return data;
};

export const inviteMember = async (
  projectId: string,
  payload: InviteMemberRequest
): Promise<ProjectMember> => {
  const { data } = await apiClient.post<ProjectMember>(`/projects/${projectId}/members`, payload);
  return data;
};

export const updateRole = async (
  projectId: string,
  userId: string,
  payload: UpdateRoleRequest
): Promise<ProjectMember> => {
  const { data } = await apiClient.put<ProjectMember>(
    `/projects/${projectId}/members/${userId}`,
    payload
  );
  return data;
};

export const removeMember = async (projectId: string, userId: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/members/${userId}`);
};

export const memberService = {
  getMembers,
  inviteMember,
  updateRole,
  removeMember,
};

export default memberService;
