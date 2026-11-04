import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  updateProfile,
  updateProfileDetails,
  uploadAvatar,
  deleteAvatar,
  getOAuthProviders,
  startOAuthLink,
  disconnectProvider,
} from './api';
import { useAuth } from '../../context/AuthContext';
import { setStoredUser } from '../../lib/token';
import {
  UserProfileResponse,
  UpdateProfileRequest,
  OAuthProvidersResponse,
} from '../../types/profile';

export const profileQueryKeys = {
  me: ['users', 'me'] as const,
  providers: ['auth', 'oauth', 'providers'] as const,
};

/**
 * Hook to retrieve the authenticated user profile.
 */
export function useMe() {
  const { isAuthenticated } = useAuth();

  return useQuery<UserProfileResponse>({
    queryKey: profileQueryKeys.me,
    queryFn: getProfile,
    enabled: isAuthenticated,
  });
}

/**
 * Hook to fetch available OAuth providers (Google, GitHub).
 */
export function useOAuthProviders() {
  return useQuery<OAuthProvidersResponse>({
    queryKey: profileQueryKeys.providers,
    queryFn: getOAuthProviders,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to initiate linking an OAuth account.
 */
export function useStartOAuthLink() {
  return useMutation({
    mutationFn: (provider: string) => startOAuthLink(provider),
  });
}

/**
 * Hook to disconnect an OAuth provider.
 * Invalidates the 'me' query on success.
 */
export function useDisconnectProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: string) => disconnectProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
    },
  });
}

/**
 * Hook to update the user's name (existing endpoint).
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();

  return useMutation({
    mutationFn: ({ name }: { name: string }) => updateProfile({ name }),
    onSuccess: (updatedProfile) => {
      // 1. Update AuthContext state
      updateUser(updatedProfile as any);
      // 2. Explicitly persist to storage
      setStoredUser(updatedProfile as any);
      // 3. Set and invalidate query cache
      queryClient.setQueryData(profileQueryKeys.me, updatedProfile);
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
    },
  });
}

/**
 * Hook to update the user's profile details (PUT /api/users/me/profile).
 */
export function useUpdateProfileDetails() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();

  return useMutation({
    mutationFn: (payload: UpdateProfileRequest) => updateProfileDetails(payload),
    onSuccess: (updatedProfile) => {
      updateUser(updatedProfile as any);
      setStoredUser(updatedProfile as any);
      queryClient.setQueryData(profileQueryKeys.me, updatedProfile);
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
    },
  });
}

/**
 * Hook to upload an avatar (POST /api/users/me/avatar).
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const { updateUser, user } = useAuth();

  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (res) => {
      queryClient.setQueryData<UserProfileResponse>(profileQueryKeys.me, (old) => {
        if (!old) return old;
        return {
          ...old,
          profile: {
            ...old.profile,
            avatarUrl: res.avatarUrl,
          },
        };
      });
      if (user) {
        const updated = {
          ...user,
          avatarUrl: res.avatarUrl,
          profile: user.profile
            ? { ...user.profile, avatarUrl: res.avatarUrl }
            : undefined,
        };
        updateUser(updated as any);
        setStoredUser(updated as any);
      }
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
    },
  });
}

/**
 * Hook to delete an avatar (DELETE /api/users/me/avatar).
 */
export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  const { updateUser, user } = useAuth();

  return useMutation({
    mutationFn: () => deleteAvatar(),
    onSuccess: () => {
      queryClient.setQueryData<UserProfileResponse>(profileQueryKeys.me, (old) => {
        if (!old) return old;
        return {
          ...old,
          profile: {
            ...old.profile,
            avatarUrl: null,
          },
        };
      });
      if (user) {
        const updated = {
          ...user,
          avatarUrl: null,
          profile: user.profile
            ? { ...user.profile, avatarUrl: null }
            : undefined,
        };
        updateUser(updated as any);
        setStoredUser(updated as any);
      }
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.me });
    },
  });
}

export default {
  useMe,
  useOAuthProviders,
  useStartOAuthLink,
  useDisconnectProvider,
  useUpdateProfile,
  useUpdateProfileDetails,
  useUploadAvatar,
  useDeleteAvatar,
};
