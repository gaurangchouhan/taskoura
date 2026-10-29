import { apiClient } from '../../services/api';
import { UserProfileResponse, UpdateProfileRequest, AvatarResponse } from '../../types/profile';

/**
 * Fetch the authenticated user's profile details.
 * GET /api/users/me -> UserProfileResponse
 */
export async function getProfile(): Promise<UserProfileResponse> {
  const { data } = await apiClient.get<UserProfileResponse>('/users/me');
  return data;
}

/**
 * Update the authenticated user's profile name (existing endpoint).
 * PUT /api/users/me { name } -> UserProfileResponse
 */
export async function updateProfile({ name }: { name: string }): Promise<UserProfileResponse> {
  const { data } = await apiClient.put<UserProfileResponse>('/users/me', { name });
  return data;
}

/**
 * Full replacement of profile details.
 * PUT /api/users/me/profile -> UserProfileResponse
 */
export async function updateProfileDetails(payload: UpdateProfileRequest): Promise<UserProfileResponse> {
  const { data } = await apiClient.put<UserProfileResponse>('/users/me/profile', payload);
  return data;
}

/**
 * Upload user avatar.
 * POST /api/users/me/avatar (multipart "file") -> { avatarUrl }
 */
export async function uploadAvatar(file: File): Promise<AvatarResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<AvatarResponse>('/users/me/avatar', formData);
  return data;
}

/**
 * Delete user avatar.
 * DELETE /api/users/me/avatar -> 204
 */
export async function deleteAvatar(): Promise<void> {
  await apiClient.delete('/users/me/avatar');
}

export default {
  getProfile,
  updateProfile,
  updateProfileDetails,
  uploadAvatar,
  deleteAvatar,
};
