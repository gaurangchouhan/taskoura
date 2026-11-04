export interface NotificationPrefs {
  taskAssigned: boolean;
  deadlineReminders: boolean;
  mentions: boolean;
  projectInvites: boolean;
  statusChanges: boolean;
}

export interface UserProfileData {
  phone: string | null;
  phoneVerified: boolean;
  organization: string | null;
  department: string | null;
  jobTitle: string | null;
  graduationYear: number | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  skills: string[];
  timeZone: string | null;
  avatarUrl: string | null;
  notificationPrefs: NotificationPrefs;
}

export interface UserProvider {
  provider: string;
  email: string;
  linkedAt: string;
}

export interface OAuthProviderInfo {
  key: string;
  label: string;
  startUrl: string;
}

export interface OAuthProvidersResponse {
  providers: OAuthProviderInfo[];
}

export interface OAuthLinkStartResponse {
  url: string;
}

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  createdAt: string;
  profile: UserProfileData;
  providers: UserProvider[];
  passwordLoginEnabled?: boolean;
}

export interface UpdateProfileRequest {
  phone?: string | null;
  organization?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  graduationYear?: number | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  bio?: string | null;
  skills?: string[];
  timeZone?: string | null;
  notificationPrefs?: NotificationPrefs;
}

export interface AvatarResponse {
  avatarUrl: string;
}
