import React, { useState } from 'react';
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
  const [createdSecret, setCreatedSecret] = useState<{
    deviceId: string;
    deviceKey: string;
    isRotation?: boolean;
  } | null>(null);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Hidden if feature flag is off or loading fails
  if (isStatusLoading || !biolockStatus?.enabled) {
    return null;
  }

  const device = biolockStatus.device;
  const credential = biolockStatus.credential;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await registerDevice(deviceName.trim() || undefined);
      setCreatedSecret({
        deviceId: res.deviceId,
        deviceKey: res.deviceKey,
      });
      setDeviceName('');
      toast.success('BioLock device registered successfully');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to register device';
      toast.error(msg);
    }
  };

  const handleRotateKey = async () => {
    if (!device) return;
    try {
      const res = await rotateKey(device.id);
      setCreatedSecret({
        deviceId: res.deviceId,
        deviceKey: res.deviceKey,
        isRotation: true,
      });
      toast.success('Device key rotated successfully');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to rotate key';
      toast.error(msg);
    }
  };

  const handleRevoke = async () => {
    if (!device) return;
    try {
      await revokeDevice(device.id);
      setShowRevokeConfirm(false);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to revoke device';
      toast.error(msg);
    }
  };

  const handleDeleteCred = async () => {
    try {
      await deleteCredential();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to delete credential';
      toast.error(msg);
    }
  };

  const copyToClipboard = (text: string, type: 'id' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
    toast.success('Copied to clipboard');
  };

  return (
    <div
      data-testid="biolock-device-card"
      className="rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4 text-slate-800"
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

      {/* One-time Key Display Modal / Banner */}
      {createdSecret && (
        <div
          data-testid="one-time-key-alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3 animate-fade-in"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                {createdSecret.isRotation ? 'New Device Key Generated' : 'One-Time Device Key'}
              </h5>
              <p className="text-xs text-amber-800 mt-0.5">
                Save this key now. It is derived securely and will <strong>never be shown again</strong>.
                Configure it into your device firmware.
              </p>
            </div>
          </div>

          <div className="space-y-2 bg-white/80 p-3 rounded-lg border border-amber-200 text-xs">
            <div>
              <span className="text-slate-500 block font-medium mb-0.5">Device ID:</span>
              <div className="flex items-center justify-between font-mono bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200">
                <span className="truncate">{createdSecret.deviceId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdSecret.deviceId, 'id')}
                  className="ml-2 text-slate-500 hover:text-slate-800 cursor-pointer"
                  title="Copy Device ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block font-medium mb-0.5">Hex Device Key:</span>
              <div className="flex items-center justify-between font-mono bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200 break-all">
                <span className="text-slate-900 select-all">{createdSecret.deviceKey}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdSecret.deviceKey, 'key')}
                  className="ml-2 text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
                  title="Copy Device Key"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => setCreatedSecret(null)}
              className="text-xs font-semibold px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-md transition-colors"
            >
              I have safely copied my key
            </button>
          </div>
        </div>
      )}

      {/* No device registered: Registration Form */}
      {!device ? (
        <form onSubmit={handleRegister} className="space-y-3">
          <p className="text-xs text-slate-600">
            No BioLock hardware device is currently active for your account. Register your device to begin protecting documents.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Device name (e.g. Desk Scanner)"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={isRegistering}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
            >
              {isRegistering && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Register Device
            </button>
          </div>
        </form>
      ) : (
        /* Device already registered */
        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200/80">
            <div>
              <span className="font-semibold text-slate-900 block">{device.name}</span>
              <span className="text-slate-500 font-mono text-[11px]">{device.id}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRotateKey}
                disabled={isRotating}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition-colors flex items-center gap-1"
                title="Rotate device HMAC key"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                Rotate Key
              </button>

              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                disabled={isRevoking}
                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium transition-colors flex items-center gap-1"
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
                  className="text-rose-600 hover:text-rose-800 font-medium underline"
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
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
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
                      className="font-bold underline text-rose-900"
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
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isRevoking}
                className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors"
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
