import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  Wifi,
  WifiOff,
  FileLock,
  ExternalLink,
  Loader2,
  Server,
  Cpu
} from 'lucide-react';
import { useBiolockStatus, useProjectBiometricSetting, useUpdateProjectBiometricSetting } from '../../../hooks/useBiolock';
import { timeAgo } from '../../../lib/datetime';
import toast from 'react-hot-toast';

interface BioLockSetupChecklistProps {
  projectId: string;
  isOwner: boolean;
}

export const BioLockSetupChecklist: React.FC<BioLockSetupChecklistProps> = ({
  projectId,
  isOwner,
}) => {
  const { data: biolockStatus, isLoading: isStatusLoading } = useBiolockStatus({ enabled: isOwner });
  const { data: projectSetting, isLoading: isSettingLoading } = useProjectBiometricSetting(projectId, isOwner);
  const updateSettingMutation = useUpdateProjectBiometricSetting(projectId);

  const [isManuallyToggled, setIsManuallyToggled] = useState<boolean | null>(null);

  if (!isOwner) {
    return null;
  }

  // If status is loading or backend returned disabled/missing
  if (isStatusLoading || isSettingLoading) {
    return null;
  }

  const serverEnabled = Boolean(biolockStatus?.enabled);
  // If BioLock is completely disabled on server, we still show the card to the project owner to inform them
  const deviceRegistered = Boolean(biolockStatus?.device);
  const deviceOnline = Boolean(biolockStatus?.device?.online);
  const lastSeenStr = biolockStatus?.device?.lastSeenAt
    ? timeAgo(biolockStatus.device.lastSeenAt)
    : 'Never';
  const fingerprintEnrolled = biolockStatus?.credential?.status === 'ACTIVE';
  const projectProtected = Boolean(projectSetting?.enabled);
  const protectedDocsCount = projectSetting?.protectedDocumentsCount ?? 0;

  const allReady =
    serverEnabled &&
    deviceRegistered &&
    deviceOnline &&
    fingerprintEnrolled &&
    projectProtected;

  const isOpen = isManuallyToggled !== null ? isManuallyToggled : !allReady;

  const handleToggleProjectProtection = async () => {
    if (!projectProtected && !fingerprintEnrolled) {
      toast.error('You must register a device and enroll a fingerprint before enabling protection');
      return;
    }
    try {
      await updateSettingMutation.mutateAsync(!projectProtected);
      toast.success(
        !projectProtected
          ? 'BioLock protection enabled for this project'
          : 'BioLock protection disabled for this project'
      );
    } catch {
      toast.error('Failed to update project biometric protection');
    }
  };

  return (
    <div
      data-testid="biolock-setup-checklist"
      className="p-4 sm:p-5 rounded-2xl bg-white border border-indigo-100 shadow-xs mb-6 transition-all"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              allReady
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
            }`}
          >
            {allReady ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                BioLock Hardware Security
              </h3>
              <span
                data-testid="biolock-status-badge"
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  allReady
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {allReady ? 'Fully Operational' : 'Setup Incomplete'}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">
              {allReady
                ? `Protected with leader fingerprint • ${protectedDocsCount} protected document${protectedDocsCount === 1 ? '' : 's'}`
                : 'Project owner checklist for biometric approval workflow'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="toggle-checklist-button"
            onClick={() => setIsManuallyToggled(!isOpen)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label={isOpen ? 'Collapse checklist' : 'Expand checklist'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded checklist items */}
      {isOpen && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {/* 1. Server Enabled */}
            <div
              data-testid="check-server-enabled"
              className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${
                serverEnabled ? 'bg-slate-50/60 border-slate-200/80' : 'bg-rose-50/60 border-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                  1. Server BioLock Service
                </span>
                {serverEnabled ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {serverEnabled
                  ? 'Server endpoints active and ready'
                  : 'Disabled. Set BIOLOCK_ENABLED=true in backend environment.'}
              </p>
            </div>

            {/* 2. Device Registered */}
            <div
              data-testid="check-device-registered"
              className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${
                deviceRegistered ? 'bg-slate-50/60 border-slate-200/80' : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  2. ESP32 Hardware Device
                </span>
                {deviceRegistered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <p className="text-slate-500 truncate">
                  {deviceRegistered
                    ? `Device: ${biolockStatus?.device?.name || 'ESP32 BioLock'}`
                    : 'No device registered.'}
                </p>
                {!deviceRegistered && (
                  <Link
                    to="/app/profile"
                    className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-0.5 shrink-0"
                  >
                    Register <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* 3. Device Online */}
            <div
              data-testid="check-device-online"
              className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${
                deviceOnline ? 'bg-slate-50/60 border-slate-200/80' : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  {deviceOnline ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  3. Device Online Status
                </span>
                {deviceOnline ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {deviceOnline
                  ? `Online (Last heartbeat ${lastSeenStr})`
                  : `Offline. Last seen: ${lastSeenStr}. Power on ESP32 or run simulator.`}
              </p>
            </div>

            {/* 4. Fingerprint Enrolled */}
            <div
              data-testid="check-fingerprint-enrolled"
              className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${
                fingerprintEnrolled ? 'bg-slate-50/60 border-slate-200/80' : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-slate-500" />
                  4. Leader Fingerprint
                </span>
                {fingerprintEnrolled ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <p className="text-slate-500 truncate">
                  {fingerprintEnrolled
                    ? `Enrolled in sensor slot #${biolockStatus?.credential?.slot}`
                    : 'Fingerprint not enrolled.'}
                </p>
                {!fingerprintEnrolled && (
                  <Link
                    to="/app/profile"
                    className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-0.5 shrink-0"
                  >
                    Enroll <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Project-specific settings banner */}
          <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <FileLock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="font-semibold text-slate-900 block">
                  Project Biometric Protection
                </span>
                <span className="text-slate-500 text-[11px]">
                  {projectProtected
                    ? `Enabled • ${protectedDocsCount} protected document${protectedDocsCount === 1 ? '' : 's'}`
                    : 'Disabled. Team members can view documents without biometric authorization.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <label
                data-testid="toggle-project-biolock"
                className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 select-none"
              >
                <span className="text-[11px]">
                  {projectProtected ? 'Protected' : 'Unprotected'}
                </span>
                <input
                  type="checkbox"
                  checked={projectProtected}
                  onChange={handleToggleProjectProtection}
                  disabled={updateSettingMutation.isPending}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                />
                {updateSettingMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                )}
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
