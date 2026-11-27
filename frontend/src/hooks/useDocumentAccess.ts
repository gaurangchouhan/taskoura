import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { documentAccessService } from '../services/documentAccessService';
import { AccessState, DocumentAccessStateResponse } from '../types/biolock';

interface UseDocumentAccessProps {
  attachmentId: string;
  fileName: string;
  fileType?: string;
  restricted: boolean;
  locked: boolean;
  isProjectOwner?: boolean;
  biolockEnabled?: boolean;
}

export const useDocumentAccess = ({
  attachmentId,
  fileName,
  fileType,
  restricted,
  locked,
  isProjectOwner = false,
  biolockEnabled = false,
}: UseDocumentAccessProps) => {
  const [accessState, setAccessState] = useState<AccessState>(() => {
    if (!biolockEnabled || !restricted) return 'UNRESTRICTED';
    if (isProjectOwner) return 'LEADER';
    // For non-owners on a restricted document with BioLock enabled, default to LOCKED
    return 'LOCKED';
  });

  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestExpiresAt, setRequestExpiresAt] = useState<string | null>(null);
  const [requestSecondsRemaining, setRequestSecondsRemaining] = useState<number | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [accessSecondsRemaining, setAccessSecondsRemaining] = useState<number | null>(null);
  const [leaderNotified, setLeaderNotified] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const [isLoadingBlob, setIsLoadingBlob] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0);
  const mountedRef = useRef(true);

  // Sync initial / props changes
  useEffect(() => {
    if (!biolockEnabled || !restricted) {
      setAccessState('UNRESTRICTED');
    } else if (isProjectOwner) {
      setAccessState('LEADER');
    } else {
      // Non-owner on restricted doc: ensure we are not in UNRESTRICTED or LEADER
      setAccessState((current) => {
        if (current === 'UNRESTRICTED' || current === 'LEADER') {
          return 'LOCKED';
        }
        return current;
      });
    }
  }, [biolockEnabled, restricted, isProjectOwner]);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [stopPolling, previewUrl]);

  // Request countdown timer (1s interval)
  useEffect(() => {
    if (accessState === 'WAITING_FOR_LEADER' && requestSecondsRemaining !== null && requestSecondsRemaining > 0) {
      const interval = setInterval(() => {
        setRequestSecondsRemaining((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [accessState, requestSecondsRemaining]);

  // Access grant countdown timer (1s interval) - when expires, locks without reload!
  useEffect(() => {
    if (accessState === 'APPROVED' && accessSecondsRemaining !== null) {
      if (accessSecondsRemaining <= 0) {
        setAccessState('LOCKED');
        toast('Access grant has expired', { icon: '🔒' });
        return;
      }
      const interval = setInterval(() => {
        setAccessSecondsRemaining((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            setAccessState('LOCKED');
            toast('Access grant has expired', { icon: '🔒' });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [accessState, accessSecondsRemaining]);

  // Check initial state on mount if restricted and not owner
  useEffect(() => {
    if (!biolockEnabled || !restricted || isProjectOwner) return;

    let isSubscribed = true;
    documentAccessService
      .getAccessState(attachmentId, true)
      .then((data: DocumentAccessStateResponse) => {
        if (!isSubscribed || !mountedRef.current) return;
        if (data.state === 'APPROVED') {
          setAccessState('APPROVED');
          setAccessExpiresAt(data.accessExpiresAt || null);
          setAccessSecondsRemaining(data.secondsRemaining ?? null);
        } else if (data.state === 'PENDING') {
          setRequestId(data.requestId || null);
          setRequestExpiresAt(data.requestExpiresAt || null);
          setRequestSecondsRemaining(data.secondsRemaining ?? null);
          setDeviceOnline(data.deviceOnline !== false);
          setAccessState('WAITING_FOR_LEADER');
        } else if (data.state === 'DENIED') {
          setAccessState('DENIED');
          setFailureReason(data.failureReason || null);
        } else if (data.state === 'EXPIRED') {
          setAccessState('EXPIRED');
          setFailureReason(data.failureReason || null);
        } else if (data.state === 'LOCKED') {
          setAccessState('LOCKED');
        }
      })
      .catch(() => {
        if (isSubscribed && mountedRef.current) {
          setAccessState('LOCKED');
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [attachmentId, biolockEnabled, restricted, isProjectOwner]);

  // Polling loop for WAITING_FOR_LEADER
  useEffect(() => {
    if (accessState !== 'WAITING_FOR_LEADER') {
      stopPolling();
      return;
    }

    const poll = async () => {
      if (!mountedRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) {
        return; // Pause while tab is hidden
      }

      try {
        const res = await documentAccessService.getAccessState(attachmentId, true);
        if (!mountedRef.current) return;
        errorCountRef.current = 0;

        if (res.deviceOnline !== undefined) {
          setDeviceOnline(res.deviceOnline);
        }

        if (res.state === 'APPROVED') {
          stopPolling();
          setAccessState('APPROVED');
          setAccessExpiresAt(res.accessExpiresAt || null);
          setAccessSecondsRemaining(res.secondsRemaining ?? null);
          toast.success('Access approved by Project Leader!');
        } else if (res.state === 'DENIED') {
          stopPolling();
          setAccessState('DENIED');
          setFailureReason(res.failureReason || null);
          toast.error(`Access request denied: ${res.failureReason || 'Leader rejected'}`);
        } else if (res.state === 'EXPIRED') {
          stopPolling();
          setAccessState('EXPIRED');
          setFailureReason(res.failureReason || 'Request timed out');
        } else if (res.state === 'CANCELLED' || res.state === 'LOCKED') {
          stopPolling();
          setAccessState('LOCKED');
        } else if (res.state === 'PENDING' && res.secondsRemaining !== undefined) {
          setRequestSecondsRemaining(res.secondsRemaining);
        }
      } catch {
        errorCountRef.current += 1;
        if (errorCountRef.current > 6) {
          stopPolling();
          setAccessState('ERROR');
        }
      }
    };

    stopPolling();
    pollIntervalRef.current = setInterval(poll, 2000);

    return stopPolling;
  }, [accessState, attachmentId, stopPolling]);

  // Start requesting access
  const requestAccess = useCallback(async () => {
    setAccessState('REQUESTING');
    setFailureReason(null);
    try {
      const res = await documentAccessService.requestAccess(attachmentId);
      setRequestId(res.requestId);
      setRequestExpiresAt(res.expiresAt);
      setRequestSecondsRemaining(res.secondsRemaining ?? 120);
      setLeaderNotified(res.leaderNotified);
      setDeviceOnline(res.deviceOnline);
      setAccessState('WAITING_FOR_LEADER');
      toast.success('Access request submitted');
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
      const status = resp?.status;
      const code = resp?.data?.code as string | undefined;
      const details = resp?.data;

      if (status === 409 && code === 'BIOLOCK_REQUEST_ACTIVE') {
        const reqId = (details?.requestId as string) || null;
        const sec = (details?.secondsRemaining as number) || 120;
        setRequestId(reqId);
        setRequestSecondsRemaining(sec);
        setAccessState('WAITING_FOR_LEADER');
        toast('An access request is already active', { icon: '⏳' });
      } else if (status === 409 && code === 'BIOLOCK_DEVICE_OFFLINE') {
        setDeviceOnline(false);
        setAccessState('LOCKED');
        toast.error("The leader's BioLock device is offline. Please ask them to connect it.");
      } else if (status === 429) {
        setAccessState('LOCKED');
        toast.error('Too many access requests for this document. Please try again later.');
      } else {
        setAccessState('ERROR');
        const msg = (err as Error)?.message || 'Failed to request access';
        toast.error(msg);
      }
    }
  }, [attachmentId]);

  // Cancel access request
  const cancelRequest = useCallback(async () => {
    if (!requestId) {
      setAccessState('LOCKED');
      stopPolling();
      return;
    }
    try {
      await documentAccessService.cancelAccessRequest(requestId);
      stopPolling();
      setAccessState('LOCKED');
      setRequestId(null);
      toast.success('Access request cancelled');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to cancel request';
      toast.error(msg);
    }
  }, [requestId, stopPolling]);

  // View content (creates object URL, revokes on close)
  const viewContent = useCallback(async () => {
    setIsLoadingBlob(true);
    try {
      const blob = await documentAccessService.fetchContentBlob(attachmentId);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      // If text/image/pdf, window open or modal
      const isImg = fileType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
      const isPdf = fileType?.includes('pdf') || /\.pdf$/i.test(fileName);

      if (!isImg && !isPdf) {
        // Download directly if cannot render preview inline
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setPreviewUrl(null);
      }
    } catch (err: unknown) {
      toast.error('Failed to load document content');
    } finally {
      setIsLoadingBlob(false);
    }
  }, [attachmentId, fileName, fileType]);

  const closePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  // Download content via temporary blob object URL
  const downloadContent = useCallback(async () => {
    setIsLoadingBlob(true);
    try {
      const blob = await documentAccessService.fetchContentBlob(attachmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: unknown) {
      toast.error('Failed to download document content');
    } finally {
      setIsLoadingBlob(false);
    }
  }, [attachmentId, fileName]);

  return {
    accessState,
    requestId,
    requestSecondsRemaining,
    accessSecondsRemaining,
    leaderNotified,
    deviceOnline,
    failureReason,
    isLoadingBlob,
    previewUrl,
    requestAccess,
    cancelRequest,
    viewContent,
    closePreview,
    downloadContent,
    canAccessContent: accessState === 'LEADER' || accessState === 'UNRESTRICTED' || accessState === 'APPROVED',
  };
};
