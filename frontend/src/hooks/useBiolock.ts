import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { biolockService } from '../services/biolockService';
import { queryKeys } from '../lib/queryKeys';
import { BiolockStatusResponse, EnrollmentStatusResponse } from '../types/biolock';

export const useBiolockStatus = (options?: { enabled?: boolean }) => {
  return useQuery<BiolockStatusResponse>({
    queryKey: queryKeys.biolock.status(),
    queryFn: () => biolockService.getStatus(),
    staleTime: 30000,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useRegisterDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) => biolockService.registerDevice(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.biolock.status() });
    },
  });
};

export const useRotateDeviceKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => biolockService.rotateDeviceKey(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.biolock.status() });
    },
  });
};

export const useRevokeDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => biolockService.revokeDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.biolock.status() });
      toast.success('BioLock device revoked');
    },
  });
};

export const useDeleteCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => biolockService.deleteCredential(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.biolock.status() });
      toast.success('Biometric credential deleted');
    },
  });
};

export const useProjectBiometricSetting = (projectId?: string, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.biolock.projectSetting(projectId || ''),
    queryFn: () => biolockService.getProjectBiometricSetting(projectId || ''),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30000,
  });
};

export const useUpdateProjectBiometricSetting = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => biolockService.updateProjectBiometricSetting(projectId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.biolock.projectSetting(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

export type EnrollmentStep = 'IDLE' | 'STARTING' | 'WAITING_FOR_FINGERPRINT' | 'SUCCESS' | 'FAILED';

export const useEnrollment = () => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<EnrollmentStep>('IDLE');
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startEnrollment = useCallback(async () => {
    cleanup();
    activeRef.current = true;
    setStep('STARTING');
    setErrorReason(null);

    try {
      const res = await biolockService.startEnrollment();
      if (!activeRef.current) return;

      setJobId(res.jobId);
      setStep('WAITING_FOR_FINGERPRINT');

      const startTime = Date.now();
      const MAX_TIMEOUT_MS = 180000; // 3 min

      pollTimerRef.current = setInterval(async () => {
        if (!activeRef.current) {
          cleanup();
          return;
        }

        // Check if tab is hidden
        if (typeof document !== 'undefined' && document.hidden) {
          return;
        }

        if (Date.now() - startTime > MAX_TIMEOUT_MS) {
          cleanup();
          setStep('FAILED');
          setErrorReason('Enrollment timed out');
          toast.error('Enrollment timed out');
          return;
        }

        try {
          const statusRes: EnrollmentStatusResponse = await biolockService.getEnrollmentStatus(res.jobId);
          if (!activeRef.current) return;

          const jobStatus = statusRes.status?.toUpperCase();
          const outcome = statusRes.outcome?.toUpperCase();

          if (jobStatus === 'COMPLETED' && (outcome === 'ENROLLED' || outcome === 'DUPLICATE')) {
            cleanup();
            setStep('SUCCESS');
            queryClient.invalidateQueries({ queryKey: queryKeys.biolock.status() });
            toast.success('Fingerprint enrolled successfully!');
          } else if (jobStatus === 'FAILED' || jobStatus === 'EXPIRED' || jobStatus === 'CANCELLED') {
            cleanup();
            setStep('FAILED');
            const reason = statusRes.reason || 'Enrollment was not completed';
            setErrorReason(reason);
            toast.error(`Enrollment failed: ${reason}`);
          }
        } catch (err: unknown) {
          // Keep polling unless persistent failure
          console.warn('Enrollment poll error:', err);
        }
      }, 2000);
    } catch (err: unknown) {
      cleanup();
      setStep('FAILED');
      const msg = (err as Error)?.message || 'Failed to start enrollment';
      setErrorReason(msg);
      toast.error(msg);
    }
  }, [cleanup, queryClient]);

  const reset = useCallback(() => {
    cleanup();
    setStep('IDLE');
    setJobId(null);
    setErrorReason(null);
  }, [cleanup]);

  return {
    step,
    jobId,
    errorReason,
    startEnrollment,
    reset,
    isEnrolling: step === 'STARTING' || step === 'WAITING_FOR_FINGERPRINT',
  };
};
