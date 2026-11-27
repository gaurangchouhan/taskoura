export interface BiolockDeviceStatus {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt?: string | null;
}

export interface BiometricCredentialStatus {
  id: string;
  status: 'ACTIVE' | 'UNUSED' | 'PENDING_DELETE' | 'DELETED';
  slot: number;
}

export interface BiolockStatusResponse {
  enabled: boolean;
  device?: BiolockDeviceStatus | null;
  credential?: BiometricCredentialStatus | null;
  problem?: string | null;
}

export interface DeviceRegistrationResponse {
  deviceId: string;
  deviceKey: string;
  createdAt?: string;
  keyVersion?: number;
}

export interface DeviceRotateKeyResponse {
  deviceId: string;
  deviceKey: string;
  keyVersion: number;
}

export interface EnrollmentResponse {
  jobId: string;
  status: string;
}

export interface EnrollmentStatusResponse {
  jobId: string;
  status: string;
  outcome?: string;
  reason?: string;
}

export interface ProjectBiometricSettingResponse {
  enabled: boolean;
  credentialId?: string;
  protectedDocumentsCount?: number;
}

export interface DocumentAccessRequestResponse {
  requestId: string;
  status: string;
  expiresAt: string;
  secondsRemaining?: number;
  deviceName?: string;
  leaderNotified: boolean;
  deviceOnline: boolean;
}

export type AccessState =
  | 'LEADER'
  | 'UNRESTRICTED'
  | 'LOCKED'
  | 'REQUESTING'
  | 'WAITING_FOR_LEADER'
  | 'APPROVED'
  | 'DENIED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'ERROR';

export interface DocumentAccessStateResponse {
  state: 'LEADER' | 'UNRESTRICTED' | 'LOCKED' | 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'CANCELLED';
  requestId?: string;
  requestExpiresAt?: string;
  secondsRemaining?: number;
  accessExpiresAt?: string;
  failureReason?: string;
  deviceOnline?: boolean;
}
