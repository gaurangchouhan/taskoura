import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  Cpu,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  Key,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useBiolockStatus,
  useRegisterDevice,
  useRotateDeviceKey,
  useRevokeDevice,
  useDeleteCredential,
  useEnrollment,
} from '../../../hooks/useBiolock';
import { timeAgo } from '../../../lib/datetime';

export const BioLockDeviceCard: React.FC = () => {
  const { data: biolockStatus, isLoading: isStatusLoading } = useBiolockStatus();
  const { mutateAsync: registerDevice, isPending: isRegistering } = useRegisterDevice();
  const { mutateAsync: rotateKey, isPending: isRotating } = useRotateDeviceKey();
  const { mutateAsync: revokeDevice, isPending: isRevoking } = useRevokeDevice();
  const { mutateAsync: deleteCredential, isPending: isDeletingCred } = useDeleteCredential();

  const {
    step: enrollmentStep,
    errorReason: enrollmentError,
    startEnrollment,
    reset: resetEnrollment,
    isEnrolling,
  } = useEnrollment();

  const [deviceName, setDeviceName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Modal secret strictly in memory state - cleared on modal close
  const [createdSecret, setCreatedSecret] = useState<{
    deviceId: string;
    deviceKey: string;
    isRotation?: boolean;
  } | null>(null);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Auto-scroll to card if hash matches #biolock-device-card
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#biolock-device-card') {
      const el = document.getElementById('biolock-device-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  // Hidden if feature flag is off or loading fails
  if (isStatusLoading || !biolockStatus?.enabled) {
    return null;
  }

  const device = biolockStatus.device;
  const credential = biolockStatus.credential;

  // Name validation: 3 to 40 characters
  const trimmedName = deviceName.trim();
  const isNameValid = trimmedName.length >= 3 && trimmedName.length <= 40;
  const showNameError = nameTouched && trimmedName.length > 0 && !isNameValid;

  const parseServerError = (err: unknown): string => {
    const axiosErr = err as {
      response?: {
        status?: number;
        data?: { message?: string; code?: string; details?: { deviceId?: string } };
      };
      message?: string;
    };

    const status = axiosErr?.response?.status;
    const serverMsg = axiosErr?.response?.data?.message;
    const code = axiosErr?.response?.data?.code;

    if (status === 400 || code === 'VALIDATION_FAILED') {
      return serverMsg || 'Device name must be between 3 and 40 characters.';
    }
    if (status === 409 || code === 'BIOLOCK_DEVICE_EXISTS' || code === 'ACTIVE_DEVICE_EXISTS') {
      return serverMsg || 'A BioLock device is already registered for your account. Revoke it before registering a new one.';
    }
    if (status === 429 || code === 'RATE_LIMITED') {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (status === 503 || code === 'BIOLOCK_NOT_CONFIGURED') {
      return serverMsg || 'BioLock service is not configured on the server. Please contact your administrator.';
    }
    return serverMsg || axiosErr?.message || 'Failed to register device. Please try again.';
  };

  const handleRegister = async () => {
    setNameTouched(true);
    setServerError(null);

    // Require 3 to 40 characters
    if (!isNameValid) {
      setServerError('Device name must be between 3 and 40 characters.');
      return;
    }

    try {
      const res = await registerDevice(trimmedName);
      setCreatedSecret({
        deviceId: res.deviceId,
        deviceKey: res.deviceKey,
      });
      setDeviceName('');
      setNameTouched(false);
      setServerError(null);
      toast.success('BioLock device registered successfully');
    } catch (err: unknown) {
      const msg = parseServerError(err);
      setServerError(msg);
      toast.error(msg);
    }
  };

  const handleRotateKey = async () => {
    if (!device) return;
    setServerError(null);
    try {
      const res = await rotateKey(device.id);
      setCreatedSecret({
        deviceId: res.deviceId,
        deviceKey: res.deviceKey,
        isRotation: true,
      });
      toast.success('Device key rotated successfully');
    } catch (err: unknown) {
      const msg = parseServerError(err);
      toast.error(msg);
    }
  };

  const handleRevoke = async () => {
    if (!device) return;
    try {
      await revokeDevice(device.id);
      setShowRevokeConfirm(false);
    } catch (err: unknown) {
      const msg = parseServerError(err);
      toast.error(msg);
    }
  };

  const handleDeleteCred = async () => {
    try {
      await deleteCredential();
    } catch (err: unknown) {
      const msg = parseServerError(err);
      toast.error(msg);
    }
  };

  const copyToClipboard = (text: string, type: 'id' | 'key' | 'snippet') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
    toast.success('Copied to clipboard');
  };

  const configSnippet = createdSecret
    ? `export BIOLOCK_BASE_URL=https://taskoura.onrender.com\nexport BIOLOCK_DEVICE_ID=${createdSecret.deviceId}\nexport BIOLOCK_DEVICE_KEY=${createdSecret.deviceKey}`
    : '';

  return (
    <div
      id="biolock-device-card"
      data-testid="biolock-device-card"
      className="rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4 text-slate-800 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Taskoura BioLock Hardware</h4>
            <p className="text-xs text-slate-500">
              Hardware biometric document protection via ESP32-S2 & R307S sensor
            </p>
          </div>
        </div>

        {device && (
          <span
            data-testid="device-online-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              device.online
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                device.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {device.online ? 'Device Online' : 'Device Offline'}
          </span>
        )}
      </div>

      {/* Backend Problem Warning Banner (e.g. Master Key Invalid) */}
      {biolockStatus.problem && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Server configuration notice: BioLock device registration is currently unavailable ({biolockStatus.problem}).
          </span>
        </div>
      )}

      {/* PERSISTENT MODAL FOR ONE-TIME SECRET DISPLAY */}
      {createdSecret && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            data-testid="one-time-key-alert"
            className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm sm:text-base font-bold text-slate-900">
                  {createdSecret.isRotation ? 'New Device Key Generated' : 'One-Time Device Credentials'}
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 font-medium">
                  This key is shown only once and will <strong>never be shown again</strong>. Configure it into your device firmware now.
                </p>
              </div>
            </div>

            {/* Credential Fields */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-500 block font-semibold mb-1">Device ID</span>
                <div className="flex items-center justify-between font-mono bg-white px-3 py-2 rounded-lg border border-slate-200">
                  <span className="truncate select-all text-slate-800">{createdSecret.deviceId}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdSecret.deviceId, 'id')}
                    className="ml-2 p-1 text-slate-500 hover:text-slate-800 cursor-pointer rounded-md hover:bg-slate-100 transition-colors"
                    title="Copy Device ID"
                  >
                    {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-semibold mb-1">Device Key (Hex HMAC-SHA256)</span>
                <div className="flex items-center justify-between font-mono bg-white px-3 py-2 rounded-lg border border-slate-200 break-all">
                  <span className="text-slate-900 select-all font-semibold">{createdSecret.deviceKey}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdSecret.deviceKey, 'key')}
                    className="ml-2 p-1 text-slate-500 hover:text-slate-800 cursor-pointer shrink-0 rounded-md hover:bg-slate-100 transition-colors"
                    title="Copy Device Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Copy-All Environment Block */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 font-semibold">Environment Setup (.env / export)</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(configSnippet, 'snippet')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 cursor-pointer"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied snippet</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy all</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-[11px] bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto select-all leading-relaxed">
                  {configSnippet}
                </pre>
              </div>
            </div>

            {/* Confirmation Action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                data-testid="btn-saved-keys"
                onClick={() => setCreatedSecret(null)}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                I saved these
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No device registered: Registration View (using non-form container to prevent outer form collision) */}
      {!device ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            No BioLock hardware device is currently active for your account. Register your device to begin protecting documents.
          </p>

          {serverError && (
            <div
              data-testid="biolock-server-error"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
            >
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Device name (e.g. Desk Scanner)"
                value={deviceName}
                onChange={(e) => {
                  setDeviceName(e.target.value);
                  if (serverError) setServerError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRegister();
                  }
                }}
                className={`flex-1 px-3 py-2 text-xs rounded-xl bg-white border ${
                  showNameError ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-sky-500'
                } focus:outline-hidden focus:ring-2`}
              />
              <button
                type="button"
                onClick={handleRegister}
                disabled={isRegistering || !isNameValid}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0"
              >
                {isRegistering && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Register Device
              </button>
            </div>
            <p className={`text-[11px] ${showNameError ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
              Enter a device name between 3 and 40 characters.
            </p>
          </div>
        </div>
      ) : (
        /* Device already registered */
        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200/80">
            <div>
              <span className="font-semibold text-slate-900 block">{device.name}</span>
              <span className="text-slate-500 font-mono text-[11px] block">{device.id}</span>
              <span className="text-slate-400 text-[11px] mt-0.5 block">
                Last seen: {device.lastSeenAt ? timeAgo(device.lastSeenAt) : 'Never'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRotateKey}
                disabled={isRotating}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Rotate device HMAC key"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                Rotate Key
              </button>

              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                disabled={isRevoking}
                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Revoke
              </button>
            </div>
          </div>

          {/* Fingerprint Credential Section */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-sky-600" />
                <span className="font-semibold text-slate-900">Biometric Credential</span>
              </div>

              {credential && credential.status === 'ACTIVE' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Enrolled (Slot {credential.slot})
                </span>
              ) : (
                <span className="text-slate-400">Not enrolled</span>
              )}
            </div>

            {/* If enrolled */}
            {credential && credential.status === 'ACTIVE' ? (
              <div className="flex items-center justify-between pt-1 text-slate-500">
                <span>Fingerprint template stored inside sensor slot {credential.slot}.</span>
                <button
                  type="button"
                  onClick={handleDeleteCred}
                  disabled={isDeletingCred}
                  className="text-rose-600 hover:text-rose-800 font-medium underline cursor-pointer disabled:opacity-50"
                >
                  Delete Fingerprint
                </button>
              </div>
            ) : (
              /* If not enrolled */
              <div className="space-y-3 pt-1">
                <p className="text-slate-600">
                  Enroll your fingerprint to approve member access requests for restricted documents.
                </p>

                {enrollmentStep === 'IDLE' && (
                  <button
                    type="button"
                    onClick={startEnrollment}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Fingerprint className="w-4 h-4" />
                    Enroll my fingerprint
                  </button>
                )}

                {isEnrolling && (
                  <div
                    data-testid="enrollment-progress-banner"
                    className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 space-y-2 animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-sky-600 shrink-0" />
                      <div>
                        <span className="font-bold block">
                          Place your finger on the device twice
                        </span>
                        <span className="text-xs text-sky-700">
                          Waiting for ESP32-S2 sensor response...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {enrollmentStep === 'SUCCESS' && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Fingerprint enrolled successfully!</span>
                  </div>
                )}

                {enrollmentStep === 'FAILED' && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{enrollmentError || 'Enrollment failed'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={resetEnrollment}
                      className="font-bold underline text-rose-900 cursor-pointer"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {showRevokeConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-slate-900">Revoke BioLock Device?</h4>
            </div>
            <p className="text-xs text-slate-600">
              This will revoke the active device and keys. The device will no longer be able to poll or approve document access requests.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isRevoking}
                className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Revoke Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BioLockDeviceCard;
