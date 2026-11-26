import { apiClient } from './api';
import {
  BiolockStatusResponse,
  DeviceRegistrationResponse,
  DeviceRotateKeyResponse,
  EnrollmentResponse,
  EnrollmentStatusResponse,
  ProjectBiometricSettingResponse,
} from '../types/biolock';

export const biolockService = {
  getStatus: async (): Promise<BiolockStatusResponse> => {
    try {
      const { data } = await apiClient.get<BiolockStatusResponse>('/biolock/status');
      return data || { enabled: false };
    } catch (err: unknown) {
      // If 404 or backend BioLock is off/unsupported, fail gracefully
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 400) {
        return { enabled: false };
      }
      throw err;
    }
  },

  registerDevice: async (name?: string): Promise<DeviceRegistrationResponse> => {
    const { data } = await apiClient.post<DeviceRegistrationResponse>('/biolock/devices', {
      name: name?.trim() || undefined,
    });
    return data;
  },

  rotateDeviceKey: async (deviceId: string): Promise<DeviceRotateKeyResponse> => {
    const { data } = await apiClient.post<DeviceRotateKeyResponse>(`/biolock/devices/${deviceId}/rotate-key`);
    return data;
  },

  revokeDevice: async (deviceId: string): Promise<void> => {
    await apiClient.delete(`/biolock/devices/${deviceId}`);
  },

  startEnrollment: async (): Promise<EnrollmentResponse> => {
    const { data } = await apiClient.post<EnrollmentResponse>('/biolock/enrollment');
    return data;
  },

  getEnrollmentStatus: async (jobId: string): Promise<EnrollmentStatusResponse> => {
    const { data } = await apiClient.get<EnrollmentStatusResponse>(`/biolock/enrollment/${jobId}`);
    return data;
  },

  deleteCredential: async (): Promise<void> => {
    await apiClient.delete('/biolock/credential');
  },

  getProjectBiometricSetting: async (projectId: string): Promise<ProjectBiometricSettingResponse> => {
    const { data } = await apiClient.get<ProjectBiometricSettingResponse>(`/projects/${projectId}/biolock`);
    return data;
  },

  updateProjectBiometricSetting: async (
    projectId: string,
    enabled: boolean
  ): Promise<ProjectBiometricSettingResponse> => {
    const { data } = await apiClient.put<ProjectBiometricSettingResponse>(`/projects/${projectId}/biolock`, {
      enabled,
    });
    return data;
  },
};

export default biolockService;
