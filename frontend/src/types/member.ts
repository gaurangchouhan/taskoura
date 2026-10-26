export type MemberRole = 'Owner' | 'Member';

export interface ProjectMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'Owner' | 'Member' | string;
  avatarUrl?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: 'Owner' | 'Member' | string;
}

export interface UpdateRoleRequest {
  role: 'Owner' | 'Member' | string;
}
